import type { Adapter } from '../types'
import { usageMetricsAdapter } from './usageMetrics'

/**
 * Registry of supported Copilot export shapes, tried in order against the first
 * parsed record of an upload. Adding another format means adding an adapter
 * module and listing it here — nothing downstream changes.
 */
export const adapters: Adapter[] = [usageMetricsAdapter]

export function detectAdapter(sample: unknown): Adapter | undefined {
  return adapters.find((a) => a.matches(sample))
}

export { usageMetricsAdapter }
