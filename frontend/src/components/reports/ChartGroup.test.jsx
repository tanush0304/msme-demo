// @vitest-environment jsdom
// ChartGroup "Expand all" + "Export PNG" (one image of every chart on the
// screen). html-to-image and the download are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const m = vi.hoisted(() => ({ toPng: vi.fn(), download: vi.fn(), seenAtCapture: null }))
vi.mock('html-to-image', () => ({ toPng: (...a) => m.toPng(...a) }))
vi.mock('../../utils/chartExport', async (orig) => ({ ...(await orig()), downloadDataUrl: (...a) => m.download(...a) }))

const { default: ChartGroup } = await import('./ChartGroup')
const { default: ChartCard } = await import('./ChartCard')
const { pngFilter } = await import('../../utils/chartExport')

const DATA = { columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] }
const group = ({ aLoading = false, bEmpty = false } = {}) =>
  render(
    <ChartGroup title="Downtime Report" screen="Downtime">
      <div className="grid">
        <ChartCard title="Chart A" raw loading={aLoading} filterText="01-11-2026 to 26-11-2026" exportData={DATA}>
          <div data-testid="plot-a">a</div>
        </ChartCard>
        <ChartCard title="Chart B" raw empty={bEmpty} exportData={DATA}>
          <div data-testid="plot-b">b</div>
        </ChartCard>
      </div>
    </ChartGroup>,
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 26, 10, 0, 0))
  m.toPng.mockReset().mockImplementation(async (node) => {
    m.seenAtCapture = node.textContent
    return 'data:image/png;base64,AAA'
  })
  m.download.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.body.style.overflow = ''
})

describe('ChartGroup', () => {
  it('one Expand all button; no Export on the screen', () => {
    group()
    expect(screen.getAllByRole('button', { name: /Expand all/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
  })

  it('Expand all shows every chart with data in one window, each with title + filter line', () => {
    group()
    fireEvent.click(screen.getByRole('button', { name: /Expand all/ }))
    const dialog = screen.getByRole('dialog', { name: 'Downtime Report – all charts' })
    const cells = within(dialog).getAllByTestId('chart-group-cell')
    expect(cells).toHaveLength(2)
    expect(within(cells[0]).getByText('Chart A')).toBeTruthy()
    expect(within(cells[0]).getByText('01-11-2026 to 26-11-2026')).toBeTruthy()
    expect(within(dialog).getByTestId('plot-b')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /Export PNG/ })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: /Excel/ })).toBeNull() // PNG only
  })

  it('empty charts are left out of the window', () => {
    group({ bEmpty: true })
    fireEvent.click(screen.getByRole('button', { name: /Expand all/ }))
    const cells = within(screen.getByRole('dialog')).getAllByTestId('chart-group-cell')
    expect(cells).toHaveLength(1)
    expect(within(cells[0]).getByText('Chart A')).toBeTruthy()
  })

  it('Expand all is disabled while any chart is loading', () => {
    group({ aLoading: true })
    expect(screen.getByRole('button', { name: /Expand all/ }).disabled).toBe(true)
  })

  it('Esc / Close close it and restore page scroll', () => {
    document.body.style.overflow = 'auto'
    group()
    fireEvent.click(screen.getByRole('button', { name: /Expand all/ }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('auto')
    fireEvent.click(screen.getByRole('button', { name: /Expand all/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Export PNG: one image of the grid with screen title + Exported line -> <Screen>_All_charts_<date>.png', async () => {
    group()
    fireEvent.click(screen.getByRole('button', { name: /Expand all/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export PNG/ }))
    })
    await waitFor(() => expect(m.download).toHaveBeenCalledTimes(1))
    expect(m.download).toHaveBeenCalledWith('data:image/png;base64,AAA', 'Downtime_All_charts_2026-11-26.png')
    const [node, options] = m.toPng.mock.calls[0]
    expect(node.getAttribute('data-testid')).toBe('chart-group-capture')
    expect(options.filter).toBe(pngFilter)
    expect(m.seenAtCapture).toContain('Downtime Report')
    expect(m.seenAtCapture).toContain('Chart A')
    expect(m.seenAtCapture).toContain('Chart B')
    expect(m.seenAtCapture).toContain('01-11-2026 to 26-11-2026')
    expect(m.seenAtCapture).toContain('Exported 26-11-2026')
    expect(m.seenAtCapture).not.toContain('Export PNG') // buttons are outside the captured part
  })

  it('a PNG failure shows an error and nothing is downloaded', async () => {
    m.toPng.mockRejectedValueOnce(new Error('canvas tainted'))
    group()
    fireEvent.click(screen.getByRole('button', { name: /Expand all/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export PNG/ }))
    })
    expect((await screen.findByRole('alert')).textContent).toContain('canvas tainted')
    expect(m.download).not.toHaveBeenCalled()
  })

  it('a ChartCard outside a group still works (no Expand all)', () => {
    render(<ChartCard title="Solo" raw><div>x</div></ChartCard>)
    expect(screen.queryByRole('button', { name: /Expand all/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Expand chart' })).toBeTruthy()
  })
})
