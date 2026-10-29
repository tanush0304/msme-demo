// Maintenance checklist rules shared by Checklist Entry and the Daily
// checklist gate on Production Data Entry.

/** Built-in frequencies for a Maintenance Master checklist item. */
export const CHECKLIST_FREQUENCIES = ['Daily', 'Weekly', 'Monthly']

export const DAILY = 'Daily'

const norm = (v) => String(v ?? '').trim().toLowerCase()

/** Same frequency / type, ignoring case and surrounding spaces. */
export function sameFrequency(a, b) {
  return norm(a) !== '' && norm(a) === norm(b)
}

/** The machine's Maintenance Master items whose frequency matches `type`. */
export function itemsForType(items, type) {
  return (items ?? []).filter((item) => sameFrequency(item.frequency, type))
}

export function noItemsMessage(type, machineLabel) {
  return `No ${type} checklist items for ${machineLabel} -- add them in Maintenance Master.`
}

/** Tick box -> the condition value saved on the log item. */
export function conditionFromTick(ticked) {
  return ticked ? 'OK' : 'Not OK'
}

export function isTicked(condition) {
  return condition === 'OK'
}

/** The log of `type` for machine + date + shift among `logs`, or null. */
export function findLogFor(logs, { machineId, date, shiftCode, type }) {
  return (
    (logs ?? []).find(
      (l) => l.machine_id === machineId && l.log_date === date && l.shift_code === shiftCode && sameFrequency(l.maintenance_type, type)
    ) ?? null
  )
}

/** Data Entry only gates a NEW log on an Internal stage; Manual stages and a
 * resumed open log are never blocked. */
export function gateApplies({ stage, activeLog, machineId, shiftCode }) {
  return Boolean(stage && stage.type === 'Internal' && !activeLog && machineId && shiftCode)
}

/**
 * State of the Daily checklist gate.
 *  'no-items' -- the machine has no Daily items in the master (Start allowed)
 *  'pending'  -- no checklist saved yet for this machine/shift (Start blocked)
 *  'not-ok'   -- saved, but an item is Not OK or missing (Start blocked)
 *  'done'     -- saved and every item OK (Start allowed)
 */
export function gateStatus({ dailyItems, log, logItems }) {
  if (!dailyItems?.length) return 'no-items'
  if (!log) return 'pending'
  const okIds = new Set((logItems ?? []).filter((it) => isTicked(it.condition)).map((it) => it.checklist_item_id))
  return dailyItems.every((item) => okIds.has(item.id)) ? 'done' : 'not-ok'
}

export function gateAllowsStart(status) {
  return status === 'no-items' || status === 'done'
}

export function gateMessage(status, machineLabel) {
  if (status === 'no-items') return `No Daily checklist items set for ${machineLabel} -- ask maintenance to add them`
  if (status === 'pending') return 'All checklist items must be ticked before production can start.'
  if (status === 'not-ok') return `Daily checklist for ${machineLabel} has Not OK items -- a supervisor must clear them before production can start.`
  return null
}
