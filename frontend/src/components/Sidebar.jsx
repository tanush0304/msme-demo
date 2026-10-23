import { useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  Factory,
  House,
  LogOut,
  Menu,
  ShieldCheck,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { NAV_ITEMS, canSeeSubItem } from '../utils/constants'
import { moduleTheme } from '../theme/moduleTheme'

function initialsFor(email) {
  const name = email?.split('@')[0] ?? ''
  const parts = name.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Icon per module; colours come from theme/moduleTheme.js.
const MODULE_PRESENTATION = {
  masters: { label: 'Masters', icon: Database },
  production: { label: 'Production', icon: Factory },
  quality: { label: 'Quality', icon: ShieldCheck },
  'customer-order': { label: 'Customer Orders', icon: ClipboardList },
  'job-order': { label: 'Jobwork', icon: Truck },
  maintenance: { label: 'Maintenance', icon: Wrench },
  stores: { label: 'Stores', icon: Warehouse },
  dashboard: { label: 'Reports & Dashboard', icon: BarChart3 },
}

// Contextual accordion: a module's group auto-expands while one of its
// screens is open (current screen highlighted, siblings one click away) and
// stays collapsed on a module landing page (e.g. the Masters card selector),
// so the sidebar never duplicates the workspace. Other modules stay visible.
function contextualExpandedKey(activeKey, activeSubKey) {
  return activeSubKey ? activeKey : null
}

export default function Sidebar({ activeKey, activeSubKey, onSelect, onSelectSub, onHome, isHome = false, userEmail, onSignOut, role }) {
  const isRestricted = (module) => Boolean(module.roles && !module.roles.includes(role))
  // Starts collapsed on phones (below md, 768px) so the content keeps the width;
  // desktop starts expanded. Either way the menu button toggles it.
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 767px)').matches))
  const [expandedKey, setExpandedKey] = useState(() => contextualExpandedKey(activeKey, activeSubKey))
  const [lastContext, setLastContext] = useState(`${activeKey}/${activeSubKey}`)

  // Re-sync with navigation that happens outside the sidebar (Dashboard
  // shortcuts, the Masters card selector) -- adjusted during render rather
  // than in an effect so the first paint is already correct.
  const context = `${activeKey}/${activeSubKey}`
  if (context !== lastContext) {
    setLastContext(context)
    setExpandedKey(contextualExpandedKey(activeKey, activeSubKey))
  }

  function handleModuleClick(module) {
    // Clicking the module you're already in: from one of its screens it goes
    // back to the module's landing; on the landing it just opens/closes its
    // list. Clicking any other module navigates there.
    if (module.key === activeKey && activeSubKey) {
      onSelect(module.key)
    } else if (module.subItems && module.key === activeKey) {
      setExpandedKey((k) => (k === module.key ? null : module.key))
    } else {
      onSelect(module.key)
    }
  }

  return (
    <aside
      className={`flex h-full ${collapsed ? 'w-[68px]' : 'w-[264px]'} shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-800 shadow-[2px_0_12px_rgba(15,42,82,0.06)] transition-[width]`}
    >
      {/* Only the collapse button: the Pragati & Unnati logo lives in the page
          header. Same 78px height as the header so the borders line up. */}
      <div className="flex h-[78px] shrink-0 items-center border-b border-slate-200 bg-white px-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`} aria-label="Application modules">
        <div className="space-y-1.5">
          {/* Home (Main Menu): same row as the modules, neutral grey tile; never
              locked, never expands -- it only returns to the Main Menu. */}
          <button
            type="button"
            onClick={() => onHome?.()}
            aria-current={isHome ? 'page' : undefined}
            aria-label="Open Home"
            title={collapsed ? 'Home' : undefined}
            style={isHome ? { backgroundColor: '#F1F5F9', boxShadow: 'inset 4px 0 0 #64748B' } : undefined}
            className={`group flex min-h-[48px] w-full items-center gap-3 rounded-lg py-2 text-left text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${collapsed ? 'justify-center px-0' : 'px-3'} ` +
              (isHome ? 'sidebar-active' : 'hover:bg-slate-100')}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 ${isHome ? 'bg-white' : 'bg-slate-100'}`}>
              <House size={19} strokeWidth={2.2} aria-hidden="true" />
            </span>
            {!collapsed && <span className={`min-w-0 flex-1 text-[13px] leading-tight ${isHome ? 'font-bold' : 'font-semibold'}`}>Home</span>}
          </button>
          {NAV_ITEMS.map((module) => {
            const presentation = MODULE_PRESENTATION[module.key] ?? { label: module.label, icon: Database }
            const Icon = presentation.icon
            const theme = moduleTheme(module.key)
            const selected = activeKey === module.key
            const locked = isRestricted(module)
            const expanded = !collapsed && !locked && Boolean(module.subItems) && expandedKey === module.key
            const Chevron = expanded ? ChevronDown : ChevronRight
            return (
              <div key={module.key}>
                {/* Active: 4px accent bar (inset shadow, no layout shift) + the
                    module tint, label in the module's 800 shade. */}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => handleModuleClick(module)}
                  aria-current={selected ? 'page' : undefined}
                  aria-expanded={module.subItems && !locked ? expanded : undefined}
                  aria-label={locked ? `${presentation.label}. Supervisor or admin access required.` : `Open ${presentation.label}`}
                  title={locked ? 'Supervisor or admin access required' : collapsed ? presentation.label : undefined}
                  style={selected ? { backgroundColor: theme.tint, color: theme.dark, boxShadow: `inset 4px 0 0 ${theme.accent}` } : undefined}
                  className={`group flex min-h-[48px] w-full items-center gap-3 rounded-lg py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${collapsed ? 'justify-center px-0' : 'px-3'} ` +
                    (selected
                      ? 'sidebar-active'
                      : locked
                        ? 'cursor-not-allowed text-slate-400'
                        : 'text-slate-800 hover:bg-slate-100')}
                >
                  <span
                    className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (locked ? 'opacity-50' : '')}
                    style={{ backgroundColor: selected ? '#FFFFFF' : theme.tint, color: theme.strong }}
                  >
                    <Icon size={19} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  {!collapsed && (
                    <>
                      <span className={`min-w-0 flex-1 text-[13px] leading-tight ${selected ? 'font-bold' : 'font-semibold'}`}>{presentation.label}</span>
                      {module.subItems && !locked && <Chevron size={15} className="shrink-0 opacity-70" aria-hidden="true" />}
                    </>
                  )}
                </button>

                {expanded && (
                  <div className="ml-[30px] mt-1 space-y-0.5 border-l border-slate-200 pl-2" role="group" aria-label={`${presentation.label} screens`}>
                    {module.subItems.filter((screen) => canSeeSubItem(screen, role)).map((screen) => {
                      const isActiveScreen = selected && activeSubKey === screen.key
                      return (
                        <button
                          key={screen.key}
                          type="button"
                          onClick={() => onSelectSub(module.key, screen.key)}
                          aria-current={isActiveScreen ? 'page' : undefined}
                          style={isActiveScreen ? { borderLeftColor: theme.accent, color: theme.strong } : undefined}
                          className={'flex min-h-[32px] w-full items-center gap-2 rounded-r px-2.5 text-left text-[12px] leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-400/60 ' +
                            (isActiveScreen ? 'sidebar-active-screen border-l-2 font-semibold' : 'border-l-2 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
                        >
                          <span
                            className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (isActiveScreen ? '' : 'border border-slate-400')}
                            style={isActiveScreen ? { backgroundColor: theme.accent } : undefined}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">{screen.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-3">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'flex-col' : ''}`}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[10px] font-bold text-[#1E3A8A]"
            title={collapsed ? userEmail : undefined}
          >
            {initialsFor(userEmail)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-medium text-slate-800" title={userEmail}>{userEmail}</div>
              <div className="text-[10px] capitalize text-slate-600">{role}</div>
            </div>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="shrink-0 rounded p-1.5 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
