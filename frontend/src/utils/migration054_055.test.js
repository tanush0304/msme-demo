// 054 / 055 demo migration files: structure + security checks (the files are
// run by hand in the Supabase SQL editor -- every statement must stand alone).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name) => readFileSync(new URL(`../../../backend/migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// statements only (comment lines dropped)
const codeOf = (sql) => sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
const functionsOf = (code) => [...code.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => ({ name: m[1], args: m[2] }))
const argTypes = (args) => args.split(',').map((a) => a.trim().split(/\s+/).slice(1).join(' ')).filter(Boolean).join(', ')

const FILES = {
  '054': read('054_quality_jobwork_receipt.sql'),
  '055': read('055_jobwork_qc_gate.sql'),
}

describe.each(Object.entries(FILES))('%s migration file', (_, sql) => {
  const code = codeOf(sql)

  it('has PREVIEW, CHANGE, VERIFICATION and ROLLBACK in that order', () => {
    const at = ['PREVIEW', 'CHANGE', 'VERIFICATION', 'ROLLBACK'].map((h) => sql.search(new RegExp(`-{10,} ${h}`)))
    at.forEach((i) => expect(i).toBeGreaterThan(-1))
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('no begin/commit, no temp tables, no security definer', () => {
    expect(code).not.toMatch(/\b(begin|commit)\s*;\s*$/im)
    expect(code).not.toMatch(/temp(orary)?\s+table|on commit drop/i)
    expect(code).not.toMatch(/security\s+definer/i)
  })

  it('every function: EXECUTE revoked from public + anon, granted to authenticated', () => {
    const fns = functionsOf(code)
    expect(fns.length).toBeGreaterThan(0)
    for (const { name, args } of fns) {
      const sig = `public.${name}(${argTypes(args)})`.replace(/[.()]/g, '\\$&')
      expect(code).toMatch(new RegExp(`revoke all on function ${sig} from public, anon;`))
      expect(code).toMatch(new RegExp(`grant execute on function ${sig} to authenticated, service_role;`))
    }
  })

  it('no client name', () => {
    expect(sql).not.toMatch(/bml[h]/i)
  })
})

describe('054 specifics', () => {
  const sql = FILES['054']
  it('PREVIEW checks the job work master key (p / u) before the FK', () => {
    const preview = sql.slice(sql.search(/-{10,} PREVIEW/), sql.search(/-{10,} CHANGE/))
    expect(preview).toMatch(/contype in \('p', 'u'\)/)
    expect(preview).toMatch(/"job work master"/)
  })
})

describe('055 specifics', () => {
  const sql = FILES['055']
  const code = codeOf(sql)
  it('PREVIEW prints the live guard_app_settings body', () => {
    const preview = sql.slice(sql.search(/-{10,} PREVIEW/), sql.search(/-{10,} CHANGE/))
    expect(preview).toMatch(/pg_get_functiondef\('public\.guard_app_settings\(\)'::regprocedure\)/)
  })
  it("seeds the gate 'off' without overwriting existing values", () => {
    expect(code).toMatch(/\('jobwork_qc_gate_mode', 'off'\)/)
    expect(code).toMatch(/on conflict \(key\) do nothing/)
  })
  it('overrides table: RLS on, authenticated SELECT + INSERT only, nothing for anon', () => {
    expect(code).toMatch(/revoke all on table public\."jobwork qc overrides" from public, anon, authenticated;/)
    expect(code).toMatch(/grant select, insert on table public\."jobwork qc overrides" to authenticated;/)
    expect(code).toMatch(/alter table public\."jobwork qc overrides" enable row level security;/)
    expect(code).not.toMatch(/grant [^;]*(update|delete)[^;]*"jobwork qc overrides"[^;]*to authenticated/i)
    expect(code).not.toMatch(/grant [^;]*"jobwork qc overrides"[^;]*to (anon|public)\b/i)
  })
})
