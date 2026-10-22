#!/usr/bin/env node
// READ-ONLY schema check for the seed: signs in as the demo admin and, for
// every table the seed writes (phases 1-4), runs
//   select=<exact columns the seed sends or keys on>&limit=0
// so PostgREST validates each column name without returning or writing any
// row. Same env rules as seed-demo.mjs (values never printed; aborts unless
// the URL host starts with DEMO_PROJECT_REF).
//   node scripts/seed-demo/check-columns.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire, register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as D from './data.mjs'

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend')

function readEnvFile(file) {
  const full = path.join(FRONTEND, file)
  if (!fs.existsSync(full)) return {}
  const out = {}
  for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const eq = line.indexOf('=')
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

register(new URL('./loader.mjs', import.meta.url)) // app utils use extensionless imports
const keys = (rows) => [...new Set(rows.flatMap((r) => Object.keys(r)))]
const { REGISTRATION_KEYS } = await import(pathToFileURL(path.join(FRONTEND, 'src/utils/customerComplaints.js')).href)

// table -> columns the seed sends (payload keys) plus the ones it reads to key / skip rows.
const TABLES = {
  'shifts master': [...keys(D.SHIFTS), 'shift_duration', 'net_working_hours'],
  'employees master': keys(D.EMPLOYEES),
  'operations master': ['operation_name'],
  'machines master': keys(D.MACHINES),
  'machine operations': keys(D.MACHINE_OPERATIONS),
  'products master': keys(D.PRODUCTS),
  'raw materials master': keys(D.RAW_MATERIALS),
  'suppliers master': keys(D.SUPPLIERS),
  'rm suppliers': ['raw_material_code', 'supplier_id', 'standard_purchase_price', 'lead_time_days'],
  'product raw materials': keys(D.BOM),
  'production batch master': keys(D.BATCH_SIZES),
  'job work master': keys(D.JOB_WORK_TYPES),
  'vendors master': keys(D.VENDORS),
  'vendor job work types': keys(D.VENDOR_JOB_WORK_TYPES),
  'cycle time master': ['id', ...keys(D.CYCLE_TIMES)],
  'quality master': ['id', ...keys(D.QUALITY_PARAMETERS)],
  'maintenance master': ['id', ...keys(D.MAINTENANCE_CHECKLIST)],
  'maintenance schedule': ['machine_id', 'maintenance_frequency', 'last_maintenance_date', 'next_maintenance_due', 'status', 'remarks'],
  'maintenance plan': ['machine_id', 'planned_week_start_date'],
  'customers master': keys(D.CUSTOMERS),
  'customer enquiries': ['qtn_no', 'customer_id', 'drawing_number', 'part_serial_number', 'part_name', 'quoted_price', 'quoted_date', 'supply_lead_time_days', 'revision_status'],
  'customer po headers': ['id', 'customer_id', 'po_number', 'po_date', 'delivery_terms', 'payment_terms'],
  'customer orders': ['order_line_id', 'qtn_no', 'customer_id', 'po_number', 'po_date', 'part_serial_number', 'order_qty', 'order_type', 'expected_delivery', 'customer_po_line_no', 'parent_po_id'],
  'raw material transactions': ['doc_no', 'voided_at', 'raw_material_code', 'transaction_type', 'qty', 'transaction_date', 'supplier_id', 'part_serial_number', 'employee_id', 'shift_code', 'user_id'],
  'raw material stock balance': ['raw_material_code', 'current_stock'],
  'production orders': ['prd_no', 'order_line_id', 'batch_no', 'prd_qty'],
  'production route card stages': ['id', 'prd_no', 'seq', 'operation', 'type', 'machine_id', 'job_work_code', 'cycle_time_min', 'status', 'actual_date'],
  'production logs': ['id', 'prd_no', 'stage_id', 'machine_id', 'employee_id', 'shift_code', 'start_time', 'planned_qty', 'standard_qty_per_hour', 'setter_employee_id', 'setting_time_min', 'cycle_time_min', 'substitute_reason', 'substitute_reason_note', 'is_open'],
  'production log hours': ['id', 'log_id', 'log_date', 'shift_code', 'employee_id', 'hour_slot', 'qty_produced', 'qty_rejected', 'qty_rework'],
  'production shift verifications': ['log_id', 'log_date', 'shift_code', 'status', 'reject_reason'],
  'job order dispatch': ['dc_no', 'prd_no', 'stage_id', 'job_work_code', 'vendor_id', 'part_serial_number', 'qty', 'dispatch_date', 'expected_receipt_date', 'is_open', 'voided_at'],
  'job order receipt': ['dc_no', 'qty_received', 'receipt_date'],
  'wip transactions': ['prd_no', 'transaction_type', 'nature_of_operation_stage_id', 'target_stage_id', 'qty', 'employee_id', 'shift_code', 'transaction_date', 'remarks', 'user_id'],
  'finished goods transactions': ['part_serial_number', 'transaction_type', 'qty', 'transaction_date', 'prd_no', 'customer_id', 'employee_id', 'shift_code', 'user_id'],
  'quality logs': ['id', 'prd_no', 'stage_id', 'machine_id', 'employee_id', 'shift_code', 'log_date'],
  'quality log readings': ['quality_log_id', 'quality_parameter_id', 'observed_value'],
  'maintenance logs': ['id', 'machine_id', 'employee_id', 'shift_code', 'log_date', 'maintenance_type'],
  'maintenance log items': ['maintenance_log_id', 'checklist_item_id', 'condition', 'observation', 'action_taken'],
  'customer complaints': ['complaint_no', ...REGISTRATION_KEYS, 'status'],
  'app users': ['user_id', 'role', 'employee_id'],
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.test') }
const host = new URL(env.VITE_SUPABASE_URL).hostname
if (!env.DEMO_PROJECT_REF || env.DEMO_PROJECT_REF.length < 8 || !host.startsWith(env.DEMO_PROJECT_REF)) {
  console.error('URL host does not start with DEMO_PROJECT_REF -- refusing.')
  process.exit(1)
}
const req = createRequire(path.join(FRONTEND, 'package.json'))
const mod = await import(pathToFileURL(req.resolve('@supabase/supabase-js')).href)
const sb = (mod.createClient ?? mod.default.createClient)(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { error: signInError } = await sb.auth.signInWithPassword({ email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD })
if (signInError) {
  console.error(`sign-in failed: ${signInError.message}`)
  process.exit(1)
}

let bad = 0
for (const [table, cols] of Object.entries(TABLES)) {
  const { error } = await sb.from(table).select(cols.join(',')).limit(0)
  if (error) bad += 1
  console.log(`${error ? 'FAIL' : 'ok  '}  ${table.padEnd(32)} ${String(cols.length).padStart(2)} cols${error ? `  -> ${error.message}` : ''}`)
}
await sb.auth.signOut()
console.log(`\n${Object.keys(TABLES).length} tables checked, ${bad} with a column mismatch. No rows read or written (limit=0).`)
process.exitCode = bad ? 1 : 0
