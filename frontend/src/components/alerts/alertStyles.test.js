import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// Bell + "Needs attention" panel use the demo's tokens only (brand*, Banner /
// ConfirmDialog patterns): no hard-coded hex colours, every button keyboard-visible.
const FILES = ['AlertBell.jsx', 'NeedsAttentionDialog.jsx']
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')

describe('alert panel styling', () => {
  it.each(FILES)('%s has no hex colours', (f) => {
    expect(src(f).match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g)).toBeNull()
  })

  it.each(FILES)('%s: every button has a focus-visible ring', (f) => {
    // each <button ...> opening (props may contain "=>", so cut at the first child / "</button>")
    const buttons = src(f).split('<button').slice(1).map((b) => b.split(/<\/button>|\n\s*<[A-Za-z]/)[0])
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) expect(b).toMatch(/focus-visible:ring-2/)
  })
})
