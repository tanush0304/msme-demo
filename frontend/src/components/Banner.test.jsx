// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import Banner, { SUCCESS_HIDE_MS } from './Banner'

afterEach(() => { cleanup(); vi.useRealTimers() })
const RAW = 'PRD PRD-009 has started (3 row(s) in "production logs") and cannot be cancelled'

describe('Banner', () => {
  it('error: role="alert", friendly text, raw message in the Details tooltip, dismissable', () => {
    const onClose = vi.fn()
    render(<Banner tone="error" message={RAW} onClose={onClose} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("PRD-009 can't be cancelled")
    expect(screen.getByText('Details').getAttribute('title')).toBe(RAW)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('no Details when the text is already readable; nothing rendered without a message', () => {
    render(<Banner tone="error" message="Select a Customer PO No and Part first." />)
    expect(screen.queryByText('Details')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    cleanup()
    const { container } = render(<Banner tone="error" message={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('warning is an alert too; success is a status that hides itself after 4s', () => {
    render(<Banner tone="warning" message="Shift crosses midnight." />)
    expect(screen.getByRole('alert').textContent).toContain('Shift crosses midnight.')
    cleanup()
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Banner tone="success" message="PRD-009 cancelled." onClose={onClose} />)
    expect(screen.getByRole('status').textContent).toContain('PRD-009 cancelled.')
    act(() => { vi.advanceTimersByTime(SUCCESS_HIDE_MS - 1) })
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
