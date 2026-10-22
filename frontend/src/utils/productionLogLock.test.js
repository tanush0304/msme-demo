import { describe, it, expect } from 'vitest'
import { releasedPlannedQty, pickOpenLogForScreen, logMatchesScreen, createRequestGate, OUT_OF_SYNC_MESSAGE } from './productionLogLock'
import { acceptedQty } from './productionReport'

describe('releasedPlannedQty', () => {
  it('keeps only what was produced, capped at the reservation', () => {
    expect(releasedPlannedQty(100, [{ qty_produced: 30 }, { qty_produced: 12 }])).toBe(42)
    expect(releasedPlannedQty(40, [{ qty_produced: 30 }, { qty_produced: 12 }])).toBe(40)
    expect(releasedPlannedQty(100, [])).toBe(0)
  })
})

describe('releasedPlannedQty counts every piece processed', () => {
  it('uses qty_produced (= accepted + rejected + rework), not accepted only', () => {
    // 50 processed: 40 accepted + 6 rejected + 4 rework
    const hours = [{ qty_produced: 50, qty_rejected: 6, qty_rework: 4 }]
    expect(acceptedQty(hours[0])).toBe(40)
    expect(releasedPlannedQty(100, hours)).toBe(50)
  })
})

describe('pickOpenLogForScreen', () => {
  const stages = [{ id: 7, seq: 2, operation: 'Turning' }]
  it("returns the newest open log whose stage belongs to this screen", () => {
    const logs = [{ id: 2, stage_id: 99 }, { id: 1, stage_id: 7 }]
    expect(pickOpenLogForScreen(logs, stages)).toEqual({ log: logs[1], stage: stages[0] })
  })
  it('is null when none match', () => {
    expect(pickOpenLogForScreen([{ id: 2, stage_id: 99 }], stages)).toBeNull()
  })
})

describe('logMatchesScreen (Save Hours guard)', () => {
  const log = { id: 9, prd_no: 'PRD-006', stage_id: 41, machine_id: 'MC-04' }
  it('matches when PRD, stage and machine are the open log\'s', () => {
    expect(logMatchesScreen(log, { prdNo: 'PRD-006', stageId: '41', machineId: 'MC-04' })).toBe(true)
  })
  it('refuses another PRD / stage / machine (the raced resume case)', () => {
    expect(logMatchesScreen(log, { prdNo: 'PRD-007', stageId: 41, machineId: 'MC-04' })).toBe(false)
    expect(logMatchesScreen(log, { prdNo: 'PRD-006', stageId: 40, machineId: 'MC-04' })).toBe(false)
    expect(logMatchesScreen(log, { prdNo: 'PRD-006', stageId: 41, machineId: 'MC-02' })).toBe(false)
    expect(logMatchesScreen(log, { prdNo: 'PRD-006', stageId: null, machineId: 'MC-04' })).toBe(false)
    expect(logMatchesScreen(null, { prdNo: 'PRD-006', stageId: 41 })).toBe(false)
  })
  it('ignores the machine when the screen has none (Manual Operations)', () => {
    expect(logMatchesScreen({ ...log, machine_id: null }, { prdNo: 'PRD-006', stageId: 41 })).toBe(true)
  })
  it('the message the screens show', () => {
    expect(OUT_OF_SYNC_MESSAGE).toBe('Screen out of sync, reload the log')
  })
})

describe('createRequestGate', () => {
  it('only the latest request is current', () => {
    const gate = createRequestGate()
    const a = gate.start()
    expect(gate.isCurrent(a)).toBe(true)
    const b = gate.start()
    expect(gate.isCurrent(a)).toBe(false)
    expect(gate.isCurrent(b)).toBe(true)
  })
})
