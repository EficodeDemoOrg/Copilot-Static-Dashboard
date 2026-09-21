import { useEffect, useState } from 'react'

/**
 * True while the page is being laid out for print.
 *
 * Recharts' ResponsiveContainer measures via ResizeObserver, which does not fire
 * during print layout — charts end up 0x0 or at screen width in the PDF. Charts
 * therefore switch to an explicit pixel size while this is true.
 *
 * Both signals are needed: Chrome/Safari fire beforeprint/afterprint, while the
 * `print` media query is what actually flips in some preview implementations.
 */
export function usePrintMode(): boolean {
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('print')

    const on = () => setPrinting(true)
    const off = () => setPrinting(false)
    const onChange = (e: MediaQueryListEvent) => setPrinting(e.matches)

    window.addEventListener('beforeprint', on)
    window.addEventListener('afterprint', off)
    mql.addEventListener('change', onChange)

    if (mql.matches) setPrinting(true)

    return () => {
      window.removeEventListener('beforeprint', on)
      window.removeEventListener('afterprint', off)
      mql.removeEventListener('change', onChange)
    }
  }, [])

  return printing
}

/** A4 portrait at 96dpi minus 14mm margins, rounded down. */
export const PRINT_CHART_WIDTH = 680
