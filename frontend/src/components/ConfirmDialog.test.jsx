// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import ConfirmDialog, { labelOf } from './ConfirmDialog'

afterEach(() => cleanup())

function setup(props = {}) {
  const onConfirm = props.onConfirm ?? vi.fn(async () => {})
  const onClose = vi.fn()
  render(<ConfirmDialog open recordType="customer" label="CUST-001 – Acme" onConfirm={onConfirm} onClose={onClose} {...props} />)
  return { onConfirm, onClose }
}

describe('ConfirmDialog', () => {
  it('names the record type and label', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Delete customer?' })).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain("CUST-001 – Acme will be permanently deleted. This can't be undone.")
  })

  it('focuses Cancel, so Enter there does not delete', () => {
    const { onConfirm, onClose } = setup()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancel)
    expect(screen.getByRole('button', { name: 'Delete' }).getAttribute('type')).toBe('button')
    fireEvent.keyDown(cancel, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(cancel)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Esc and the backdrop close without deleting; clicks inside the card do not', () => {
    const { onConfirm, onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByText(/permanently deleted/))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('confirm-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Delete runs once; spinner and both buttons disabled while pending, then closes', async () => {
    let finish
    const onConfirm = vi.fn(() => new Promise((r) => { finish = r }))
    const { onClose } = setup({ onConfirm })
    const del = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(del)
    fireEvent.click(del)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(del.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true)
    expect(screen.getByLabelText('Working')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => finish())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a DB error (the screen Banner reports it)', async () => {
    const { onClose } = setup({ onConfirm: vi.fn(async () => { throw new Error('boom') }) })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('takes title / button overrides and renders nothing when closed', () => {
    setup({ title: 'Remove planned maintenance?', confirmText: 'Remove' })
    expect(screen.getByRole('heading', { name: 'Remove planned maintenance?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy()
    cleanup()
    render(<ConfirmDialog open={false} recordType="x" label="y" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('labelOf skips empty parts', () => {
    expect(labelOf('MC-01', '', null, 'Spindle')).toBe('MC-01 – Spindle')
  })
})
