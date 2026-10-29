import { describe, it, expect } from 'vitest'
import { sameFrequency, itemsForType, noItemsMessage, conditionFromTick, isTicked, findLogFor, gateApplies, gateStatus, gateAllowsStart, gateMessage } from './dailyChecklist'

const ITEMS = [
  { id: 1, checklist_item: 'Oil level', frequency: 'Daily' },
  { id: 2, checklist_item: 'Coolant', frequency: '  daily ' },
  { id: 3, checklist_item: 'Belt', frequency: 'Weekly' },
  { id: 4, checklist_item: 'Untagged', frequency: null },
]

describe('frequency matching', () => {
  it('matches trimmed and case-insensitive; blank never matches', () => {
    expect(sameFrequency(' DAILY', 'daily ')).toBe(true)
    expect(sameFrequency('Weekly', 'Daily')).toBe(false)
    expect(sameFrequency('', '')).toBe(false)
    expect(sameFrequency(null, 'Daily')).toBe(false)
  })

  it('shows only the items of the picked type', () => {
    expect(itemsForType(ITEMS, 'Daily').map((i) => i.id)).toEqual([1, 2])
    expect(itemsForType(ITEMS, ' weekly').map((i) => i.id)).toEqual([3])
    expect(itemsForType(ITEMS, 'Monthly')).toEqual([])
    expect(noItemsMessage('Monthly', 'CNC-01')).toBe('No Monthly checklist items for CNC-01 -- add them in Maintenance Master.')
  })
})

describe('tick box -> condition', () => {
  it('ticked = OK, unticked = Not OK, and back', () => {
    expect(conditionFromTick(true)).toBe('OK')
    expect(conditionFromTick(false)).toBe('Not OK')
    expect(isTicked('OK')).toBe(true)
    expect(isTicked('Not OK')).toBe(false)
  })
})

describe('per-shift lookup', () => {
  const LOGS = [
    { id: 10, machine_id: 'MC-1', log_date: '2026-10-28', shift_code: 'A', maintenance_type: 'Weekly' },
    { id: 11, machine_id: 'MC-1', log_date: '2026-10-28', shift_code: 'A', maintenance_type: 'daily' },
    { id: 12, machine_id: 'MC-1', log_date: '2026-10-28', shift_code: 'B', maintenance_type: 'Daily' },
  ]
  it('finds the Daily log for that machine + date + shift only', () => {
    expect(findLogFor(LOGS, { machineId: 'MC-1', date: '2026-10-28', shiftCode: 'A', type: 'Daily' }).id).toBe(11)
    expect(findLogFor(LOGS, { machineId: 'MC-1', date: '2026-10-28', shiftCode: 'B', type: 'Daily' }).id).toBe(12)
    expect(findLogFor(LOGS, { machineId: 'MC-1', date: '2026-10-28', shiftCode: 'C', type: 'Daily' })).toBeNull()
    expect(findLogFor(LOGS, { machineId: 'MC-2', date: '2026-10-28', shiftCode: 'A', type: 'Daily' })).toBeNull()
  })
})

describe('Data Entry gate', () => {
  const internal = { type: 'Internal' }
  it('applies to a new log on an Internal stage only (manual stages and resumed logs exempt)', () => {
    expect(gateApplies({ stage: internal, activeLog: null, machineId: 'MC-1', shiftCode: 'A' })).toBe(true)
    expect(gateApplies({ stage: { type: 'Manual' }, activeLog: null, machineId: 'MC-1', shiftCode: 'A' })).toBe(false)
    expect(gateApplies({ stage: internal, activeLog: { id: 5 }, machineId: 'MC-1', shiftCode: 'A' })).toBe(false)
    expect(gateApplies({ stage: internal, activeLog: null, machineId: '', shiftCode: 'A' })).toBe(false)
    expect(gateApplies({ stage: internal, activeLog: null, machineId: 'MC-1', shiftCode: '' })).toBe(false)
  })

  const daily = [{ id: 1 }, { id: 2 }]
  it('no master items -> allowed; none saved -> blocked; Not OK or missing -> blocked; all OK -> allowed', () => {
    expect(gateStatus({ dailyItems: [], log: null, logItems: [] })).toBe('no-items')
    expect(gateStatus({ dailyItems: daily, log: null, logItems: [] })).toBe('pending')
    expect(gateStatus({ dailyItems: daily, log: { id: 9 }, logItems: [{ checklist_item_id: 1, condition: 'OK' }, { checklist_item_id: 2, condition: 'Not OK' }] })).toBe('not-ok')
    expect(gateStatus({ dailyItems: daily, log: { id: 9 }, logItems: [{ checklist_item_id: 1, condition: 'OK' }] })).toBe('not-ok')
    expect(gateStatus({ dailyItems: daily, log: { id: 9 }, logItems: [{ checklist_item_id: 1, condition: 'OK' }, { checklist_item_id: 2, condition: 'OK' }] })).toBe('done')
    expect(['no-items', 'pending', 'not-ok', 'done', null].map(gateAllowsStart)).toEqual([true, false, false, true, false])
  })

  it('messages', () => {
    expect(gateMessage('no-items', 'CNC-01')).toBe('No Daily checklist items set for CNC-01 -- ask maintenance to add them')
    expect(gateMessage('pending', 'CNC-01')).toBe('All checklist items must be ticked before production can start.')
    expect(gateMessage('not-ok', 'CNC-01')).toBe('Daily checklist for CNC-01 has Not OK items -- a supervisor must clear them before production can start.')
    expect(gateMessage('done', 'CNC-01')).toBeNull()
  })
})
