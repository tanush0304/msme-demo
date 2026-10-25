// Readable text for an error from a save. The database guards (031-036)
// raise clear messages -- a 23514 quantity refusal includes the max, e.g.
// "Quantity issued (60) is more than the current stock of TEST-RM01 (50)" --
// so those are shown exactly as the DB wrote them. A bare PostgreSQL
// "permission denied for ..." (a missing grant / RLS) and the few raw
// messages in FRIENDLY below are translated.
export function dbErrorMessage(error, fallback = 'Could not save.') {
  const message = typeof error === 'string' ? error : error?.message ?? ''
  if (error?.code === '42501' && /^permission denied/i.test(message)) {
    return PERMISSION_TEXT
  }
  return message ? friendlyDbMessage(message) : fallback
}

const PERMISSION_TEXT = 'You do not have permission to make this change.'

// Raw database / network messages users should not see verbatim -> plain
// wording. Explicit list only; anything else passes through unchanged (the
// 031-036 guard messages are already readable). The Banner keeps the raw
// text as a "Details" tooltip.
const FRIENDLY = [
  [/^(?:PRD\s+)?(PRD-\d+)\s+has started \(\d+ row\(s\) in "production logs"\) and cannot be cancelled/i,
    (m) => `${m[1]} can't be cancelled: production has already started on it. Only PRDs with no production entries can be cancelled.`],
  [/^permission denied for (table|relation|sequence|view|function)\b/i, () => PERMISSION_TEXT],
  [/^duplicate key value violates unique constraint/i, () => 'This record already exists (a value that must be unique is already used).'],
  [/^(Failed to fetch|NetworkError|Load failed|TypeError: Failed to fetch)/i, () => "Can't reach the server -- check your connection and try again."],
  [/^Invalid login credentials$/i, () => 'Invalid username or password'],
]

/** Friendly text for a known raw message; unknown messages are returned as is. */
export function friendlyDbMessage(text) {
  const raw = String(text ?? '')
  for (const [re, make] of FRIENDLY) {
    const m = raw.match(re)
    if (m) return make(m)
  }
  return raw
}

/** True when the database refused a quantity over its limit (036 guards, 031/033 jobwork). */
export const isQtyLimitError = (error) => error?.code === '23514'
