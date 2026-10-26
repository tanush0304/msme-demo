// @vitest-environment jsdom
// Customer Master delete: in-app confirm dialog (no window.confirm); Cancel
// keeps the record, Delete removes it once, a DB error shows in the Banner.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
const q = vi.hoisted(() => ({
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
}))
vi.mock('../../data/queries/customers', () => q)

import CustomerMaster from './CustomerMaster'

const ACME = { customer_id: 'CUST-001', customer_name: 'Acme Engineering' }

beforeEach(() => {
  q.listCustomers.mockReset().mockResolvedValue([ACME])
  q.deleteCustomer.mockReset().mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockImplementation(() => { throw new Error('window.confirm must not be used') })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openDialog() {
  render(<CustomerMaster />)
  fireEvent.click(await screen.findByText('CUST-001'))
  fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
  return screen.findByRole('dialog')
}

describe('Customer Master delete', () => {
  it('Cancel closes the dialog without deleting', async () => {
    const dialog = await openDialog()
    expect(dialog.textContent).toContain('Delete customer?')
    expect(dialog.textContent).toContain('CUST-001 – Acme Engineering will be permanently deleted.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(q.deleteCustomer).not.toHaveBeenCalled()
  })

  it('Delete removes the record once and closes', async () => {
    await openDialog()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(q.deleteCustomer).toHaveBeenCalledTimes(1)
    expect(q.deleteCustomer).toHaveBeenCalledWith('CUST-001')
  })

  it('a DB error closes the dialog and shows in the Banner', async () => {
    q.deleteCustomer.mockRejectedValue(new Error('update or delete on table "customer master" violates foreign key constraint'))
    await openDialog()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
