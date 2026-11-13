// @vitest-environment jsdom
// ChartCard Expand + Export (PNG / Excel). html-to-image, the CSV export and
// the download are mocked -- nothing is drawn to a canvas, saved or fetched.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const m = vi.hoisted(() => ({ toPng: vi.fn(), exportToCsv: vi.fn(), download: vi.fn(), seenAtCapture: null }))
vi.mock('html-to-image', () => ({ toPng: (...a) => m.toPng(...a) }))
vi.mock('../../utils/exportUtils', () => ({ exportToCsv: (...a) => m.exportToCsv(...a) }))
vi.mock('../../utils/chartExport', async (orig) => ({ ...(await orig()), downloadDataUrl: (...a) => m.download(...a) }))

const { default: ChartCard } = await import('./ChartCard')
const { pngFilter, chartFileName, reportFilterText, donutExportData, seriesExportData, fileNamePart } = await import('../../utils/chartExport')

const DATA = {
  columns: [
    { key: 'label', label: 'Machine' },
    { key: 'efficiency_pct', label: 'Efficiency %' },
  ],
  rows: [
    { label: 'CNC Lathe TL-200', efficiency_pct: 92.5 },
    { label: 'VMC V-600', efficiency_pct: 81 },
  ],
}
const PROPS = {
  title: 'Production Efficiency (By Machine)',
  screen: 'Production_Status',
  exportKey: 'Efficiency_By_Machine',
  exportData: DATA,
  filterText: '01-04-2026 to 14-11-2026 · Machine: MC-03',
  raw: true,
}
const card = (props = {}) => render(<ChartCard {...PROPS} {...props}><div data-testid="plot">plot</div></ChartCard>)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 10, 0, 0)) // 14-11-2026 local
  m.toPng.mockReset().mockImplementation(async (node) => {
    m.seenAtCapture = node.textContent
    return 'data:image/png;base64,AAA'
  })
  m.exportToCsv.mockReset()
  m.download.mockReset()
  m.seenAtCapture = null
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.body.style.overflow = ''
})

describe('Expand modal', () => {
  it('opens at ~90% of the viewport above everything, with the same title, filter line and chart', () => {
    card()
    fireEvent.click(screen.getByRole('button', { name: 'Expand chart' }))
    const dialog = screen.getByRole('dialog', { name: PROPS.title })
    expect(dialog.className).toContain('sm:h-[90vh]')
    expect(dialog.className).toContain('sm:w-[90vw]')
    expect(screen.getByTestId('chart-modal-backdrop').className).toContain('z-[70]') // above sidebar / header / dialogs / toast
    expect(within(dialog).getByText(PROPS.filterText)).toBeTruthy()
    expect(within(dialog).getByTestId('plot')).toBeTruthy() // re-rendered, not a scaled copy
    expect(screen.getAllByTestId('plot')).toHaveLength(2)
  })

  it('locks page scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    card()
    fireEvent.click(screen.getByRole('button', { name: 'Expand chart' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('Esc closes it', () => {
    card()
    fireEvent.click(screen.getByRole('button', { name: 'Expand chart' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a click outside (backdrop) closes it; a click inside does not', () => {
    card()
    fireEvent.click(screen.getByRole('button', { name: 'Expand chart' }))
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.mouseDown(screen.getByTestId('chart-modal-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Expand shows without exportData; Export does not', () => {
    card({ exportData: undefined })
    expect(screen.getByRole('button', { name: 'Expand chart' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
  })
})

describe('disabled while loading or empty', () => {
  it.each([
    ['loading', { loading: true }],
    ['empty', { empty: true }],
  ])('%s: Expand and Export are disabled', (_, extra) => {
    card(extra)
    expect(screen.getByRole('button', { name: 'Expand chart' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Export/ }).disabled).toBe(true)
  })
})

describe('Export', () => {
  it('menu: PNG and Excel, styled like the table Export button', () => {
    card()
    const btn = screen.getByRole('button', { name: /Export/ })
    expect(btn.className).toContain('bg-[#15803D]')
    fireEvent.click(btn)
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['PNG', 'Excel'])
  })

  it('Excel: exportToCsv with the chart columns + rows and <Screen>_<Chart>_<YYYY-MM-DD>.csv', () => {
    card()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excel' }))
    expect(m.exportToCsv).toHaveBeenCalledTimes(1)
    expect(m.exportToCsv).toHaveBeenCalledWith(DATA.columns, DATA.rows, 'Production_Status_Efficiency_By_Machine_2026-11-14.csv')
  })

  it('PNG: captures the card with title, filter line and export date, then downloads <Screen>_<Chart>_<date>.png', async () => {
    card()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }))
    })
    await waitFor(() => expect(m.download).toHaveBeenCalledTimes(1))
    expect(m.download).toHaveBeenCalledWith('data:image/png;base64,AAA', 'Production_Status_Efficiency_By_Machine_2026-11-14.png')
    const [node, options] = m.toPng.mock.calls[0]
    expect(node.tagName).toBe('SECTION') // the card, not the page
    expect(options.filter).toBe(pngFilter)
    expect(m.seenAtCapture).toContain(PROPS.title)
    expect(m.seenAtCapture).toContain(PROPS.filterText)
    expect(m.seenAtCapture).toContain('Exported 14-11-2026')
    expect(screen.queryByText(/Exported 14-11-2026/)).toBeNull() // only shown while capturing
  })

  it('PNG leaves out the Expand / Export buttons and the open menu (toPng filter)', async () => {
    card()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    const menu = screen.getByRole('menu')
    const expand = screen.getByRole('button', { name: 'Expand chart' })
    const exportBtn = screen.getByRole('button', { name: /Export/ })
    const title = screen.getByRole('heading', { name: PROPS.title })
    // the tools wrapper (holding both buttons + the menu) is excluded, so html-to-image skips its whole subtree
    const tools = expand.closest('[data-export-exclude]')
    expect(tools).toBeTruthy()
    expect(tools.contains(exportBtn)).toBe(true)
    expect(tools.contains(menu)).toBe(true)
    expect(pngFilter(tools)).toBe(false)
    expect(pngFilter(title)).toBe(true)
    expect(pngFilter(screen.getByTestId('plot'))).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }))
    })
    await waitFor(() => expect(m.toPng).toHaveBeenCalled())
    expect(m.toPng.mock.calls[0][1].filter).toBe(pngFilter)
  })

  it('a PNG failure shows an error and nothing is downloaded', async () => {
    m.toPng.mockRejectedValueOnce(new Error('canvas tainted'))
    card()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }))
    })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('canvas tainted')
    expect(m.download).not.toHaveBeenCalled()
  })
})

describe('chartExport helpers', () => {
  it('file name parts and pattern', () => {
    expect(fileNamePart('Efficiency (By Machine)')).toBe('Efficiency_By_Machine')
    expect(chartFileName('Downtime', 'Downtime % by Type', new Date(2026, 0, 5))).toBe('Downtime_Downtime_by_Type_2026-01-05')
  })

  it('filter line: applied range + filters by label, blanks left out', () => {
    const applied = { from: '2026-04-01', to: '2026-11-14', machineId: 'MC-03', shiftCode: '' }
    expect(
      reportFilterText(applied, [
        { label: 'Machine', key: 'machineId', options: [{ value: 'MC-03', label: 'CNC Lathe TL-200 (MC-03)' }] },
        { label: 'Shift', key: 'shiftCode' },
      ]),
    ).toBe('01-04-2026 to 14-11-2026 · Machine: CNC Lathe TL-200 (MC-03)')
  })

  it('donut + series export data use the chart labels', () => {
    expect(donutExportData([{ label: 'Closed', value: 3 }, { label: 'Open', value: 1 }], { labelHeader: 'Status', valueHeader: 'Qty' })).toEqual({
      columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Qty' }, { key: 'share', label: 'Share %' }],
      rows: [{ label: 'Closed', value: 3, share: 75 }, { label: 'Open', value: 1, share: 25 }],
    })
    expect(seriesExportData([{ label: 'Oct', po: 5, extra: 1 }], 'label', 'Month', [{ key: 'po', label: 'PO Quantity' }])).toEqual({
      columns: [{ key: 'label', label: 'Month' }, { key: 'po', label: 'PO Quantity' }],
      rows: [{ label: 'Oct', po: 5 }],
    })
  })
})
