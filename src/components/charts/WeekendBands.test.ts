import { describe, expect, it } from 'vitest'
import { getWeekendRanges } from './WeekendBands'

describe('getWeekendRanges', () => {
  it('groups Saturday and Sunday into one UTC weekend range', () => {
    expect(
      getWeekendRanges([
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
        '2026-09-21',
      ]),
    ).toEqual([{ start: '2026-09-19', end: '2026-09-20' }])
  })

  it('returns each weekend separately across a longer date range', () => {
    expect(
      getWeekendRanges([
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
        '2026-09-21',
        '2026-09-25',
        '2026-09-26',
        '2026-09-27',
        '2026-09-28',
      ]),
    ).toEqual([
      { start: '2026-09-19', end: '2026-09-20' },
      { start: '2026-09-26', end: '2026-09-27' },
    ])
  })

  it('returns no ranges when the dates contain only weekdays', () => {
    expect(getWeekendRanges(['2026-09-21', '2026-09-22', '2026-09-23'])).toEqual([])
  })

  it('keeps partial weekends visible at either range boundary', () => {
    expect(getWeekendRanges(['2026-09-20', '2026-09-21'])).toEqual([
      { start: '2026-09-20', end: '2026-09-20' },
    ])
    expect(getWeekendRanges(['2026-09-18', '2026-09-19'])).toEqual([
      { start: '2026-09-19', end: '2026-09-19' },
    ])
  })
})
