import {
  BarChart3,
  ClipboardList,
  Database,
  Factory,
  House,
  ShieldCheck,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { AppBar } from '../components/PageHeader'
import ModuleCard from '../components/ModuleCard'
import { moduleTheme } from '../theme/moduleTheme'
import { NAV_ITEMS } from '../utils/constants'

const MODULES = [
  { key: 'masters', title: 'Masters', description: 'Manage master data for your business.', icon: Database },
  { key: 'customer-order', title: 'Customer Orders', description: 'Handle enquiries and sales orders.', icon: ClipboardList },
  { key: 'production', title: 'Production', description: 'Plan, execute and monitor production.', icon: Factory },
  { key: 'job-order', title: 'Jobwork', description: 'Manage jobwork orders and tracking.', icon: Truck },
  { key: 'quality', title: 'Quality', description: 'Ensure product quality and compliance.', icon: ShieldCheck },
  { key: 'maintenance', title: 'Maintenance', description: 'Plan and track maintenance activities.', icon: Wrench },
  { key: 'stores', title: 'Stores', description: 'Manage raw materials and finished goods.', icon: Warehouse },
  { key: 'dashboard', title: 'Reports and Dashboard', description: 'Get real-time insights across operations.', icon: BarChart3 },
]

export default function MainMenu({ role, onNavigate, onSignOut }) {
  // Same role rule as the sidebar: a module with `roles` in NAV_ITEMS
  // (Masters, Reports & Dashboard) is supervisor/admin only.
  const isLocked = (key) => NAV_ITEMS.find((item) => item.key === key)?.roles?.includes(role) === false

  return (
    <main className="bg-page flex min-h-screen flex-col text-[#1D2B3B]">
      <AppBar compactLogo>
        <div className="flex shrink-0 items-center gap-3 pr-4 sm:gap-5 sm:pr-6">
          <nav aria-label="Main navigation" className="hidden sm:block">
            <button type="button" aria-current="page" className="inline-flex items-center gap-2 rounded-md border-b-2 border-[#1E4C8A] px-2 py-2 text-sm font-semibold text-[#1E4C8A]">
              <House size={17} aria-hidden="true" /> Home
            </button>
          </nav>
          <button onClick={onSignOut} className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#465D73] transition hover:border-[#176FA8] hover:text-[#176FA8] focus:outline-none focus:ring-2 focus:ring-[#176FA8]/25 sm:text-sm">
            Sign out
          </button>
        </div>
      </AppBar>

      <section aria-labelledby="main-menu-title" className="mx-auto w-full max-w-[1400px] px-5 pb-2 pt-8 sm:px-8 lg:pt-10">
        <h1 id="main-menu-title" className="text-[34px] font-extrabold leading-tight tracking-tight text-[#4C1D95] sm:text-[48px] sm:leading-[1.1]">
          Your operations, connected.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-600 sm:text-[17px]">
          From master data to final despatch.
          <br />
          Your people, production and inventory, in one place.
        </p>
      </section>

      <section aria-label="System modules" className="mx-auto grid w-full max-w-[1400px] auto-rows-[minmax(150px,auto)] grid-cols-1 gap-4 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {MODULES.map((module) => {
          const locked = isLocked(module.key)
          return (
            <ModuleCard
              key={module.key}
              title={module.title}
              description={locked ? 'Supervisor or admin access is required.' : module.description}
              icon={module.icon}
              theme={moduleTheme(module.key)}
              disabled={locked}
              onClick={() => onNavigate(module.key)}
              ariaLabel={locked ? `${module.title}. Supervisor or admin access required.` : `Open ${module.title}`}
            />
          )
        })}
      </section>
    </main>
  )
}
