import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Download,
  FilePlus2,
  FileText,
  Hand,
  ListChecks,
  MessageSquareWarning,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Route,
  ShieldCheck,
  Truck,
  TriangleAlert,
} from 'lucide-react'
import { NAV_ITEMS, STORES_LANDING_TILES, canSeeSubItem } from '../utils/constants'
import { moduleTheme, rotatedTheme } from '../theme/moduleTheme'

// Icon + short description per tile key. Labels never come from here -- see
// constants.js (report descriptions also live there and win over these).
const TILE_ART = {
  production: {
    planning: { icon: CalendarDays, description: 'Plan and manage production schedules.' },
    'production-data-entry': { icon: ListChecks, description: 'Record production data and track progress.' },
    'manual-operations': { icon: Hand, description: 'Handle manual production operations.' },
    'route-card': { icon: Route, description: 'Manage operation sequences and routing.' },
    'shift-verification': { icon: ShieldCheck, description: 'Verify and confirm shift activities.' },
  },
  'customer-order': {
    enquiry: { icon: FilePlus2, description: 'Create and manage new customer enquiries.' },
    order: { icon: ClipboardPlus, description: 'Create and manage new customer orders.' },
  },
  'job-order': {
    dispatch: { icon: Truck, description: 'Despatch materials to job workers.' },
    receipt: { icon: Download, description: 'Receive materials back from job workers.' },
  },
  maintenance: {
    checklist: { icon: ClipboardCheck, description: 'Record maintenance checklists and activities.' },
    plan: { icon: CalendarDays, description: 'Plan and schedule maintenance activities.' },
  },
  quality: {
    inspection: { icon: ShieldCheck, description: 'Record inspection results and maintain quality standards.' },
    complaint: { icon: MessageSquareWarning, description: 'Manage customer complaints and resolutions.' },
  },
  stores: {
    'rm-receipt': { icon: Truck, description: 'Receive raw materials into stores.' },
    'rm-issue': { icon: ArrowRightLeft, description: 'Issue raw materials from stores.' },
    'wip-receipt': { icon: PackagePlus, description: 'Receive WIP materials into stores.' },
    'wip-issue': { icon: PackageMinus, description: 'Issue WIP materials from stores.' },
    'fg-receipt': { icon: PackageCheck, description: 'Receive finished goods into stores.' },
    'fg-despatch': { icon: Truck, description: 'Despatch finished goods to customers.' },
  },
  dashboard: {
    'customer-order-status': { icon: FileText },
    'job-order-status': { icon: ClipboardCheck },
    'production-status': { icon: BarChart3 },
    'daily-machine': { icon: CalendarClock },
    downtime: { icon: TriangleAlert },
    'quality-status': { icon: ShieldCheck },
    'wip-status': { icon: Boxes },
    'rm-status': { icon: ClipboardList },
    'fg-inventory': { icon: Package },
    'complaint-status': { icon: MessageSquareWarning },
  },
}

// Reports rotates through the 8 module accents card by card; every other
// landing uses its own module colour.
function withArt(moduleKey, tile, index) {
  const art = TILE_ART[moduleKey]?.[tile.key] ?? {}
  const theme = moduleKey === 'dashboard' ? rotatedTheme(index) : moduleTheme(moduleKey)
  return { ...tile, icon: art.icon, description: tile.description ?? art.description, theme }
}

/** Landing tiles for a module: { key, label, subKey, mode?, icon, description, theme }.
 * Every sub-screen in NAV_ITEMS order that `role` may open (sub-items with
 * `roles`, e.g. Shift Verification, are hidden from other roles; sub-items with
 * `landing: false` are sidebar-only); Stores uses
 * STORES_LANDING_TILES. */
export function landingTiles(moduleKey, role) {
  const base =
    moduleKey === 'stores'
      ? STORES_LANDING_TILES
      : (NAV_ITEMS.find((n) => n.key === moduleKey)?.subItems ?? [])
          .filter((s) => canSeeSubItem(s, role) && s.landing !== false)
          .map((s) => ({ ...s, subKey: s.key }))
  return base.map((tile, i) => withArt(moduleKey, tile, i))
}
