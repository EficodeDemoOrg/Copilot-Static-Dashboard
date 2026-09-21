import type { Filters } from '../data/metrics'
import { fmtDayLong } from '../format'
import type { ReportWindow } from '../data/types'
import { EficodeLogo } from './EficodeLogo'

interface Props {
  fileNames: string[]
  adapterLabel: string
  reportWindow?: ReportWindow
  range?: { start: string; end: string }
  filters: Filters
  /** Frozen at load time so re-renders don't churn the printed timestamp. */
  generatedAt: Date
}

/** At most this many file names are spelled out before falling back to a count. */
const NAMES_SHOWN = 3

/**
 * Hidden on screen, shown when printing. Makes an exported PDF self-describing:
 * which files, which slice of them, and when it was produced.
 */
export function ReportHeader({ fileNames, adapterLabel, reportWindow, range, filters, generatedAt }: Props) {
  const source =
    fileNames.length <= NAMES_SHOWN
      ? fileNames.join(', ')
      : `${fileNames.length} files (${fileNames.slice(0, NAMES_SHOWN).join(', ')}, …)`

  const parts = [
    `Source: ${source}`,
    adapterLabel,
    reportWindow ? `Report window ${fmtDayLong(reportWindow.start)} – ${fmtDayLong(reportWindow.end)}` : undefined,
    range ? `Showing ${fmtDayLong(range.start)} – ${fmtDayLong(range.end)}` : undefined,
    filters.organization ? `Organization ${filters.organization}` : undefined,
  ].filter(Boolean)

  return (
    <header className="report-header">
      <div className="appbar__brand">
        <EficodeLogo height={38} />
        <h1 className="appbar__title">Copilot usage report</h1>
      </div>
      <p className="appbar__sub">
        {parts.join(' · ')} · Generated {generatedAt.toLocaleString('en-GB')}
      </p>
    </header>
  )
}
