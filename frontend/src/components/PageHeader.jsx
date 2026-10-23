import pragatiUnnatiLogo from '../assets/pragati-unnati-logo.png'
import { CLIENT_LOGO, CLIENT_NAME } from '../utils/constants'
import { createContext, useContext } from 'react'
import { ChevronRight } from 'lucide-react'
import { useModuleTheme } from './ModuleTheme'

// App wraps every module in this provider with its breadcrumb trail
// (module > screen, from NAV_ITEMS); Masters overrides it with its own so
// the "Masters" crumb can return to the tile landing.
//   [{ label, onClick? }, ...] -- items with onClick render as links.
const PageHeaderBandContext = createContext(null)

export function PageHeaderBandProvider({ breadcrumb, children }) {
  return <PageHeaderBandContext.Provider value={{ breadcrumb }}>{children}</PageHeaderBandContext.Provider>
}

// Pragati & Unnati logo, the header's left block. Shared with Main Menu so
// both sit at the same size and position, its left edge flush with the
// breadcrumb / content inset (16px, 24px from sm); `className` sets
// visibility (AppBar hides it below lg).
function HeaderLogo({ className = 'flex' }) {
  return (
    <div className={`z-10 shrink-0 items-center pl-4 pr-5 sm:pl-6 ${className}`}>
      <img src={pragatiUnnatiLogo} alt="Pragati & Unnati" className="h-[70px] w-auto object-contain" />
    </div>
  )
}

// White app bar shared by every screen and Home. From sm it's a 3-column grid
// so the title sits truly centred: the Pragati & Unnati logo left,
// title (+ CLIENT_NAME when set) centre, `children` + optional client logo
// right. Below sm it's a plain row -- compact logo (96px) then the title
// filling the rest; the title wraps to at most 2 lines (then ellipsis) and
// keeps up to 6rem, so the logo gives way first when space is very tight
// (e.g. sidebar open on a phone).
// Home shows "Data Management System" in navy; module screens pass their
// module name and accent. `compactLogo` shows the small Pragati & Unnati
// logo below lg (Home and module screens).
export function AppBar({ children, compactLogo = false, title = 'Data Management System', titleColor = '#0F2A52' }) {
  return (
    <header className="relative flex h-[78px] shrink-0 items-center gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] border-b border-slate-200/80 bg-white/95 shadow-[0_1px_6px_rgba(15,42,82,0.05)]">
      <div className="flex min-w-0 items-center">
        {compactLogo && (
          <img src={pragatiUnnatiLogo} alt="Pragati & Unnati — Together Towards a Better Tomorrow" className="ml-4 w-[96px] min-w-0 max-w-[calc(100%-1rem)] object-contain sm:w-[150px] lg:hidden" />
        )}
        <HeaderLogo className="hidden lg:flex" />
      </div>
      <div className={`min-w-[min(6rem,100%)] flex-1 text-center sm:min-w-0 sm:pr-0 ${children ? '' : 'pr-3'}`}>
        <p className="line-clamp-2 break-words text-[18px] font-extrabold leading-tight tracking-tight sm:text-[24px] lg:text-[30px]" style={{ color: titleColor }}>
          {title}
        </p>
        {CLIENT_NAME && <p className="truncate text-[12px] text-slate-500">{CLIENT_NAME}</p>}
      </div>
      <div className="flex shrink-0 items-center justify-end sm:min-w-0">
        {children}
        {CLIENT_LOGO && (
          <div className="flex shrink-0 items-center px-3 sm:px-5">
            <img src={CLIENT_LOGO} alt={CLIENT_NAME} className="h-11 w-auto max-w-[150px] object-contain sm:h-[64px]" />
          </div>
        )}
      </div>
    </header>
  )
}

// App bar (module name centred in its colour), breadcrumb row, then the page
// title in the module's 800 shade with its subtitle in slate-700 ("A | B"
// tags read as "A · B") -- both sit on the tinted page background, so they
// use the dark shades to stay >= 4.5:1 there.
// `size="lg"` for landings. On a landing whose title is just the module
// name, the title is dropped (the app bar already shows it) and only the
// subtitle stays.
function BandHeader({ title, subtitle, breadcrumb, size }) {
  const theme = useModuleTheme()
  const sub = subtitle ? subtitle.split('|').map((t) => t.trim()).filter(Boolean).join(' · ') : ''
  const lg = size === 'lg'
  const showTitle = !(theme.moduleName && title === theme.moduleName)
  return (
    <div className="shrink-0">
      <AppBar compactLogo title={theme.moduleName || undefined} titleColor={theme.moduleName ? theme.title : undefined} />
      {breadcrumb?.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 border-b border-slate-200/80 bg-white/70 px-4 py-1.5 text-[12px] text-slate-700 sm:px-6">
          {breadcrumb.map((crumb, i) => {
            const last = i === breadcrumb.length - 1
            return (
              <span key={crumb.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
                {crumb.onClick && !last ? (
                  <button type="button" onClick={crumb.onClick} className="text-slate-700 hover:text-brandblue hover:underline">
                    {crumb.label}
                  </button>
                ) : (
                  <span className={last ? 'font-semibold text-slate-900' : 'text-slate-700'} aria-current={last ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>
      )}
      {/* Nothing at all on a landing whose title is the module name and has
          no subtitle -- the app bar already names the module. */}
      {(showTitle || sub) && (
        <div className={`px-4 sm:px-6 ${lg ? 'pb-1 pt-5' : 'pb-1 pt-3'}`}>
          {showTitle && (
            <h1 className={`truncate font-bold leading-tight tracking-tight ${lg ? 'text-[26px] sm:text-[32px]' : 'text-[19px] sm:text-[22px]'}`} style={{ color: theme.dark }}>
              {title}
            </h1>
          )}
          {sub && <p title={sub} className={`truncate text-slate-700 ${lg ? `${showTitle ? 'mt-1' : ''} text-[13px] sm:text-[15px]` : 'text-[12px] sm:text-[13px]'}`}>{sub}</p>}
        </div>
      )}
    </div>
  )
}

// Every screen's header. Callers' `eyebrow` prop is no longer shown -- the
// breadcrumb row replaces it.
export default function PageHeader({ title, subtitle, size }) {
  const band = useContext(PageHeaderBandContext)
  return <BandHeader title={title} subtitle={subtitle} breadcrumb={band?.breadcrumb} size={size} />
}
