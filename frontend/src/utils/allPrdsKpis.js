// Demo only: Production Status KPI cards when no PRD is applied ("All PRDs").
// Kept out of reportAggregates.js (shared with the client app, taken whole).

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Distinct PRD numbers in the period's "report production hours" rows, sorted. */
export function prdsInRows(rows = []) {
  return [...new Set(rows.map((r) => r?.prd_no).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/**
 * Totals over `prdNos`:
 *   prd_qty  = sum of the PRDs' planned qty (order rows from listOrdersByPrd)
 *   produced = sum of each PRD's last-stage good qty (prdProducedKpis(...).produced, to date)
 * `perPrd` = { [prd_no]: { produced } }. A PRD with no order / no stages counts as 0.
 */
export function allPrdsKpis({ prdNos = [], orders = [], perPrd = {} }) {
  let prdQty = 0
  let produced = 0
  for (const prd of prdNos) {
    prdQty += num(orders.find((o) => o.prd_no === prd)?.prd_qty)
    produced += num(perPrd[prd]?.produced)
  }
  return { prd_count: prdNos.length, prd_qty: prdQty, produced }
}
