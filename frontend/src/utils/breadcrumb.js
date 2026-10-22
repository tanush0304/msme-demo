import { NAV_ITEMS } from './constants'

/** Page-header breadcrumb for a module screen: Module > Screen. On a screen
 * the module crumb links back to the module's landing (`onTop`); on the
 * landing itself the module crumb is the current page, not a link. */
export function headerBreadcrumb(topKey, subKey, onTop) {
  const top = NAV_ITEMS.find((n) => n.key === topKey)
  if (!top) return []
  const sub = top.subItems?.find((s) => s.key === subKey)
  return sub ? [{ label: top.label, onClick: onTop }, { label: sub.label }] : [{ label: top.label }]
}
