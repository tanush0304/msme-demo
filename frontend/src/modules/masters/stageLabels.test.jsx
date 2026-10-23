// @vitest-environment jsdom
// "Stage" (route position) instead of "Seq" in Cycle Time Master and
// Masters > Route Card. The stored seq (10/20/30) is unchanged; users see 1, 2, 3.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

const CYCLE_ROWS = [
  { id: 1, part_serial_number: 'PART-101', seq: 10, operation: 'Cutting', type: 'Internal', machine_id: 'MC-01', job_work_code: null, cycle_time_min: 3 },
  { id: 2, part_serial_number: 'PART-101', seq: 10, operation: 'Cutting', type: 'Internal', machine_id: 'MC-02', job_work_code: null, cycle_time_min: 3.2 },
  { id: 3, part_serial_number: 'PART-101', seq: 20, operation: 'Rough Turning', type: 'Internal', machine_id: 'MC-03', job_work_code: null, cycle_time_min: 4.5 },
  { id: 4, part_serial_number: 'PART-101', seq: 40, operation: 'Grinding', type: 'Internal', machine_id: 'MC-07', job_work_code: null, cycle_time_min: 4 },
]
const PRODUCTS = [{ part_serial_number: 'PART-101', part_name: 'Hydraulic Valve Body', part_drawing_reference_number: 'DRG-101-A' }]

vi.mock('../../data/queries/cycleTimes', () => ({
  listCycleTimes: vi.fn(async () => CYCLE_ROWS),
  createCycleTime: vi.fn(), updateCycleTime: vi.fn(), deleteCycleTime: vi.fn(),
  listCycleTimesForPart: vi.fn(async () => CYCLE_ROWS),
}))
vi.mock('../../data/queries/products', () => ({ listProducts: vi.fn(async () => PRODUCTS) }))
vi.mock('../../data/queries/machines', () => ({ listMachines: vi.fn(async () => []) }))
vi.mock('../../data/queries/jobWorkTypes', () => ({ listJobWorkTypes: vi.fn(async () => []) }))
vi.mock('../../data/queries/machineOperations', () => ({ listMachineOperationOptions: vi.fn(async () => []), listAllMachineOperations: vi.fn(async () => []) }))

import CycleTimeMaster from './CycleTimeMaster'
import RouteCardScreen from '../customerOrder/RouteCardScreen'

afterEach(() => cleanup())

const columnTexts = (table, label) => {
  const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent.trim())
  const i = headers.indexOf(label)
  return within(table).getAllByRole('row').slice(1).map((tr) => tr.children[i]?.textContent.trim())
}

describe('Cycle Time Master', () => {
  it('form field is "Stage" with the route-order hint', async () => {
    render(<CycleTimeMaster />)
    expect(await screen.findByText('Order of this operation in the route (1, 2, 3 ...)')).toBeTruthy()
    expect(screen.queryByText('Sequence')).toBeNull()
  })

  it('list shows a "Stage" column with the route position (10,10,20,40 -> 1,1,2,3), no "Seq"', async () => {
    render(<CycleTimeMaster />)
    await waitFor(() => expect(screen.getAllByRole('table').at(-1).textContent).toContain('Cutting'), { timeout: 4000 })
    // the list shows its first rows only until expanded
    fireEvent.click(screen.getByRole('button', { name: /show all|more/i }))
    const table = screen.getAllByRole('table').at(-1)
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent.trim())
    expect(headers).toContain('Stage')
    expect(headers).not.toContain('Seq')
    expect(columnTexts(table, 'Stage')).toEqual(['1', '1', '2', '3'])
  })
})

describe('Masters > Route Card', () => {
  it('shows only the "Stage" position column (no "Seq")', async () => {
    render(<RouteCardScreen />)
    const combo = await screen.findByRole('combobox')
    await waitFor(() => { fireEvent.click(combo); expect(screen.getAllByRole('option').length).toBeGreaterThan(0) })
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent.includes('PART-101')))
    const table = await screen.findByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent.trim())
    expect(headers[0]).toBe('Stage')
    expect(headers).not.toContain('Seq')
    expect(columnTexts(table, 'Stage')).toEqual(['1', '1', '2', '3'])
  })
})
