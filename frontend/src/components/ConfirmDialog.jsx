import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

/**
 * Delete confirmation (same frame as VoidEntryDialog). Cancel has focus, so
 * Enter only deletes when Delete itself is focused; Esc / backdrop / Cancel
 * close. While onConfirm runs both buttons are disabled. The dialog closes
 * when it settles either way -- a DB error is shown by the screen's own
 * Banner (the screen's delete body catches it).
 */
export default function ConfirmDialog({ open, recordType, label, onConfirm, onClose, confirmText = 'Delete', title, body }) {
  const [pending, setPending] = useState(false)
  const cancelRef = useRef(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

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
        <div className="mb-3 flex items-center gap-2 text-red-700">
          <Trash2 size={18} />
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {body ?? (
            <>
              <strong>{label}</strong> will be permanently deleted. This can't be undone.
            </>
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={pending} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={pending} className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
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
