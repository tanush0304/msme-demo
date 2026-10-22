// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Sidebar from './Sidebar'

afterEach(() => cleanup())

function renderSidebar(activeKey, activeSubKey, onSelect = vi.fn()) {
  render(
    <Sidebar
      activeKey={activeKey}
      activeSubKey={activeSubKey}
      onSelect={onSelect}
      onSelectSub={vi.fn()}
      onHome={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      role="supervisor"
    />
  )
  return onSelect
}

describe('clicking the active module', () => {
  it('from one of its screens opens the module landing', () => {
    const onSelect = renderSidebar('dashboard', 'production-status')
    fireEvent.click(screen.getByRole('button', { name: 'Open Reports & Dashboard' }))
    expect(onSelect).toHaveBeenCalledWith('dashboard')
  })

  it('on its landing only toggles the screen list (no navigation)', () => {
    const onSelect = renderSidebar('stores', null)
    const button = screen.getByRole('button', { name: 'Open Stores' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('another module still navigates there', () => {
    const onSelect = renderSidebar('stores', 'rm')
    fireEvent.click(screen.getByRole('button', { name: 'Open Production' }))
    expect(onSelect).toHaveBeenCalledWith('production')
  })
})
