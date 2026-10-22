import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HourlySlotsEntry from './HourlySlotsEntry'

const render = (extra = {}) =>
  renderToStaticMarkup(
    createElement(HourlySlotsEntry, {
      startTime: '06:00',
      endTime: '14:00',
      shiftCode: 'A',
      logHours: [],
      onSaveHours: () => {},
      onAddExtraHour: () => {},
      saving: false,
      entryDate: '2026-10-22',
      ...extra,
    })
  )

describe('HourlySlotsEntry accessible names', () => {
  it('labels every hour row qty input "Hour N produced / rejected / rework"', () => {
    const html = render()
    for (const n of [1, 3, 8]) {
      expect(html).toContain(`aria-label="Hour ${n} produced"`)
      expect(html).toContain(`aria-label="Hour ${n} rejected"`)
      expect(html).toContain(`aria-label="Hour ${n} rework"`)
    }
  })

  it('with idle columns (Production Data Entry) labels idle + remarks "Hour N <field>"', () => {
    const html = render({ showIdle: true })
    expect(html).toContain('aria-label="Hour 1 produced"')
    expect(html).toContain('aria-label="Hour 1 remarks"')
    expect(html).toMatch(/aria-label="Hour 1 Opr Issue"/)
    expect(html).not.toMatch(/aria-label="[^"]* slot \d+"/)
  })
})
