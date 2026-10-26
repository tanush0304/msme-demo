// @vitest-environment jsdom
// Customer Order Status: opens on This Financial Year; with no PO lines in
// the period it names the latest PO and "Show all POs" re-searches from the
// earliest PO date (To kept). Bounds are only fetched in that empty state.
import { cloneElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { periodRange } from '../../utils/reportPeriods'
import { todayISO } from '../../utils/dates'

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 300 }) }
})
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))

const q = vi.hoisted(() => ({
  listOrdersByPoDate: vi.fn(),
  listFgTransactionsUpTo: vi.fn(async () => []),
  getPoDateBounds: vi.fn(),
}))
vi.mock('../../data/queries/reports', () => q)
vi.mock('../../data/queries/customerOrders', () => ({ listProductionOrders: vi.fn(async () => []) }))
vi.mock('../../data/queries/customers', () => ({ listCustomers: vi.fn(async () => []) }))
vi.mock('../../data/queries/products', () => ({ listProducts: vi.fn(async () => []) }))

import CustomerOrderStatusScreen from './CustomerOrderStatusScreen'

const LINE = { order_line_id: 1, customer_id: 'C1', po_number: 'PO-9', po_date: '2026-05-02', part_serial_number: 'P1', order_qty: 10, prd_no: null }

beforeEach(() => {
  q.listOrdersByPoDate.mockReset()
  q.getPoDateBounds.mockReset()
  q.getPoDateBounds.mockResolvedValue({
    earliest: { po_number: 'PO-1', po_date: '2024-06-10' },
    latest: { po_number: 'PO-8', po_date: '2025-03-15' },
  })
})
afterEach(cleanup)

describe('Customer Order Status empty state', () => {
  it('loads This Financial Year by default', async () => {
    q.listOrdersByPoDate.mockResolvedValue([LINE])
    render(<CustomerOrderStatusScreen />)
    await waitFor(() => expect(q.listOrdersByPoDate).toHaveBeenCalled())
    expect(q.listOrdersByPoDate.mock.calls[0][0]).toMatchObject(periodRange('thisFY'))
  })

  it('names the latest PO and Show all POs searches earliest PO date -> today', async () => {
    q.listOrdersByPoDate.mockResolvedValue([])
    render(<CustomerOrderStatusScreen />)
    await screen.findByRole('button', { name: 'Show all POs' })
    // An old custom range: To must move to today, not stay at 31-01-2025.
    fireEvent.change(screen.getByLabelText('From', { exact: true }), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText('To', { exact: true }), { target: { value: '2025-01-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(q.listOrdersByPoDate).toHaveBeenLastCalledWith(expect.objectContaining({ to: '2025-01-31' })))
    expect(await screen.findByText('No POs dated in this period. Latest PO: PO-8 dated 15-03-2025.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all POs' }))
    await waitFor(() => expect(q.listOrdersByPoDate).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2024-06-10', to: todayISO() })))
  })

  it('says no POs exist and offers no button when the table is empty', async () => {
    q.listOrdersByPoDate.mockResolvedValue([])
    q.getPoDateBounds.mockResolvedValue({ earliest: null, latest: null })
    render(<CustomerOrderStatusScreen />)
    expect(await screen.findByText('No POs recorded yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show all POs' })).toBeNull()
  })

  it('does not fetch bounds when the period has PO lines', async () => {
    q.listOrdersByPoDate.mockResolvedValue([LINE])
    render(<CustomerOrderStatusScreen />)
    expect(await screen.findAllByText('PO-9')).not.toHaveLength(0)
    expect(q.getPoDateBounds).not.toHaveBeenCalled()
    expect(screen.queryByText(/No POs/)).toBeNull()
  })
})
