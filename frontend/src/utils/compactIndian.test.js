import { describe, it, expect } from 'vitest'
import { compactIndian, compactKpiValue } from './compactIndian'

describe('compactIndian', () => {
  it('leaves values under 10,000 unchanged', () => {
    expect(compactIndian(0)).toBe('0')
    expect(compactIndian(1250)).toBe('1,250')
    expect(compactIndian(9999)).toBe('9,999')
    expect(compactIndian(12.5)).toBe('12.5')
    expect(compactIndian(-1250)).toBe('-1,250')
  })
  it('thresholds', () => {
    expect(compactIndian(10000)).toBe('10K')
    expect(compactIndian(12500)).toBe('12.5K')
    expect(compactIndian(99999)).toBe('99.99K')
    expect(compactIndian(100000)).toBe('1 L')
    expect(compactIndian(125000)).toBe('1.25 L')
    expect(compactIndian(9999999)).toBe('99.99 L')
    expect(compactIndian(10000000)).toBe('1 Cr')
    expect(compactIndian(12500000)).toBe('1.25 Cr')
    expect(compactIndian(1234567890)).toBe('123.45 Cr')
  })
  it('negatives and large decimals', () => {
    expect(compactIndian(-12500)).toBe('-12.5K')
    expect(compactIndian(-125000)).toBe('-1.25 L')
    expect(compactIndian(12500.5)).toBe('12.5K')
    expect(compactIndian(120000)).toBe('1.2 L')
  })
  it('invalid -> dash', () => {
    expect(compactIndian(null)).toBe('—')
    expect(compactIndian(NaN)).toBe('—')
  })
})

describe('compactKpiValue', () => {
  it('compacts formatted strings and keeps the full value', () => {
    expect(compactKpiValue('1,25,000', 'Nos')).toMatchObject({ display: '1.25 L', full: '1,25,000' })
    expect(compactKpiValue('12,500.5')).toMatchObject({ display: '12.5K', full: '12,500.5' })
    expect(compactKpiValue(12500)).toMatchObject({ display: '12.5K', full: '12500' })
  })
  it('flags plain numbers vs composite strings', () => {
    expect(compactKpiValue('1,250').plain).toBe(true)
    expect(compactKpiValue('620 Kg · 80 Nos').plain).toBe(false)
    expect(compactKpiValue('—').plain).toBe(false)
  })
  it('passes through small, percent and non-numeric values', () => {
    expect(compactKpiValue('1,250', 'Nos')).toMatchObject({ display: '1,250', full: null })
    expect(compactKpiValue('12345.6', '%')).toMatchObject({ display: '12345.6', full: null })
    expect(compactKpiValue('—')).toMatchObject({ display: '—', full: null })
    expect(compactKpiValue('85.2%')).toMatchObject({ display: '85.2%', full: null })
    expect(compactKpiValue(null)).toMatchObject({ display: null, full: null })
  })
})
