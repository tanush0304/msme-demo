import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

/**
 * Delete confirmation (same frame as VoidEntryDialog). Cancel has focus, so
 * Enter only deletes when Delete itself is focused; Esc / backdrop / Cancel
 * close. While onConfirm runs both buttons are disabled. The dialog closes
 * when it settles either way -- a DB error is shown by the screen's own
 * Banner (the screen's delete body catches it).
 * Extra options (ported 2026-11-13):
 *   tone            'danger' (red, default) | 'confirm' (green) | 'notice' (amber, OK-style)
 *   cancelLabel     default "Cancel"
 *   hideCancel      one button only; the confirm button gets focus
 *   children        extra input under the body (e.g. a reason)
 *   confirmDisabled e.g. until a required reason is typed
 */
export default function ConfirmDialog({ open, recordType, label, onConfirm, onClose, confirmText = 'Delete', title, body, tone = 'danger', cancelLabel = 'Cancel', hideCancel = false, children, confirmDisabled = false }) {
  const [pending, setPending] = useState(false)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const confirmTone = tone === 'confirm'
  const noticeTone = tone === 'notice'

  useEffect(() => {
    if (open) (hideCancel ? confirmRef : cancelRef).current?.focus()
  }, [open, hideCancel])

  useEffect(() => {
    if (!open || pending) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, pending, onClose])

  if (!open) return null

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
    } catch {
      // The screen's Banner reports it.
    } finally {
      setPending(false)
      onClose()
    }
  }

  const heading = title ?? `Delete ${recordType}?`
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      data-testid="confirm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className={`mb-3 flex items-center gap-2 ${noticeTone ? 'text-amber-700' : confirmTone ? 'text-green-700' : 'text-red-700'}`}>
          {noticeTone ? <AlertTriangle size={18} /> : <Trash2 size={18} />}
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        <p className={`mb-3 rounded border px-3 py-2 text-sm ${confirmTone ? 'border-green-200 bg-green-50 text-green-800' : noticeTone ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {body ?? (
            <>
              <strong>{label}</strong> will be permanently deleted. This can't be undone.
            </>
          )}
        </p>
        {children}
        <div className="mt-4 flex justify-end gap-2">
          {!hideCancel && (
            <button ref={cancelRef} type="button" onClick={onClose} disabled={pending} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40">
              {cancelLabel}
            </button>
          )}
          <button ref={confirmRef} type="button" onClick={handleConfirm} disabled={pending || confirmDisabled} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 ${confirmTone ? 'bg-green-600' : noticeTone ? 'bg-amber-600' : 'bg-red-600'}`}>
            {pending && <Loader2 size={13} className="animate-spin" aria-label="Working" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * const del = useDeleteConfirm()
 * del.ask('customer', 'CUST-001 – Acme', async () => { ...existing delete body... })
 * ...render {del.dialog}
 * options: { title, body, confirmText } (e.g. "Remove" for unscheduling).
 */
export function useDeleteConfirm() {
  const [req, setReq] = useState(null)
  const close = useCallback(() => setReq(null), [])
  const ask = (recordType, label, run, options = {}) => setReq({ recordType, label, run, ...options })
  const dialog = (
    <ConfirmDialog
      open={Boolean(req)}
      recordType={req?.recordType}
      label={req?.label}
      title={req?.title}
      body={req?.body}
      confirmText={req?.confirmText}
      onConfirm={() => req.run()}
      onClose={close}
    />
  )
  return { ask, dialog }
}

/** "A – B – C" from the non-empty parts (dialog labels). */
export const labelOf = (...parts) => parts.filter((p) => p != null && String(p).trim() !== '').join(' – ')
