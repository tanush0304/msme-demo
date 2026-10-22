import { describe, expect, it, vi } from 'vitest'
import { headerBreadcrumb } from './breadcrumb'

describe('headerBreadcrumb', () => {
  it('on a screen: the module crumb links back to the landing', () => {
    const onTop = vi.fn()
    const crumbs = headerBreadcrumb('dashboard', 'production-status', onTop)
    expect(crumbs.map((c) => c.label)).toEqual(['Reports & Dashboard', 'Production Status'])
    crumbs[0].onClick()
    expect(onTop).toHaveBeenCalledTimes(1)
    expect(crumbs[1].onClick).toBeUndefined()
  })

  it('on the landing: one crumb, the current page, not a link', () => {
    const crumbs = headerBreadcrumb('stores', null, vi.fn())
    expect(crumbs).toEqual([{ label: 'Stores' }])
  })

  it('unknown module: no crumbs', () => {
    expect(headerBreadcrumb('nope', null, vi.fn())).toEqual([])
  })
})
