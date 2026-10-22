import PageHeader from './PageHeader'
import ModuleCard from './ModuleCard'

// One landing tile: the shared ModuleCard in the module's colour, the
// screen's name from constants.js. `layout` is 'stack' (big icon on top)
// when the landing has only a few screens.
export function LandingTile({ tile, onSelect, layout = 'row' }) {
  return (
    <ModuleCard
      title={tile.label}
      description={tile.description}
      icon={tile.icon}
      theme={tile.theme}
      layout={layout}
      onClick={() => onSelect(tile)}
    />
  )
}

/** Columns by tile count: 4 -> 2x2, 5-6 -> 3 per row, 7-8 -> 4 per row
 * (7 = 4 + 3), otherwise one row up to 3, 4 per row beyond 8. */
export function landingGrid(count) {
  const cols = count <= 3 ? Math.max(count, 1) : count === 4 ? 2 : count <= 6 ? 3 : 4
  return { cols, rows: Math.ceil(count / cols) }
}

/** Grid column (lg, half-tile units: each tile spans 2) where tile `index`
 * starts: the first tile of a short last row is pushed in by half a tile per
 * missing tile, so that row sits centred (5 tiles -> 3 + 2 centred).
 * 'auto' everywhere else. */
export function tileColumnStart(index, count, cols) {
  const remainder = count % cols
  if (remainder === 0 || index !== count - remainder) return 'auto'
  return cols - remainder + 1
}

// Tile width cap (px) and the gap -- the grid never grows wider than this, so
// a module with 2 screens shows 2 normal-sized tiles, not 2 giant ones.
const TILE_MAX_W = 380
const GAP = 20

// Module landing page: every sub-screen as a tile. Rows take their content
// height (with a minimum), so card text is never clipped; the grid sits
// centred and the page scrolls if it doesn't fit.
export default function ModuleLanding({ title, subtitle, tiles, onSelect }) {
  const { cols, rows } = landingGrid(tiles.length)
  const layout = tiles.length <= 4 ? 'stack' : 'row'
  const gridStyle = {
    '--cols': cols,
    '--half-cols': cols * 2,
    '--rows': rows,
    '--max-w': `${cols * TILE_MAX_W + (cols - 1) * GAP}px`,
    gap: GAP,
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title={title} subtitle={subtitle} size="lg" />
      {/* Flex column + m-auto on the grid: centred both ways; scrolls when
          the tiles don't fit. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-page px-4 py-4 sm:px-6 lg:py-5">
        <div
          style={gridStyle}
          className="m-auto grid w-full max-w-[1200px] auto-rows-[minmax(170px,auto)] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] lg:max-w-[var(--max-w)] lg:[grid-template-columns:repeat(var(--half-cols),minmax(0,1fr))] lg:[grid-template-rows:repeat(var(--rows),minmax(190px,auto))]"
        >
          {tiles.map((tile, i) => (
            <div
              key={tile.key}
              style={{ '--col-start': tileColumnStart(i, tiles.length, cols) }}
              className="min-h-0 min-w-0 lg:[grid-column:var(--col-start)_/_span_2]"
            >
              <LandingTile tile={tile} onSelect={onSelect} layout={layout} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
