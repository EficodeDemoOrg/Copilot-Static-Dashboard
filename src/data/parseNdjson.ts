import { adapters, detectAdapter } from './adapters'
import { organizationGroupKey } from './organizationGroups'
import type { Dataset, ReportWindow, UserDay } from './types'

export class ReportFormatError extends Error {
  constructor(
    message: string,
    readonly sampleKeys: string[],
  ) {
    super(message)
    this.name = 'ReportFormatError'
  }
}

interface FileResult {
  records: UserDay[]
  reportWindow?: ReportWindow
  malformedLines: number
  skippedRecords: number
  adapterId: string
}

/**
 * Parsed on the main thread: the page's CSP forbids blob workers, and the export
 * is line-delimited so there is no streaming parser to gain from anyway. If real
 * multi-part uploads ever freeze the UI, the CSP-compatible upgrade is a module
 * worker — `new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })`
 * — which Vite emits as a real same-origin file that `default-src 'self'` permits.
 */
function parseOneFile(text: string): FileResult {
  const lines = text.split('\n')

  // Detection runs against the first line that parses at all, so a stray blank
  // or truncated leading line does not misidentify an otherwise valid file.
  let sample: unknown
  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue
    try {
      sample = JSON.parse(t)
      break
    } catch {
      continue
    }
  }

  if (sample === undefined) {
    throw new ReportFormatError('No valid JSON found — is this a line-delimited JSON (.ndjson) file?', [])
  }

  const adapter = detectAdapter(sample)
  if (!adapter) {
    const expected = adapters.map((a) => `${a.label} (${a.requiredFields.join(', ')})`).join('; ')
    const keys = typeof sample === 'object' && sample !== null ? Object.keys(sample) : []
    throw new ReportFormatError(`Unrecognised format. Expected ${expected}.`, keys)
  }

  const records: UserDay[] = []
  let malformedLines = 0
  let skippedRecords = 0
  let reportWindow: ReportWindow | undefined

  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue

    let obj: unknown
    try {
      obj = JSON.parse(t)
    } catch {
      // One bad line must never cost the whole upload; count it and move on.
      malformedLines++
      continue
    }

    const record = adapter.toUserDay(obj)
    if (!record) {
      skippedRecords++
      continue
    }
    records.push(record)
    reportWindow ??= adapter.reportWindow(obj)
  }

  return { records, reportWindow, malformedLines, skippedRecords, adapterId: adapter.id }
}

/** Widen `into` to also cover `next`. Part files all carry the same window, but merged exports may not. */
function unionWindow(into: ReportWindow | undefined, next: ReportWindow | undefined): ReportWindow | undefined {
  if (!next) return into
  if (!into) return next
  return {
    start: next.start < into.start ? next.start : into.start,
    end: next.end > into.end ? next.end : into.end,
  }
}

export function parseNdjsonText(text: string, fileName: string): Dataset {
  return mergeResults([{ fileName, result: parseOneFile(text) }])
}

export async function parseFiles(files: File[]): Promise<Dataset> {
  const parsed: { fileName: string; result: FileResult }[] = []

  for (const file of files) {
    // text() keeps the bytes in this tab. Nothing is uploaded anywhere.
    parsed.push({ fileName: file.name, result: parseOneFile(await file.text()) })
  }

  return mergeResults(parsed)
}

function mergeResults(parsed: { fileName: string; result: FileResult }[]): Dataset {
  const adapter = adapters.find((a) => a.id === parsed[0]!.result.adapterId)!

  // Exports arrive as Spark part files; the same group/user/day can appear in
  // more than one if the user re-selects a file or the parts overlap. Group
  // identity is part of the key because one GitHub user can belong to multiple
  // organizations represented in a merged export.
  const byKey = new Map<string, UserDay>()
  let duplicates = 0
  let malformedLines = 0
  let skippedRecords = 0
  let reportWindow: ReportWindow | undefined

  for (const { result } of parsed) {
    malformedLines += result.malformedLines
    skippedRecords += result.skippedRecords
    reportWindow = unionWindow(reportWindow, result.reportWindow)

    for (const r of result.records) {
      const key = `${organizationGroupKey(r.enterpriseId, r.organizationId)}|${r.userId}|${r.day}`
      if (byKey.has(key)) {
        duplicates++
        continue
      }
      byKey.set(key, r)
    }
  }

  const records = [...byKey.values()]
  if (records.length === 0) {
    throw new ReportFormatError(
      `${adapter.label} recognised, but no usable records were found — every record was missing a day or a user.`,
      [],
    )
  }

  const warnings: string[] = []
  const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`
  if (duplicates > 0) {
    warnings.push(
      `${plural(duplicates, 'duplicate record')} dropped (same enterprise, organization, user, and day seen more than once).`,
    )
  }
  if (malformedLines > 0) {
    warnings.push(`${plural(malformedLines, 'line')} could not be parsed as JSON and ${malformedLines === 1 ? 'was' : 'were'} ignored.`)
  }
  if (skippedRecords > 0) {
    warnings.push(`${plural(skippedRecords, 'record')} skipped — missing a day or a user.`)
  }

  return {
    records,
    fileNames: parsed.map((p) => p.fileName),
    adapterId: adapter.id,
    adapterLabel: adapter.label,
    reportWindow,
    warnings,
  }
}
