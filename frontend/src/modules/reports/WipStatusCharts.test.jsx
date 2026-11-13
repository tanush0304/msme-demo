// @vitest-environment jsdom
// WIP Status charts: balance charts say "No WIP stock at <To>" when rows exist
// but nothing is left; the trend chart covers the whole period and says
// "No WIP movement in this period" when nothing moved and nothing carried in.
import { cloneElement } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { todayISO } from '../../utils/dates'

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 300 }) }
})
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
const ledger = vi.hoisted(() => ({ rows: [] }))
vi.mock('../../data/queries/reports', () => ({ listWipTransactionsUpTo: async () => ledger.rows }))
vi.mock('../../data/queries/customerOrders', () => ({ listOrdersByPrd: async () => [{ prd_no: 'PRD-001', prd_qty: 20 }] }))
vi.mock('../../data/queries/routeCards', () => ({ listAllStages: async () => [{ id: 7, seq: 1, operation: 'Turning' }] }))
const csv = vi.hoisted(() => ({ calls: [] }))
vi.mock('../../utils/exportUtils', () => ({ exportToCsv: (...a) => csv.calls.push(a), exportToPdf: () => {} }))
vi.mock('html-to-image', () => ({ toPng: async () => 'data:image/png;base64,' }))

import WipStatusScreen from './WipStatusScreen'

afterEach(() => cleanup())
const T = (transaction_type, qty, transaction_date) => ({ prd_no: 'PRD-001', nature_of_operation_stage_id: 7, transaction_type, qty, transaction_date })

describe('WIP Status charts', () => {
  it('same-day 20 in / 20 out: balance charts say no stock; trend still drawn with its period title', async () => {
    const d = todayISO()
    ledger.rows = [T('Receipt', 20, d), T('Issue', 20, d)]
    render(<WipStatusScreen />)
    expect(await screen.findAllByText(/^No WIP stock at .+ -- everything received has been issued\.$/)).toHaveLength(2)
    expect(screen.getByText(/^WIP Status \(.+ to .+\)$/)).toBeTruthy()
    expect(screen.queryByText('No WIP movement in this period')).toBeNull()
    expect(screen.getByText('Received')).toBeTruthy()
    expect(screen.getByText('Closing WIP')).toBeTruthy()
  })

  it('chart Excel export: the trend series with the legend labels, the filter line and <Screen>_<Chart>_<date>.csv', async () => {
    const d = todayISO()
    ledger.rows = [T('Receipt', 20, d), T('Issue', 5, d)]
    csv.calls = []
    render(<WipStatusScreen />)
    const heading = await screen.findByText(/^WIP Status \(.+ to .+\)$/)
    const trendCard = heading.closest('section')
    const { within, fireEvent } = await import('@testing-library/react')
    expect(within(trendCard).getByTestId('chart-subline').textContent).toMatch(/^\d{2}-\d{2}-\d{4} to \d{2}-\d{2}-\d{4}$/)
    fireEvent.click(within(trendCard).getByRole('button', { name: /Export/ }))
    fireEvent.click(within(trendCard).getByRole('menuitem', { name: 'Excel' }))
    expect(csv.calls).toHaveLength(1)
    const [columns, rows, filename] = csv.calls[0]
    expect(columns.map((c) => c.label)).toEqual(['Period', 'Received', 'Issued', 'Closing WIP']) // same as the chart legend
    expect(rows.some((r) => r.receipts === 20 && r.issues === 5)).toBe(true)
    expect(filename).toBe(`WIP_Status_WIP_Trend_${d}.csv`)
  })

  it('truly empty period: default text on balance charts, no-movement text on trend', async () => {
    ledger.rows = []
    render(<WipStatusScreen />)
    expect(await screen.findByText('No WIP movement in this period')).toBeTruthy()
    expect(screen.getAllByText('No data for this period.')).toHaveLength(2)
    expect(screen.queryByText(/No WIP stock at/)).toBeNull()
  })
})
