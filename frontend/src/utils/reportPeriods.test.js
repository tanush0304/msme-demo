import { describe, it, expect } from 'vitest'
import { PERIOD_PRESETS, fyStart, periodRange, previousRange, daysBetween, addDays, displayDate, shortDate } from './reportPeriods'

const TODAY = new Date(2026, 9, 12) // 12 Oct 2026, local

describe('periodRange', () => {
  it('handles single-day presets', () => {
    expect(periodRange('today', TODAY)).toEqual({ from: '2026-10-12', to: '2026-10-12' })
    expect(periodRange('yesterday', TODAY)).toEqual({ from: '2026-10-11', to: '2026-10-11' })
  })
  it('counts today inside last 7 / 30 days', () => {
    expect(periodRange('last7', TODAY)).toEqual({ from: '2026-10-06', to: '2026-10-12' })
    expect(periodRange('last30', TODAY)).toEqual({ from: '2026-09-13', to: '2026-10-12' })
  })
  it('handles month presets incl. year boundary', () => {
    expect(periodRange('thisMonth', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-12' })
    expect(periodRange('lastMonth', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodRange('lastMonth', new Date(2026, 0, 5))).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })
  it('starts This Financial Year on 1 Apr (previous year for Jan-Mar)', () => {
    expect(periodRange('thisFY', TODAY)).toEqual({ from: '2026-04-01', to: '2026-10-12' })
    expect(periodRange('thisFY', new Date(2027, 1, 15))).toEqual({ from: '2026-04-01', to: '2027-02-15' })
    expect(fyStart(new Date(2027, 2, 31))).toBe('2026-04-01')
    expect(fyStart(new Date(2027, 3, 1))).toBe('2027-04-01')
  })
  it('lists This Financial Year after Last Month, before Custom Range', () => {
    expect(PERIOD_PRESETS.map((p) => p.value).slice(-3)).toEqual(['lastMonth', 'thisFY', 'custom'])
  })
  it('returns null for custom', () => {
    expect(periodRange('custom', TODAY)).toBeNull()
  })
})

describe('day helpers', () => {
  it('addDays crosses months', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('daysBetween is inclusive and empty when reversed', () => {
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(daysBetween('2026-10-02', '2026-10-01')).toEqual([])
  })
  it('previousRange is the equal-length window just before', () => {
    expect(previousRange({ from: '2026-10-06', to: '2026-10-12' })).toEqual({ from: '2026-09-29', to: '2026-10-05' })
    expect(previousRange({ from: '2026-10-12', to: '2026-10-12' })).toEqual({ from: '2026-10-11', to: '2026-10-11' })
  })
  it('formats dates', () => {
    expect(displayDate('2026-09-23')).toBe('23-09-2026')
    expect(shortDate('2026-09-23')).toBe('23-Sep')
    expect(displayDate(null)).toBe('')
  })
})
