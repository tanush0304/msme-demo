// Fictional demo dataset for the Msme-demo project. Every company, person,
// GSTIN / PAN and phone number here is made up (GSTINs follow the obviously
// fake "..AAAAA0000A1Z0" pattern, e-mail domains end in .example, no bank
// details). Dates are working days counted back from the run date
// (wd(k) = k-th working day before today, Sundays skipped), so the data is
// always "the last ~30 days" whenever the seed runs.

// ---- timeline -------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0')
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** k-th working day (Mon-Sat) before today; wd(0) = today, or Saturday when run on a Sunday. */
export function wd(k, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (d.getDay() === 0) d.setDate(d.getDate() - 1)
  let left = k
  while (left > 0) {
    d.setDate(d.getDate() - 1)
    if (d.getDay() !== 0) left -= 1
  }
  return isoDate(d)
}

/** Calendar date `days` after an ISO date (same arithmetic as the DC screen's expected receipt date). */
export function addDaysISO(dateISO, days) {
  const d = new Date(dateISO)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monday of the week `weeksBack` weeks before the current one. */
export function mondayWeeksBack(weeksBack, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const back = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - back - weeksBack * 7)
  return isoDate(d)
}

// ---- Phase 1 (admin): masters ----------------------------------------------

export const SHIFTS = [
  { shift_code: 'A', shift_name: 'Shift A (Morning)', start_time: '06:00', end_time: '14:00', lunch_break_duration: '30 min' },
  { shift_code: 'B', shift_name: 'Shift B (Evening)', start_time: '14:00', end_time: '22:00', lunch_break_duration: '30 min' },
  { shift_code: 'C', shift_name: 'Shift C (Night)', start_time: '22:00', end_time: '06:00', lunch_break_duration: '30 min' },
]
/** Hour slots logged per shift (7 full hours of the 7.5 net). */
export const SLOTS_PER_SHIFT = 7

const emp = (employee_id, employee_name, department, designation, employee_type, joining_date) => ({
  employee_id, employee_name, department, designation, employee_type, joining_date, employee_status: 'Active',
})
export const EMPLOYEES = [
  emp('EMP-001', 'Arjun Rao', 'Administration', 'Plant Administrator', 'Permanent', '2019-04-01'),
  emp('EMP-002', 'Meera Iyer', 'Production', 'Production Supervisor', 'Permanent', '2020-01-06'),
  emp('EMP-003', 'Vikram Desai', 'Production', 'CNC Operator', 'Permanent', '2021-07-12'),
  emp('EMP-004', 'Kiran Patil', 'Production', 'Setter', 'Permanent', '2018-11-19'),
  emp('EMP-005', 'Suresh Naidu', 'Production', 'Setter', 'Permanent', '2022-02-14'),
  emp('EMP-006', 'Divya Menon', 'Quality', 'Quality Inspector', 'Permanent', '2021-03-08'),
  emp('EMP-007', 'Farhan Ali', 'Quality', 'Quality Inspector', 'Contract', '2023-06-01'),
  emp('EMP-008', 'Lakshmi Reddy', 'Stores', 'Store Keeper', 'Permanent', '2020-09-21'),
  emp('EMP-009', 'Manoj Kulkarni', 'Maintenance', 'Maintenance Technician', 'Permanent', '2019-12-02'),
  emp('EMP-010', 'Neha Joshi', 'Production', 'Machine Operator', 'Contract', '2023-01-16'),
]
/** Demo login -> employee to link (printed at the Phase 2 STOP). */
export const LOGIN_EMPLOYEES = { admin: 'EMP-001', supervisor: 'EMP-002', operator: 'EMP-003' }

export const OPERATIONS = ['Cutting', 'Facing', 'Rough Turning', 'Finish Turning', 'Threading', 'Drilling', 'Milling', 'Grinding']

const CATEGORY_OPERATIONS = {
  Cutting: ['Cutting'],
  'CNC Turning': ['Facing', 'Rough Turning', 'Finish Turning', 'Threading'],
  VMC: ['Milling', 'Drilling'],
  Grinding: ['Grinding'],
}
const machine = (machine_id, machine_name, category, manufacturer_name, model) => ({
  machine_id, machine_name, category, manufacturer_name, model,
})
export const MACHINES = [
  machine('MC-01', 'Bandsaw BS-260', 'Cutting', 'Demo Machine Tools', 'BS-260'),
  machine('MC-02', 'Circular Saw CS-350', 'Cutting', 'Demo Machine Tools', 'CS-350'),
  machine('MC-03', 'CNC Lathe TL-200', 'CNC Turning', 'Sample Lathe Works', 'TL-200'),
  machine('MC-04', 'CNC Lathe TL-250', 'CNC Turning', 'Sample Lathe Works', 'TL-250'),
  machine('MC-05', 'VMC V-600', 'VMC', 'Example CNC Systems', 'V-600'),
  machine('MC-06', 'VMC V-850', 'VMC', 'Example CNC Systems', 'V-850'),
  machine('MC-07', 'Cylindrical Grinder CG-300', 'Grinding', 'Placeholder Grinders', 'CG-300'),
  machine('MC-08', 'Surface Grinder SG-450', 'Grinding', 'Placeholder Grinders', 'SG-450'),
]
export const MACHINE_OPERATIONS = MACHINES.flatMap((m) => CATEGORY_OPERATIONS[m.category].map((operation) => ({ machine_id: m.machine_id, operation })))

const product = (part_serial_number, part_name, part_drawing_reference_number) => ({
  part_serial_number, part_name, part_drawing_reference_number, unit_of_measurement: 'Nos', product_status: 'Active',
})
export const PRODUCTS = [
  product('PART-101', 'Hydraulic Valve Body', 'DRG-101-A'),
  product('PART-102', 'Pump Shaft', 'DRG-102-B'),
  product('PART-103', 'Flange Adapter', 'DRG-103-A'),
  product('PART-104', 'Gear Blank', 'DRG-104-C'),
  product('PART-105', 'Bearing Housing', 'DRG-105-A'),
  product('PART-106', 'Coupling Sleeve', 'DRG-106-B'),
]

const rm = (raw_material_code, raw_material_name, raw_material_category, rm_type, unit_of_measurement, cost_per_unit, diameter_mm = null) => ({
  raw_material_code, raw_material_name, raw_material_category, rm_type, unit_of_measurement, cost_per_unit, diameter_mm,
  rm_source: 'Trading', opening_stock: 0,
})
export const RAW_MATERIALS = [
  rm('RM-01', 'EN8 Round Bar 40 mm', 'Steel', 'Bar', 'Kg', 72, 40),
  rm('RM-02', 'EN19 Round Bar 32 mm', 'Steel', 'Bar', 'Kg', 96, 32),
  rm('RM-03', 'MS Plate 12 mm', 'Steel', 'Plate', 'Kg', 64),
  rm('RM-04', '20MnCr5 Forging', 'Alloy', 'Forging', 'Kg', 118),
  rm('RM-05', 'Grey Cast Iron Housing Casting', 'Alloy', 'Casting', 'Nos', 420),
  rm('RM-06', 'Soluble Cutting Coolant', 'Consumables', 'Consumable', 'Ltr', 180),
]

const supplier = (n, supplier_id, supplier_name, city, contact_person_name) => ({
  supplier_id, supplier_name, contact_person_name,
  supplier_address: `Plot ${n * 7}, Industrial Area Phase 2, ${city}`,
  mobile_number: `90000 0001${n}`,
  email_address: `sales@${supplier_name.split(' ')[0].toLowerCase()}.example`,
  gstin_no: `29AAAAA000${n}A1Z0`,
  pan_no: `AAAAA000${n}A`,
  gst_category: 'Registered',
  tds_applicable: false,
  payment_terms: '30 Days',
})
export const SUPPLIERS = [
  supplier(1, 'SUP-01', 'Northwind Steels Pvt Ltd', 'Bengaluru', 'Rahul Mehta'),
  supplier(2, 'SUP-02', 'Contoso Alloys Pvt Ltd', 'Pune', 'Anita Kapoor'),
  supplier(3, 'SUP-03', 'Fabrikam Castings Pvt Ltd', 'Coimbatore', 'Sanjay Pillai'),
  supplier(4, 'SUP-04', 'Tailspin Lubricants Pvt Ltd', 'Chennai', 'Kavitha Raman'),
]
export const RM_SUPPLIERS = [
  { raw_material_code: 'RM-01', supplier_id: 'SUP-01', standard_purchase_price: 72, lead_time_days: 7 },
  { raw_material_code: 'RM-01', supplier_id: 'SUP-02', standard_purchase_price: 75, lead_time_days: 10 },
  { raw_material_code: 'RM-02', supplier_id: 'SUP-02', standard_purchase_price: 96, lead_time_days: 10 },
  { raw_material_code: 'RM-03', supplier_id: 'SUP-01', standard_purchase_price: 64, lead_time_days: 5 },
  { raw_material_code: 'RM-03', supplier_id: 'SUP-02', standard_purchase_price: 66, lead_time_days: 8 },
  { raw_material_code: 'RM-04', supplier_id: 'SUP-02', standard_purchase_price: 118, lead_time_days: 14 },
  { raw_material_code: 'RM-05', supplier_id: 'SUP-03', standard_purchase_price: 420, lead_time_days: 21 },
  { raw_material_code: 'RM-06', supplier_id: 'SUP-04', standard_purchase_price: 180, lead_time_days: 3 },
]
/** BOM: consumption per finished unit. */
export const BOM = [
  { part_serial_number: 'PART-101', raw_material_code: 'RM-01', consumption_per_unit: 1.2 },
  { part_serial_number: 'PART-101', raw_material_code: 'RM-06', consumption_per_unit: 0.05 },
  { part_serial_number: 'PART-102', raw_material_code: 'RM-02', consumption_per_unit: 0.9 },
  { part_serial_number: 'PART-103', raw_material_code: 'RM-03', consumption_per_unit: 1.5 },
  { part_serial_number: 'PART-104', raw_material_code: 'RM-04', consumption_per_unit: 1.1 },
  { part_serial_number: 'PART-104', raw_material_code: 'RM-06', consumption_per_unit: 0.03 },
  { part_serial_number: 'PART-105', raw_material_code: 'RM-05', consumption_per_unit: 1 },
  { part_serial_number: 'PART-106', raw_material_code: 'RM-01', consumption_per_unit: 0.6 },
]
export const BATCH_SIZES = [
  { part_serial_number: 'PART-101', production_batch_quantity: 100 },
  { part_serial_number: 'PART-102', production_batch_quantity: 80 },
  { part_serial_number: 'PART-103', production_batch_quantity: 150 },
  { part_serial_number: 'PART-104', production_batch_quantity: 100 },
  { part_serial_number: 'PART-105', production_batch_quantity: 60 },
  { part_serial_number: 'PART-106', production_batch_quantity: 200 },
]

export const JOB_WORK_TYPES = [
  { job_work_code: 'JW-01', type_of_job_work: 'Heat Treatment', lead_time_days: 7 },
  { job_work_code: 'JW-02', type_of_job_work: 'Zinc Plating', lead_time_days: 5 },
  { job_work_code: 'JW-03', type_of_job_work: 'Painting', lead_time_days: 4 },
]
const vendor = (n, vendor_id, vendor_name, city, contact_person_name) => ({
  vendor_id, vendor_name, contact_person_name,
  vendor_address: `Shed ${n * 3}, Small Industries Estate, ${city}`,
  mobile_no: `90000 0002${n}`,
  email_id: `jobwork@${vendor_name.split(' ')[0].toLowerCase()}.example`,
  gstin_no: `29AAAAA001${n}A1Z0`,
  pan_no: `AAAAA001${n}A`,
  gst_category: 'Registered',
  tds_applicable: false,
  payment_terms: '30 Days',
})
export const VENDORS = [
  vendor(1, 'VEN-01', 'Wingtip Heat Treaters', 'Bengaluru', 'Prakash Shetty'),
  vendor(2, 'VEN-02', 'Litware Surface Finishers', 'Hosur', 'Deepa Nair'),
  vendor(3, 'VEN-03', 'Proseware Platers', 'Bengaluru', 'Imran Khan'),
]
export const VENDOR_JOB_WORK_TYPES = [
  { vendor_id: 'VEN-01', job_work_code: 'JW-01' },
  { vendor_id: 'VEN-02', job_work_code: 'JW-02' },
  { vendor_id: 'VEN-02', job_work_code: 'JW-03' },
  { vendor_id: 'VEN-03', job_work_code: 'JW-02' },
]

const internal = (part_serial_number, seq, operation, machine_id, cycle_time_min) => ({
  part_serial_number, seq, operation, type: 'Internal', machine_id, job_work_code: null, cycle_time_min,
})
const outsourced = (part_serial_number, seq, operation, job_work_code) => ({
  part_serial_number, seq, operation, type: 'Outsourced', machine_id: null, job_work_code, cycle_time_min: null,
})
/** Cycle Time Master, in insert order (ids follow it -> the planned machine
 * collapseCycleRows picks per seq is the first row not already used). */
export const CYCLE_TIMES = [
  internal('PART-101', 10, 'Cutting', 'MC-01', 3.0),
  internal('PART-101', 10, 'Cutting', 'MC-02', 3.2),
  internal('PART-101', 20, 'Rough Turning', 'MC-03', 4.5),
  internal('PART-101', 20, 'Rough Turning', 'MC-04', 4.8),
  internal('PART-101', 30, 'Milling', 'MC-05', 6.0),
  internal('PART-101', 40, 'Grinding', 'MC-07', 4.0),
  internal('PART-102', 10, 'Cutting', 'MC-02', 2.8),
  internal('PART-102', 20, 'Finish Turning', 'MC-03', 5.0),
  internal('PART-102', 20, 'Finish Turning', 'MC-04', 5.0),
  outsourced('PART-102', 30, 'Heat Treatment', 'JW-01'),
  internal('PART-102', 40, 'Grinding', 'MC-08', 3.5),
  internal('PART-103', 10, 'Cutting', 'MC-01', 2.5),
  internal('PART-103', 20, 'Facing', 'MC-04', 3.5),
  internal('PART-103', 30, 'Drilling', 'MC-06', 3.0),
  internal('PART-104', 10, 'Cutting', 'MC-02', 3.0),
  internal('PART-104', 20, 'Rough Turning', 'MC-03', 4.5),
  outsourced('PART-104', 30, 'Zinc Plating', 'JW-02'),
  internal('PART-104', 40, 'Finish Turning', 'MC-04', 4.0),
  internal('PART-105', 10, 'Milling', 'MC-05', 7.0),
  internal('PART-105', 10, 'Milling', 'MC-06', 7.0),
  internal('PART-105', 20, 'Drilling', 'MC-06', 3.0),
  internal('PART-105', 30, 'Grinding', 'MC-08', 4.5),
  internal('PART-106', 10, 'Cutting', 'MC-01', 2.0),
  internal('PART-106', 20, 'Threading', 'MC-04', 2.5),
]

// Same columns QualityMaster sends -- "quality master" has no UoM column.
const qp = (part_serial_number, machine_id, type_of_operation, quality_parameter, standard, upper_tolerance, lower_tolerance) => ({
  part_serial_number, machine_id, type_of_operation, quality_parameter, standard, upper_tolerance, lower_tolerance, remarks: null,
})
/** Tolerances are positive bands: accepted range = standard - lower .. standard + upper. */
export const QUALITY_PARAMETERS = [
  qp('PART-101', 'MC-01', 'Cutting', 'Cut Length', 85, 0.5, 0.5),
  qp('PART-101', 'MC-03', 'Rough Turning', 'Outer Diameter', 38.5, 0.1, 0.1),
  qp('PART-101', 'MC-05', 'Milling', 'Slot Width', 12, 0.05, 0.05),
  qp('PART-101', 'MC-05', 'Milling', 'Slot Depth', 5, 0.1, 0.1),
  qp('PART-101', 'MC-07', 'Grinding', 'Ground Diameter', 38, 0.02, 0.02),
  qp('PART-101', 'MC-07', 'Grinding', 'Surface Roughness Ra', 0.8, 0.2, 0.8),
  qp('PART-102', 'MC-03', 'Finish Turning', 'Shaft Diameter', 30, 0.02, 0.02),
  qp('PART-103', 'MC-01', 'Cutting', 'Blank Thickness', 12, 0.3, 0.3),
  qp('PART-103', 'MC-04', 'Facing', 'Flange Thickness', 10, 0.1, 0.1),
  qp('PART-104', 'MC-03', 'Rough Turning', 'Outer Diameter', 60.5, 0.1, 0.1),
  qp('PART-104', 'MC-03', 'Rough Turning', 'Overall Length', 45, 0.2, 0.2),
  qp('PART-105', 'MC-05', 'Milling', 'Bore Diameter', 52, 0.03, 0.03),
  qp('PART-106', 'MC-04', 'Threading', 'Thread Length', 25, 0.2, 0.2),
]

const CATEGORY_CHECKLIST = {
  Cutting: ['Check blade tension and wear', 'Clean chip tray and coolant sump'],
  'CNC Turning': ['Check hydraulic oil level', 'Check chuck jaws for wear'],
  VMC: ['Check spindle coolant level', 'Clean way covers and wipers'],
  Grinding: ['Dress grinding wheel', 'Check coolant concentration'],
}
export const MAINTENANCE_CHECKLIST = MACHINES.flatMap((m) => CATEGORY_CHECKLIST[m.category].map((checklist_item) => ({ machine_id: m.machine_id, checklist_item, remarks: null })))

/** Maintenance visits (Phase 4); the schedule's last date follows them. */
export const MAINTENANCE_LOGS = [
  { key: 'ML1', machine_id: 'MC-01', w: 20, shift_code: 'A', employee_id: 'EMP-009', maintenance_type: 'Weekly' },
  { key: 'ML2', machine_id: 'MC-03', w: 15, shift_code: 'A', employee_id: 'EMP-009', maintenance_type: 'Weekly' },
  { key: 'ML3', machine_id: 'MC-05', w: 11, shift_code: 'B', employee_id: 'EMP-009', maintenance_type: 'Weekly' },
  { key: 'ML4', machine_id: 'MC-07', w: 9, shift_code: 'A', employee_id: 'EMP-009', maintenance_type: 'Monthly',
    notOk: { item: 'Check coolant concentration', observation: 'Coolant concentration 2% (target 5%)', action_taken: 'Topped up concentrate to 5%' } },
  { key: 'ML5', machine_id: 'MC-08', w: 3, shift_code: 'B', employee_id: 'EMP-009', maintenance_type: 'Monthly' },
]
export const MAINTENANCE_SCHEDULE = MACHINES.map((m) => {
  const frequency = { Cutting: 'Fortnightly', 'CNC Turning': 'Weekly', VMC: 'Weekly', Grinding: 'Monthly' }[m.category]
  const visit = MAINTENANCE_LOGS.find((l) => l.machine_id === m.machine_id)
  return { machine_id: m.machine_id, maintenance_frequency: frequency, lastW: visit ? visit.w : 25, status: 'Active' }
})
/** Planned maintenance weeks (Mondays, current week or earlier -- no future dates). */
export const MAINTENANCE_PLAN = [
  { machine_id: 'MC-01', weeksBack: 3 }, { machine_id: 'MC-03', weeksBack: 3 }, { machine_id: 'MC-05', weeksBack: 2 },
  { machine_id: 'MC-07', weeksBack: 1 }, { machine_id: 'MC-04', weeksBack: 0 }, { machine_id: 'MC-08', weeksBack: 0 },
]

const customer = (n, customer_id, customer_name, contact_person_name, city, state, pincode, stateCode) => ({
  customer_id, customer_name, contact_person_name,
  mobile_number: `90000 0003${n}`,
  email_address: `purchase@${customer_name.split(' ')[0].toLowerCase()}.example`,
  registered_address: `${10 + n}, Industrial Layout, Sector ${n}`, registered_city: city, registered_state: state, registered_pincode: pincode, registered_country: 'India',
  delivery_address: `Gate ${n}, Assembly Plant, Sector ${n}`, delivery_city: city, delivery_state: state, delivery_pincode: pincode, delivery_country: 'India',
  gstin_number: `${stateCode}AAAAA000${n}A1Z0`, pan_number: `AAAAA000${n}A`, gst_registered: true,
  payment_terms: '30 Days', currency: 'INR', status: 'Active',
  customer_drawing_ref_no: `CDR-${customer_id}`,
})
export const CUSTOMERS = [
  customer(1, 'CUST-001', 'Acme Components Pvt Ltd', 'Rohit Sen', 'Bengaluru', 'Karnataka', '560058', '29'),
  customer(2, 'CUST-002', 'Globex Engineering Pvt Ltd', 'Priya Nambiar', 'Pune', 'Maharashtra', '411019', '27'),
  customer(3, 'CUST-003', 'Initech Motors Pvt Ltd', 'Ajay Verma', 'Chennai', 'Tamil Nadu', '600058', '33'),
  customer(4, 'CUST-004', 'Vandelay Industries Pvt Ltd', 'Sneha Kulkarni', 'Coimbatore', 'Tamil Nadu', '641021', '33'),
  customer(5, 'CUST-005', 'Adventure Works Equipment Pvt Ltd', 'Karthik Iyer', 'Hosur', 'Tamil Nadu', '635109', '33'),
]

/** Enquiries (QTN numbers come from the app's generateNextQtnNo). */
export const ENQUIRIES = [
  { customer_id: 'CUST-001', part_serial_number: 'PART-101', quoted_price: 1450, w: 30, supply_lead_time_days: 21, revision_status: 'Accepted' },
  { customer_id: 'CUST-002', part_serial_number: 'PART-102', quoted_price: 980, w: 30, supply_lead_time_days: 28, revision_status: 'Accepted' },
  { customer_id: 'CUST-003', part_serial_number: 'PART-104', quoted_price: 760, w: 29, supply_lead_time_days: 30, revision_status: 'Accepted' },
  { customer_id: 'CUST-004', part_serial_number: 'PART-103', quoted_price: 640, w: 29, supply_lead_time_days: 21, revision_status: 'Accepted' },
  { customer_id: 'CUST-005', part_serial_number: 'PART-105', quoted_price: 2100, w: 28, supply_lead_time_days: 35, revision_status: 'Under Review' },
  { customer_id: 'CUST-003', part_serial_number: 'PART-106', quoted_price: 310, w: 28, supply_lead_time_days: 14, revision_status: 'Accepted' },
]

/** PO headers with their lines. `plan` = batches Phase 2 plans (<= batch size); `prds` names them A..F. */
export const PURCHASE_ORDERS = [
  { customer_id: 'CUST-001', po_number: 'ACME-PO-0451', w: 27, lines: [
    { line: '10', part_serial_number: 'PART-101', order_qty: 200, deliveryDays: 12, plan: [100, 100], prds: ['A', 'B'] },
    { line: '20', part_serial_number: 'PART-105', order_qty: 60, deliveryDays: 25 },
  ] },
  { customer_id: 'CUST-002', po_number: 'GLOBEX-PO-1187', w: 26, lines: [
    { line: '10', part_serial_number: 'PART-102', order_qty: 80, deliveryDays: 5, plan: [80], prds: ['C'] },
  ] },
  { customer_id: 'CUST-003', po_number: 'INITECH-PO-0332', w: 26, lines: [
    { line: '10', part_serial_number: 'PART-104', order_qty: 150, deliveryDays: -2, plan: [100, 50], prds: ['D', 'E'] },
    { line: '20', part_serial_number: 'PART-106', order_qty: 400, deliveryDays: 20 },
  ] },
  { customer_id: 'CUST-004', po_number: 'VANDELAY-PO-0078', w: 25, lines: [
    { line: '10', part_serial_number: 'PART-103', order_qty: 120, deliveryDays: 15, plan: [120], prds: ['F'] },
  ] },
  { customer_id: 'CUST-005', po_number: 'AW-PO-2210', w: 24, lines: [
    { line: '10', part_serial_number: 'PART-101', order_qty: 100, deliveryDays: 30 },
    { line: '20', part_serial_number: 'PART-103', order_qty: 150, deliveryDays: 32 },
  ] },
]
export const PO_TERMS = { delivery_terms: 'Ex-works', payment_terms: '30 Days' }

/** GRNs (doc numbers from the trigger). G11 is never issued and is voided in Phase 4. */
export const GRNS = [
  { key: 'G1', raw_material_code: 'RM-01', qty: 150, supplier_id: 'SUP-01', w: 26 },
  { key: 'G2', raw_material_code: 'RM-02', qty: 100, supplier_id: 'SUP-02', w: 26 },
  { key: 'G3', raw_material_code: 'RM-04', qty: 100, supplier_id: 'SUP-02', w: 26 },
  { key: 'G4', raw_material_code: 'RM-06', qty: 20, supplier_id: 'SUP-04', w: 26 },
  { key: 'G5', raw_material_code: 'RM-01', qty: 150, supplier_id: 'SUP-02', w: 25 },
  { key: 'G6', raw_material_code: 'RM-03', qty: 120, supplier_id: 'SUP-01', w: 25 },
  { key: 'G7', raw_material_code: 'RM-05', qty: 80, supplier_id: 'SUP-03', w: 25 },
  { key: 'G8', raw_material_code: 'RM-03', qty: 120, supplier_id: 'SUP-02', w: 24 },
  { key: 'G9', raw_material_code: 'RM-04', qty: 100, supplier_id: 'SUP-02', w: 24 },
  { key: 'G10', raw_material_code: 'RM-06', qty: 20, supplier_id: 'SUP-04', w: 24 },
  { key: 'G11', raw_material_code: 'RM-05', qty: 40, supplier_id: 'SUP-03', w: 24 },
]
export const GRN_TO_VOID = { key: 'G11', reason: 'Duplicate GRN -- same delivery challan entered twice' }
export const STORES_STAFF = { employee_id: 'EMP-008', shift_code: 'A' }

// ---- Phase 2 (supervisor): RM issues, BOM x PRD qty -------------------------

/** Issue dates per PRD -- after every GRN (<= wd 24), before the PRD's first log. */
export const RM_ISSUE_W = { A: 23, B: 22, C: 23, D: 22, E: 22, F: 22 }
export const SHIFT_HOURS = 7.5

// ---- Phase 3 (operator): production -----------------------------------------

/**
 * One step = one production log on one stage, run in this order (each log is
 * closed before the next one on the same machine opens). `days` are the
 * (date, shift) blocks hours are logged in; `end`: 'complete' (Mark Stage
 * Complete), 'endlog' (End Log, stage stays Pending) or 'open' (in progress).
 * accepted = produced - rejected - rework.
 */
export const PRODUCTION_STEPS = [
  { prd: 'A', seq: 10, machine_id: 'MC-01', employee_id: 'EMP-003', setter: 'EMP-004', setting: 20, days: [{ w: 22, shift: 'A', produced: 100, rejected: 2, rework: 0 }], end: 'complete' },
  { prd: 'C', seq: 10, machine_id: 'MC-02', employee_id: 'EMP-003', setter: 'EMP-005', setting: 15, days: [{ w: 21, shift: 'B', produced: 80, rejected: 0, rework: 0 }], end: 'complete' },
  { prd: 'A', seq: 20, machine_id: 'MC-03', employee_id: 'EMP-003', setter: 'EMP-005', setting: 30, days: [{ w: 20, shift: 'A', produced: 60, rejected: 1, rework: 0 }, { w: 19, shift: 'A', produced: 38, rejected: 0, rework: 1 }], end: 'complete' },
  { prd: 'D', seq: 10, machine_id: 'MC-02', employee_id: 'EMP-010', setter: 'EMP-004', setting: 15, days: [{ w: 20, shift: 'C', produced: 100, rejected: 1, rework: 0 }], end: 'complete' },
  { prd: 'C', seq: 20, machine_id: 'MC-03', employee_id: 'EMP-010', setter: 'EMP-005', setting: 25, days: [{ w: 19, shift: 'B', produced: 80, rejected: 2, rework: 1 }], end: 'complete' },
  { prd: 'B', seq: 10, machine_id: 'MC-01', employee_id: 'EMP-010', setter: 'EMP-004', setting: 20, days: [{ w: 18, shift: 'C', produced: 100, rejected: 1, rework: 0 }], end: 'complete' },
  { prd: 'A', seq: 30, machine_id: 'MC-05', employee_id: 'EMP-010', setter: 'EMP-004', setting: 35, days: [{ w: 17, shift: 'B', produced: 96, rejected: 2, rework: 0 }], end: 'complete' },
  { prd: 'D', seq: 20, machine_id: 'MC-03', employee_id: 'EMP-003', setter: 'EMP-005', setting: 30, days: [{ w: 17, shift: 'A', produced: 60, rejected: 1, rework: 0 }, { w: 16, shift: 'A', produced: 39, rejected: 1, rework: 0 }], end: 'complete' },
  { prd: 'A', seq: 40, machine_id: 'MC-07', employee_id: 'EMP-010', setter: 'EMP-004', setting: 20, days: [{ w: 15, shift: 'A', produced: 94, rejected: 1, rework: 0 }], end: 'complete' },
  // Substitute machine: planned MC-03, run on MC-04 (capable per Cycle Time Master).
  { prd: 'B', seq: 20, machine_id: 'MC-04', substitute: 'Breakdown', employee_id: 'EMP-003', setter: 'EMP-005', setting: 30, days: [{ w: 14, shift: 'A', produced: 70, rejected: 1, rework: 0 }], end: 'endlog' },
  { prd: 'E', seq: 10, machine_id: 'MC-02', employee_id: 'EMP-003', setter: 'EMP-004', setting: 15, days: [{ w: 10, shift: 'A', produced: 50, rejected: 0, rework: 0 }], end: 'complete' },
  { prd: 'E', seq: 20, machine_id: 'MC-03', employee_id: 'EMP-010', setter: 'EMP-005', setting: 30, days: [{ w: 8, shift: 'B', produced: 50, rejected: 1, rework: 0 }], end: 'complete' },
  { prd: 'F', seq: 10, machine_id: 'MC-01', employee_id: 'EMP-003', setter: 'EMP-004', setting: 20, days: [{ w: 6, shift: 'A', produced: 120, rejected: 0, rework: 0 }], end: 'complete' },
  { prd: 'F', seq: 20, machine_id: 'MC-04', employee_id: 'EMP-010', setter: 'EMP-005', setting: 25, days: [{ w: 4, shift: 'B', produced: 70, rejected: 1, rework: 0 }], end: 'open' },
]

// ---- Phase 4 (supervisor) ---------------------------------------------------

/** The one shift decision that is Rejected; every other closed log's shift is Approved. */
export const REJECTED_SHIFT = { prd: 'B', seq: 20, w: 14, shift: 'A', reason: 'Rejected count does not match the scrap register -- please recheck and resubmit.' }

/** Jobwork DCs (dc_no from the app's generateNextDcNo; expected date = dispatch + lead time). */
export const DISPATCHES = [
  { key: 'DC1', prd: 'C', seq: 30, vendor_id: 'VEN-01', qty: 77, w: 16, receipts: [{ qty: 77, w: 10 }] },
  { key: 'DC2', prd: 'D', seq: 30, vendor_id: 'VEN-02', qty: 60, w: 13, receipts: [{ qty: 35, w: 7 }] },
  { key: 'DC3', prd: 'D', seq: 30, vendor_id: 'VEN-03', qty: 37, w: 12, closeShort: 'Vendor capacity issue -- balance to be re-sent on a new DC' },
  { key: 'DC4', prd: 'E', seq: 30, vendor_id: 'VEN-02', qty: 49, w: 7 }, // open, past its expected date -> overdue
]
export const WIP_MOVES = [
  { type: 'Receipt', prd: 'B', fromSeq: 10, qty: 20, w: 11, employee_id: 'EMP-008', shift_code: 'A', remarks: 'Moved to WIP rack while MC-03 is down' },
  { type: 'Issue', prd: 'B', fromSeq: 10, toSeq: 20, qty: 15, w: 9, employee_id: 'EMP-008', shift_code: 'B', remarks: 'Issued back to turning' },
]
export const FG_MOVES = [
  { type: 'Production Receipt', prd: 'A', qty: 93, w: 12, employee_id: 'EMP-008', shift_code: 'A' },
  { type: 'Dispatch', prd: 'A', qty: 60, w: 10, employee_id: 'EMP-008', shift_code: 'A' },
  { type: 'Dispatch', prd: 'A', qty: 25, w: 5, employee_id: 'EMP-008', shift_code: 'B' },
]
/** Inspections: readings keyed by quality parameter name; one is out of tolerance (38.035 vs 38 +/- 0.02). */
export const QUALITY_LOGS = [
  { key: 'QL1', prd: 'A', seq: 40, machine_id: 'MC-07', w: 2, employee_id: 'EMP-006', shift_code: 'A', readings: { 'Ground Diameter': 38.035, 'Surface Roughness Ra': 0.7 } },
  { key: 'QL2', prd: 'A', seq: 30, machine_id: 'MC-05', w: 2, employee_id: 'EMP-006', shift_code: 'A', readings: { 'Slot Width': 12.02, 'Slot Depth': 5.04 } },
  { key: 'QL3', prd: 'D', seq: 20, machine_id: 'MC-03', w: 1, employee_id: 'EMP-007', shift_code: 'B', readings: { 'Outer Diameter': 60.46, 'Overall Length': 45.1 } },
  { key: 'QL4', prd: 'F', seq: 10, machine_id: 'MC-01', w: 1, employee_id: 'EMP-007', shift_code: 'A', readings: { 'Blank Thickness': 12.1 } },
]
export const COMPLAINT = {
  w: 1, customer_id: 'CUST-001', part_serial_number: 'PART-101', prd: 'A',
  contact_person: 'Rohit Sen', contact_number_email: 'quality@acme.example', complaint_source: 'Email',
  customer_po_no: 'ACME-PO-0451', invoice_no: 'INV-DEMO-0107', qty_supplied: 60, qty_complained: 4, manufacturingW: 15,
  complaint_type: 'Dimensional', complaint_category: 'Product',
  complaint_description: 'Four pieces found with oversize slot width at incoming inspection.',
  defect_problem: 'Slot width 12.08 mm against 12.00 +/- 0.05 mm', severity: 'Major', priority: 'High',
}

// ---- derived checks (used by --dry-run and before Phase 3/4 writes) ---------

/** Every chronology rule from the brief, as [label, earlierW, laterW] pairs (bigger w = earlier). */
export function chronologyChecks(X = { GRNS, PRODUCTION_STEPS, RM_ISSUE_W, DISPATCHES, WIP_MOVES, FG_MOVES, QUALITY_LOGS, COMPLAINT, ENQUIRIES, PURCHASE_ORDERS }) {
  const { GRNS, PRODUCTION_STEPS, RM_ISSUE_W, DISPATCHES, WIP_MOVES, FG_MOVES, QUALITY_LOGS, COMPLAINT, ENQUIRIES, PURCHASE_ORDERS } = X
  const checks = []
  const grnMax = Math.min(...GRNS.map((g) => g.w)) // latest GRN
  const firstLog = (prd) => Math.max(...PRODUCTION_STEPS.filter((s) => s.prd === prd).flatMap((s) => s.days.map((d) => d.w)))
  const lastLogOfStage = (prd, seq) => Math.min(...PRODUCTION_STEPS.filter((s) => s.prd === prd && s.seq === seq).flatMap((s) => s.days.map((d) => d.w)))
  for (const [prd, w] of Object.entries(RM_ISSUE_W)) {
    checks.push([`latest GRN < RM issue ${prd}`, grnMax, w])
    checks.push([`RM issue ${prd} < first log of PRD ${prd}`, w, firstLog(prd)])
  }
  for (const s of PRODUCTION_STEPS) {
    const prev = PRODUCTION_STEPS.filter((p) => p.prd === s.prd && p.seq < s.seq)
    for (const p of prev) checks.push([`PRD ${s.prd} stage ${p.seq} logs < stage ${s.seq} logs`, lastLogOfStage(p.prd, p.seq), Math.max(...s.days.map((d) => d.w))])
  }
  for (const d of DISPATCHES) {
    const prevSeq = Math.max(...PRODUCTION_STEPS.filter((s) => s.prd === d.prd && s.seq < d.seq).map((s) => s.seq))
    checks.push([`${d.key}: PRD ${d.prd} stage ${prevSeq} logs < dispatch`, lastLogOfStage(d.prd, prevSeq), d.w])
    for (const r of d.receipts ?? []) checks.push([`${d.key}: dispatch < receipt`, d.w, r.w])
  }
  for (const m of WIP_MOVES) checks.push([`WIP ${m.type} PRD ${m.prd} after its stage-${m.fromSeq} logs`, lastLogOfStage(m.prd, m.fromSeq), m.w])
  const wipReceipt = WIP_MOVES.find((m) => m.type === 'Receipt')
  const wipIssue = WIP_MOVES.find((m) => m.type === 'Issue')
  if (wipReceipt && wipIssue) checks.push(['WIP receipt < WIP issue', wipReceipt.w, wipIssue.w])
  for (const fgReceipt of FG_MOVES.filter((m) => m.type === 'Production Receipt')) {
    const lastSeq = Math.max(...PRODUCTION_STEPS.filter((s) => s.prd === fgReceipt.prd).map((s) => s.seq))
    checks.push([`PRD ${fgReceipt.prd} last stage < FG receipt`, lastLogOfStage(fgReceipt.prd, lastSeq), fgReceipt.w])
    // an outsourced stage before the last one: its receipts come first too
    for (const d of DISPATCHES.filter((x) => x.prd === fgReceipt.prd)) for (const r of d.receipts ?? []) checks.push([`${d.key} receipt < FG receipt ${fgReceipt.prd}`, r.w, fgReceipt.w])
  }
  for (const m of FG_MOVES.filter((x) => x.type === 'Dispatch')) {
    const receipt = FG_MOVES.find((x) => x.type === 'Production Receipt' && x.prd === m.prd)
    checks.push([`FG receipt < FG despatch (PRD ${m.prd})`, receipt ? receipt.w : -1, m.w])
  }
  // stages after an outsourced one start only after its first receipt
  for (const d of DISPATCHES) {
    const first = Math.max(-1, ...(d.receipts ?? []).map((r) => r.w))
    for (const s of PRODUCTION_STEPS.filter((x) => x.prd === d.prd && x.seq > d.seq)) checks.push([`${d.key} receipt < PRD ${s.prd} stage ${s.seq} logs`, first, Math.max(...s.days.map((x) => x.w))])
  }
  const lastDespatch = Math.min(...FG_MOVES.filter((x) => x.type === 'Dispatch').map((m) => m.w))
  const lastTxn = Math.min(lastDespatch, ...DISPATCHES.flatMap((d) => [d.w, ...(d.receipts ?? []).map((r) => r.w)]), ...WIP_MOVES.map((m) => m.w))
  for (const q of QUALITY_LOGS) checks.push([`last stock/jobwork movement < quality ${q.key}`, lastTxn, q.w])
  checks.push(['last stock/jobwork movement < complaint', lastTxn, COMPLAINT.w])
  for (const e of ENQUIRIES) {
    const po = PURCHASE_ORDERS.find((p) => p.customer_id === e.customer_id && p.lines.some((l) => l.part_serial_number === e.part_serial_number))
    if (po) checks.push([`enquiry ${e.customer_id}/${e.part_serial_number} < its PO`, e.w, po.w])
  }
  return checks.map(([label, earlier, later]) => ({ label, ok: earlier > later, earlier, later }))
}
