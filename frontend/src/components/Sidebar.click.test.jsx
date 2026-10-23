// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
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

describe('Home item', () => {
  function renderHome({ role = 'supervisor', isHome = false } = {}) {
    const onHome = vi.fn()
    const onSelect = vi.fn()
    render(
      <Sidebar activeKey="production" activeSubKey="production-entry" onSelect={onSelect} onSelectSub={vi.fn()}
        onHome={onHome} isHome={isHome} userEmail="user@example.com" onSignOut={vi.fn()} role={role} />
    )
    return { onHome, onSelect }
  }
  const nav = () => screen.getByRole('navigation', { name: 'Application modules' })

  it('is the first item, above Masters', () => {
    renderHome()
    const buttons = within(nav()).getAllByRole('button')
    expect(buttons[0].getAttribute('aria-label')).toBe('Open Home')
    expect(buttons[1].getAttribute('aria-label')).toBe('Open Masters')
  })

  it('calls onHome only -- no navigation, nothing expands', () => {
    const { onHome, onSelect } = renderHome()
    const before = within(nav()).getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === 'true').length
    fireEvent.click(screen.getByRole('button', { name: 'Open Home' }))
    expect(onHome).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
    expect(within(nav()).getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === 'true').length).toBe(before)
  })

  it('is enabled for an operator while Masters stays locked', () => {
    renderHome({ role: 'operator' })
    const home = screen.getByRole('button', { name: 'Open Home' })
    expect(home.disabled).toBe(false)
    expect(home.getAttribute('title')).toBeNull()
    expect(screen.getByRole('button', { name: 'Masters. Supervisor or admin access required.' }).disabled).toBe(true)
  })

  it('collapsed: icon only, with a Home tooltip', () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    const home = screen.getByRole('button', { name: 'Open Home' })
    expect(home.getAttribute('title')).toBe('Home')
    expect(home.textContent).toBe('')
    expect(home.querySelector('svg')).not.toBeNull()
  })

  it('is marked current only when isHome', () => {
    renderHome()
    expect(screen.getByRole('button', { name: 'Open Home' }).getAttribute('aria-current')).toBeNull()
    cleanup()
    renderHome({ isHome: true })
    expect(screen.getByRole('button', { name: 'Open Home' }).getAttribute('aria-current')).toBe('page')
  })
})

describe('starting width', () => {
  const realMatchMedia = window.matchMedia
  afterEach(() => { window.matchMedia = realMatchMedia })
  const setPhone = (phone) => { window.matchMedia = (q) => ({ matches: phone && q === '(max-width: 767px)', media: q, addEventListener() {}, removeEventListener() {} }) }

  it('starts collapsed below md and can still be expanded', () => {
    setPhone(true)
    renderSidebar('production', null)
    const toggle = screen.getByRole('button', { name: 'Expand sidebar' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy()
  })

  it('starts expanded on desktop', () => {
    setPhone(false)
    renderSidebar('production', null)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy()
  })
})
