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

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const FRONTEND = path.join(ROOT, 'frontend')
const SRC = path.join(FRONTEND, 'src')

// ---- args -------------------------------------------------------------------

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const phaseArg = argv.includes('--phase') ? Number(argv[argv.indexOf('--phase') + 1]) : null
if (!DRY_RUN && ![1, 2, 3, 4].includes(phaseArg)) {
  console.error('Usage: node scripts/seed-demo/seed-demo.mjs --phase <1|2|3|4>   (or --dry-run)')
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
const shiftOf = (code) => D.SHIFTS.find((s) => s.shift_code === code)
/** ISO timestamp of a shift's start on a date (local time of the machine running the seed). */
const shiftStartISO = (date, code) => new Date(`${date}T${shiftOf(code).start_time}:00`).toISOString()

/** Splits a day's qty over the shift's hour slots; rejects / rework sit in the last slots. */
function hourRows({ produced, rejected, rework }) {
  const n = D.SLOTS_PER_SHIFT
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
  for (const po of D.PURCHASE_ORDERS) {
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
  const T = (d) => D.wd(d)

  const shifts = await app.listShifts()
  for (const s of D.SHIFTS) {
    if (shifts.some((x) => x.shift_code === s.shift_code)) { tally('shifts master', 'skipped'); continue }
    const computed = app.computeShiftHours(s)
    if (computed.error) fail(`shift ${s.shift_code}: ${computed.error}`)
    await step(`shift ${s.shift_code}`, 'shifts master', () => app.createShift({
      ...s, shift_duration: computed.shift_duration || null, net_working_hours: computed.net_working_hours || null,
    }))
    tally('shifts master', 'inserted')
  }

  const employees = await app.listEmployees()
  for (const e of D.EMPLOYEES) {
    if (employees.some((x) => x.employee_id === e.employee_id)) { tally('employees master', 'skipped'); continue }
    await step(`employee ${e.employee_id}`, 'employees master', () => app.createEmployee(e))
    tally('employees master', 'inserted')
  }

  const ops = await app.listMachineOperationOptions()
  for (const o of D.OPERATIONS) {
    if (ops.includes(o)) { tally('operations master', 'skipped'); continue }
    await step(`operation ${o}`, 'operations master', () => app.createMachineOperationOption(o))
    tally('operations master', 'inserted')
  }

  const machines = await app.listMachines()
  for (const m of D.MACHINES) {
    if (machines.some((x) => x.machine_id === m.machine_id)) tally('machines master', 'skipped')
    else {
      await step(`machine ${m.machine_id}`, 'machines master', () => app.createMachine(m))
      tally('machines master', 'inserted')
    }
    const wanted = D.MACHINE_OPERATIONS.filter((x) => x.machine_id === m.machine_id).map((x) => x.operation)
    const have = await app.listOperationsForMachine(m.machine_id)
    if (have.length) { tally('machine operations', 'skipped', wanted.length); continue } // never overwrite an existing set
    await step(`operations of ${m.machine_id}`, 'machine operations', () => app.setMachineOperations(m.machine_id, wanted))
    tally('machine operations', 'inserted', wanted.length)
  }

  const products = await app.listProducts()
  for (const p of D.PRODUCTS) {
    if (products.some((x) => x.part_serial_number === p.part_serial_number)) { tally('products master', 'skipped'); continue }
    await step(`product ${p.part_serial_number}`, 'products master', () => app.createProduct(p))
    tally('products master', 'inserted')
  }

  const rms = await app.listRawMaterials()
  for (const r of D.RAW_MATERIALS) {
    if (rms.some((x) => x.raw_material_code === r.raw_material_code)) { tally('raw materials master', 'skipped'); continue }
    await step(`raw material ${r.raw_material_code}`, 'raw materials master', () => app.createRawMaterial(r))
    tally('raw materials master', 'inserted')
  }

  const suppliers = await app.listSuppliers()
  for (const s of D.SUPPLIERS) {
    if (suppliers.some((x) => x.supplier_id === s.supplier_id)) { tally('suppliers master', 'skipped'); continue }
    await step(`supplier ${s.supplier_id}`, 'suppliers master', () => app.createSupplier(s))
    tally('suppliers master', 'inserted')
  }

  for (const link of D.RM_SUPPLIERS) {
    const have = await app.listSuppliersForRawMaterial(link.raw_material_code)
    if (have.some((x) => x.supplier_id === link.supplier_id)) { tally('rm suppliers', 'skipped'); continue }
    await step(`rm supplier ${link.raw_material_code}/${link.supplier_id}`, 'rm suppliers', () =>
      app.createRmSupplierLink({ raw_material_code: link.raw_material_code, ...app.supplierRowPayload(link) }))
    tally('rm suppliers', 'inserted')
  }

  const bom = await app.listAllProductRawMaterials()
  for (const p of D.PRODUCTS) {
    const wanted = D.BOM.filter((b) => b.part_serial_number === p.part_serial_number)
    if (bom.some((b) => b.part_serial_number === p.part_serial_number)) { tally('product raw materials', 'skipped', wanted.length); continue }
    await step(`BOM of ${p.part_serial_number}`, 'product raw materials', () => app.setProductRawMaterials(p.part_serial_number, wanted))
    tally('product raw materials', 'inserted', wanted.length)
  }

  const batches = await app.listProductionBatches()
  for (const b of D.BATCH_SIZES) {
    if (batches.some((x) => x.part_serial_number === b.part_serial_number)) { tally('production batch master', 'skipped'); continue }
    await step(`batch size ${b.part_serial_number}`, 'production batch master', () => app.createProductionBatch(b))
    tally('production batch master', 'inserted')
  }

  const jwts = await app.listJobWorkTypes()
  for (const j of D.JOB_WORK_TYPES) {
    if (jwts.some((x) => x.job_work_code === j.job_work_code)) { tally('job work master', 'skipped'); continue }
    await step(`job work ${j.job_work_code}`, 'job work master', () => app.createJobWorkType(j))
    tally('job work master', 'inserted')
  }

  const vendors = await app.listVendors()
  for (const v of D.VENDORS) {
    if (vendors.some((x) => x.vendor_id === v.vendor_id)) tally('vendors master', 'skipped')
    else {
      await step(`vendor ${v.vendor_id}`, 'vendors master', () => app.createVendor(v))
      tally('vendors master', 'inserted')
    }
    const wanted = D.VENDOR_JOB_WORK_TYPES.filter((x) => x.vendor_id === v.vendor_id).map((x) => x.job_work_code)
    const have = await app.listJobWorkTypesForVendor(v.vendor_id)
    if (have.length) { tally('vendor job work types', 'skipped', wanted.length); continue }
    await step(`job work types of ${v.vendor_id}`, 'vendor job work types', () => app.setVendorJobWorkTypes(v.vendor_id, wanted))
    tally('vendor job work types', 'inserted', wanted.length)
  }

  const cycles = await app.listCycleTimes()
  for (const c of D.CYCLE_TIMES) {
    const k = keyOf(c.part_serial_number, c.seq, c.machine_id, c.job_work_code)
    if (cycles.some((x) => keyOf(x.part_serial_number, x.seq, x.machine_id, x.job_work_code) === k)) { tally('cycle time master', 'skipped'); continue }
    await step(`cycle time ${c.part_serial_number} seq ${c.seq} ${c.machine_id ?? c.job_work_code}`, 'cycle time master', () => app.createCycleTime(c))
    tally('cycle time master', 'inserted')
  }

  const params = await app.listQualityParameters()
  for (const q of D.QUALITY_PARAMETERS) {
    const k = keyOf(q.part_serial_number, q.machine_id, q.type_of_operation, q.quality_parameter)
    if (params.some((x) => keyOf(x.part_serial_number, x.machine_id, x.type_of_operation, x.quality_parameter) === k)) { tally('quality master', 'skipped'); continue }
    await step(`quality parameter ${k}`, 'quality master', () => app.createQualityParameter(q))
    tally('quality master', 'inserted')
  }

  const checklist = await app.listMaintenanceChecklist()
  for (const c of D.MAINTENANCE_CHECKLIST) {
    if (checklist.some((x) => x.machine_id === c.machine_id && x.checklist_item === c.checklist_item)) { tally('maintenance master', 'skipped'); continue }
    await step(`checklist ${c.machine_id}: ${c.checklist_item}`, 'maintenance master', () => app.createMaintenanceChecklistItem(c))
    tally('maintenance master', 'inserted')
  }

  const schedules = await app.listMaintenanceSchedules()
  for (const s of D.MAINTENANCE_SCHEDULE) {
    if (schedules.some((x) => x.machine_id === s.machine_id)) { tally('maintenance schedule', 'skipped'); continue }
    const last = T(s.lastW)
    await step(`schedule ${s.machine_id}`, 'maintenance schedule', () => app.saveMaintenanceSchedule({
      machine_id: s.machine_id, maintenance_frequency: s.maintenance_frequency, last_maintenance_date: last,
      next_maintenance_due: app.addFrequency(last, s.maintenance_frequency), status: s.status, remarks: null,
    }))
    tally('maintenance schedule', 'inserted')
  }

  const plan = await rows(sb, 'maintenance plan')
  for (const p of D.MAINTENANCE_PLAN) {
    const week = D.mondayWeeksBack(p.weeksBack)
    if (plan.some((x) => x.machine_id === p.machine_id && x.planned_week_start_date === week)) { tally('maintenance plan', 'skipped'); continue }
    await step(`maintenance plan ${p.machine_id} ${week}`, 'maintenance plan', () => app.scheduleMaintenanceWeek(p.machine_id, week))
    tally('maintenance plan', 'inserted')
  }

  const customers = await app.listCustomers()
  for (const c of D.CUSTOMERS) {
    if (customers.some((x) => x.customer_id === c.customer_id)) { tally('customers master', 'skipped'); continue }
    await step(`customer ${c.customer_id}`, 'customers master', () => app.createCustomer(c))
    tally('customers master', 'inserted')
  }

  let enquiries = await app.listCustomerEnquiries()
  for (const e of D.ENQUIRIES) {
    const date = T(e.w)
    const product = D.PRODUCTS.find((p) => p.part_serial_number === e.part_serial_number)
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
  for (const po of D.PURCHASE_ORDERS) {
    const poDate = T(po.w)
    let header = headers.find((h) => h.customer_id === po.customer_id && h.po_number === po.po_number)
    if (header) tally('customer po headers', 'skipped')
    else {
      header = await step(`PO ${po.po_number}`, 'customer po headers', () => app.createPoHeader({
        customer_id: po.customer_id, po_number: po.po_number, po_date: poDate, ...D.PO_TERMS,
      }))
      tally('customer po headers', 'inserted')
    }
    const lines = await app.listOrdersForPoHeader(header.id)
    for (const l of po.lines) {
      if (lines.some((x) => x.part_serial_number === l.part_serial_number && String(x.customer_po_line_no ?? '') === l.line)) { tally('customer orders (PO lines)', 'skipped'); continue }
      const qtn = enquiries.find((e) => e.customer_id === po.customer_id && e.part_serial_number === l.part_serial_number)
      await step(`PO line ${po.po_number}/${l.line}`, 'customer orders', () => app.createCustomerOrder(app.withTypedFields({
        qtn_no: qtn?.qtn_no || null, customer_id: po.customer_id, po_number: po.po_number, po_date: poDate,
        part_serial_number: l.part_serial_number, order_qty: l.order_qty, order_type: null,
        expected_delivery: addCalendarDays(l.deliveryDays), customer_po_line_no: l.line, parent_po_id: header.id,
      }, ORDER_LINE_TYPES)))
      tally('customer orders (PO lines)', 'inserted')
    }
  }

  const receipts = await rows(sb, 'raw material transactions', (q) => q.eq('transaction_type', 'Receipt'))
  for (const g of D.GRNS) {
    const date = T(g.w)
    const exists = receipts.some((x) => x.raw_material_code === g.raw_material_code && sameNum(x.qty, g.qty) && x.transaction_date === date && x.supplier_id === g.supplier_id)
    if (exists) { tally('raw material transactions (GRN)', 'skipped'); continue }
    await step(`GRN ${g.key} ${g.raw_material_code} ${g.qty}`, 'raw material transactions', () => app.createRawMaterialTransaction({
      raw_material_code: g.raw_material_code, transaction_type: 'Receipt', qty: g.qty, transaction_date: date,
      supplier_id: g.supplier_id, employee_id: D.STORES_STAFF.employee_id, shift_code: D.STORES_STAFF.shift_code, user_id: me.userId,
    }))
    tally('raw material transactions (GRN)', 'inserted')
  }
}

/** Expected delivery: calendar days from today (negative = already past -> overdue line). */
function addCalendarDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return D.isoDate(d)
}

// ---- Phase 2: supervisor -------------------------------------------------------------------

async function phase2(sb, app, me, cfg) {
  const headers = await rows(sb, 'customer po headers')
  const allLines = await rows(sb, 'customer orders')
  const batchMaster = await app.listProductionBatches()
  const bom = await app.listAllProductRawMaterials()

  for (const po of D.PURCHASE_ORDERS) {
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
        shiftHours: D.SHIFT_HOURS,
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
  for (const [letter, w] of Object.entries(D.RM_ISSUE_W)) {
    const prd = prds.find((p) => p.prd_no === needPrd(map, letter))
    const order = (await app.listOrdersByPrd()).find((o) => o.prd_no === prd.prd_no)
    const date = D.wd(w)
    for (const b of bom.filter((x) => x.part_serial_number === order.part_serial_number)) {
      const qty = Math.round(num(prd.prd_qty) * num(b.consumption_per_unit) * 1000) / 1000
      const exists = issues.some((x) => x.raw_material_code === b.raw_material_code && sameNum(x.qty, qty) && x.transaction_date === date && x.part_serial_number === order.part_serial_number)
      if (exists) { tally('raw material transactions (issue)', 'skipped'); continue }
      await step(`RM issue ${b.raw_material_code} ${qty} for ${prd.prd_no}`, 'raw material transactions', () => app.createRawMaterialTransaction({
        raw_material_code: b.raw_material_code, transaction_type: 'Issue', qty, transaction_date: date,
        part_serial_number: order.part_serial_number, employee_id: D.STORES_STAFF.employee_id, shift_code: D.STORES_STAFF.shift_code, user_id: me.userId,
      }))
      tally('raw material transactions (issue)', 'inserted')
    }
  }

  printCounts('Phase 2 -- rows inserted / skipped:')

  // STOP: linking SQL for all three logins (text only -- the seed never runs SQL).
  const ids = {}
  for (const role of ['admin', 'supervisor', 'operator']) ids[role] = await signIn(sb, cfg, role)
  await sb.auth.signOut()
  console.log('\n=== STOP: link the demo logins to their employees ===')
  console.log('Run this yourself in the Supabase SQL editor of the DEMO project, then confirm and run Phase 3:\n')
  for (const [role, employeeId] of Object.entries(D.LOGIN_EMPLOYEES)) {
    const now = ids[role].employeeId ? `   -- currently linked to ${ids[role].employeeId}` : ''
    console.log(`update "app users" set employee_id = '${employeeId}' where user_id = '${ids[role].userId}';   -- demo ${role}${now}`)
  }
  console.log('\nThen: node scripts/seed-demo/seed-demo.mjs --phase 3')
}

// ---- Phase 3: operator -----------------------------------------------------------------------

async function phase3(sb, app, me) {
  if (me.employeeId !== D.LOGIN_EMPLOYEES.operator) {
    fail(`the demo operator is linked to ${me.employeeId ?? 'no employee'}, expected ${D.LOGIN_EMPLOYEES.operator} -- run the linking SQL printed by Phase 2 first.`)
  }
  const map = await prdMap(sb)
  for (const s of D.PRODUCTION_STEPS) {
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

    const cycleRows = await app.listCycleTimesForPart(order.part_serial_number)
    const masterCycleTime = app.cycleTimeForMachine({ cycleTimeRows: cycleRows, seq: stage.seq, chosenId: s.machine_id, plannedId: stage.machine_id, frozenCycleTime: stage.cycle_time_min }).cycleTimeMin
    const substituteNeeded = app.substituteReasonRequired(s.machine_id, stage.machine_id)
    if (substituteNeeded && !s.substitute) fail(`${label}: planned machine is ${stage.machine_id} -- the seed step has no substitute reason.`)
    if (!substituteNeeded && s.substitute) fail(`${label}: planned machine is ${stage.machine_id}, so the seeded substitute reason would not apply.`)
    const first = s.days[0]
    const firstDate = D.wd(first.w)

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

    for (const d of s.days) {
      const date = D.wd(d.w)
      const hourRowsStamped = hourRows(d).map((r) => ({ ...r, log_id: log.id, log_date: date, shift_code: d.shift, employee_id: s.employee_id }))
      await step(`hours ${date} shift ${d.shift}: ${label}`, 'production log hours', () => app.addProductionLogHours(hourRowsStamped))
      tally('production log hours', 'inserted', hourRowsStamped.length)
    }

    const lastDate = D.wd(s.days[s.days.length - 1].w)
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
}

// ---- Phase 4: supervisor -----------------------------------------------------------------------

async function phase4(sb, app, me) {
  const map = await prdMap(sb)
  const stagesOf = async (letter) => app.getStagesForPrd(needPrd(map, letter))
  const stageId = async (letter, seq) => (await stagesOf(letter)).find((x) => Number(x.seq) === seq)?.id ?? fail(`PRD ${letter} has no stage ${seq}`)
  const orders = await app.listOrdersByPrd()
  const orderOf = (letter) => orders.find((o) => o.prd_no === needPrd(map, letter))

  // 1. Shift verifications -- every (log, date, shift) of a closed seeded log.
  const rejectStage = await stageId(D.REJECTED_SHIFT.prd, D.REJECTED_SHIFT.seq)
  const rejectKey = keyOf(needPrd(map, D.REJECTED_SHIFT.prd), rejectStage, D.wd(D.REJECTED_SHIFT.w), D.REJECTED_SHIFT.shift)
  for (const letter of [...new Set(D.PRODUCTION_STEPS.map((s) => s.prd))]) {
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
        logId: log.id, logDate: h.log_date, shiftCode: h.shift_code, status: reject ? 'Rejected' : 'Approved', rejectReason: reject ? D.REJECTED_SHIFT.reason : null,
      }))
      tally(`production shift verifications (${reject ? 'Rejected' : 'Approved'})`, 'inserted')
    }
  }

  // 2. Jobwork: DCs, receipts, close short; one DC stays open past its expected date.
  const jwts = await app.listJobWorkTypes()
  for (const dc of D.DISPATCHES) {
    const prdNo = needPrd(map, dc.prd)
    const stage = (await stagesOf(dc.prd)).find((x) => Number(x.seq) === dc.seq)
    const date = D.wd(dc.w)
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
        expected_receipt_date: app.toDateOrNull(lead ? D.addDaysISO(date, lead) : ''),
      }))
      tally('job order dispatch', 'inserted')
    }
    const got = await app.listReceiptsForDcNos([row.dc_no])
    for (const [i, r] of (dc.receipts ?? []).entries()) {
      if (got[i]) { tally('job order receipt', 'skipped'); continue }
      await step(`receipt ${r.qty} on ${row.dc_no}`, 'create_job_order_receipt', () => app.createReceipt({ dc_no: row.dc_no, qty_received: r.qty, receipt_date: D.wd(r.w) }))
      tally('job order receipt', 'inserted')
    }
    if (dc.closeShort) {
      const current = (await rows(sb, 'job order dispatch', (q) => q.eq('dc_no', row.dc_no)))[0]
      if (!current.is_open) { tally('close_job_order_short', 'skipped'); continue }
      await step(`close ${row.dc_no} short`, 'close_job_order_short', () => app.closeDispatchShort(row.dc_no, dc.closeShort))
      tally('close_job_order_short', 'inserted')
    }
  }

  // 3. WIP receipt / issue.
  for (const m of D.WIP_MOVES) {
    const prdNo = needPrd(map, m.prd)
    const fromId = await stageId(m.prd, m.fromSeq)
    const toId = m.toSeq ? await stageId(m.prd, m.toSeq) : null
    const date = D.wd(m.w)
    const have = (await app.listWipTransactionsForPrd(prdNo)).some((x) => x.transaction_type === m.type && x.nature_of_operation_stage_id === fromId && sameNum(x.qty, m.qty) && x.transaction_date === date)
    if (have) { tally(`wip transactions (${m.type})`, 'skipped'); continue }
    const payload = { prd_no: prdNo, nature_of_operation_stage_id: fromId, qty: m.qty, employee_id: m.employee_id, shift_code: m.shift_code, transaction_date: date, remarks: m.remarks, user_id: me.userId }
    await step(`WIP ${m.type} ${prdNo} ${m.qty}`, 'wip transactions', () => (m.type === 'Receipt' ? app.createWipReceipt(payload) : app.createWipIssue({ ...payload, target_stage_id: toId })))
    tally(`wip transactions (${m.type})`, 'inserted')
  }

  // 4. Finished goods receipt + despatch.
  for (const m of D.FG_MOVES) {
    const prdNo = needPrd(map, m.prd)
    const order = orderOf(m.prd)
    const date = D.wd(m.w)
    const have = (await rows(sb, 'finished goods transactions', (q) => q.eq('prd_no', prdNo))).some((x) => x.transaction_type === m.type && sameNum(x.qty, m.qty) && x.transaction_date === date)
    if (have) { tally(`finished goods transactions (${m.type})`, 'skipped'); continue }
    await step(`FG ${m.type} ${prdNo} ${m.qty}`, 'finished goods transactions', () => app.createFinishedGoodsTransaction({
      part_serial_number: order.part_serial_number, transaction_type: m.type, qty: m.qty, transaction_date: date, prd_no: prdNo,
      ...(m.type === 'Dispatch' ? { customer_id: order.customer_id ?? null } : {}),
      employee_id: m.employee_id, shift_code: m.shift_code, user_id: me.userId,
    }))
    tally(`finished goods transactions (${m.type})`, 'inserted')
  }

  // 5. Quality inspections + readings (one out of tolerance).
  const params = await app.listQualityParameters()
  for (const q of D.QUALITY_LOGS) {
    const prdNo = needPrd(map, q.prd)
    const stage = (await stagesOf(q.prd)).find((x) => Number(x.seq) === q.seq)
    const date = D.wd(q.w)
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

  // 6. Maintenance visits + checklist results.
  const visits = await rows(sb, 'maintenance logs')
  for (const v of D.MAINTENANCE_LOGS) {
    const date = D.wd(v.w)
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

  // 7. Customer complaint (Open).
  const c = D.COMPLAINT
  const complaintDate = D.wd(c.w)
  if ((await app.listComplaints()).some((x) => x.customer_id === c.customer_id && x.part_serial_number === c.part_serial_number && x.complaint_date === complaintDate)) tally('customer complaints', 'skipped')
  else {
    const form = {
      ...app.emptyComplaintForm(complaintDate),
      customer_id: c.customer_id, contact_person: c.contact_person, contact_number_email: c.contact_number_email, complaint_source: c.complaint_source,
      part_serial_number: c.part_serial_number, customer_po_no: c.customer_po_no, invoice_no: c.invoice_no, batch_lot_no: needPrd(map, c.prd),
      qty_supplied: String(c.qty_supplied), qty_complained: String(c.qty_complained), manufacturing_date: D.wd(c.manufacturingW),
      complaint_type: c.complaint_type, complaint_category: c.complaint_category, complaint_description: c.complaint_description,
      defect_problem: c.defect_problem, severity: c.severity, priority: c.priority,
    }
    const error = app.validateRegistration(form)
    if (error) fail(`complaint: ${error}`)
    const saved = await step('customer complaint', 'customer complaints', () => app.createComplaint(app.registrationPayload(form)))
    console.log(`  complaint ${saved.complaint_no} (Open)`)
    tally('customer complaints', 'inserted')
  }

  // 8. Void one GRN that was never issued.
  const g = D.GRNS.find((x) => x.key === D.GRN_TO_VOID.key)
  const grn = (await rows(sb, 'raw material transactions', (q) => q.eq('transaction_type', 'Receipt').eq('raw_material_code', g.raw_material_code)))
    .find((x) => sameNum(x.qty, g.qty) && x.transaction_date === D.wd(g.w) && x.supplier_id === g.supplier_id)
    ?? fail(`GRN ${g.key} not found -- run Phase 1 first.`)
  if (grn.voided_at) tally('void_entry (GRN)', 'skipped')
  else {
    await step(`void GRN ${grn.doc_no}`, 'void_entry', () => app.voidEntry(app.VOID_TYPES.GRN, grn.doc_no, D.GRN_TO_VOID.reason))
    tally('void_entry (GRN)', 'inserted')
  }
}

// ---- dry run (offline: no env read, no network) ---------------------------------------------------

async function dryRun(app) {
  const W = (k) => `W-${k} ${D.wd(k)}`
  console.log(`DRY RUN -- offline: no .env read, no sign-in, no network. Dates relative to today (${D.wd(0)}), Sundays skipped.\n`)
  const line = (login, table, n, note = '') => console.log(`  [${login.padEnd(10)}] ${table.padEnd(34)} ${String(n).padStart(4)}  ${note}`)

  console.log('Phase 1 (admin)')
  line('admin', 'shifts master', D.SHIFTS.length, D.SHIFTS.map((s) => `${s.shift_code} ${s.start_time}-${s.end_time}`).join(', '))
  line('admin', 'employees master', D.EMPLOYEES.length, `${D.EMPLOYEES[0].employee_id}..${D.EMPLOYEES.at(-1).employee_id}`)
  line('admin', 'operations master', D.OPERATIONS.length)
  line('admin', 'machines master', D.MACHINES.length, Object.entries(Object.groupBy(D.MACHINES, (m) => m.category)).map(([c, ms]) => `${c} x${ms.length}`).join(', '))
  line('admin', 'machine operations', D.MACHINE_OPERATIONS.length)
  line('admin', 'products master', D.PRODUCTS.length)
  line('admin', 'raw materials master', D.RAW_MATERIALS.length)
  line('admin', 'suppliers master', D.SUPPLIERS.length)
  line('admin', 'rm suppliers', D.RM_SUPPLIERS.length)
  line('admin', 'product raw materials (BOM)', D.BOM.length)
  line('admin', 'production batch master', D.BATCH_SIZES.length)
  line('admin', 'job work master', D.JOB_WORK_TYPES.length)
  line('admin', 'vendors master', D.VENDORS.length)
  line('admin', 'vendor job work types', D.VENDOR_JOB_WORK_TYPES.length)
  line('admin', 'cycle time master', D.CYCLE_TIMES.length, `outsourced: ${D.CYCLE_TIMES.filter((c) => c.type === 'Outsourced').map((c) => `${c.part_serial_number} seq ${c.seq} ${c.job_work_code}`).join(', ')}`)
  line('admin', 'quality master', D.QUALITY_PARAMETERS.length)
  line('admin', 'maintenance master (checklist)', D.MAINTENANCE_CHECKLIST.length)
  line('admin', 'maintenance schedule', D.MAINTENANCE_SCHEDULE.length)
  line('admin', 'maintenance plan', D.MAINTENANCE_PLAN.length, `weeks ${[...new Set(D.MAINTENANCE_PLAN.map((p) => D.mondayWeeksBack(p.weeksBack)))].join(', ')}`)
  line('admin', 'customers master', D.CUSTOMERS.length)
  line('admin', 'customer enquiries', D.ENQUIRIES.length, `${W(Math.max(...D.ENQUIRIES.map((e) => e.w)))} .. ${W(Math.min(...D.ENQUIRIES.map((e) => e.w)))}`)
  line('admin', 'customer po headers', D.PURCHASE_ORDERS.length)
  line('admin', 'customer orders (PO lines)', D.PURCHASE_ORDERS.flatMap((p) => p.lines).length, `${D.PURCHASE_ORDERS.flatMap((p) => p.lines).filter((l) => l.plan).length} planned in Phase 2`)
  line('admin', 'raw material transactions (GRN)', D.GRNS.length, `${W(Math.max(...D.GRNS.map((g) => g.w)))} .. ${W(Math.min(...D.GRNS.map((g) => g.w)))}`)

  console.log('\nPhase 2 (supervisor)')
  const planned = D.PURCHASE_ORDERS.flatMap((po) => po.lines.filter((l) => l.plan).map((l) => ({ po, l })))
  line('supervisor', 'plan_production_orders (lines)', planned.length, planned.map(({ po, l }) => `${po.po_number}/${l.line}: ${l.plan.join('+')} -> PRD ${l.prds.join(',')}`).join('; '))
  line('supervisor', '  -> production orders (PRDs)', planned.reduce((a, { l }) => a + l.plan.length, 0))
  const issueRows = Object.keys(D.RM_ISSUE_W).flatMap((letter) => {
    const { l } = planned.find(({ l: x }) => x.prds.includes(letter))
    const qty = l.plan[l.prds.indexOf(letter)]
    return D.BOM.filter((b) => b.part_serial_number === l.part_serial_number).map((b) => `${letter}:${b.raw_material_code} ${Math.round(qty * b.consumption_per_unit * 1000) / 1000}`)
  })
  line('supervisor', 'raw material transactions (issue)', issueRows.length, issueRows.join(', '))
  console.log('  STOP -> prints linking SQL: admin->EMP-001, supervisor->EMP-002, operator->EMP-003')

  console.log('\nPhase 3 (operator)')
  const hours = D.PRODUCTION_STEPS.flatMap((s) => s.days.map((d) => hourRows(d).length)).reduce((a, b) => a + b, 0)
  line('operator', 'production logs', D.PRODUCTION_STEPS.length, `${D.PRODUCTION_STEPS.filter((s) => s.end === 'complete').length} completed, ${D.PRODUCTION_STEPS.filter((s) => s.end === 'endlog').length} End Log, ${D.PRODUCTION_STEPS.filter((s) => s.end === 'open').length} open`)
  line('operator', 'production log hours', hours, `${D.PRODUCTION_STEPS.flatMap((s) => s.days).length} (date, shift) blocks x up to ${D.SLOTS_PER_SHIFT} slots`)
  for (const s of D.PRODUCTION_STEPS) {
    const acc = s.days.reduce((a, d) => a + d.produced - d.rejected - d.rework, 0)
    console.log(`      PRD ${s.prd} seq ${String(s.seq).padEnd(2)} ${s.machine_id}${s.substitute ? ` (substitute: ${s.substitute})` : ''}  ${s.days.map((d) => `${W(d.w)} ${d.shift}: ${d.produced}/${d.rejected}/${d.rework}`).join(' + ')}  accepted ${acc}  -> ${s.end}`)
  }

  console.log('\nPhase 4 (supervisor)')
  const blocks = D.PRODUCTION_STEPS.filter((s) => s.end !== 'open').flatMap((s) => s.days.map(() => 1)).length
  line('supervisor', 'production shift verifications', blocks, `${blocks - 1} Approved, 1 Rejected (PRD ${D.REJECTED_SHIFT.prd} seq ${D.REJECTED_SHIFT.seq} ${W(D.REJECTED_SHIFT.w)} ${D.REJECTED_SHIFT.shift}); open log's shift left Pending`)
  line('supervisor', 'job order dispatch', D.DISPATCHES.length, D.DISPATCHES.map((d) => `${d.key} PRD ${d.prd} ${d.qty} ${W(d.w)}`).join('; '))
  line('supervisor', 'create_job_order_receipt', D.DISPATCHES.flatMap((d) => d.receipts ?? []).length, D.DISPATCHES.filter((d) => d.receipts).map((d) => `${d.key}: ${d.receipts.map((r) => `${r.qty}/${d.qty} ${W(r.w)}`).join(', ')}`).join('; '))
  line('supervisor', 'close_job_order_short', D.DISPATCHES.filter((d) => d.closeShort).length, D.DISPATCHES.filter((d) => d.closeShort).map((d) => d.key).join(', '))
  const overdue = D.DISPATCHES.find((d) => !d.receipts && !d.closeShort)
  const overduePart = planned.find(({ l }) => l.prds.includes(overdue.prd)).l.part_serial_number
  const lead = D.JOB_WORK_TYPES.find((j) => j.job_work_code === D.CYCLE_TIMES.find((c) => c.part_serial_number === overduePart && c.seq === overdue.seq).job_work_code).lead_time_days
  console.log(`      overdue DC: ${overdue.key} dispatched ${D.wd(overdue.w)}, expected ${D.addDaysISO(D.wd(overdue.w), lead)} (< today ${D.wd(0)}: ${D.addDaysISO(D.wd(overdue.w), lead) < D.isoDate(new Date())})`)
  line('supervisor', 'wip transactions', D.WIP_MOVES.length, D.WIP_MOVES.map((m) => `${m.type} ${m.qty} ${W(m.w)}`).join('; '))
  line('supervisor', 'finished goods transactions', D.FG_MOVES.length, D.FG_MOVES.map((m) => `${m.type} ${m.qty} ${W(m.w)}`).join('; '))
  line('supervisor', 'quality logs', D.QUALITY_LOGS.length)
  line('supervisor', 'quality log readings', D.QUALITY_LOGS.reduce((a, q) => a + Object.keys(q.readings).length, 0), '1 out of tolerance (Ground Diameter 38.035 vs 38 +/- 0.02)')
  line('supervisor', 'maintenance logs', D.MAINTENANCE_LOGS.length)
  line('supervisor', 'maintenance log items', D.MAINTENANCE_LOGS.reduce((a, v) => a + D.MAINTENANCE_CHECKLIST.filter((c) => c.machine_id === v.machine_id).length, 0), '1 Not OK')
  line('supervisor', 'customer complaints', 1, `Open, ${W(D.COMPLAINT.w)}`)
  line('supervisor', 'void_entry (GRN)', 1, `${D.GRN_TO_VOID.key} (never issued)`)

  console.log('\nRoute card stages per planned part -- the app\'s own collapseCycleRows (what buildStageSnapshot sends to plan_production_orders):')
  const withIds = D.CYCLE_TIMES.map((c, i) => ({ ...c, id: i + 1 }))
  for (const part of [...new Set(planned.map(({ l }) => l.part_serial_number))]) {
    const snap = app.collapseCycleRows(withIds.filter((c) => c.part_serial_number === part).sort((a, b) => a.seq - b.seq || a.id - b.id))
    console.log(`  ${part}: ${snap.map((s) => `${s.seq} ${s.operation} ${s.machine_id ?? s.job_work_code}`).join(' -> ')}`)
  }

  const checks = D.chronologyChecks()
  const bad = checks.filter((c) => !c.ok)
  console.log(`\nChronology: ${checks.length - bad.length}/${checks.length} checks pass${bad.length ? '' : ' (GRN < RM issue < first log < later stages < DC < receipt < WIP/FG < despatch < quality/complaint)'}`)
  for (const c of bad) console.log(`  FAIL: ${c.label} (W-${c.earlier} vs W-${c.later})`)
  const shifts = new Set(D.SHIFTS.map((s) => s.shift_code))
  const futureOrBadShift = D.PRODUCTION_STEPS.flatMap((s) => s.days).filter((d) => d.w < 1 || !shifts.has(d.shift))
  console.log(`Production days on a defined shift and before today: ${futureOrBadShift.length ? 'NO' : 'yes'}`)
  if (bad.length || futureOrBadShift.length) process.exitCode = 1
}

// ---- main ---------------------------------------------------------------------------------------------

const PHASE_LOGIN = { 1: 'admin', 2: 'supervisor', 3: 'operator', 4: 'supervisor' }

try {
  if (DRY_RUN) {
    await dryRun(await loadApp())
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
