import { useEffect, useId, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { friendlyDbMessage } from '../utils/dbErrors'

// One message toast for every screen: error (red), warning (amber), success
// (green). Rendered through a portal, fixed top-centre just below the 78px
// header, above everything (dialogs are z-50, the toast z-[60]) so it shows
// wherever the page is scrolled. Only the newest message shows; when it clears, the previous one
// (if still set) comes back. Errors and warnings stay until dismissed or the
// screen clears them; success hides itself after 4s unless it names a
// generated document number (isStickySuccess). Errors and warnings are
// role="alert", success role="status". Known raw database messages are
// reworded (utils/dbErrors.js) with the raw text as a "Details" tooltip.
// `inline` keeps a standing status note in the page flow instead.
const TONES = {
  error: { box: 'bg-red-600 text-white', icon: AlertCircle, role: 'alert' },
  warning: { box: 'bg-amber-500 text-slate-900', icon: AlertTriangle, role: 'alert' },
  success: { box: 'bg-green-600 text-white', icon: CheckCircle2, role: 'status' },
}
const INLINE_TONES = {
  error: { box: 'border-l-red-600 bg-red-50 text-red-800', iconClass: 'text-red-600' },
  warning: { box: 'border-l-amber-500 bg-amber-50 text-amber-900', iconClass: 'text-amber-600' },
  success: { box: 'border-l-green-600 bg-green-50 text-green-800', iconClass: 'text-green-600' },
}

export const SUCCESS_HIDE_MS = 4000

// Generated document numbers (same rule as the client app).
const DOC_NUMBER = /\b(?:(?:GRN|RMI|WIR|WII|FGR|FGD|DC|JR|PRD|JC)-\d+|CMP-\d{4}-\d+)\b/

/** A success message naming a generated document number stays until dismissed. */
export function isStickySuccess(text) {
  return DOC_NUMBER.test(String(text ?? ''))
}

// Newest-wins registry of the toasts that currently have a message.
let seq = 0
const active = new Map() // id -> order
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function newestId() {
  let best = null
  let bestOrder = -1
  for (const [id, order] of active) {
    if (order > bestOrder) {
      best = id
      bestOrder = order
    }
  }
  return best
}

export default function Banner({ tone = 'error', message, onClose, className = '', inline = false }) {
  const id = useId()
  const raw = typeof message === 'string' ? message : message?.message ?? ''
  const text = tone === 'success' ? raw : friendlyDbMessage(raw)
  const reworded = text !== raw
  const autoHide = tone === 'success' && !isStickySuccess(raw)

  useEffect(() => {
    if (inline || !raw) return undefined
    active.set(id, ++seq)
    emit()
    return () => {
      active.delete(id)
      emit()
    }
  }, [id, raw, inline])
  const shownId = useSyncExternalStore(subscribe, newestId, () => null)

  useEffect(() => {
    if (!autoHide || !raw || !onClose) return undefined
    const t = setTimeout(onClose, SUCCESS_HIDE_MS)
    return () => clearTimeout(t)
  }, [autoHide, raw, onClose])

  if (!raw) return null
  const t = TONES[tone] ?? TONES.error
  const Icon = t.icon
  const body = (
    <>
      {text}
      {reworded && (
        <span title={raw} className="ml-2 cursor-help whitespace-nowrap text-[12px] font-normal underline decoration-dotted opacity-80">
          Details
        </span>
      )}
    </>
  )
  const closeButton = onClose && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Dismiss"
      className="-mr-1 shrink-0 rounded p-0.5 opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <X size={16} aria-hidden="true" />
    </button>
  )

  if (inline) {
    const it = INLINE_TONES[tone] ?? INLINE_TONES.error
    return (
      <div role={t.role} className={`banner-in flex items-start gap-2.5 rounded-md border border-l-4 border-slate-200/70 px-3.5 py-2.5 text-sm shadow-sm ${it.box} ${className}`}>
        <Icon size={20} className={`mt-px shrink-0 ${it.iconClass}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 font-medium">{body}</div>
        {closeButton}
      </div>
    )
  }

  if (shownId !== id || typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[86px] z-[60] flex justify-center px-4" data-testid="toast">
      <div
        role={t.role}
        data-tone={tone}
        className={`toast-in pointer-events-auto flex w-full max-w-[640px] items-start gap-2.5 rounded-lg px-4 py-3 text-sm shadow-2xl ring-1 ring-black/10 ${t.box}`}
      >
        <Icon size={20} className="mt-px shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 font-medium">{body}</div>
        {closeButton}
      </div>
    </div>,
    document.body
  )
}
