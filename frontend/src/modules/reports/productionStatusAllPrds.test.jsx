// @vitest-environment jsdom
// Demo only: Production Status KPI cards are "All PRDs" totals until a PRD is
// applied; a PRD applied -> the per-PRD cards exactly as before.
import { cloneElement } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { todayISO } from '../../utils/dates'

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 300 }) }
})
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))

const T = todayISO()
const row = (o) => ({ log_date: T, shift_code: 'A', employee_id: 'E1', stage_seq: 1, operation: 'Turning', machine_id: 'MC-1', machine_name: 'CNC 1', machine_category: 'CNC', idle_breakdown: 0, idle_no_material: 0, idle_no_operator: 0, idle_power_cut: 0, idle_tool_change: 0, idle_quality_issue: 0, idle_others: 0, idle_lunch: 0, cycle_time_min: 5, standard_qty_per_hour: 10, shift_hours: 8, ...o })
const m = vi.hoisted(() => ({ hours: [] }))
const HOURS = [
  row({ log_id: 1, prd_no: 'PRD-1', stage_id: 11, hour_rows: 4, produced: 40, rejected: 2, rework: 1 }),
  row({ log_id: 2, prd_no: 'PRD-2', stage_id: 21, hour_rows: 2, produced: 20, rejected: 0, rework: 1 }),
]
const STAGES = { 'PRD-1': [{ id: 11, seq: 1 }, { id: 12, seq: 2 }], 'PRD-2': [{ id: 21, seq: 1 }] }
const AGG = { 'PRD-1': { 12: { accepted: 30 } }, 'PRD-2': { 21: { accepted: 18 } } }

vi.mock('../../data/queries/reports', () => ({ listProductionHours: async () => m.hours, listLoggedPrds: async () => ['PRD-1', 'PRD-2'] }))
vi.mock('../../data/queries/machines', () => ({ listMachines: async () => [{ machine_id: 'MC-1', machine_name: 'CNC 1', category: 'CNC' }] }))
vi.mock('../../data/queries/shifts', () => ({ listShifts: async () => [{ shift_code: 'A', shift_name: 'Shift A' }] }))
vi.mock('../../data/queries/employees', () => ({ listEmployees: async () => [{ employee_id: 'E1', employee_name: 'Ravi' }] }))
vi.mock('../../data/queries/customerOrders', () => ({
  listOrdersByPrd: async () => [{ prd_no: 'PRD-1', prd_qty: 100, order_qty: 200 }, { prd_no: 'PRD-2', prd_qty: 50, order_qty: 60 }, { prd_no: 'PRD-9', prd_qty: 999 }],
}))
vi.mock('../../data/queries/routeCards', () => ({ getStagesForPrd: async (prd) => STAGES[prd] ?? [] }))
vi.mock('../../data/queries/productionLogs', () => ({ getStageAggregatesForPrd: async (prd) => AGG[prd] ?? {} }))
vi.mock('../../components/SearchableSelect', () => ({
  default: ({ value, onChange, options, ...rest }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={onChange}>
      <option value="" />
      {(options ?? []).map((o) => {
        const v = typeof o === 'string' ? o : o.value
        return <option key={v} value={v}>{typeof o === 'string' ? o : o.label}</option>
      })}
    </select>
  ),
}))

const { ChartTypeProvider } = await import('../../components/reports/ChartTypeToggle')
const ProductionStatus = (await import('./ProductionStatusScreen')).default

async function mount() {
  await act(async () => {
    render(<ChartTypeProvider initial="bar"><ProductionStatus /></ChartTypeProvider>)
  })
  for (let i = 0; i < 6; i++) await act(async () => {})
}
const card = (label) => screen.getAllByText(label).map((el) => el.closest('[class*="rounded"]')).find(Boolean)

afterEach(() => cleanup())

describe('Production Status -- All PRDs KPI cards (demo)', () => {
  it('no PRD applied: All PRDs totals, no "Select a PRD No" box', async () => {
    m.hours = HOURS
    await mount()
    const box = screen.getByTestId('kpi-all-prds')
    expect(screen.queryByText(/Select a PRD No/)).toBeNull()
    expect(box.textContent).toContain('All PRDs — 2 PRDs with production in this period')
    const text = box.textContent
    expect(text).toContain('150') // PRD Qty = 100 + 50 (PRD-9 not in the period)
    expect(text).toContain('48') // last-stage good: 30 (PRD-1 stage 2) + 18 (PRD-2 stage 1)
    expect(text).toContain('All PRDs · 2 PRDs')
    expect(text).toContain('All PRDs · to date')
    // period figures: produced 60, rejected 2, rework 2 -> 3.33 % / 3.33 % of (56 + 2 + 2)
    expect(text).toContain('3.33%, all PRDs, this period')
    expect(within(box).getByText('Production Efficiency')).toBeTruthy()
    expect(card('Production Efficiency')).toBeTruthy()
  })

  it('no production in the period: zeros + "No production in this period"', async () => {
    m.hours = []
    await mount()
    const box = screen.getByTestId('kpi-all-prds')
    expect(box.textContent).toContain('All PRDs — No production in this period')
    expect(box.textContent).toContain('All PRDs · 0 PRDs')
  })

  it('PRD applied: the per-PRD cards as before, no All PRDs text', async () => {
    m.hours = HOURS
    await mount()
    fireEvent.change(screen.getByLabelText('PRD No'), { target: { value: 'PRD-1' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /search/i })))
    for (let i = 0; i < 6; i++) await act(async () => {})
    expect(screen.queryByTestId('kpi-all-prds')).toBeNull()
    expect(screen.queryByText(/All PRDs/)).toBeNull()
    expect(screen.getByText('(PO line 200)')).toBeTruthy()
    expect(screen.getByText('to date')).toBeTruthy()
  })
})
