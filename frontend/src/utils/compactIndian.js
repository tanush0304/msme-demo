// Compact Indian number format for KPI cards only (exports/tables keep full values).
// < 10,000 unchanged; then K / L (lakh) / Cr (crore), max 2 decimals, truncated
// (never rounds up across a threshold, e.g. 99,999 -> 99.99K not 100K).

const STEPS = [
  { min: 1e7, div: 1e7, suffix: ' Cr' },
  { min: 1e5, div: 1e5, suffix: ' L' },
  { min: 1e4, div: 1e3, suffix: 'K' },
]

export function compactIndian(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const num = Number(n)
  const abs = Math.abs(num)
  const step = STEPS.find(s => abs >= s.min)
  if (!step) return num.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const scaled = Math.floor(Math.round((abs / step.div) * 1e6) / 1e4) / 100
  return `${num < 0 ? '-' : ''}${String(scaled)}${step.suffix}`
}

const PLAIN_NUMBER = /^-?[\d,]+(\.\d+)?$/

/** Card value -> { display, full }. Only plain numeric strings/numbers are
 * compacted, and never when the unit is a percentage. full is null when unchanged;
 * plain = a single number (safe to keep on one line; composite strings may wrap). */
export function compactKpiValue(value, unit) {
  if (value == null) return { display: value, full: null, plain: false }
  const str = String(value).trim()
  const plain = PLAIN_NUMBER.test(str)
  if (unit === '%' || !plain) return { display: value, full: null, plain }
  const num = Number(str.replace(/,/g, ''))
  if (!Number.isFinite(num) || Math.abs(num) < 1e4) return { display: value, full: null, plain }
  return { display: compactIndian(num), full: str, plain }
}
