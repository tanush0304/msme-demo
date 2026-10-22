// One colour family per module -- the single source for landing cards, page
// titles and the in-screen accents (section/table headers, primary Save,
// links) that use the brandblue/brandnavy/brandsky Tailwind colours.
//   accent  Tailwind-600: card top border, icon, arrow button
//   title   page title: the accent, or 700 where 600 is under 3:1 on the page
//           background (WCAG AA large text) -- only Quality's green
//   strong  700: primary buttons / links (white text passes WCAG AA on it)
//   dark    800: section/table header text, button hover
//   tint    accent at 15% on white: icon square, section/table header fill
//   wash    accent at 12% alpha: card bottom-right glow
// Semantic colours (Delete/Void red, amber warnings, status pills, charts,
// input colour coding) are deliberately NOT here.

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
const mixWithWhite = (hex, amount) => toHex(hexRgb(hex).map((v) => 255 + (v - 255) * amount))

function family(accent, strong, dark, title = accent) {
  return { accent, title, strong, dark, tint: mixWithWhite(accent, 0.15), wash: `rgba(${hexRgb(accent).join(', ')}, 0.12)` }
}

export const MODULE_THEME = {
  masters: family('#2563EB', '#1D4ED8', '#1E40AF'),
  'customer-order': family('#7C3AED', '#6D28D9', '#5B21B6'),
  production: family('#E11D48', '#BE123C', '#9F1239'),
  'job-order': family('#EA580C', '#C2410C', '#9A3412'),
  quality: family('#16A34A', '#15803D', '#166534', '#15803D'),
  maintenance: family('#DB2777', '#BE185D', '#9D174D'),
  stores: family('#0D9488', '#0F766E', '#115E59'),
  dashboard: family('#6D28D9', '#5B21B6', '#4C1D95'),
}

// The 8 accents in Home order -- Masters and Reports rotate through these
// card by card.
export const ACCENT_ROTATION = Object.values(MODULE_THEME)

export const rotatedTheme = (index) => ACCENT_ROTATION[index % ACCENT_ROTATION.length]

// Outside any module (Home, login): the original neutral blue.
export const DEFAULT_THEME = family('#1E4C8A', '#1E4C8A', '#0F2A52')

export function moduleTheme(key) {
  return MODULE_THEME[key] ?? DEFAULT_THEME
}

/** CSS variables behind the brandblue / brandnavy / brandsky Tailwind colours
 * ("R G B" triplets, so opacity modifiers like /30 keep working), plus
 * --brand-accent for the per-module page background (index.css). */
export function themeVars(theme) {
  return {
    '--brand-blue': hexRgb(theme.strong).join(' '),
    '--brand-navy': hexRgb(theme.dark).join(' '),
    '--brand-sky': hexRgb(theme.tint).join(' '),
    '--brand-accent': hexRgb(theme.accent).join(' '),
  }
}
