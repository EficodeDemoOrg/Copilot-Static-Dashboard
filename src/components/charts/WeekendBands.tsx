import { ReferenceArea } from 'recharts'
import { chrome } from '../../theme/palette'

export interface WeekendRange {
  start: string
  end: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Groups ordered YYYY-MM-DD values into contiguous Saturday/Sunday ranges.
 * UTC keeps the calendar classification stable across viewer time zones.
 */
export function getWeekendRanges(dates: readonly string[]): WeekendRange[] {
  const ranges: WeekendRange[] = []
  let current: WeekendRange | undefined
  let previousTime: number | undefined

  for (const date of dates) {
    const time = Date.parse(`${date}T00:00:00Z`)
    if (!Number.isFinite(time)) {
      current = undefined
      previousTime = undefined
      continue
    }

    const day = new Date(time).getUTCDay()
    if (day !== 0 && day !== 6) {
      current = undefined
      previousTime = time
      continue
    }

    if (current && previousTime !== undefined && time - previousTime === DAY_MS) {
      current.end = date
    } else {
      current = { start: date, end: date }
      ranges.push(current)
    }
    previousTime = time
  }

  return ranges
}

interface Props {
  dates: readonly string[]
}

/** Theme-aware weekend sections shared by every daily cartesian chart. */
export function WeekendBands({ dates }: Props) {
  return (
    <>
      {getWeekendRanges(dates).map(({ start, end }) => (
        <ReferenceArea
          key={`${start}:${end}`}
          x1={start}
          x2={end}
          fill={chrome.weekendBand}
          stroke="none"
          zIndex={0}
          pointerEvents="none"
        />
      ))}
    </>
  )
}
