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

/**
 * Reports & Dashboard landing: the report cards (9 + Customer Complaint),
 * compact cards at content height (min 150px from 1400px, no stretch), 4 per
 * row from 1400px, 3 from xl, 2 from md, 1 on phones. Left edge = breadcrumb.
 * Text is never clipped; the page scrolls when the cards don't fit.
 */
export default function ReportLanding({ title, subtitle, tiles, onSelect }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={title} subtitle={subtitle} size="lg" />
      <main className="min-h-0 flex-1 overflow-y-auto bg-page px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 min-[1400px]:grid-cols-4 min-[1400px]:auto-rows-[minmax(150px,auto)]">
          {tiles.map((tile) => (
            <ReportCard key={tile.key} tile={tile} onSelect={onSelect} />
          ))}
        </div>
      </main>
    </div>
  )
}
