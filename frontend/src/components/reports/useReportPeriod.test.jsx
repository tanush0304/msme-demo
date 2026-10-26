// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useReportPeriod from './useReportPeriod'
import { periodRange } from '../../utils/reportPeriods'

describe('useReportPeriod', () => {
  it('defaults to Last 30 Days', () => {
    const { result } = renderHook(() => useReportPeriod({ x: '' }))
    expect(result.current.barProps.period).toBe('last30')
    expect(result.current.applied).toEqual({ ...periodRange('last30'), x: '' })
  })

  it('uses defaultPeriod for the initial state and Reset', () => {
    const { result } = renderHook(() => useReportPeriod({ x: '' }, { defaultPeriod: 'thisFY' }))
    expect(result.current.barProps.period).toBe('thisFY')
    expect(result.current.applied).toEqual({ ...periodRange('thisFY'), x: '' })
    act(() => result.current.barProps.onPeriodChange('today'))
    act(() => result.current.setFilter('x')('A'))
    act(() => result.current.barProps.onReset())
    expect(result.current.barProps.period).toBe('thisFY')
    expect(result.current.filters).toEqual({ x: '' })
    expect(result.current.applied).toEqual({ ...periodRange('thisFY'), x: '' })
  })

  it('setRangeAndSearch sets a custom range and applies it with the filters', () => {
    const { result } = renderHook(() => useReportPeriod({ x: '' }))
    act(() => result.current.setFilter('x')('A'))
    act(() => result.current.setRangeAndSearch('2025-01-02', '2026-10-26'))
    expect(result.current.barProps).toMatchObject({ period: 'custom', from: '2025-01-02', to: '2026-10-26' })
    expect(result.current.applied).toEqual({ from: '2025-01-02', to: '2026-10-26', x: 'A' })
  })
})
