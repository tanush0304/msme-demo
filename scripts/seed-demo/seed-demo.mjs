#!/usr/bin/env node
// Seeds the Msme-demo Supabase project with fictional demo data (data.mjs)
// by signing in as the demo users -- anon key + login only, so every RLS
// policy and guard trigger runs exactly as it does for the app. Writes go
// through the app's own data layer (frontend/src/data/queries, see
// loader.mjs), so payloads are the ones the screens send.
//
//   node scripts/seed-demo/seed-demo.mjs --dry-run           offline: counts, dates, checks
//   node scripts/seed-demo/seed-demo.mjs --phase 1           admin: masters, orders, GRNs
//   node scripts/seed-demo/seed-demo.mjs --phase 2           supervisor: planning + RM issues, then STOP
//   (run the printed linking SQL yourself)
//   node scripts/seed-demo/seed-demo.mjs --phase 3           operator: production logs
//   node scripts/seed-demo/seed-demo.mjs --phase 4           supervisor: approvals, stores, jobwork, quality ...
//   node scripts/seed-demo/seed-demo.mjs --phase 5 [--wave T1]   top-up: a fresh wave over the last ~21 days
//   node scripts/seed-demo/seed-demo.mjs --dry-run --phase 5 [--wave T1]   offline plan of that wave
//   node scripts/seed-demo/seed-demo.mjs --check [--wave T1]   read-only Phase 5 preflight (codes, routes, open logs)
//   node scripts/seed-demo/seed-demo.mjs --refresh           how to re-run Phase 5 later (text only)
//
// Config: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from frontend/.env;
// DEMO_PROJECT_REF and DEMO_{ADMIN,SUPERVISOR,OPERATOR}_{EMAIL,PASSWORD}
// from frontend/.env.test (falls back to .env). Values are never printed.
// Aborts unless the URL host starts with DEMO_PROJECT_REF. Never uses SQL,
// a DB password or a service key. Idempotent: rows whose key (natural key,
// or the identifying columns of a transaction) already exist are skipped.
// The first refusal from the database stops the run and is reported as is.
import fs from 'node:fs'
import path from 'node:path'
import { register, createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as D from './data.mjs'
import { topUpDataset, anchorFromPoDate, ANCHOR_PO_W } from './data-topup.mjs'

/** The dataset the phase code writes: data.mjs for Phases 1-4, a top-up wave for Phase 5. */
let X = D

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const FRONTEND = path.join(ROOT, 'frontend')
const SRC = path.join(FRONTEND, 'src')

// ---- args -------------------------------------------------------------------

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const phaseArg = argv.includes('--phase') ? Number(argv[argv.indexOf('--phase') + 1]) : null
const WAVE = argv.includes('--wave') ? String(argv[argv.indexOf('--wave') + 1] ?? '') : 'T1'
const REFRESH = argv.includes('--refresh')
const CHECK = argv.includes('--check')
if (!/^T\d{1,3}$/.test(WAVE)) {
  console.error('--wave must look like T1, T2, ... (it becomes part of the wave PO numbers)')
  process.exit(2)
}
if (!DRY_RUN && !REFRESH && !CHECK && ![1, 2, 3, 4, 5].includes(phaseArg)) {
  console.error('Usage: node scripts/seed-demo/seed-demo.mjs --phase <1|2|3|4|5> [--wave T1]   (or --dry-run [--phase 5], --refresh)')
  process.exit(2)
}

// ---- counters + failure reporting ---------------------------------------------

const counts = new Map() // table -> { inserted, skipped }
const tally = (table, kind, n = 1) => {
  const row = counts.get(table) ?? { inserted: 0, skipped: 0 }
  row[kind] += n
  counts.set(table, row)
}
function printCounts(title) {
  console.log(`\n${title}`)
  const rows = [...counts.entries()]
  const width = Math.max(28, ...rows.map(([t]) => t.length))
  console.log(`  ${'table / action'.padEnd(width)}  inserted  skipped`)
  for (const [table, c] of rows) console.log(`  ${table.padEnd(width)}  ${String(c.inserted).padStart(8)}  ${String(c.skipped).padStart(7)}`)
}

class Stop extends Error {}
/** Runs one write; on any error prints step + table + the database's own message and stops the run. */
async function step(label, table, fn) {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof Stop) throw error
    console.error(`\nSTOPPED at: ${label}  [${table}]`)
    console.error(`  database said: ${error.message}`)
    for (const k of ['code', 'details', 'hint']) if (error[k]) console.error(`  ${k}: ${error[k]}`)
    console.error('  Nothing after this step was attempted. No workaround was tried.')
    printCounts('Rows written before the stop:')
    throw new Stop()
  }
}
const fail = (message) => {
  console.error(`\nSTOPPED: ${message}`)
  printCounts('Rows written before the stop:')
  throw new Stop()
}

// ---- env (values never printed) ------------------------------------------------

function readEnvFile(file) {
  const full = path.join(FRONTEND, file)
  if (!fs.existsSync(full)) return {}
  const out = {}
  for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}
function loadConfig() {
  const env = { ...readEnvFile('.env'), ...readEnvFile('.env.test') }
  const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'DEMO_PROJECT_REF',
    'DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD', 'DEMO_SUPERVISOR_EMAIL', 'DEMO_SUPERVISOR_PASSWORD',
    'DEMO_OPERATOR_EMAIL', 'DEMO_OPERATOR_PASSWORD']
  const missing = need.filter((k) => !env[k])
  if (missing.length) fail(`missing in frontend/.env / .env.test: ${missing.join(', ')}`)
  const ref = env.DEMO_PROJECT_REF
  let host
  try {
    host = new URL(env.VITE_SUPABASE_URL).hostname
  } catch {
    fail('VITE_SUPABASE_URL is not a valid URL')
  }
  if (ref.length < 8 || !host.startsWith(ref)) fail('VITE_SUPABASE_URL host does not start with DEMO_PROJECT_REF -- refusing to touch a non-demo project.')
  return {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    logins: {
      admin: { email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD },
      supervisor: { email: env.DEMO_SUPERVISOR_EMAIL, password: env.DEMO_SUPERVISOR_PASSWORD },
      operator: { email: env.DEMO_OPERATOR_EMAIL, password: env.DEMO_OPERATOR_PASSWORD },
    },
  }
}

// ---- app modules (real data layer + utils) ----------------------------------------

register(new URL('./loader.mjs', import.meta.url))
const appImport = (rel) => import(pathToFileURL(path.join(SRC, rel)).href)

async function loadApp() {
  const mods = await Promise.all([
    'data/queries/shifts.js', 'data/queries/employees.js', 'data/queries/operationsMaster.js', 'data/queries/machines.js',
    'data/queries/machineOperations.js', 'data/queries/products.js', 'data/queries/rawMaterials.js', 'data/queries/suppliers.js',
    'data/queries/rmSuppliers.js', 'data/queries/productRawMaterials.js', 'data/queries/productionBatch.js', 'data/queries/jobWorkTypes.js',
    'data/queries/vendors.js', 'data/queries/vendorJobWorkTypes.js', 'data/queries/cycleTimes.js', 'data/queries/qualityParameters.js',
    'data/queries/maintenanceChecklist.js', 'data/queries/maintenanceSchedules.js', 'data/queries/maintenancePlan.js', 'data/queries/customers.js',
    'data/queries/customerEnquiries.js', 'data/queries/customerPoHeaders.js', 'data/queries/customerOrders.js', 'data/queries/rawMaterialStock.js',
    'data/queries/routeCards.js', 'data/queries/currentUser.js', 'data/queries/productionLogs.js', 'data/queries/wip.js',
    'data/queries/finishedGoodsStock.js', 'data/queries/jobOrders.js', 'data/queries/shiftVerifications.js', 'data/queries/qualityLogs.js',
    'data/queries/maintenanceLogs.js', 'data/queries/customerComplaints.js', 'data/queries/voidEntries.js', 'data/queries/appUsers.js',
    'data/queries/productionPlanning.js',
    'utils/shiftCalculations.js', 'utils/rawMaterialSave.js', 'utils/numericFields.js', 'utils/maintenanceFrequency.js',
    'utils/batchSplit.js', 'utils/calculations.js', 'utils/machineEligibility.js', 'utils/productionLogLock.js',
    'utils/customerComplaints.js', 'utils/voidEntry.js',
  ].map(appImport))
  return Object.assign({}, ...mods)
}

// ---- Supabase session ----------------------------------------------------------------

async function connect(cfg) {
  const req = createRequire(path.join(FRONTEND, 'package.json'))
  const mod = await import(pathToFileURL(req.resolve('@supabase/supabase-js')).href)
  const createClient = mod.createClient ?? mod.default?.createClient
  const sb = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  globalThis.__SEED_SUPABASE__ = sb // read by supabase-shim.mjs on first import
  return sb
}

/** Signs in as a demo login and checks its "app users" role. Returns { userId, employeeId }. */
async function signIn(sb, cfg, role) {
  await sb.auth.signOut()
  const { data, error } = await sb.auth.signInWithPassword(cfg.logins[role])
  if (error) fail(`sign-in as the demo ${role} failed: ${error.message}`)
  const userId = data.user.id
  const { data: appUser, error: auErr } = await sb.from('app users').select('*').eq('user_id', userId).maybeSingle()
  if (auErr) fail(`reading "app users" for the demo ${role}: ${auErr.message}`)
  if (!appUser) fail(`the demo ${role} login has no "app users" row -- create it in the app first (the seed never creates users).`)
  if (appUser.role !== role) fail(`the demo ${role} login has role "${appUser.role}" in "app users", expected "${role}".`)
  console.log(`Signed in as the demo ${role} (user ${userId}).`)
  return { userId, employeeId: appUser.employee_id ?? null }
}

async function rows(sb, table, apply = (q) => q) {
  const { data, error } = await apply(sb.from(table).select('*'))
  if (error) fail(`reading "${table}": ${error.message}`)
  return data
}

// ---- helpers ---------------------------------------------------------------------------

const keyOf = (...parts) => parts.map((p) => String(p ?? '')).join('|')
const num = (v) => Number(v ?? 0)
const sameNum = (a, b) => Math.abs(num(a) - num(b)) < 1e-9
const shiftOf = (code) => X.SHIFTS.find((s) => s.shift_code === code)
/** ISO timestamp of a shift's start on a date (local time of the machine running the seed). */
const shiftStartISO = (date, code) => new Date(`${date}T${shiftOf(code).start_time}:00`).toISOString()

/** Splits a day's qty over the shift's hour slots; rejects / rework sit in the last slots. */
function hourRows({ produced, rejected, rework }) {
  const n = X.SLOTS_PER_SHIFT
  const base = Math.floor(produced / n)
  const extra = produced % n
  const out = Array.from({ length: n }, (_, i) => ({ hour_slot: i + 1, qty_produced: base + (i < extra ? 1 : 0), qty_rejected: 0, qty_rework: 0 }))
  let rej = rejected
  let rw = rework
  for (let i = n - 1; i >= 0 && (rej > 0 || rw > 0); i--) {
    const room = out[i].qty_produced - out[i].qty_rejected - out[i].qty_rework
    const r = Math.min(rej, room)
    out[i].qty_rejected += r
    rej -= r
    const w = Math.min(rw, room - r)
    out[i].qty_rework += w
    rw -= w
  }
  return out.filter((r) => r.qty_produced > 0)
}

/** PRD letter (A..F) -> prd_no, from the planned PO lines (batch order). */
async function prdMap(sb) {
  const headers = await rows(sb, 'customer po headers')
  const lines = await rows(sb, 'customer orders')
  const prds = await rows(sb, 'production orders')
  const map = {}
  for (const po of X.PURCHASE_ORDERS) {
    const header = headers.find((h) => h.customer_id === po.customer_id && h.po_number === po.po_number)
    for (const l of po.lines.filter((x) => x.plan)) {
      const line = header && lines.find((x) => x.parent_po_id === header.id && x.part_serial_number === l.part_serial_number && String(x.customer_po_line_no ?? '') === l.line)
      const own = line ? prds.filter((p) => p.order_line_id === line.order_line_id).sort((a, b) => num(a.batch_no) - num(b.batch_no)) : []
      l.prds.forEach((letter, i) => { if (own[i]) map[letter] = own[i].prd_no })
    }
  }
  return map
}
const needPrd = (map, letter) => map[letter] ?? fail(`PRD ${letter} not found -- run Phase 2 first.`)

// ---- Phase 1: admin --------------------------------------------------------------------

async function phase1(sb, app, me) {
  const T = (d) => X.wd(d)

  const shifts = await app.listShifts()
  for (const s of X.SHIFTS) {
    if (shifts.some((x) => x.shift_code === s.shift_code)) { tally('shifts master', 'skipped'); continue }
    const computed = app.computeShiftHours(s)
    if (computed.error) fail(`shift ${s.shift_code}: ${computed.error}`)
    await step(`shift ${s.shift_code}`, 'shifts master', () => app.createShift({
      ...s, shift_duration: computed.shift_duration || null, net_working_hours: computed.net_working_hours || null,
    }))
    tally('shifts master', 'inserted')
  }

  const employees = await app.listEmployees()
  for (const e of X.EMPLOYEES) {
    if (employees.some((x) => x.employee_id === e.employee_id)) { tally('employees master', 'skipped'); continue }
    await step(`employee ${e.employee_id}`, 'employees master', () => app.createEmployee(e))
    tally('employees master', 'inserted')
  }

  const ops = await app.listMachineOperationOptions()
  for (const o of X.OPERATIONS) {
    if (ops.includes(o)) { tally('operations master', 'skipped'); continue }
    await step(`operation ${o}`, 'operations master', () => app.createMachineOperationOption(o))
    tally('operations master', 'inserted')
  }

  const machines = await app.listMachines()
  for (const m of X.MACHINES) {
    if (machines.some((x) => x.machine_id === m.machine_id)) tally('machines master', 'skipped')
    else {
      await step(`machine ${m.machine_id}`, 'machines master', () => app.createMachine(m))
      tally('machines master', 'inserted')
    }
    const wanted = X.MACHINE_OPERATIONS.filter((x) => x.machine_id === m.machine_id).map((x) => x.operation)
    const have = await app.listOperationsForMachine(m.machine_id)
    if (have.length) { tally('machine operations', 'skipped', wanted.length); continue } // never overwrite an existing set
    await step(`operations of ${m.machine_id}`, 'machine operations', () => app.setMachineOperations(m.machine_id, wanted))
    tally('machine operations', 'inserted', wanted.length)
  }

  const products = await app.listProducts()
  for (const p of X.PRODUCTS) {
    if (products.some((x) => x.part_serial_number === p.part_serial_number)) { tally('products master', 'skipped'); continue }
    await step(`product ${p.part_serial_number}`, 'products master', () => app.createProduct(p))
    tally('products master', 'inserted')
  }

  const rms = await app.listRawMaterials()
  for (const r of X.RAW_MATERIALS) {
    if (rms.some((x) => x.raw_material_code === r.raw_material_code)) { tally('raw materials master', 'skipped'); continue }
    await step(`raw material ${r.raw_material_code}`, 'raw materials master', () => app.createRawMaterial(r))
    tally('raw materials master', 'inserted')
  }

  const suppliers = await app.listSuppliers()
  for (const s of X.SUPPLIERS) {
    if (suppliers.some((x) => x.supplier_id === s.supplier_id)) { tally('suppliers master', 'skipped'); continue }
    await step(`supplier ${s.supplier_id}`, 'suppliers master', () => app.createSupplier(s))
    tally('suppliers master', 'inserted')
  }

  for (const link of X.RM_SUPPLIERS) {
    const have = await app.listSuppliersForRawMaterial(link.raw_material_code)
    if (have.some((x) => x.supplier_id === link.supplier_id)) { tally('rm suppliers', 'skipped'); continue }
    await step(`rm supplier ${link.raw_material_code}/${link.supplier_id}`, 'rm suppliers', () =>
      app.createRmSupplierLink({ raw_material_code: link.raw_material_code, ...app.supplierRowPayload(link) }))
    tally('rm suppliers', 'inserted')
  }

  const bom = await app.listAllProductRawMaterials()
  for (const p of X.PRODUCTS) {
    const wanted = X.BOM.filter((b) => b.part_serial_number === p.part_serial_number)
    if (bom.some((b) => b.part_serial_number === p.part_serial_number)) { tally('product raw materials', 'skipped', wanted.length); continue }
    await step(`BOM of ${p.part_serial_number}`, 'product raw materials', () => app.setProductRawMaterials(p.part_serial_number, wanted))
    tally('product raw materials', 'inserted', wanted.length)
  }

  const batches = await app.listProductionBatches()
  for (const b of X.BATCH_SIZES) {
    if (batches.some((x) => x.part_serial_number === b.part_serial_number)) { tally('production batch master', 'skipped'); continue }
    await step(`batch size ${b.part_serial_number}`, 'production batch master', () => app.createProductionBatch(b))
    tally('production batch master', 'inserted')
  }

  const jwts = await app.listJobWorkTypes()
  for (const j of X.JOB_WORK_TYPES) {
    if (jwts.some((x) => x.job_work_code === j.job_work_code)) { tally('job work master', 'skipped'); continue }
    await step(`job work ${j.job_work_code}`, 'job work master', () => app.createJobWorkType(j))
    tally('job work master', 'inserted')
  }

  const vendors = await app.listVendors()
  for (const v of X.VENDORS) {
    if (vendors.some((x) => x.vendor_id === v.vendor_id)) tally('vendors master', 'skipped')
    else {
      await step(`vendor ${v.vendor_id}`, 'vendors master', () => app.createVendor(v))
      tally('vendors master', 'inserted')
    }
    const wanted = X.VENDOR_JOB_WORK_TYPES.filter((x) => x.vendor_id === v.vendor_id).map((x) => x.job_work_code)
    const have = await app.listJobWorkTypesForVendor(v.vendor_id)
    if (have.length) { tally('vendor job work types', 'skipped', wanted.length); continue }
    await step(`job work types of ${v.vendor_id}`, 'vendor job work types', () => app.setVendorJobWorkTypes(v.vendor_id, wanted))
    tally('vendor job work types', 'inserted', wanted.length)
  }

  const cycles = await app.listCycleTimes()
  for (const c of X.CYCLE_TIMES) {
    const k = keyOf(c.part_serial_number, c.seq, c.machine_id, c.job_work_code)
    if (cycles.some((x) => keyOf(x.part_serial_number, x.seq, x.machine_id, x.job_work_code) === k)) { tally('cycle time master', 'skipped'); continue }
    await step(`cycle time ${c.part_serial_number} seq ${c.seq} ${c.machine_id ?? c.job_work_code}`, 'cycle time master', () => app.createCycleTime(c))
    tally('cycle time master', 'inserted')
  }

  const params = await app.listQualityParameters()
  for (const q of X.QUALITY_PARAMETERS) {
    const k = keyOf(q.part_serial_number, q.machine_id, q.type_of_operation, q.quality_parameter)
    if (params.some((x) => keyOf(x.part_serial_number, x.machine_id, x.type_of_operation, x.quality_parameter) === k)) { tally('quality master', 'skipped'); continue }
    await step(`quality parameter ${k}`, 'quality master', () => app.createQualityParameter(q))
    tally('quality master', 'inserted')
  }

  const checklist = await app.listMaintenanceChecklist()
  for (const c of X.MAINTENANCE_CHECKLIST) {
    if (checklist.some((x) => x.machine_id === c.machine_id && x.checklist_item === c.checklist_item)) { tally('maintenance master', 'skipped'); continue }
    await step(`checklist ${c.machine_id}: ${c.checklist_item}`, 'maintenance master', () => app.createMaintenanceChecklistItem(c))
    tally('maintenance master', 'inserted')
  }

  const schedules = await app.listMaintenanceSchedules()
  for (const s of X.MAINTENANCE_SCHEDULE) {
    if (schedules.some((x) => x.machine_id === s.machine_id)) { tally('maintenance schedule', 'skipped'); continue }
    const last = T(s.lastW)
    await step(`schedule ${s.machine_id}`, 'maintenance schedule', () => app.saveMaintenanceSchedule({
      machine_id: s.machine_id, maintenance_frequency: s.maintenance_frequency, last_maintenance_date: last,
      next_maintenance_due: app.addFrequency(last, s.maintenance_frequency), status: s.status, remarks: null,
    }))
    tally('maintenance schedule', 'inserted')
  }

  const plan = await rows(sb, 'maintenance plan')
  for (const p of X.MAINTENANCE_PLAN) {
    const week = X.mondayWeeksBack(p.weeksBack)
    if (plan.some((x) => x.machine_id === p.machine_id && x.planned_week_start_date === week)) { tally('maintenance plan', 'skipped'); continue }
    await step(`maintenance plan ${p.machine_id} ${week}`, 'maintenance plan', () => app.scheduleMaintenanceWeek(p.machine_id, week))
    tally('maintenance plan', 'inserted')
  }

  const customers = await app.listCustomers()
  for (const c of X.CUSTOMERS) {
    if (customers.some((x) => x.customer_id === c.customer_id)) { tally('customers master', 'skipped'); continue }
    await step(`customer ${c.customer_id}`, 'customers master', () => app.createCustomer(c))
    tally('customers master', 'inserted')
  }

  let enquiries = await app.listCustomerEnquiries()
  for (const e of X.ENQUIRIES) {
    const date = T(e.w)
    const product = X.PRODUCTS.find((p) => p.part_serial_number === e.part_serial_number)
    if (enquiries.some((x) => x.customer_id === e.customer_id && x.part_serial_number === e.part_serial_number && x.quoted_date === date)) { tally('customer enquiries', 'skipped'); continue }
    const saved = await step(`enquiry ${e.customer_id}/${e.part_serial_number}`, 'customer enquiries', async () => {
      const qtnNo = await app.generateNextQtnNo()
      return app.createCustomerEnquiry({
        qtn_no: qtnNo, customer_id: e.customer_id, drawing_number: product.part_drawing_reference_number,
        part_serial_number: e.part_serial_number, part_name: product.part_name, quoted_price: e.quoted_price,
        quoted_date: date, supply_lead_time_days: e.supply_lead_time_days, revision_status: e.revision_status,
      })
    })
    enquiries = [...enquiries, saved]
    tally('customer enquiries', 'inserted')
  }

  const headers = await app.listPoHeaders()
  const ORDER_LINE_TYPES = { numeric: ['order_qty'], date: ['po_date', 'expected_delivery'] } // as CustomerOrderScreen
  for (const po of X.PURCHASE_ORDERS) {
    const poDate = T(po.w)
    let header = headers.find((h) => h.customer_id === po.customer_id && h.po_number === po.po_number)
    if (header) tally('customer po headers', 'skipped')
    else {
      header = await step(`PO ${po.po_number}`, 'customer po headers', () => app.createPoHeader({
        customer_id: po.customer_id, po_number: po.po_number, po_date: poDate, ...X.PO_TERMS,
      }))
      tally('customer po headers', 'inserted')
    }
    const lines = await app.listOrdersForPoHeader(header.id)
    for (const l of po.lines) {
      if (lines.some((x) => x.part_serial_number === l.part_serial_number && String(x.customer_po_line_no ?? '') === l.line)) { tally('customer orders (PO lines)', 'skipped'); continue }
      const qtn = enquiries.find((e) => e.customer_id === po.customer_id && e.part_serial_number === l.part_serial_number)
      await step(`PO line ${po.po_number}/${l.line}`, 'customer orders', () => app.createCustomerOrder(app.withTypedFields({
        qtn_no: qtn?.qtn_no || null, customer_id: po.customer_id, po_number: po.po_number, po_date: poDate,
        part_serial_number: l.part_serial_number, order_qty: l.order_qty, order_type: l.order_type ?? null,
        expected_delivery: addCalendarDays(l.deliveryDays), customer_po_line_no: l.line, parent_po_id: header.id,
      }, ORDER_LINE_TYPES)))
      tally('customer orders (PO lines)', 'inserted')
    }
  }

  const receipts = await rows(sb, 'raw material transactions', (q) => q.eq('transaction_type', 'Receipt'))
  for (const g of X.GRNS) {
    const date = T(g.w)
    const exists = receipts.some((x) => x.raw_material_code === g.raw_material_code && sameNum(x.qty, g.qty) && x.transaction_date === date && x.supplier_id === g.supplier_id)
    if (exists) { tally('raw material transactions (GRN)', 'skipped'); continue }
    await step(`GRN ${g.key} ${g.raw_material_code} ${g.qty}`, 'raw material transactions', () => app.createRawMaterialTransaction({
      raw_material_code: g.raw_material_code, transaction_type: 'Receipt', qty: g.qty, transaction_date: date,
      supplier_id: g.supplier_id, employee_id: X.STORES_STAFF.employee_id, shift_code: X.STORES_STAFF.shift_code, user_id: me.userId,
    }))
    tally('raw material transactions (GRN)', 'inserted')
  }
}

/** Expected delivery: calendar days from today (negative = already past -> overdue line). */
function addCalendarDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return X.isoDate(d)
}

// ---- Phase 2: supervisor -------------------------------------------------------------------

async function phase2(sb, app, me, cfg) {
  const headers = await rows(sb, 'customer po headers')
  const allLines = await rows(sb, 'customer orders')
  const batchMaster = await app.listProductionBatches()
  const bom = await app.listAllProductRawMaterials()

  for (const po of X.PURCHASE_ORDERS) {
    const header = headers.find((h) => h.customer_id === po.customer_id && h.po_number === po.po_number) ?? fail(`PO ${po.po_number} not found -- run Phase 1 first.`)
    for (const l of po.lines.filter((x) => x.plan)) {
      const line = allLines.find((x) => x.parent_po_id === header.id && x.part_serial_number === l.part_serial_number && String(x.customer_po_line_no ?? '') === l.line)
        ?? fail(`PO line ${po.po_number}/${l.line} not found -- run Phase 1 first.`)
      const existing = (await app.listProductionOrders()).filter((p) => p.order_line_id === line.order_line_id)
      if (existing.length === l.plan.length) { tally('plan_production_orders (PRDs)', 'skipped', l.plan.length); continue }
      if (existing.length) fail(`PO line ${po.po_number}/${l.line} already has ${existing.length} PRD(s) but the seed plans ${l.plan.length} -- inspect it in Production Planning; the seed will not guess.`)

      // Same checks + snapshot values as ProductionPlanningScreen.
      const [withPlanning] = app.linesWithPlanning([line], [])
      const check = app.validateSplit(l.plan.map((qty) => ({ qty, plan: true })), withPlanning.remaining_qty, app.masterBatchSizeFor(batchMaster, l.part_serial_number), l.part_serial_number)
      if (check.errors.length) fail(`PO line ${po.po_number}/${l.line}: ${check.errors.join(' ')}`)
      const balance = await app.listRawMaterialStockBalance()
      const materialAvailability = bom.filter((b) => b.part_serial_number === l.part_serial_number).map((r) => {
        const stock = balance.find((b) => b.raw_material_code === r.raw_material_code)?.current_stock ?? 0
        return {
          raw_material_code: r.raw_material_code, consumption_per_unit: Number(r.consumption_per_unit), current_stock: stock,
          units_producible: r.consumption_per_unit > 0 ? Math.floor(stock / r.consumption_per_unit) : null,
        }
      })
      const hasBom = materialAvailability.length > 0
      const short = materialAvailability.filter((m) => check.plannedTotal * m.consumption_per_unit > num(m.current_stock))
      if (short.length) fail(`insufficient RM stock for ${po.po_number}/${l.line}: ${short.map((m) => m.raw_material_code).join(', ')} (Phase 1 GRNs missing?)`)
      const created = await step(`plan ${po.po_number}/${l.line} batches ${l.plan.join('+')}`, 'plan_production_orders', () => app.planProductionOrders({
        orderLineId: line.order_line_id,
        partSerialNumber: l.part_serial_number,
        batches: check.planned,
        shiftHours: X.SHIFT_HOURS,
        availableRmQtySnapshot: hasBom ? materialAvailability[0].current_stock : null,
        unitsProducible: hasBom ? Math.min(...materialAvailability.map((m) => m.units_producible)) : null,
      }))
      console.log(`  planned ${po.po_number}/${l.line}: ${(created ?? []).map((p) => p.prd_no).join(', ')}`)
      tally('plan_production_orders (PRDs)', 'inserted', (created ?? []).length)
    }
  }

  // RM issues: BOM x PRD qty per PRD, before its first production log.
  const map = await prdMap(sb)
  const prds = await app.listProductionOrders()
  const issues = await rows(sb, 'raw material transactions', (q) => q.eq('transaction_type', 'Issue'))
  for (const [letter, w] of Object.entries(X.RM_ISSUE_W)) {
    const prd = prds.find((p) => p.prd_no === needPrd(map, letter))
    const order = (await app.listOrdersByPrd()).find((o) => o.prd_no === prd.prd_no)
    const date = X.wd(w)
    for (const b of bom.filter((x) => x.part_serial_number === order.part_serial_number)) {
      const qty = Math.round(num(prd.prd_qty) * num(b.consumption_per_unit) * 1000) / 1000
      const exists = issues.some((x) => x.raw_material_code === b.raw_material_code && sameNum(x.qty, qty) && x.transaction_date === date && x.part_serial_number === order.part_serial_number)
      if (exists) { tally('raw material transactions (issue)', 'skipped'); continue }
      await step(`RM issue ${b.raw_material_code} ${qty} for ${prd.prd_no}`, 'raw material transactions', () => app.createRawMaterialTransaction({
        raw_material_code: b.raw_material_code, transaction_type: 'Issue', qty, transaction_date: date,
        part_serial_number: order.part_serial_number, employee_id: X.STORES_STAFF.employee_id, shift_code: X.STORES_STAFF.shift_code, user_id: me.userId,
      }))
      tally('raw material transactions (issue)', 'inserted')
    }
  }

  if (X.WAVE) return // top-up wave: the logins were linked once, before Phase 3
  printCounts('Phase 2 -- rows inserted / skipped:')

  // STOP: linking SQL for all three logins (text only -- the seed never runs SQL).
  const ids = {}
  for (const role of ['admin', 'supervisor', 'operator']) ids[role] = await signIn(sb, cfg, role)
  await sb.auth.signOut()
  console.log('\n=== STOP: link the demo logins to their employees ===')
  console.log('Run this yourself in the Supabase SQL editor of the DEMO project, then confirm and run Phase 3:\n')
  for (const [role, employeeId] of Object.entries(X.LOGIN_EMPLOYEES)) {
    const now = ids[role].employeeId ? `   -- currently linked to ${ids[role].employeeId}` : ''
    console.log(`update "app users" set employee_id = '${employeeId}' where user_id = '${ids[role].userId}';   -- demo ${role}${now}`)
  }
  console.log('\nThen: node scripts/seed-demo/seed-demo.mjs --phase 3')
}

// ---- Phase 3: operator -----------------------------------------------------------------------

async function phase3(sb, app, me, steps = X.PRODUCTION_STEPS) {
  if (me.employeeId !== X.LOGIN_EMPLOYEES.operator) {
    fail(`the demo operator is linked to ${me.employeeId ?? 'no employee'}, expected ${X.LOGIN_EMPLOYEES.operator} -- run the linking SQL printed by Phase 2 first.`)
  }
  const map = await prdMap(sb)
  for (const s of steps) {
    const prdNo = needPrd(map, s.prd)
    const stages = await app.getStagesForPrd(prdNo)
    const stage = stages.find((x) => Number(x.seq) === s.seq) ?? fail(`PRD ${prdNo} has no stage seq ${s.seq}`)
    const label = `PRD ${prdNo} stage ${s.seq} on ${s.machine_id}`
    const logs = (await app.listLogsForPrd(prdNo)).filter((l) => l.stage_id === stage.id)
    if (logs.length) {
      const doneAsPlanned = s.end === 'complete' ? stage.status === 'Completed' : s.end === 'endlog' ? logs.every((l) => !l.is_open) : true
      if (!doneAsPlanned) fail(`${label}: a log exists but the stage is not in the seeded end state -- finish or correct it in the app; the seed will not guess.`)
      tally('production logs', 'skipped')
      continue
    }

    // Available qty exactly as Production Data Entry computes it.
    const order = (await app.listOrdersByPrd()).find((o) => o.prd_no === prdNo) ?? fail(`PRD ${prdNo} has no PO line`)
    const [aggregates, wipAggregates] = await Promise.all([app.getStageAggregatesForPrd(prdNo), app.getWipAggregatesForPrd(prdNo)])
    const available = app.computeStageAvailability(stages, order?.prd_qty ?? 0, aggregates, wipAggregates)[stage.id] ?? 0
    const produced = s.days.reduce((a, d) => a + d.produced, 0)
    if (!(available > 0)) fail(`${label}: nothing available to this stage yet (previous stage not completed?)`)
    if (produced > available) fail(`${label}: seed would produce ${produced} but only ${available} is available.`)

    if (s.manual && stage.type !== 'Manual') fail(`${label}: the seed marks this step Manual but the stage type is ${stage.type}.`)
    if (!s.manual && stage.type === 'Manual') fail(`${label}: the stage is Manual -- the seed step must be marked manual.`)
    if (s.manual) {
      // Same payload as ManualOperationsScreen.handleStart.
      const first = s.days[0]
      const log = await step(`start manual log: ${label}`, 'production logs', () => app.createProductionLog({
        prd_no: prdNo, stage_id: stage.id, machine_id: null, employee_id: s.employee_id, shift_code: first.shift,
        start_time: shiftStartISO(X.wd(first.w), first.shift), planned_qty: available,
        standard_qty_per_hour: app.standardQtyPerHour(stage.cycle_time_min),
      }))
      tally('production logs (Manual)', 'inserted')
      await logDaysAndEnd(app, s, log, stage, label)
      continue
    }
    const cycleRows = await app.listCycleTimesForPart(order.part_serial_number)
    const masterCycleTime = app.cycleTimeForMachine({ cycleTimeRows: cycleRows, seq: stage.seq, chosenId: s.machine_id, plannedId: stage.machine_id, frozenCycleTime: stage.cycle_time_min }).cycleTimeMin
    const substituteNeeded = app.substituteReasonRequired(s.machine_id, stage.machine_id)
    if (substituteNeeded && !s.substitute) fail(`${label}: planned machine is ${stage.machine_id} -- the seed step has no substitute reason.`)
    if (!substituteNeeded && s.substitute) fail(`${label}: planned machine is ${stage.machine_id}, so the seeded substitute reason would not apply.`)
    const first = s.days[0]
    const firstDate = X.wd(first.w)

    const log = await step(`start log: ${label}`, 'production logs', () => app.createProductionLog({
      prd_no: prdNo,
      stage_id: stage.id,
      machine_id: s.machine_id,
      employee_id: s.employee_id,
      shift_code: first.shift,
      start_time: shiftStartISO(firstDate, first.shift),
      planned_qty: available,
      standard_qty_per_hour: app.standardQtyPerHour(stage.cycle_time_min),
      setter_employee_id: s.setter,
      setting_time_min: s.setting,
      cycle_time_min: masterCycleTime,
      // planned_machine_id is set by the database from the stage (never sent).
      substitute_reason: substituteNeeded ? s.substitute : null,
      substitute_reason_note: null,
    }))
    tally('production logs', 'inserted')
    await logDaysAndEnd(app, s, log, stage, label)
  }
}

/** Hour rows for each (date, shift) block of a step, then its end state. */
async function logDaysAndEnd(app, s, log, stage, label) {
  for (const d of s.days) {
    const date = X.wd(d.w)
    const hourRowsStamped = hourRows(d).map((r) => ({ ...r, log_id: log.id, log_date: date, shift_code: d.shift, employee_id: s.employee_id }))
    await step(`hours ${date} shift ${d.shift}: ${label}`, 'production log hours', () => app.addProductionLogHours(hourRowsStamped))
    tally('production log hours', 'inserted', hourRowsStamped.length)
  }

  const lastDate = X.wd(s.days[s.days.length - 1].w)
  if (s.end === 'complete') {
    await step(`Mark Stage Complete: ${label}`, 'production route card stages', () => app.updateStageStatus(stage.id, 'Completed', lastDate))
    await step(`close log: ${label}`, 'production logs', () => app.closeProductionLog(log.id))
    tally('stages marked Completed', 'inserted')
  } else if (s.end === 'endlog') {
    const hours = await app.listLogHoursForLogIds([log.id])
    await step(`End Log: ${label}`, 'production logs', () => app.endProductionLog(log.id, app.releasedPlannedQty(log.planned_qty, hours)))
    tally('logs ended (End Log)', 'inserted')
  } else {
    tally('logs left open (in progress)', 'inserted')
  }
}

const PHASE4_SECTIONS = ['verify', 'jobwork', 'wip', 'fg', 'quality', 'maintenance', 'complaint', 'void']

// ---- Phase 4: supervisor -----------------------------------------------------------------------

async function phase4(sb, app, me, sections = PHASE4_SECTIONS) {
  const want = (name) => sections.includes(name)
  const map = await prdMap(sb)
  const stagesOf = async (letter) => app.getStagesForPrd(needPrd(map, letter))
  const stageId = async (letter, seq) => (await stagesOf(letter)).find((x) => Number(x.seq) === seq)?.id ?? fail(`PRD ${letter} has no stage ${seq}`)
  const orders = await app.listOrdersByPrd()
  const orderOf = (letter) => orders.find((o) => o.prd_no === needPrd(map, letter))

  // 1. Shift verifications -- every (log, date, shift) of a closed seeded log.
  if (want('verify')) {
    const rejectStage = await stageId(X.REJECTED_SHIFT.prd, X.REJECTED_SHIFT.seq)
    const rejectKey = keyOf(needPrd(map, X.REJECTED_SHIFT.prd), rejectStage, X.wd(X.REJECTED_SHIFT.w), X.REJECTED_SHIFT.shift)
    for (const letter of [...new Set(X.PRODUCTION_STEPS.map((s) => s.prd))]) {
      const prdNo = needPrd(map, letter)
      const logs = (await app.listLogsForPrd(prdNo)).filter((l) => !l.is_open)
      const hours = await app.listLogHoursForLogIds(logs.map((l) => l.id))
      const groups = new Map()
      for (const h of hours) groups.set(keyOf(h.log_id, h.log_date, h.shift_code), h)
      for (const h of groups.values()) {
        if (me.employeeId && h.employee_id === me.employeeId) { tally('production shift verifications (own hours, left)', 'skipped'); continue }
        const log = logs.find((l) => l.id === h.log_id)
        const existing = await app.listShiftVerificationsForLog(log.id)
        if (existing.some((v) => v.log_date === h.log_date && v.shift_code === h.shift_code)) { tally('production shift verifications', 'skipped'); continue }
        const reject = keyOf(prdNo, log.stage_id, h.log_date, h.shift_code) === rejectKey
        await step(`${reject ? 'reject' : 'approve'} ${prdNo} ${h.log_date} shift ${h.shift_code}`, 'production shift verifications', () => app.setShiftVerification({
          logId: log.id, logDate: h.log_date, shiftCode: h.shift_code, status: reject ? 'Rejected' : 'Approved', rejectReason: reject ? X.REJECTED_SHIFT.reason : null,
        }))
        tally(`production shift verifications (${reject ? 'Rejected' : 'Approved'})`, 'inserted')
      }
    }
  }

  // 2. Jobwork: DCs, receipts, close short; one DC stays open past its expected date.
  if (want('jobwork')) {
    const jwts = await app.listJobWorkTypes()
    for (const dc of X.DISPATCHES) {
      const prdNo = needPrd(map, dc.prd)
      const stage = (await stagesOf(dc.prd)).find((x) => Number(x.seq) === dc.seq)
      const date = X.wd(dc.w)
      let row = (await app.listDispatchesForPrd(prdNo)).find((x) => x.stage_id === stage.id && x.vendor_id === dc.vendor_id && x.dispatch_date === date && sameNum(x.qty, dc.qty))
      if (row) tally('job order dispatch', 'skipped')
      else {
        const lead = jwts.find((j) => j.job_work_code === stage.job_work_code)?.lead_time_days
        row = await step(`DC ${dc.key}: ${prdNo} stage ${dc.seq} -> ${dc.vendor_id}`, 'job order dispatch', async () => app.createDispatch({
          dc_no: await app.generateNextDcNo(),
          prd_no: prdNo,
          stage_id: stage.id,
          job_work_code: stage.job_work_code,
          vendor_id: dc.vendor_id,
          part_serial_number: orderOf(dc.prd)?.part_serial_number,
          qty: dc.qty,
          dispatch_date: date,
          expected_receipt_date: app.toDateOrNull(lead ? X.addDaysISO(date, lead) : ''),
        }))
        tally('job order dispatch', 'inserted')
      }
      const got = await app.listReceiptsForDcNos([row.dc_no])
      for (const [i, r] of (dc.receipts ?? []).entries()) {
        if (got[i]) { tally('job order receipt', 'skipped'); continue }
        await step(`receipt ${r.qty} on ${row.dc_no}`, 'create_job_order_receipt', () => app.createReceipt({ dc_no: row.dc_no, qty_received: r.qty, receipt_date: X.wd(r.w) }))
        tally('job order receipt', 'inserted')
      }
      if (dc.closeShort) {
        const current = (await rows(sb, 'job order dispatch', (q) => q.eq('dc_no', row.dc_no)))[0]
        if (!current.is_open) { tally('close_job_order_short', 'skipped'); continue }
        await step(`close ${row.dc_no} short`, 'close_job_order_short', () => app.closeDispatchShort(row.dc_no, dc.closeShort))
        tally('close_job_order_short', 'inserted')
      }
    }
  }

  // 3. WIP receipt / issue.
  if (want('wip')) {
    for (const m of X.WIP_MOVES) {
      const prdNo = needPrd(map, m.prd)
      const fromId = await stageId(m.prd, m.fromSeq)
      const toId = m.toSeq ? await stageId(m.prd, m.toSeq) : null
      const date = X.wd(m.w)
      const have = (await app.listWipTransactionsForPrd(prdNo)).some((x) => x.transaction_type === m.type && x.nature_of_operation_stage_id === fromId && sameNum(x.qty, m.qty) && x.transaction_date === date)
      if (have) { tally(`wip transactions (${m.type})`, 'skipped'); continue }
      const payload = { prd_no: prdNo, nature_of_operation_stage_id: fromId, qty: m.qty, employee_id: m.employee_id, shift_code: m.shift_code, transaction_date: date, remarks: m.remarks, user_id: me.userId }
      await step(`WIP ${m.type} ${prdNo} ${m.qty}`, 'wip transactions', () => (m.type === 'Receipt' ? app.createWipReceipt(payload) : app.createWipIssue({ ...payload, target_stage_id: toId })))
      tally(`wip transactions (${m.type})`, 'inserted')
    }
  }

  // 4. Finished goods receipt + despatch.
  if (want('fg')) {
    for (const m of X.FG_MOVES) {
      const prdNo = needPrd(map, m.prd)
      const order = orderOf(m.prd)
      const date = X.wd(m.w)
      const have = (await rows(sb, 'finished goods transactions', (q) => q.eq('prd_no', prdNo))).some((x) => x.transaction_type === m.type && sameNum(x.qty, m.qty) && x.transaction_date === date)
      if (have) { tally(`finished goods transactions (${m.type})`, 'skipped'); continue }
      await step(`FG ${m.type} ${prdNo} ${m.qty}`, 'finished goods transactions', () => app.createFinishedGoodsTransaction({
        part_serial_number: order.part_serial_number, transaction_type: m.type, qty: m.qty, transaction_date: date, prd_no: prdNo,
        ...(m.type === 'Dispatch' ? { customer_id: order.customer_id ?? null } : {}),
        employee_id: m.employee_id, shift_code: m.shift_code, user_id: me.userId,
      }))
      tally(`finished goods transactions (${m.type})`, 'inserted')
    }
  }

  // 5. Quality inspections + readings (one out of tolerance).
  if (want('quality')) {
    const params = await app.listQualityParameters()
    for (const q of X.QUALITY_LOGS) {
      const prdNo = needPrd(map, q.prd)
      const stage = (await stagesOf(q.prd)).find((x) => Number(x.seq) === q.seq)
      const date = X.wd(q.w)
      const have = (await rows(sb, 'quality logs', (x) => x.eq('prd_no', prdNo).eq('stage_id', stage.id))).some((l) => l.machine_id === q.machine_id && l.log_date === date)
      if (have) { tally('quality logs', 'skipped'); continue }
      const part = orderOf(q.prd).part_serial_number
      const readings = Object.entries(q.readings).map(([name, value]) => {
        const p = params.find((x) => x.part_serial_number === part && x.machine_id === q.machine_id && x.type_of_operation === stage.operation && x.quality_parameter === name)
          ?? fail(`quality parameter "${name}" for ${part}/${q.machine_id}/${stage.operation} not found -- run Phase 1.`)
        return { quality_parameter_id: p.id, observed_value: value }
      })
      const log = await step(`inspection ${q.key} ${prdNo} stage ${q.seq}`, 'quality logs', () => app.createQualityLog({
        prd_no: prdNo, stage_id: stage.id, machine_id: q.machine_id, employee_id: q.employee_id, shift_code: q.shift_code, log_date: date,
      }))
      tally('quality logs', 'inserted')
      await step(`readings ${q.key}`, 'quality log readings', () => app.createQualityLogReadings(readings.map((r) => ({ quality_log_id: log.id, ...r }))))
      tally('quality log readings', 'inserted', readings.length)
    }
  }

  // 6. Maintenance visits + checklist results.
  if (want('maintenance')) {
    const visits = await rows(sb, 'maintenance logs')
    for (const v of X.MAINTENANCE_LOGS) {
      const date = X.wd(v.w)
      if (visits.some((x) => x.machine_id === v.machine_id && x.log_date === date)) { tally('maintenance logs', 'skipped'); continue }
      const log = await step(`maintenance ${v.machine_id} ${date}`, 'maintenance logs', () => app.createMaintenanceLog({
        machine_id: v.machine_id, employee_id: v.employee_id, shift_code: v.shift_code, log_date: date, maintenance_type: v.maintenance_type,
      }))
      tally('maintenance logs', 'inserted')
      for (const item of await app.listChecklistItemsForMachine(v.machine_id)) {
        const bad = v.notOk && item.checklist_item === v.notOk.item
        await step(`maintenance item ${v.machine_id}: ${item.checklist_item}`, 'maintenance log items', () => app.addMaintenanceLogItem({
          maintenance_log_id: log.id, checklist_item_id: item.id, condition: bad ? 'Not OK' : 'OK',
          observation: bad ? v.notOk.observation : null, action_taken: bad ? v.notOk.action_taken : null,
        }))
        tally('maintenance log items', 'inserted')
      }
    }
  }

  // 7. Customer complaint (Open).
  if (want('complaint')) {
    const c = X.COMPLAINT
    const complaintDate = X.wd(c.w)
    if ((await app.listComplaints()).some((x) => x.customer_id === c.customer_id && x.part_serial_number === c.part_serial_number && x.complaint_date === complaintDate)) tally('customer complaints', 'skipped')
    else {
      const form = {
        ...app.emptyComplaintForm(complaintDate),
        customer_id: c.customer_id, contact_person: c.contact_person, contact_number_email: c.contact_number_email, complaint_source: c.complaint_source,
        part_serial_number: c.part_serial_number, customer_po_no: c.customer_po_no, invoice_no: c.invoice_no, batch_lot_no: needPrd(map, c.prd),
        qty_supplied: String(c.qty_supplied), qty_complained: String(c.qty_complained), manufacturing_date: X.wd(c.manufacturingW),
        complaint_type: c.complaint_type, complaint_category: c.complaint_category, complaint_description: c.complaint_description,
        defect_problem: c.defect_problem, severity: c.severity, priority: c.priority,
      }
      const error = app.validateRegistration(form)
      if (error) fail(`complaint: ${error}`)
      const saved = await step('customer complaint', 'customer complaints', () => app.createComplaint(app.registrationPayload(form)))
      console.log(`  complaint ${saved.complaint_no} (Open)`)
      tally('customer complaints', 'inserted')
    }
  }

  // 8. Void one GRN that was never issued (Phase 4 only).
  if (want('void')) {
    if (!X.GRN_TO_VOID) return
    const g = X.GRNS.find((x) => x.key === X.GRN_TO_VOID.key)
    const grn = (await rows(sb, 'raw material transactions', (q) => q.eq('transaction_type', 'Receipt').eq('raw_material_code', g.raw_material_code)))
      .find((x) => sameNum(x.qty, g.qty) && x.transaction_date === X.wd(g.w) && x.supplier_id === g.supplier_id)
      ?? fail(`GRN ${g.key} not found -- run Phase 1 first.`)
    if (grn.voided_at) tally('void_entry (GRN)', 'skipped')
    else {
      await step(`void GRN ${grn.doc_no}`, 'void_entry', () => app.voidEntry(app.VOID_TYPES.GRN, grn.doc_no, X.GRN_TO_VOID.reason))
      tally('void_entry (GRN)', 'inserted')
    }
  }
}

// ---- Phase 5: top-up wave (admin -> supervisor -> operator -> supervisor) ----------------------

const REFRESH_NOTE = `To keep the demo current later, add a NEW wave dated relative to that day:
  node scripts/seed-demo/seed-demo.mjs --dry-run --phase 5 --wave T2   (check the plan + chronology)
  node scripts/seed-demo/seed-demo.mjs --phase 5 --wave T2
Use the next free tag each time (T2, T3, ...): the tag is part of the wave's PO numbers, so a new
tag adds a fresh ~21-day wave ending on the run day. Re-running an EXISTING tag never adds new
activity -- its dates are read back from its first PO, so it only fills in what a stopped run left.
Customers CUST-008/009 and PART-109 are created once and reused by every wave. Older waves stay as
they are (their open DC / open Manual log stay open until someone closes them in the app).`

/** Rows per table after the run (read-only head counts). */
const COUNT_TABLES = [
  'customers master', 'products master', 'cycle time master', 'customer po headers', 'customer orders', 'raw material transactions',
  'production orders', 'production logs', 'production log hours', 'production shift verifications', 'job order dispatch',
  'job order receipt', 'finished goods transactions', 'quality logs', 'quality log readings', 'maintenance logs',
  'maintenance log items', 'customer complaints',
]
async function printTableTotals(sb) {
  console.log('\nRows per table now (whole demo project):')
  for (const t of COUNT_TABLES) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t.padEnd(34)} ${error ? `(not readable: ${error.message})` : String(count).padStart(6)}`)
  }
}

/**
 * Read-only checks before Phase 5 writes anything (also run alone with --check):
 *  - the wave's new codes (customers, part + drawing no, PO numbers) are free -- or, when the
 *    wave already started, belong to this wave (same names / customers);
 *  - the live route of every planned part is the one the wave was planned on;
 *  - the operator's open logs (any not from this wave are End-Logged before production).
 * Returns { conflicts, routeDiffs, waveStarted }.
 */
async function preflightTopUp(sb, app, waveStarted) {
  const conflicts = []
  const customers = await app.listCustomers()
  for (const c of X.CUSTOMERS) {
    const have = customers.find((x) => x.customer_id === c.customer_id)
    if (have && (!waveStarted || have.customer_name !== c.customer_name)) conflicts.push(`customer ${c.customer_id} already exists ("${have.customer_name}")`)
  }
  const products = await app.listProducts()
  for (const p of X.PRODUCTS) {
    const have = products.find((x) => x.part_serial_number === p.part_serial_number)
    if (have && (!waveStarted || have.part_name !== p.part_name)) conflicts.push(`part ${p.part_serial_number} already exists ("${have.part_name}")`)
    const drawing = products.find((x) => x.part_drawing_reference_number === p.part_drawing_reference_number && x.part_serial_number !== p.part_serial_number)
    if (drawing) conflicts.push(`drawing no ${p.part_drawing_reference_number} already used by ${drawing.part_serial_number}`)
  }
  const poNumbers = X.PURCHASE_ORDERS.map((p) => p.po_number)
  for (const h of await rows(sb, 'customer po headers', (q) => q.in('po_number', poNumbers))) {
    const ours = X.PURCHASE_ORDERS.find((p) => p.po_number === h.po_number)
    if (!waveStarted || h.customer_id !== ours.customer_id) conflicts.push(`PO number ${h.po_number} already exists (customer ${h.customer_id})`)
  }

  // Live route (what plan_production_orders will snapshot) vs the planned one.
  const routeDiffs = []
  const fmt = (r) => r.map((s) => `${s.seq} ${s.operation} ${s.machine_id ?? s.job_work_code ?? s.type}`).join(' -> ')
  const planned = X.PURCHASE_ORDERS.flatMap((p) => p.lines.filter((l) => l.plan))
  const expectedRows = X.ALL_CYCLE_TIMES.map((c, i) => ({ ...c, id: i + 1 }))
  for (const part of [...new Set(planned.map((l) => l.part_serial_number))].sort()) {
    const live = await rows(sb, 'cycle time master', (q) => q.eq('part_serial_number', part))
    const isNew = X.PRODUCTS.some((p) => p.part_serial_number === part)
    if (!live.length && isNew) continue // created by this wave's admin step
    const want = fmt(app.collapseCycleRows(expectedRows.filter((c) => c.part_serial_number === part).sort((a, b) => a.seq - b.seq || a.id - b.id)))
    const got = fmt(app.collapseCycleRows([...live].sort((a, b) => a.seq - b.seq || a.id - b.id)))
    if (got !== want) routeDiffs.push(`${part}: live route "${got}" but the wave is planned on "${want}"`)
  }
  return { conflicts, routeDiffs }
}

/** Open logs of the signed-in user, with PRD / stage / machine for the report. */
async function openLogsOfCurrentUser(app) {
  const logs = await app.listOpenLogsForUser(await app.getCurrentUserId())
  const out = []
  for (const l of logs) {
    const stage = (await app.getStagesForPrd(l.prd_no)).find((s) => s.id === l.stage_id)
    out.push({ log: l, label: `log ${l.id}: ${l.prd_no} stage ${stage?.seq ?? '?'} ${stage?.type === 'Manual' ? '(Manual)' : l.machine_id ?? ''} employee ${l.employee_id}`, stage })
  }
  return out
}

/** The wave's anchor: today, or read back from its first PO when the wave already started. */
async function waveAnchor(sb) {
  const first = topUpDataset(WAVE).PURCHASE_ORDERS[0]
  const header = (await rows(sb, 'customer po headers', (q) => q.eq('customer_id', first.customer_id).eq('po_number', first.po_number)))[0]
  if (!header) return { anchor: new Date(), started: false, note: `Wave ${WAVE} is new: anchored on today (${D.isoDate(new Date())}).` }
  const anchor = anchorFromPoDate(header.po_date) ?? fail(`wave ${WAVE}: cannot derive its anchor date from ${first.po_number} (${header.po_date}).`)
  const stale = D.isoDate(anchor) !== D.isoDate(new Date()) ? ' For a fresh wave ending today use the next tag -- see --refresh.' : ''
  return { anchor, started: true, note: `Wave ${WAVE} already started: ${first.po_number} is dated ${header.po_date}, so it keeps its anchor ${D.isoDate(anchor)} (only missing rows are added).${stale}` }
}

/** --check: the preflight alone (read-only, nothing written). */
async function checkTopUp(sb, app, cfg) {
  await signIn(sb, cfg, 'admin')
  const { anchor, started, note } = await waveAnchor(sb)
  console.log(note)
  X = topUpDataset(WAVE, anchor)
  const { conflicts, routeDiffs } = await preflightTopUp(sb, app, started)
  console.log(`\nNew codes free (${X.CUSTOMERS.map((c) => c.customer_id).join(', ')}, ${X.PRODUCTS.map((p) => `${p.part_serial_number} / ${p.part_drawing_reference_number}`).join(', ')}, ${X.PURCHASE_ORDERS.length} PO numbers): ${conflicts.length ? 'NO' : 'yes'}`)
  for (const c of conflicts) console.log(`  ${c}`)
  console.log(`Live routes match the plan: ${routeDiffs.length ? 'NO' : 'yes'}`)
  for (const r of routeDiffs) console.log(`  ${r}`)
  const operator = await signIn(sb, cfg, 'operator')
  console.log(`Operator linked to ${operator.employeeId ?? 'no employee'} (expected ${X.LOGIN_EMPLOYEES.operator}): ${operator.employeeId === X.LOGIN_EMPLOYEES.operator ? 'yes' : 'NO'}`)
  const open = await openLogsOfCurrentUser(app)
  console.log(`Operator open logs: ${open.length}${open.length ? '' : ' (none)'}`)
  for (const o of open) console.log(`  ${o.label}`)
  if (open.length) console.log('  -> Phase 5 End-Logs these (app endProductionLog, released qty as the screen computes) before its production step.')
  if (conflicts.length || routeDiffs.length || operator.employeeId !== X.LOGIN_EMPLOYEES.operator) process.exitCode = 1
}

async function phase5(sb, app, cfg) {
  const admin = await signIn(sb, cfg, 'admin')
  const { anchor, started, note } = await waveAnchor(sb)
  console.log(note)
  X = topUpDataset(WAVE, anchor)
  const { conflicts, routeDiffs } = await preflightTopUp(sb, app, started)
  if (conflicts.length || routeDiffs.length) fail(`preflight (read-only) failed -- nothing was written:\n  ${[...conflicts, ...routeDiffs].join('\n  ')}`)
  console.log('Preflight: new codes free, live routes match the plan.')

  console.log('\n-- admin: customers, product + route, POs, GRNs')
  await phase1(sb, app, admin)
  const supervisor = await signIn(sb, cfg, 'supervisor')
  console.log('\n-- supervisor: plan PRDs + RM issues')
  await phase2(sb, app, supervisor, cfg)
  // A stage after an outsourced one has nothing available until the jobwork receipt exists,
  // so those steps are logged in a second operator pass, after the DCs + receipts.
  const afterJobwork = (s) => X.DISPATCHES.some((d) => d.prd === s.prd && d.seq < s.seq)
  const operator = await signIn(sb, cfg, 'operator')
  const waveSteps = X.PRODUCTION_STEPS.filter((s) => s.end === 'open')
  const map = await prdMap(sb)
  const isWaveOpenStep = (o) => waveSteps.some((s) => map[s.prd] === o.log.prd_no && Number(o.stage?.seq) === s.seq)
  for (const o of (await openLogsOfCurrentUser(app)).filter((x) => !isWaveOpenStep(x))) {
    // End Log as Production Data Entry does: planned qty released down to what was logged.
    const hours = await app.listLogHoursForLogIds([o.log.id])
    await step(`End Log (older open log) ${o.label}`, 'production logs', () => app.endProductionLog(o.log.id, app.releasedPlannedQty(o.log.planned_qty, hours)))
    console.log(`  ended older open log: ${o.label}`)
    tally('older open logs ended (End Log)', 'inserted')
  }
  console.log('\n-- operator: production logs + hours')
  await phase3(sb, app, operator, X.PRODUCTION_STEPS.filter((s) => !afterJobwork(s)))
  console.log('\n-- supervisor: jobwork DCs + receipts')
  await phase4(sb, app, (await signIn(sb, cfg, 'supervisor')), ['jobwork'])
  console.log('\n-- operator: stages after jobwork')
  await phase3(sb, app, (await signIn(sb, cfg, 'operator')), X.PRODUCTION_STEPS.filter(afterJobwork))
  console.log('\n-- supervisor: shift verifications, FG, quality, maintenance, complaint')
  await phase4(sb, app, (await signIn(sb, cfg, 'supervisor')), ['verify', 'fg', 'quality', 'maintenance', 'complaint'])
  printCounts(`Phase 5 (wave ${WAVE}) -- rows inserted / skipped:`)
  await printTableTotals(sb)
  await signIn(sb, cfg, 'operator')
  const open = await openLogsOfCurrentUser(app)
  const finalMap = await prdMap(sb)
  const expected = X.PRODUCTION_STEPS.filter((s) => s.end === 'open').map((s) => `${finalMap[s.prd]} stage ${s.seq}`)
  console.log(`\nOperator open logs now: ${open.length} -- ${open.map((o) => o.label).join('; ') || 'none'}`)
  const ok = open.length === expected.length && open.every((o) => expected.includes(`${o.log.prd_no} stage ${o.stage?.seq}`))
  console.log(ok ? `  as intended: only ${expected.join(', ')} (N7 Manual) is open.` : `  NOT as intended (expected only ${expected.join(', ')}) -- check in Production Data Entry / Manual Operations.`)
  if (!ok) process.exitCode = 1
  console.log(`\n${REFRESH_NOTE}`)
}

/** Accepted qty of a PRD's stage (all its seeded days). */
const acceptedOf = (prd, seq) => X.PRODUCTION_STEPS.filter((p) => p.prd === prd && p.seq === seq).flatMap((p) => p.days).reduce((a, d) => a + d.produced - d.rejected - d.rework, 0)

async function dryRunTopUp(app) {
  X = topUpDataset(WAVE)
  const W = (k) => `W-${k} ${X.wd(k)}`
  console.log(`DRY RUN -- Phase 5 top-up, wave ${WAVE}. Offline: no .env read, no sign-in, no network.`)
  console.log(`Anchor = today (${X.wd(0)}) for a new wave; re-running an existing wave reuses the anchor read back from ${X.PURCHASE_ORDERS[0].po_number}. Sundays skipped.\n`)
  const line = (login, table, n, note = '') => console.log(`  [${login.padEnd(10)}] ${table.padEnd(34)} ${String(n).padStart(4)}  ${note}`)
  const lines = X.PURCHASE_ORDERS.flatMap((p) => p.lines.map((l) => ({ po: p, l })))
  const planned = lines.filter(({ l }) => l.plan)
  const lineOf = (prd) => planned.find(({ l }) => l.prds.includes(prd))
  const allBom = [...X.BOM, ...D.BOM]
  const batchOf = (part) => [...X.BATCH_SIZES, ...D.BATCH_SIZES].find((b) => b.part_serial_number === part)?.production_batch_quantity

  console.log('Step 1 (admin)')
  line('admin', 'customers master', X.CUSTOMERS.length, X.CUSTOMERS.map((c) => `${c.customer_id} ${c.customer_name}`).join(', '))
  line('admin', 'products master', X.PRODUCTS.length, X.PRODUCTS.map((p) => `${p.part_serial_number} ${p.part_name}`).join(', '))
  line('admin', 'product raw materials (BOM)', X.BOM.length, X.BOM.map((b) => `${b.part_serial_number} ${b.raw_material_code} x${b.consumption_per_unit}`).join(', '))
  line('admin', 'production batch master', X.BATCH_SIZES.length, X.BATCH_SIZES.map((b) => `${b.part_serial_number} ${b.production_batch_quantity}`).join(', '))
  line('admin', 'cycle time master', X.CYCLE_TIMES.length, X.CYCLE_TIMES.map((c) => `${c.seq} ${c.operation} ${c.type === 'Manual' ? '(Manual)' : c.machine_id}`).join(' -> '))
  line('admin', 'customer po headers', X.PURCHASE_ORDERS.length, `${new Set(X.PURCHASE_ORDERS.map((p) => p.customer_id)).size} customers`)
  line('admin', 'customer orders (PO lines)', lines.length, `${lines.filter(({ l }) => l.order_type === 'Manufacturing').length} Manufacturing, ${lines.filter(({ l }) => l.order_type === 'Labour').length} Labour, ${planned.length} planned`)
  for (const p of X.PURCHASE_ORDERS) console.log(`      ${p.po_number.padEnd(18)} ${p.customer_id} ${W(p.w)}  ${p.lines.map((l) => `${l.line}:${l.part_serial_number} ${l.order_qty} ${l.order_type === 'Labour' ? 'Lab' : 'Mfg'}${l.plan ? ` -> ${l.prds.join(',')}` : ''}`).join('  ')}`)
  const need = {}
  for (const { l } of planned) for (const b of allBom.filter((x) => x.part_serial_number === l.part_serial_number)) need[b.raw_material_code] = Math.round(((need[b.raw_material_code] ?? 0) + l.plan.reduce((a, q) => a + q, 0) * b.consumption_per_unit) * 1000) / 1000
  line('admin', 'raw material transactions (GRN)', X.GRNS.length, `${W(X.GRNS[0].w)}: ${X.GRNS.map((g) => `${g.raw_material_code} ${g.qty} (need ${need[g.raw_material_code] ?? 0})`).join(', ')}`)
  const uncovered = Object.entries(need).filter(([code, q]) => !(X.GRNS.filter((g) => g.raw_material_code === code).reduce((a, g) => a + g.qty, 0) >= q))

  console.log('\nStep 2 (supervisor)')
  line('supervisor', 'plan_production_orders (PRDs)', planned.reduce((a, { l }) => a + l.plan.length, 0), planned.map(({ l }) => `${l.prds.join(',')}=${l.part_serial_number} ${l.plan.join('+')}/batch ${batchOf(l.part_serial_number)}`).join('  '))
  const overBatch = planned.filter(({ l }) => l.plan.some((q) => q > batchOf(l.part_serial_number)) || l.plan.reduce((a, b) => a + b, 0) > l.order_qty)
  const issues = planned.flatMap(({ l }) => allBom.filter((b) => b.part_serial_number === l.part_serial_number))
  line('supervisor', 'raw material transactions (issue)', issues.length, `BOM x PRD qty, all on ${W(Object.values(X.RM_ISSUE_W)[0])}`)

  console.log('\nStep 3 (operator)')
  const hours = X.PRODUCTION_STEPS.flatMap((s) => s.days.map((d) => hourRows(d).length)).reduce((a, b) => a + b, 0)
  const ends = (e) => X.PRODUCTION_STEPS.filter((s) => s.end === e).length
  line('operator', 'production logs', X.PRODUCTION_STEPS.length, `${ends('complete')} completed, ${ends('open')} open (Manual); ${X.PRODUCTION_STEPS.filter((s) => s.substitute).length} substitute`)
  line('operator', 'production log hours', hours, `${X.PRODUCTION_STEPS.flatMap((s) => s.days).length} (date, shift) blocks; shifts ${[...new Set(X.PRODUCTION_STEPS.flatMap((s) => s.days.map((d) => d.shift)))].sort().join('/')}; machines ${[...new Set(X.PRODUCTION_STEPS.map((s) => s.machine_id).filter(Boolean))].sort().join(', ')}`)
  const days = [...new Set(X.PRODUCTION_STEPS.flatMap((s) => s.days.map((d) => d.w)))].sort((a, b) => b - a)
  console.log(`      production on ${days.length} working days: ${X.wd(days[0])} .. ${X.wd(days.at(-1))}`)
  for (const s of X.PRODUCTION_STEPS) {
    const acc = s.days.reduce((a, d) => a + d.produced - d.rejected - d.rework, 0)
    console.log(`      PRD ${s.prd.padEnd(2)} seq ${String(s.seq).padEnd(2)} ${(s.machine_id ?? 'Manual').padEnd(6)}${s.substitute ? ` (substitute: ${s.substitute})` : ''}  ${s.days.map((d) => `${W(d.w)} ${d.shift}: ${d.produced}/${d.rejected}/${d.rework}`).join(' + ')}  accepted ${acc}  -> ${s.end}`)
  }
  // Flow: a stage makes at most what the stage before accepted (or what came back from jobwork).
  const flow = []
  for (const s of X.PRODUCTION_STEPS) {
    const { l } = lineOf(s.prd)
    const prevSeqs = [...new Set([...X.PRODUCTION_STEPS.filter((p) => p.prd === s.prd && p.seq < s.seq).map((p) => p.seq), ...X.DISPATCHES.filter((d) => d.prd === s.prd && d.seq < s.seq).map((d) => d.seq)])]
    const prevSeq = prevSeqs.length ? Math.max(...prevSeqs) : null
    const dcs = X.DISPATCHES.filter((d) => d.prd === s.prd && d.seq === prevSeq)
    const avail = prevSeq == null ? l.plan[l.prds.indexOf(s.prd)]
      : dcs.length ? dcs.flatMap((d) => d.receipts ?? []).reduce((a, r) => a + r.qty, 0) : acceptedOf(s.prd, prevSeq)
    const produced = s.days.reduce((a, d) => a + d.produced, 0)
    if (produced > avail) flow.push(`PRD ${s.prd} seq ${s.seq}: makes ${produced} > available ${avail}`)
  }
  for (const d of X.DISPATCHES) {
    const lastSeq = Math.max(...X.PRODUCTION_STEPS.filter((p) => p.prd === d.prd && p.seq < d.seq).map((p) => p.seq))
    if (d.qty > acceptedOf(d.prd, lastSeq)) flow.push(`${d.key}: sends ${d.qty} > accepted ${acceptedOf(d.prd, lastSeq)}`)
  }
  for (const m of X.FG_MOVES.filter((x) => x.type === 'Production Receipt')) {
    const lastSeq = Math.max(...X.PRODUCTION_STEPS.filter((p) => p.prd === m.prd).map((p) => p.seq))
    if (m.qty > acceptedOf(m.prd, lastSeq)) flow.push(`FG receipt ${m.prd}: ${m.qty} > last stage accepted ${acceptedOf(m.prd, lastSeq)}`)
  }
  for (const m of X.FG_MOVES.filter((x) => x.type === 'Dispatch')) {
    const got = X.FG_MOVES.filter((x) => x.type === 'Production Receipt' && x.prd === m.prd).reduce((a, x) => a + x.qty, 0)
    if (m.qty > got) flow.push(`despatch ${m.prd}: ${m.qty} > FG received ${got}`)
  }

  console.log('\nStep 4 (supervisor)')
  const blocks = X.PRODUCTION_STEPS.filter((s) => s.end !== 'open').flatMap((s) => s.days).length
  line('supervisor', 'production shift verifications', blocks, `${blocks - 1} Approved, 1 Rejected (PRD ${X.REJECTED_SHIFT.prd} seq ${X.REJECTED_SHIFT.seq} ${W(X.REJECTED_SHIFT.w)} ${X.REJECTED_SHIFT.shift}); the open Manual log's shift stays Pending`)
  line('supervisor', 'job order dispatch', X.DISPATCHES.length, X.DISPATCHES.map((d) => `${d.key} PRD ${d.prd} ${d.qty} ${W(d.w)}`).join('; '))
  line('supervisor', 'create_job_order_receipt', X.DISPATCHES.flatMap((d) => d.receipts ?? []).length, X.DISPATCHES.filter((d) => d.receipts).map((d) => `${d.key}: ${d.receipts.map((r) => `${r.qty}/${d.qty} ${W(r.w)}`).join(', ')}`).join('; '))
  const openDc = X.DISPATCHES.find((d) => !d.receipts)
  const openPart = lineOf(openDc.prd).l.part_serial_number
  const lead = D.JOB_WORK_TYPES.find((j) => j.job_work_code === D.CYCLE_TIMES.find((c) => c.part_serial_number === openPart && c.seq === openDc.seq).job_work_code).lead_time_days
  const due = D.addDaysISO(X.wd(openDc.w), lead)
  const notDue = due >= D.isoDate(new Date())
  console.log(`      open DC ${openDc.key}: dispatched ${X.wd(openDc.w)}, expected ${due} -> ${notDue ? 'not yet due' : 'OVERDUE (should not be)'}`)
  line('supervisor', 'finished goods transactions', X.FG_MOVES.length, X.FG_MOVES.map((m) => `${m.type === 'Dispatch' ? 'Despatch' : 'Receipt'} ${m.prd} ${m.qty} ${W(m.w)}`).join('; '))
  const closed = planned.filter(({ l }) => X.FG_MOVES.filter((m) => m.type === 'Dispatch' && l.prds.includes(m.prd)).reduce((a, m) => a + m.qty, 0) >= l.order_qty)
  console.log(`      PO lines fully despatched (-> Closed): ${closed.map(({ po, l }) => `${po.po_number}/${l.line}`).join(', ') || 'none'}`)
  line('supervisor', 'quality logs', X.QUALITY_LOGS.length, `${W(X.QUALITY_LOGS[0].w)}`)
  line('supervisor', 'quality log readings', X.QUALITY_LOGS.reduce((a, q) => a + Object.keys(q.readings).length, 0), `1 out of tolerance (${X.OUT_OF_TOLERANCE_NOTE})`)
  line('supervisor', 'maintenance logs', X.MAINTENANCE_LOGS.length, X.MAINTENANCE_LOGS.map((v) => `${v.machine_id} ${X.wd(v.w)}`).join(', '))
  line('supervisor', 'maintenance log items', X.MAINTENANCE_LOGS.reduce((a, v) => a + D.MAINTENANCE_CHECKLIST.filter((c) => c.machine_id === v.machine_id).length, 0), '1 Not OK')
  line('supervisor', 'customer complaints', 1, `Open, ${X.COMPLAINT.customer_id} ${X.COMPLAINT.part_serial_number} PRD ${X.COMPLAINT.prd}, ${W(X.COMPLAINT.w)}`)

  console.log('\nRoute card stages (the app\'s own collapseCycleRows):')
  const withIds = X.ALL_CYCLE_TIMES.map((c, i) => ({ ...c, id: i + 1 }))
  const routeOf = (part) => app.collapseCycleRows(withIds.filter((c) => c.part_serial_number === part).sort((a, b) => a.seq - b.seq || a.id - b.id))
  for (const part of [...new Set(planned.map(({ l }) => l.part_serial_number))].sort()) {
    console.log(`  ${part}: ${routeOf(part).map((s) => `${s.seq} ${s.operation} ${s.machine_id ?? s.job_work_code ?? 'Manual'}`).join(' -> ')}`)
  }
  // Seeded machine vs planned machine: a different one must carry a substitute reason.
  const subs = []
  for (const s of X.PRODUCTION_STEPS.filter((x) => !x.manual)) {
    const plannedId = routeOf(lineOf(s.prd).l.part_serial_number).find((x) => x.seq === s.seq)?.machine_id
    if (app.substituteReasonRequired(s.machine_id, plannedId) !== Boolean(s.substitute)) subs.push(`PRD ${s.prd} seq ${s.seq}: planned ${plannedId}, seeded ${s.machine_id}, substitute ${s.substitute ?? 'none'}`)
  }
  // One log at a time per machine: (date, shift) blocks never overlap on a machine.
  const slotUse = new Map()
  const clash = []
  for (const s of X.PRODUCTION_STEPS.filter((x) => x.machine_id)) for (const d of s.days) {
    const k = `${s.machine_id} ${X.wd(d.w)} ${d.shift}`
    if (slotUse.has(k)) clash.push(`${k}: ${slotUse.get(k)} and PRD ${s.prd} seq ${s.seq}`)
    slotUse.set(k, `PRD ${s.prd} seq ${s.seq}`)
  }

  const checks = X.chronologyChecks(X)
  const bad = checks.filter((c) => !c.ok)
  const span = [X.wd(Math.max(...X.PURCHASE_ORDERS.map((p) => p.w))), X.wd(0)]
  const calendarDays = Math.round((new Date(span[1]) - new Date(span[0])) / 86400000)
  const shifts = new Set(D.SHIFTS.map((x) => x.shift_code))
  const badDays = X.PRODUCTION_STEPS.flatMap((s) => s.days).filter((d) => d.w < 1 || !shifts.has(d.shift))
  const lastDays = [...new Set([...X.FG_MOVES, ...X.DISPATCHES, ...X.QUALITY_LOGS, ...X.MAINTENANCE_LOGS, X.COMPLAINT].map((m) => m.w))].filter((w) => w <= 2).sort()
  const verdict = (ok) => (ok ? 'yes' : 'NO')
  console.log('\nChecks')
  console.log(`  chronology: ${checks.length - bad.length}/${checks.length} pass (GRN < RM issue < logs < later stages < DC < receipts < FG receipt < despatch < quality/complaint)`)
  for (const c of bad) console.log(`    FAIL: ${c.label} (W-${c.earlier} vs W-${c.later})`)
  console.log(`  wave span: ${span[0]} .. ${span[1]} = ${calendarDays} calendar days (<= 21: ${verdict(calendarDays <= 21)}); activity on the last 3 days: ${lastDays.map((w) => X.wd(w)).join(', ')}`)
  console.log(`  batches <= master size and <= PO line qty: ${verdict(!overBatch.length)}`)
  console.log(`  GRNs cover the new PRDs' RM: ${verdict(!uncovered.length)}${uncovered.length ? ` ${uncovered.map(([c]) => c).join(', ')}` : ''}`)
  console.log(`  quantities flow (no stage / DC / FG move exceeds what it received): ${verdict(!flow.length)}`)
  for (const f of flow) console.log(`    ${f}`)
  console.log(`  machine = planned unless a substitute reason is given: ${verdict(!subs.length)}`)
  for (const f of subs) console.log(`    ${f}`)
  console.log(`  no two logs on one machine in the same (date, shift): ${verdict(!clash.length)}`)
  for (const f of clash) console.log(`    ${f}`)
  console.log(`  MC-04 unused (kept free; planned for PART-103 stage 20 -> the substitute): ${verdict(!X.PRODUCTION_STEPS.some((s) => s.machine_id === 'MC-04'))}`)
  console.log(`  production on a defined shift and before today: ${verdict(!badDays.length)}`)
  console.log(`  open DC not yet due: ${verdict(notDue)}`)
  console.log(`\n--refresh note:\n${REFRESH_NOTE}`)
  if (bad.length || flow.length || subs.length || clash.length || overBatch.length || uncovered.length || badDays.length || calendarDays > 21 || !notDue) process.exitCode = 1
}

// ---- dry run (offline: no env read, no network) ---------------------------------------------------

async function dryRun(app) {
  const W = (k) => `W-${k} ${X.wd(k)}`
  console.log(`DRY RUN -- offline: no .env read, no sign-in, no network. Dates relative to today (${X.wd(0)}), Sundays skipped.\n`)
  const line = (login, table, n, note = '') => console.log(`  [${login.padEnd(10)}] ${table.padEnd(34)} ${String(n).padStart(4)}  ${note}`)

  console.log('Phase 1 (admin)')
  line('admin', 'shifts master', X.SHIFTS.length, X.SHIFTS.map((s) => `${s.shift_code} ${s.start_time}-${s.end_time}`).join(', '))
  line('admin', 'employees master', X.EMPLOYEES.length, `${X.EMPLOYEES[0].employee_id}..${X.EMPLOYEES.at(-1).employee_id}`)
  line('admin', 'operations master', X.OPERATIONS.length)
  line('admin', 'machines master', X.MACHINES.length, Object.entries(Object.groupBy(X.MACHINES, (m) => m.category)).map(([c, ms]) => `${c} x${ms.length}`).join(', '))
  line('admin', 'machine operations', X.MACHINE_OPERATIONS.length)
  line('admin', 'products master', X.PRODUCTS.length)
  line('admin', 'raw materials master', X.RAW_MATERIALS.length)
  line('admin', 'suppliers master', X.SUPPLIERS.length)
  line('admin', 'rm suppliers', X.RM_SUPPLIERS.length)
  line('admin', 'product raw materials (BOM)', X.BOM.length)
  line('admin', 'production batch master', X.BATCH_SIZES.length)
  line('admin', 'job work master', X.JOB_WORK_TYPES.length)
  line('admin', 'vendors master', X.VENDORS.length)
  line('admin', 'vendor job work types', X.VENDOR_JOB_WORK_TYPES.length)
  line('admin', 'cycle time master', X.CYCLE_TIMES.length, `outsourced: ${X.CYCLE_TIMES.filter((c) => c.type === 'Outsourced').map((c) => `${c.part_serial_number} seq ${c.seq} ${c.job_work_code}`).join(', ')}`)
  line('admin', 'quality master', X.QUALITY_PARAMETERS.length)
  line('admin', 'maintenance master (checklist)', X.MAINTENANCE_CHECKLIST.length)
  line('admin', 'maintenance schedule', X.MAINTENANCE_SCHEDULE.length)
  line('admin', 'maintenance plan', X.MAINTENANCE_PLAN.length, `weeks ${[...new Set(X.MAINTENANCE_PLAN.map((p) => X.mondayWeeksBack(p.weeksBack)))].join(', ')}`)
  line('admin', 'customers master', X.CUSTOMERS.length)
  line('admin', 'customer enquiries', X.ENQUIRIES.length, `${W(Math.max(...X.ENQUIRIES.map((e) => e.w)))} .. ${W(Math.min(...X.ENQUIRIES.map((e) => e.w)))}`)
  line('admin', 'customer po headers', X.PURCHASE_ORDERS.length)
  line('admin', 'customer orders (PO lines)', X.PURCHASE_ORDERS.flatMap((p) => p.lines).length, `${X.PURCHASE_ORDERS.flatMap((p) => p.lines).filter((l) => l.plan).length} planned in Phase 2`)
  line('admin', 'raw material transactions (GRN)', X.GRNS.length, `${W(Math.max(...X.GRNS.map((g) => g.w)))} .. ${W(Math.min(...X.GRNS.map((g) => g.w)))}`)

  console.log('\nPhase 2 (supervisor)')
  const planned = X.PURCHASE_ORDERS.flatMap((po) => po.lines.filter((l) => l.plan).map((l) => ({ po, l })))
  line('supervisor', 'plan_production_orders (lines)', planned.length, planned.map(({ po, l }) => `${po.po_number}/${l.line}: ${l.plan.join('+')} -> PRD ${l.prds.join(',')}`).join('; '))
  line('supervisor', '  -> production orders (PRDs)', planned.reduce((a, { l }) => a + l.plan.length, 0))
  const issueRows = Object.keys(X.RM_ISSUE_W).flatMap((letter) => {
    const { l } = planned.find(({ l: x }) => x.prds.includes(letter))
    const qty = l.plan[l.prds.indexOf(letter)]
    return X.BOM.filter((b) => b.part_serial_number === l.part_serial_number).map((b) => `${letter}:${b.raw_material_code} ${Math.round(qty * b.consumption_per_unit * 1000) / 1000}`)
  })
  line('supervisor', 'raw material transactions (issue)', issueRows.length, issueRows.join(', '))
  console.log('  STOP -> prints linking SQL: admin->EMP-001, supervisor->EMP-002, operator->EMP-003')

  console.log('\nPhase 3 (operator)')
  const hours = X.PRODUCTION_STEPS.flatMap((s) => s.days.map((d) => hourRows(d).length)).reduce((a, b) => a + b, 0)
  line('operator', 'production logs', X.PRODUCTION_STEPS.length, `${X.PRODUCTION_STEPS.filter((s) => s.end === 'complete').length} completed, ${X.PRODUCTION_STEPS.filter((s) => s.end === 'endlog').length} End Log, ${X.PRODUCTION_STEPS.filter((s) => s.end === 'open').length} open`)
  line('operator', 'production log hours', hours, `${X.PRODUCTION_STEPS.flatMap((s) => s.days).length} (date, shift) blocks x up to ${X.SLOTS_PER_SHIFT} slots`)
  for (const s of X.PRODUCTION_STEPS) {
    const acc = s.days.reduce((a, d) => a + d.produced - d.rejected - d.rework, 0)
    console.log(`      PRD ${s.prd} seq ${String(s.seq).padEnd(2)} ${s.machine_id}${s.substitute ? ` (substitute: ${s.substitute})` : ''}  ${s.days.map((d) => `${W(d.w)} ${d.shift}: ${d.produced}/${d.rejected}/${d.rework}`).join(' + ')}  accepted ${acc}  -> ${s.end}`)
  }

  console.log('\nPhase 4 (supervisor)')
  const blocks = X.PRODUCTION_STEPS.filter((s) => s.end !== 'open').flatMap((s) => s.days.map(() => 1)).length
  line('supervisor', 'production shift verifications', blocks, `${blocks - 1} Approved, 1 Rejected (PRD ${X.REJECTED_SHIFT.prd} seq ${X.REJECTED_SHIFT.seq} ${W(X.REJECTED_SHIFT.w)} ${X.REJECTED_SHIFT.shift}); open log's shift left Pending`)
  line('supervisor', 'job order dispatch', X.DISPATCHES.length, X.DISPATCHES.map((d) => `${d.key} PRD ${d.prd} ${d.qty} ${W(d.w)}`).join('; '))
  line('supervisor', 'create_job_order_receipt', X.DISPATCHES.flatMap((d) => d.receipts ?? []).length, X.DISPATCHES.filter((d) => d.receipts).map((d) => `${d.key}: ${d.receipts.map((r) => `${r.qty}/${d.qty} ${W(r.w)}`).join(', ')}`).join('; '))
  line('supervisor', 'close_job_order_short', X.DISPATCHES.filter((d) => d.closeShort).length, X.DISPATCHES.filter((d) => d.closeShort).map((d) => d.key).join(', '))
  const overdue = X.DISPATCHES.find((d) => !d.receipts && !d.closeShort)
  const overduePart = planned.find(({ l }) => l.prds.includes(overdue.prd)).l.part_serial_number
  const lead = X.JOB_WORK_TYPES.find((j) => j.job_work_code === X.CYCLE_TIMES.find((c) => c.part_serial_number === overduePart && c.seq === overdue.seq).job_work_code).lead_time_days
  console.log(`      overdue DC: ${overdue.key} dispatched ${X.wd(overdue.w)}, expected ${X.addDaysISO(X.wd(overdue.w), lead)} (< today ${X.wd(0)}: ${X.addDaysISO(X.wd(overdue.w), lead) < X.isoDate(new Date())})`)
  line('supervisor', 'wip transactions', X.WIP_MOVES.length, X.WIP_MOVES.map((m) => `${m.type} ${m.qty} ${W(m.w)}`).join('; '))
  line('supervisor', 'finished goods transactions', X.FG_MOVES.length, X.FG_MOVES.map((m) => `${m.type} ${m.qty} ${W(m.w)}`).join('; '))
  line('supervisor', 'quality logs', X.QUALITY_LOGS.length)
  line('supervisor', 'quality log readings', X.QUALITY_LOGS.reduce((a, q) => a + Object.keys(q.readings).length, 0), '1 out of tolerance (Ground Diameter 38.035 vs 38 +/- 0.02)')
  line('supervisor', 'maintenance logs', X.MAINTENANCE_LOGS.length)
  line('supervisor', 'maintenance log items', X.MAINTENANCE_LOGS.reduce((a, v) => a + X.MAINTENANCE_CHECKLIST.filter((c) => c.machine_id === v.machine_id).length, 0), '1 Not OK')
  line('supervisor', 'customer complaints', 1, `Open, ${W(X.COMPLAINT.w)}`)
  line('supervisor', 'void_entry (GRN)', 1, `${X.GRN_TO_VOID.key} (never issued)`)

  console.log('\nRoute card stages per planned part -- the app\'s own collapseCycleRows (what buildStageSnapshot sends to plan_production_orders):')
  const withIds = X.CYCLE_TIMES.map((c, i) => ({ ...c, id: i + 1 }))
  for (const part of [...new Set(planned.map(({ l }) => l.part_serial_number))]) {
    const snap = app.collapseCycleRows(withIds.filter((c) => c.part_serial_number === part).sort((a, b) => a.seq - b.seq || a.id - b.id))
    console.log(`  ${part}: ${snap.map((s) => `${s.seq} ${s.operation} ${s.machine_id ?? s.job_work_code}`).join(' -> ')}`)
  }

  const checks = X.chronologyChecks(X)
  const bad = checks.filter((c) => !c.ok)
  console.log(`\nChronology: ${checks.length - bad.length}/${checks.length} checks pass${bad.length ? '' : ' (GRN < RM issue < first log < later stages < DC < receipt < WIP/FG < despatch < quality/complaint)'}`)
  for (const c of bad) console.log(`  FAIL: ${c.label} (W-${c.earlier} vs W-${c.later})`)
  const shifts = new Set(X.SHIFTS.map((s) => s.shift_code))
  const futureOrBadShift = X.PRODUCTION_STEPS.flatMap((s) => s.days).filter((d) => d.w < 1 || !shifts.has(d.shift))
  console.log(`Production days on a defined shift and before today: ${futureOrBadShift.length ? 'NO' : 'yes'}`)
  if (bad.length || futureOrBadShift.length) process.exitCode = 1
}

// ---- main ---------------------------------------------------------------------------------------------

const PHASE_LOGIN = { 1: 'admin', 2: 'supervisor', 3: 'operator', 4: 'supervisor' }

try {
  if (REFRESH) {
    console.log(REFRESH_NOTE)
  } else if (DRY_RUN && phaseArg === 5) {
    await dryRunTopUp(await loadApp())
  } else if (DRY_RUN) {
    await dryRun(await loadApp())
  } else if (CHECK) {
    const cfg = loadConfig()
    const sb = await connect(cfg)
    const app = await loadApp()
    console.log(`Phase 5 preflight (read-only) -- wave ${WAVE}, demo project only.\n`)
    await checkTopUp(sb, app, cfg)
    await sb.auth.signOut()
  } else if (phaseArg === 5) {
    const cfg = loadConfig()
    const sb = await connect(cfg)
    const app = await loadApp()
    console.log(`Phase 5 (top-up wave ${WAVE}) -- demo project only.`)
    await phase5(sb, app, cfg)
    await sb.auth.signOut()
  } else {
    const cfg = loadConfig()
    const sb = await connect(cfg)
    const app = await loadApp()
    const me = await signIn(sb, cfg, PHASE_LOGIN[phaseArg])
    console.log(`Phase ${phaseArg} (${PHASE_LOGIN[phaseArg]}) -- demo project only.\n`)
    if (phaseArg === 1) await phase1(sb, app, me)
    if (phaseArg === 2) await phase2(sb, app, me, cfg)
    if (phaseArg === 3) await phase3(sb, app, me)
    if (phaseArg === 4) await phase4(sb, app, me)
    if (phaseArg !== 2) printCounts(`Phase ${phaseArg} -- rows inserted / skipped:`)
    await sb.auth.signOut()
  }
} catch (error) {
  if (!(error instanceof Stop)) {
    console.error(`\nSTOPPED (unexpected): ${error.message}`)
    printCounts('Rows written before the stop:')
  }
  process.exitCode = 1
}
