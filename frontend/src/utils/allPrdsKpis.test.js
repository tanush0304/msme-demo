import { describe, it, expect } from 'vitest'
import { prdsInRows, allPrdsKpis } from './allPrdsKpis'

describe('prdsInRows', () => {
  it('distinct PRDs, numeric order, blanks dropped', () => {
    expect(prdsInRows([{ prd_no: 'PRD-10' }, { prd_no: 'PRD-2' }, { prd_no: 'PRD-2' }, { prd_no: null }, {}])).toEqual(['PRD-2', 'PRD-10'])
    expect(prdsInRows([])).toEqual([])
  })
})

describe('allPrdsKpis', () => {
  const orders = [{ prd_no: 'PRD-1', prd_qty: 100 }, { prd_no: 'PRD-2', prd_qty: '50' }, { prd_no: 'PRD-9', prd_qty: 999 }]
  it('sums planned qty and last-stage good qty over the period PRDs only', () => {
    expect(allPrdsKpis({ prdNos: ['PRD-1', 'PRD-2'], orders, perPrd: { 'PRD-1': { produced: 40 }, 'PRD-2': { produced: 15 } } }))
      .toEqual({ prd_count: 2, prd_qty: 150, produced: 55 })
  })
  it('a PRD with no order / no stages counts as 0', () => {
    expect(allPrdsKpis({ prdNos: ['PRD-1', 'PRD-3'], orders, perPrd: { 'PRD-1': { produced: 40 } } }))
      .toEqual({ prd_count: 2, prd_qty: 100, produced: 40 })
  })
  it('no PRDs -> zeros', () => {
    expect(allPrdsKpis({ prdNos: [], orders, perPrd: {} })).toEqual({ prd_count: 0, prd_qty: 0, produced: 0 })
  })
})
