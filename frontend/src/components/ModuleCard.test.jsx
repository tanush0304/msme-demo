// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Database } from 'lucide-react'
import ModuleCard from './ModuleCard'

afterEach(() => cleanup())

const THEME = { accent: '#1E7BF2', tint: '#E8F2FE', strong: '#1559B5', wash: '#E8F2FE' }
const DESC = 'Maintain customer details, addresses, GST and payment terms.'

describe('ModuleCard compact', () => {
  it('2-line title + full-width 2-line description, both with tooltips; aria label', () => {
    const onClick = vi.fn()
    render(<ModuleCard compact title="Customer Master" description={DESC} icon={Database} theme={THEME} onClick={onClick} />)
    const card = screen.getByRole('button', { name: 'Open Customer Master' })
    const titleEl = card.querySelector('[data-card-title]')
    expect(titleEl.textContent).toBe('Customer Master')
    expect(titleEl.className).toContain('line-clamp-2')
    expect(titleEl.getAttribute('title')).toBe('Customer Master')
    const desc = screen.getByText(DESC)
    expect(desc.className).toContain('line-clamp-2')
    expect(desc.className).toContain('pr-10') // clear of the arrow
    expect(desc.parentElement).toBe(card) // spans the full card width, not beside the icon
    expect(desc.getAttribute('title')).toBe(DESC)
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('height follows content -- no fixed height, no overflow clipping', () => {
    render(<ModuleCard compact title="Customer Master" description={DESC} icon={Database} theme={THEME} />)
    const card = screen.getByRole('button')
    expect(card.className).not.toMatch(/(^|\s)(h-\[\d|h-\d|max-h-|overflow-hidden)/)
    expect(card.style.borderTopColor).not.toBe('')
  })

  it('locked: disabled and keeps a custom aria label', () => {
    render(<ModuleCard compact disabled ariaLabel="Masters. Supervisor or admin access required." title="Masters" icon={Database} theme={THEME} />)
    expect(screen.getByRole('button', { name: 'Masters. Supervisor or admin access required.' }).disabled).toBe(true)
  })

  it('without compact the large card is unchanged (arrow in its own bottom row)', () => {
    render(<ModuleCard title="Production" description={DESC} icon={Database} theme={THEME} />)
    const card = screen.getByRole('button')
    expect(card.className).toContain('flex-col')
    expect(screen.getByText('Production').className).toContain('line-clamp-2')
    expect(card.querySelector('[data-card-title]')).toBeNull()
  })
})
