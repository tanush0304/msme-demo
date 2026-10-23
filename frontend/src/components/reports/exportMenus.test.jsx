// @vitest-environment jsdom
// Export ▾ (ReportTable) and Print ▾ (ActionToolbar): clicking a menu item must
// run its action. Regression: ReportTable closed its menu on mouseleave (in the
// gap between button and menu) before Excel / PDF could be clicked.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('../../utils/exportUtils', () => ({ exportToCsv: vi.fn(), exportToPdf: vi.fn() }))
import { exportToCsv, exportToPdf } from '../../utils/exportUtils'
import ReportTable from './ReportTable'
import ActionToolbar from '../ActionToolbar'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const COLS = [{ key: 'name', label: 'Name' }, { key: 'qty', label: 'Qty', align: 'right' }]
const ROWS = [{ id: 1, name: 'Bracket', qty: 12500 }]

function renderTable() {
  render(<ReportTable title="Details" columns={COLS} rows={ROWS} rowKey={(r) => r.id} exportTitle="Test Report" exportName="test_report" />)
}

// What a real click does: pointer leaves the button, crosses the gap, presses on the item.
function humanClick(trigger, item) {
  fireEvent.mouseLeave(trigger.parentElement)
  fireEvent.mouseDown(item)
  fireEvent.mouseUp(item)
  fireEvent.click(item)
}

describe('ReportTable Export menu', () => {
  it('Excel calls the CSV export with the shown rows, then closes', () => {
    renderTable()
    const trigger = screen.getByRole('button', { name: /Export/ })
    fireEvent.click(trigger)
    humanClick(trigger, screen.getByRole('menuitem', { name: 'Excel' }))
    expect(exportToCsv).toHaveBeenCalledTimes(1)
    expect(exportToCsv.mock.calls[0][2]).toBe('test_report.csv')
    expect(exportToCsv.mock.calls[0][1][0]).toMatchObject({ sno: 1, name: 'Bracket' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('PDF calls the PDF export', () => {
    renderTable()
    const trigger = screen.getByRole('button', { name: /Export/ })
    fireEvent.click(trigger)
    humanClick(trigger, screen.getByRole('menuitem', { name: 'PDF' }))
    expect(exportToPdf).toHaveBeenCalledTimes(1)
    expect(exportToPdf.mock.calls[0][2]).toBe('Test Report')
  })

  it('closes on outside mousedown and on Escape (focus back on the button)', () => {
    renderTable()
    const trigger = screen.getByRole('button', { name: /Export/ })
    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(exportToCsv).not.toHaveBeenCalled()
  })
})

describe('ActionToolbar Print menu', () => {
  it('Excel / PDF call their handlers', () => {
    const onExportExcel = vi.fn()
    const onExportPdf = vi.fn()
    render(<ActionToolbar onExportExcel={onExportExcel} onExportPdf={onExportPdf} />)
    const trigger = screen.getByRole('button', { name: /Print/ })
    fireEvent.click(trigger)
    humanClick(trigger, screen.getByRole('menuitem', { name: 'Excel' }))
    expect(onExportExcel).toHaveBeenCalledTimes(1)
    fireEvent.click(trigger)
    humanClick(trigger, screen.getByRole('menuitem', { name: 'PDF' }))
    expect(onExportPdf).toHaveBeenCalledTimes(1)
  })

  it('Escape closes the menu without exporting', () => {
    const onExportExcel = vi.fn()
    render(<ActionToolbar onExportExcel={onExportExcel} />)
    const trigger = screen.getByRole('button', { name: /Print/ })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(onExportExcel).not.toHaveBeenCalled()
  })
})
