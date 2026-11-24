import { useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { useAlerts } from './AlertsContext'

// "Needs attention" modal (ConfirmDialog look). Opened on the Main Menu
// (unless "Got it" this session) or from the bell. Esc / backdrop = Remind
// me later.
export default function NeedsAttentionDialog({ onOpenItem }) {
  const alerts = useAlerts()
  const gotItRef = useRef(null)
  const show = Boolean(alerts?.allowed && alerts.open)
  const later = alerts?.later

  useEffect(() => {
    if (!show) return undefined
    gotItRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && later()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, later])

  if (!show) return null
  const { groups, count, gotIt } = alerts

  return (
    <div
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && later()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="needs-attention-title" className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-brandsky bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brandblue text-white">
            <AlertTriangle size={16} aria-hidden="true" />
          </span>
          <h2 id="needs-attention-title" className="text-base font-semibold text-brandnavy">Needs attention</h2>
          <span className="ml-auto rounded-full bg-red-600 px-2 text-xs font-semibold leading-5 text-white">{count}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {count === 0 && (
            <p className="flex items-center gap-2.5 rounded-md border border-l-4 border-slate-200/70 border-l-green-600 bg-green-50 px-3.5 py-2.5 text-sm text-green-800 shadow-sm">
              <CheckCircle2 size={16} className="shrink-0 text-green-600" aria-hidden="true" />
              Nothing needs attention right now.
            </p>
          )}
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{g.title}</h3>
              <ul className="divide-y divide-slate-200 rounded-md border border-l-4 border-slate-200/70 border-l-amber-500 bg-white shadow-sm">
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-800 transition hover:bg-brandsky/40">
                    <span className="min-w-0 flex-1">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => {
                        later()
                        onOpenItem?.(item.open)
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brandblue px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brandnavy focus:outline-none focus-visible:ring-2 focus-visible:ring-brandblue/40 focus-visible:ring-offset-1"
                    >
                      Open <ExternalLink size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={later} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brandblue/40">
            Remind me later
          </button>
          <button ref={gotItRef} type="button" onClick={gotIt} className="rounded bg-brandnavy px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brandblue focus:outline-none focus-visible:ring-2 focus-visible:ring-brandblue/40 focus-visible:ring-offset-1">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
