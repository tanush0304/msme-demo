import PageHeader from '../PageHeader'
import ModuleCard from '../ModuleCard'

/**
 * One report card: the shared ModuleCard in the Reports colour, with the
 * report's short description from constants.js. The whole card is one button.
 *   tile: { key, label, description, icon, theme }
 */
export function ReportCard({ tile, onSelect }) {
  return <ModuleCard title={tile.label} description={tile.description} icon={tile.icon} theme={tile.theme} onClick={() => onSelect(tile)} compact />
}

// From 1400px the grid has 8 half-columns and every card spans 2 (= 4 per row),
// so an incomplete last row can start mid-way and sit centred under the rows
// above at the same card width. Literal classes so Tailwind generates them.
const LAST_ROW_START = { 1: 'min-[1400px]:col-start-4', 2: 'min-[1400px]:col-start-3', 3: 'min-[1400px]:col-start-2' }

/**
 * Reports & Dashboard landing: compact cards. From 1400px: 4 per row, the rows
 * share the scroll area's height (at least their content, at most 220px; cards
 * top-aligned) and the last, incomplete row is centred. Below: 3 from xl,
 * 2 from md, 1 on phones at content height. Left edge = breadcrumb. Text is
 * never clipped; the page scrolls when the cards don't fit.
 */
export default function ReportLanding({ title, subtitle, tiles, onSelect }) {
  const rest = tiles.length % 4
  const lastRowFrom = rest ? tiles.length - rest : -1
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={title} subtitle={subtitle} size="lg" />
      <main className="min-h-0 flex-1 overflow-y-auto bg-page px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 min-[1400px]:h-full min-[1400px]:grid-cols-8 min-[1400px]:auto-rows-[minmax(min-content,220px)]">
          {tiles.map((tile, i) => (
            <div key={tile.key} className={`min-w-0 min-[1400px]:col-span-2 ${i === lastRowFrom ? LAST_ROW_START[rest] : ''}`}>
              <ReportCard tile={tile} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
