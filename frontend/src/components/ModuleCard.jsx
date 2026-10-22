import { ArrowRight } from 'lucide-react'

// The one landing card used everywhere (Home, module landings, Masters,
// Reports): white card with a 4px accent top border and an accent wash in
// the bottom-right, 28px icon in the 700 shade on a 15% tint (>=3:1), slate
// title + gray description, solid accent arrow button in its own bottom row
// (never over the text), lift on hover. Height follows the content -- nothing
// is clipped by a fixed height; grids stretch each row to its tallest card.
// `theme` is an entry from theme/moduleTheme.js.
//   layout 'row'   icon beside the title (compact grids: Home, Masters, Reports)
//   layout 'stack' icon above the title (landings with few screens)
export default function ModuleCard({ title, description, icon: Icon, theme, onClick, ariaLabel, disabled = false, layout = 'row' }) {
  const stack = layout === 'stack'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? 'Open ' + title}
      title={title}
      style={{
        borderTopColor: theme.accent,
        backgroundImage: `radial-gradient(120% 120% at 100% 100%, ${theme.wash}, transparent 60%)`,
      }}
      className="group relative flex h-full w-full min-w-0 flex-col rounded-2xl border border-t-4 border-slate-200 bg-white p-4 pb-3 text-left shadow-[0_2px_10px_rgba(15,42,82,0.08)] transition duration-150 enabled:hover:-translate-y-1 enabled:hover:shadow-[0_14px_28px_rgba(15,42,82,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/60 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:pb-4 sm:pt-5"
    >
      <span className={stack ? 'flex flex-col items-start gap-4' : 'flex items-center gap-3'}>
        {Icon && (
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl ${stack ? 'h-14 w-14' : 'h-12 w-12'}`}
            style={{ backgroundColor: theme.tint, color: theme.strong }}
            aria-hidden="true"
          >
            <Icon size={28} strokeWidth={2} />
          </span>
        )}
        <span className={`min-w-0 font-bold leading-tight text-[#0F172A] ${stack ? 'text-[18px] sm:text-[20px]' : 'line-clamp-2 text-[14px] sm:text-[15px]'}`}>
          {title}
        </span>
      </span>
      {description && (
        <span title={description} className={`mt-2 line-clamp-2 leading-[1.4] text-gray-600 ${stack ? 'text-[13px] sm:text-[14px]' : 'text-[12px] sm:text-[13px]'}`}>
          {description}
        </span>
      )}
      <span className="mt-auto flex justify-end pt-3" aria-hidden="true">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition group-enabled:group-hover:translate-x-0.5"
          style={{ backgroundColor: theme.accent }}
        >
          <ArrowRight size={16} strokeWidth={2.6} />
        </span>
      </span>
    </button>
  )
}
