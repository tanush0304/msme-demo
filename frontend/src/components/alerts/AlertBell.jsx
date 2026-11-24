import { Bell } from 'lucide-react'
import { useAlerts } from './AlertsContext'

// Header bell with a count badge; supervisor/admin only (renders nothing
// otherwise, or outside an AlertsProvider).
export default function AlertBell({ className = '' }) {
  const alerts = useAlerts()
  if (!alerts?.allowed) return null
  const { count, openList } = alerts
  const label = count === 1 ? '1 item needs attention' : `${count} items need attention`
  return (
    <button
      type="button"
      onClick={openList}
      aria-label={`Notifications: ${label}`}
      title={label}
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brandsky bg-white text-brandnavy shadow-sm transition hover:bg-brandsky/60 hover:text-brandblue focus:outline-none focus-visible:ring-2 focus-visible:ring-brandblue/40 ${className}`}
    >
      <Bell size={18} aria-hidden="true" />
      <span
        data-testid="alert-count"
        className={`absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full px-1 text-center text-[11px] font-semibold leading-[18px] text-white ring-2 ring-white ${count > 0 ? 'bg-red-600' : 'bg-brandslate'}`}
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>
  )
}
