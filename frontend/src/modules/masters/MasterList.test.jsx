import { describe, expect, it, vi } from 'vitest'
import { rotatedTheme } from '../../theme/moduleTheme'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NAV_ITEMS } from '../../utils/constants'
import MasterList, { MASTER_ENTRIES, MasterCard } from './MasterList'

const EXPECTED_LABELS = [
  'Employee Master',
  'Shift Master',
  'Customer Master',
  'Supplier Master',
  'Raw Material Master',
  'Product Master',
  'Production Batch Master',
  'Machine Master',
  'Vendor Master',
  'Job Work Master',
  'Cycle Time Master',
  'Route Card',
  'Maintenance Master',
  'WIP Master',
  'Finished Goods Master',
  'Quality Master',
]

describe('Masters landing entries', () => {
  it('keeps the client tile order and maps every card to a screen, icon and description', () => {
    expect(MASTER_ENTRIES.map((entry) => entry.label)).toEqual(EXPECTED_LABELS)
    expect(MASTER_ENTRIES.map((entry) => entry.key)).toEqual(
      NAV_ITEMS.find((item) => item.key === 'masters').subItems.map((item) => item.key)
    )
    expect(MASTER_ENTRIES).toHaveLength(16)
    expect(MASTER_ENTRIES.every((entry) => typeof entry.component === 'function')).toBe(true)
    expect(MASTER_ENTRIES.every((entry) => Boolean(entry.icon))).toBe(true)
    expect(MASTER_ENTRIES.every((entry) => entry.description?.startsWith('Manage '))).toBe(true)
    // Card colours rotate through the 8 module accents (theme/moduleTheme.js).
    expect(MASTER_ENTRIES.map((entry) => MasterCard({ item: entry, onSelect: vi.fn() }).props.theme)).toEqual(MASTER_ENTRIES.map((_, i) => rotatedTheme(i)))
  })

  it('shows all 16 cards when Masters has no selected submenu', () => {
    const html = renderToStaticMarkup(createElement(MasterList, { activeTab: null, onSelect: vi.fn() }))
    expect(html).not.toContain('Manage all your master data in one place.')
    expect(html.match(/aria-label="Open /g)).toHaveLength(16)
    EXPECTED_LABELS.forEach((label) => expect(html).toContain('>' + label + '</span>'))
  })

  it('renders PPT-style cards: description text, no tile pictures', () => {
    const html = renderToStaticMarkup(createElement(MasterList, { activeTab: null, onSelect: vi.fn() }))
    expect(html).not.toMatch(/\.webp/)
    expect(html).toContain('Manage employee details, roles and skills')
    expect(html).toContain('Manage operation sequences and routing details')
  })

  it('resolves each submenu key to its registered screen', () => {
    MASTER_ENTRIES.forEach((item) => {
      expect(MasterList({ activeTab: item.key }).props.children.type).toBe(item.component)
    })
  })

  it('sends each card click to its corresponding submenu key', () => {
    const onSelect = vi.fn()
    MASTER_ENTRIES.forEach((item) => {
      const card = MasterCard({ item, onSelect })
      card.props.onClick()
    })
    expect(onSelect.mock.calls.map(([key]) => key)).toEqual(MASTER_ENTRIES.map((item) => item.key))
  })
})

describe('Masters header band', () => {
  it('renders the band with logos, title and breadcrumb on the landing page', () => {
    const html = renderToStaticMarkup(createElement(MasterList, { activeTab: null, onSelect: vi.fn() }))
    // No client logo is configured in the demo, so every image is a Pragati &
    // Unnati logo (the full one from lg, the compact one below it).
    expect(html).not.toContain('Engineering"')
    const alts = [...html.matchAll(/<img [^>]*alt="([^"]*)"/g)].map((m) => m[1])
    expect(alts).toHaveLength(2)
    expect(alts.every((alt) => alt.startsWith('Pragati &amp; Unnati'))).toBe(true)
    expect(html).toContain('alt="Pragati &amp; Unnati"')
    expect(html).not.toContain('Developed by')
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('aria-current="page">Masters</span>')
    expect(html).not.toContain('ERP System')
  })

  it('links the breadcrumb back to the Masters landing from inside a master', () => {
    const onSelect = vi.fn()
    const el = MasterList({ activeTab: 'customer', onSelect })
    const [masters, current] = el.props.breadcrumb
    expect(current.label).toBe('Customer Master')
    masters.onClick()
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
