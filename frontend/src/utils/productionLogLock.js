/**
 * End Log: the log keeps only what it actually used from its reservation --
 * every piece processed across its hours, never more than it originally
 * reserved. qty_produced is already that total: accepted + rejected + rework
 * (accepted itself is derived as produced - rejected - rework, see
 * acceptedQty in productionReport.js), so rejected/rework are NOT added again.
 */
export function releasedPlannedQty(plannedQty, hours) {
  const produced = hours.reduce((sum, h) => sum + Number(h.qty_produced ?? 0), 0)
  const planned = Number(plannedQty ?? 0)
  return Math.min(planned, produced)
}

/**
 * The first of this user's open logs (newest first) whose stage is one this
 * screen handles (`stages` = that screen's own pending stages), with its
 * stage -- or null.
 */
export function pickOpenLogForScreen(openLogs, stages) {
  for (const log of openLogs) {
    const stage = stages.find((s) => String(s.id) === String(log.stage_id))
    if (stage) return { log, stage }
  }
  return null
}

/** Shown (and nothing saved) when the screen no longer matches its open log. */
export const OUT_OF_SYNC_MESSAGE = 'Screen out of sync, reload the log'

/**
 * Save Hours guard: true only when the screen's PRD / stage (/ machine) are
 * the open log's own, so hours can never be written to another PRD's log
 * because two async loads raced. `machineId` is compared only when passed
 * (Manual Operations has no machine).
 */
export function logMatchesScreen(log, { prdNo, stageId, machineId } = {}) {
  if (!log) return false
  if (log.prd_no !== prdNo) return false
  if (stageId == null || String(log.stage_id) !== String(stageId)) return false
  if (machineId !== undefined && (log.machine_id ?? '') !== (machineId ?? '')) return false
  return true
}

/**
 * "Latest request wins": start() hands out a token, isCurrent(token) turns
 * false as soon as a newer request starts -- an older async load then drops
 * its results instead of overwriting the newer selection's state.
 */
export function createRequestGate() {
  let latest = 0
  return {
    start: () => ++latest,
    isCurrent: (token) => token === latest,
  }
}
