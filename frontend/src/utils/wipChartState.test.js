import { describe, it, expect } from 'vitest'
import { wipChartState } from './reportStock'
import { trendBuckets } from './reportAggregates'
import { daysBetween } from './reportPeriods'

const T = (transaction_type, qty, transaction_date) => ({ transaction_type, qty, transaction_date })
const state = (txns, from, to) =>
  wipChartState(txns, { from, to, days: daysBetween(from, to), bucket: (d) => trendBuckets(d, { sum: ['receipts', 'issues'], last: ['balance'] }) })

describe('wipChartState', () => {
  it('same-day 20 in / 20 out -> 0 balance: balance charts empty, trend not', () => {
    const s = state([T('Receipt', 20, '2026-10-05'), T('Issue', 20, '2026-10-05')], '2026-10-01', '2026-10-10')
    expect(s.balance).toBe(0)
    expect(s.balanceEmpty).toBe(true)
    expect(s.trendEmpty).toBe(false)
    expect(s.trend).toHaveLength(10)
    expect(s.trend.find((p) => p.date === '2026-10-05')).toMatchObject({ receipts: 20, issues: 20, balance: 0 })
  })

  it('stock left -> nothing empty; closing line carries the balance', () => {
    const s = state([T('Receipt', 50, '2026-10-02'), T('Issue', 15, '2026-10-04')], '2026-10-01', '2026-10-10')
    expect(s).toMatchObject({ balance: 35, balanceEmpty: false, trendEmpty: false })
    expect(s.trend.at(-1).balance).toBe(35)
  })

  it('no movement but stock carried in -> trend shown (flat closing line)', () => {
    const s = state([T('Receipt', 40, '2026-09-20')], '2026-10-01', '2026-10-10')
    expect(s).toMatchObject({ balance: 40, balanceEmpty: false, trendEmpty: false })
    expect(s.trend.every((p) => p.balance === 40)).toBe(true)
  })

  it('no movement and nothing carried in -> trend empty; later txns ignored', () => {
    const s = state([T('Receipt', 10, '2026-09-01'), T('Issue', 10, '2026-09-02'), T('Receipt', 99, '2026-11-01')], '2026-10-01', '2026-10-10')
    expect(s).toMatchObject({ balance: 0, balanceEmpty: true, trendEmpty: true })
  })

  it('whole period, monthly above 62 days', () => {
    const s = state([T('Receipt', 5, '2026-07-10'), T('Issue', 2, '2026-09-10')], '2026-07-01', '2026-10-31')
    expect(s.trend.map((p) => p.date)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(s.trend.map((p) => p.balance)).toEqual([5, 5, 3, 3])
  })
})
