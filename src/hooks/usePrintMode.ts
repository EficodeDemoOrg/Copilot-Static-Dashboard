import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'

const PrintModeContext = createContext(false)

/**
 * True while the page is being laid out for print.
 *
 * Recharts' ResponsiveContainer measures via ResizeObserver, which does not fire
 * during print layout — charts end up 0x0 or at screen width in the PDF. Charts
 * therefore switch to an explicit pixel size while this is true.
 *
 * One provider owns the browser listeners so every chart and print-only report
 * switches in the same render. `beforeprint` is flushed synchronously because
 * the browser may capture print layout before a normal React state update lands.
 */
export function PrintModeProvider({ children }: { children: ReactNode }) {
  const [printing, setPrinting] = useState(() => window.matchMedia('print').matches)

  useEffect(() => {
    const mql = window.matchMedia('print')

    const on = () => {
      flushSync(() => setPrinting(true))
    }
    const off = () => setPrinting(false)
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) on()
      else off()
    }

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

  return createElement(PrintModeContext.Provider, { value: printing }, children)
}

export function usePrintMode(): boolean {
  return useContext(PrintModeContext)
}

/** A4 portrait at 96dpi minus 14mm page margins and the chart card's border/padding. */
export const PRINT_CHART_WIDTH = 646
