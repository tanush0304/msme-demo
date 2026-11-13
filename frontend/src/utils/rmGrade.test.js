// Raw Material Grade (041) + existing diameter_mm: labels, save payload,
// report filter, and the "column missing" detection used before 041 runs.
import { describe, it, expect } from 'vitest'
import { rmSpec, withRmSpec, rmOptionLabel } from './rmLabel'
import { rawMaterialPayload } from './rawMaterialSave'
import { rmMatchesFilters } from './reportStock'
import { isMissingColumnError } from '../data/queries/rawMaterials'

describe('rmSpec / rmOptionLabel', () => {
  it('shows "Grade · ØDia" only for what is filled', () => {
    expect(rmSpec({ grade: 'EN8', diameter_mm: '50' })).toBe('EN8 · Ø50')
    expect(rmSpec({ grade: ' EN8 ', diameter_mm: '' })).toBe('EN8')
    expect(rmSpec({ grade: null, diameter_mm: 50.0 })).toBe('Ø50')
    expect(rmSpec({ diameter_mm: '50.5' })).toBe('Ø50.5')
    expect(rmSpec({ grade: '', diameter_mm: null })).toBe('')
    expect(rmSpec({})).toBe('') // before 041: no grade key at all
  })

  it('keeps the old label when no grade / dia', () => {
    expect(rmOptionLabel({ raw_material_code: 'RM-1', raw_material_name: 'EN8 Bar' })).toBe('RM-1 – EN8 Bar')
    expect(rmOptionLabel({ raw_material_code: 'RM-1' })).toBe('RM-1')
    expect(withRmSpec('EN8 Bar', {})).toBe('EN8 Bar')
  })

  it('appends the spec next to the code / name', () => {
    const rm = { raw_material_code: 'EN8-D50', raw_material_name: 'Bar', grade: 'EN8', diameter_mm: '50' }
    expect(rmOptionLabel(rm)).toBe('EN8-D50 – Bar (EN8 · Ø50)')
    expect(rmOptionLabel(rm, ' - ')).toBe('EN8-D50 - Bar (EN8 · Ø50)')
    expect(withRmSpec('Bar', rm)).toBe('Bar (EN8 · Ø50)')
  })
})

describe('rawMaterialPayload grade', () => {
  const form = { raw_material_code: 'RM-1', raw_material_name: 'Bar', grade: ' EN8 ', diameter_mm: '50', opening_stock: '' }

  it('drops grade before 041 (column missing) -- never sends it', () => {
    expect(rawMaterialPayload(form)).not.toHaveProperty('grade')
    expect(rawMaterialPayload(form, { gradeSupported: false })).not.toHaveProperty('grade')
  })

  it('sends trimmed grade, blank -> null, once 041 is run', () => {
    expect(rawMaterialPayload(form, { gradeSupported: true }).grade).toBe('EN8')
    expect(rawMaterialPayload({ ...form, grade: '  ' }, { gradeSupported: true }).grade).toBeNull()
    expect(rawMaterialPayload({ raw_material_code: 'RM-1' }, { gradeSupported: true }).grade).toBeNull()
  })

  it('keeps diameter_mm and the existing rules', () => {
    const p = rawMaterialPayload(form, { gradeSupported: true })
    expect(p.diameter_mm).toBe('50')
    expect(p.opening_stock).toBe(0)
    expect(p.rm_source).toBeNull()
  })
})

describe('rmMatchesFilters grade', () => {
  const rm = { raw_material_code: 'RM-1', grade: 'EN8', rm_type: 'Bar' }
  it('filters by grade, blank = all', () => {
    expect(rmMatchesFilters(rm, { grade: 'EN8' })).toBe(true)
    expect(rmMatchesFilters(rm, { grade: 'EN19' })).toBe(false)
    expect(rmMatchesFilters({ raw_material_code: 'RM-2' }, { grade: 'EN8' })).toBe(false)
    expect(rmMatchesFilters(rm, { grade: '' })).toBe(true)
    expect(rmMatchesFilters(rm, { grade: 'EN8', rmType: 'Plate' })).toBe(false)
  })
})

describe('isMissingColumnError', () => {
  it('recognises the PostgREST / Postgres missing-column errors', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column raw materials master.grade does not exist' })).toBe(true)
    expect(isMissingColumnError({ code: 'PGRST204', message: "Could not find the 'grade' column" })).toBe(true)
    expect(isMissingColumnError({ message: 'column "grade" does not exist' })).toBe(true)
  })
  it('does not treat other errors as missing column', () => {
    expect(isMissingColumnError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingColumnError({ message: 'Failed to fetch' })).toBe(false)
  })
})
