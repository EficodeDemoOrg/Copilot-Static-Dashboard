import { cloneElement, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'
import { PRINT_CHART_WIDTH, usePrintMode } from '../../hooks/usePrintMode'

interface Props {
  height: number
  /** A single Recharts chart element (AreaChart, BarChart, …). */
  children: ReactElement
}

/**
 * Sizes a chart for screen or for paper.
 *
 * On screen, ResponsiveContainer tracks the card width. During print layout its
 * ResizeObserver never fires, so charts render at 0x0 or at stale screen width in
 * the PDF — there we hand the chart explicit pixel dimensions instead, which
 * Recharts accepts directly and which bypass measurement entirely.
 */
export function ChartFrame({ height, children }: Props) {
  const printing = usePrintMode()

  if (printing) {
    return cloneElement(children, { width: PRINT_CHART_WIDTH, height })
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  )
}
