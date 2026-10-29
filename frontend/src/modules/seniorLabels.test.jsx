// @vitest-environment jsdom
// Senior-review labels (Break Time, Supplier Code, Preventive Maintenance) and
// the Maintenance Master checklist-item Frequency field.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))
const q = vi.hoisted(() => ({
  listShifts: vi.fn(async () => []), createShift: vi.fn(), updateShift: vi.fn(), deleteShift: vi.fn(),
  listSuppliers: vi.fn(async () => []), createSupplier: vi.fn(), updateSupplier: vi.fn(), deleteSupplier: vi.fn(),
  listMaintenanceChecklist: vi.fn(), createMaintenanceChecklistItem: vi.fn(), updateMaintenanceChecklistItem: vi.fn(), deleteMaintenanceChecklistItem: vi.fn(),
  listMaintenanceSchedules: vi.fn(async () => []), saveMaintenanceSchedule: vi.fn(),
  listMachines: vi.fn(async () => [{ machine_id: 'MC-1', machine_name: 'Lathe' }]),
}))
vi.mock('../data/queries/shifts', () => q)
vi.mock('../data/queries/suppliers', () => q)
vi.mock('../data/queries/maintenanceChecklist', () => q)
vi.mock('../data/queries/maintenanceSchedules', () => q)
vi.mock('../data/queries/machines', () => q)

import ShiftMaster from './masters/ShiftMaster'
import SupplierMaster from './masters/SupplierMaster'
import MaintenanceMaster from './masters/MaintenanceMaster'
import { landingTiles } from './moduleLandings'
import { NAV_ITEMS } from '../utils/constants'

afterEach(() => cleanup())

describe('labels', () => {
  it('Shift Master: "Break Time (min)"', async () => {
    render(<ShiftMaster />)
    expect(await screen.findByText('Break Time (min)')).toBeTruthy()
    expect(screen.queryByText(/Lunch Break/)).toBeNull()
  })

  it('Supplier Master: "Supplier Code" on the form and list, never "Supplier ID"', async () => {
    render(<SupplierMaster />)
    await waitFor(() => expect(screen.getAllByText('Supplier Code').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByText('Supplier ID')).toBeNull()
  })

  it('Maintenance "Planning" is "Preventive Maintenance" in the sidebar and on the landing card', () => {
    const subs = NAV_ITEMS.find((n) => n.key === 'maintenance').subItems
    expect(subs.find((s) => s.key === 'plan').label).toBe('Preventive Maintenance')
    expect(landingTiles('maintenance', 'supervisor').map((t) => t.label)).toContain('Preventive Maintenance')
  })
})

describe('Maintenance Master checklist-item Frequency', () => {
  it('dropdown = Daily/Weekly/Monthly + saved values + "+ Add new", plus a list column', async () => {
    q.listMaintenanceChecklist.mockResolvedValue([
      { id: 1, machine_id: 'MC-1', checklist_item: 'Oil level', frequency: 'Daily' },
      { id: 2, machine_id: 'MC-1', checklist_item: 'Lube pump', frequency: 'Every 3 days' },
    ])
    q.createMaintenanceChecklistItem.mockResolvedValue({})
    render(<MaintenanceMaster />)
    await screen.findByText('Oil level')
    expect(screen.getByRole('columnheader', { name: 'Frequency' })).toBeTruthy()

    const select = within(screen.getByText('Frequency', { selector: 'label *' }).closest('label')).getByRole('combobox')
    const options = within(select).getAllByRole('option').map((o) => o.textContent)
    for (const f of ['Daily', 'Weekly', 'Monthly', 'Every 3 days']) expect(options).toContain(f)
    expect(options.some((o) => /Add new/i.test(o))).toBe(true)
  })
})
