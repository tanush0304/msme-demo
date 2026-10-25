import { useEffect, useRef } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { friendlyDbMessage } from '../utils/dbErrors'

// One message banner for every screen: error (red), warning (amber), success
// (green, hides itself after 4s). Errors and warnings are role="alert" so
// screen readers announce them; success is role="status". Known raw database
// messages are reworded (utils/dbErrors.js) and the raw text stays available
// as a "Details" tooltip. Scrolls itself into view when it appears off-screen.
const TONES = {
  error: { box: 'border-l-red-600 bg-red-50', text: 'text-red-800', icon: AlertCircle, iconClass: 'text-red-600', role: 'alert' },
  warning: { box: 'border-l-amber-500 bg-amber-50', text: 'text-amber-900', icon: AlertTriangle, iconClass: 'text-amber-600', role: 'alert' },
  success: { box: 'border-l-green-600 bg-green-50', text: 'text-green-800', icon: CheckCircle2, iconClass: 'text-green-600', role: 'status' },
}

export const SUCCESS_HIDE_MS = 4000

export default function Banner({ tone = 'error', message, onClose, className = '' }) {
  const ref = useRef(null)
  const raw = typeof message === 'string' ? message : message?.message ?? ''
  const t = TONES[tone] ?? TONES.error
  const text = tone === 'success' ? raw : friendlyDbMessage(raw)
  const reworded = text !== raw

  useEffect(() => {
    if (raw) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [raw])

  useEffect(() => {
    if (tone !== 'success' || !raw || !onClose) return undefined
    const id = setTimeout(onClose, SUCCESS_HIDE_MS)
    return () => clearTimeout(id)
  }, [tone, raw, onClose])

  if (!raw) return null
  const Icon = t.icon
  return (
    <div
      ref={ref}
      role={t.role}
      className={`banner-in flex items-start gap-2.5 rounded-md border border-l-4 border-slate-200/70 px-3.5 py-2.5 text-sm shadow-sm ${t.box} ${className}`}
    >
      <Icon size={20} className={`mt-px shrink-0 ${t.iconClass}`} aria-hidden="true" />
      <div className={`min-w-0 flex-1 font-medium ${t.text}`}>
        {text}
        {reworded && (
          <span title={raw} className="ml-2 cursor-help whitespace-nowrap text-[12px] font-normal underline decoration-dotted opacity-80">
            Details
          </span>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className={`-mr-1 shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${t.text}`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
