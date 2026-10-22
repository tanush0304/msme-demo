import { describe, it, expect } from 'vitest'
import { employeeLabel, sortedEmployeeOptions, employeeLabelForId } from './employeeLabel'

describe('employeeLabel', () => {
  it('shows "Name (ID)" for a normal employee', () => {
    expect(employeeLabel({ employee_id: 'EMP-001', employee_name: 'Arjun Rao' })).toBe('Arjun Rao (EMP-001)')
  })

  it('falls back to the bare ID when the name is missing', () => {
    expect(employeeLabel({ employee_id: 'EMP-002', employee_name: '' })).toBe('EMP-002')
    expect(employeeLabel({ employee_id: 'EMP-002', employee_name: null })).toBe('EMP-002')
  })

  it('never renders "undefined" for a missing/null employee', () => {
    expect(employeeLabel(null)).toBe('')
    expect(employeeLabel(undefined)).toBe('')
    expect(employeeLabel({})).toBe('')
  })
})

describe('employeeLabelForId', () => {
  const EMPLOYEES = [
    { employee_id: 'EMP-001', employee_name: 'Arjun Rao' },
    { employee_id: 'EMP-002', employee_name: '' },
  ]

  it('resolves a known id to "Name (ID)"', () => {
    expect(employeeLabelForId('EMP-001', EMPLOYEES)).toBe('Arjun Rao (EMP-001)')
  })

  it('falls back to the bare ID when that employee has no name', () => {
    expect(employeeLabelForId('EMP-002', EMPLOYEES)).toBe('EMP-002')
  })

  it('falls back to the bare ID, never "undefined", when the id is not in the list at all', () => {
    expect(employeeLabelForId('EMP-999', EMPLOYEES)).toBe('EMP-999')
  })

  it('blank/missing id returns an empty string, not "undefined"', () => {
    expect(employeeLabelForId('', EMPLOYEES)).toBe('')
    expect(employeeLabelForId(null, EMPLOYEES)).toBe('')
  })
})

describe('sortedEmployeeOptions', () => {
  it('sorts by display name, falling back to ID when a name is missing', () => {
    const employees = [
      { employee_id: 'EMP-003', employee_name: 'Zara' },
      { employee_id: 'EMP-001', employee_name: 'Aditi' },
      { employee_id: 'EMP-002', employee_name: '' },
    ]
    const opts = sortedEmployeeOptions(employees)
    expect(opts.map((o) => o.value)).toEqual(['EMP-001', 'EMP-002', 'EMP-003'])
    expect(opts[0].label).toBe('Aditi (EMP-001)')
    expect(opts[1].label).toBe('EMP-002')
  })
})
