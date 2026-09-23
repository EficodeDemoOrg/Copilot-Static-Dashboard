import { adapters, detectAdapter } from './adapters'
import { emptyEntityAliases, normalizeEntityAliases } from './entityAliases'
import { organizationGroupKey } from './organizationGroups'
import type {
  Adapter,
  Dataset,
  EntityAliases,
  FileScope,
  FileValidationResult,
  ReportWindow,
  UserDay,
} from './types'

export class ReportFormatError extends Error {
  constructor(
    message: string,
    readonly sampleKeys: string[],
  ) {
    super(message)
    this.name = 'ReportFormatError'
  }
}

interface ParsedLine {
  lineNumber: number
  value?: unknown
  malformed: boolean
}

interface MergeableFile {
  fileName: string
  records: UserDay[]
  reportWindow?: ReportWindow
  adapterId: string
}

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const identityValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const sorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b))

const lineSummary = (lineNumbers: number[]): string => {
  const shown = lineNumbers.slice(0, 5).join(', ')
  const remaining = lineNumbers.length - 5
  return `line${lineNumbers.length === 1 ? '' : 's'} ${shown}${remaining > 0 ? ` and ${remaining} more` : ''}`
}

const plural = (count: number, singular: string): string =>
  `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`

/** Widen `into` to also cover `next`. */
function unionWindow(
  into: ReportWindow | undefined,
  next: ReportWindow | undefined,
): ReportWindow | undefined {
  if (!next) return into
  if (!into) return next
  return {
    start: next.start < into.start ? next.start : into.start,
    end: next.end > into.end ? next.end : into.end,
  }
}

function idsFromParsedLines(lines: ParsedLine[]): {
  enterpriseIds: string[]
  organizationIds: string[]
} {
  const enterpriseIds: string[] = []
  const organizationIds: string[] = []
  for (const { value } of lines) {
    if (!isObject(value)) continue
    const enterpriseId = identityValue(value['enterprise_id'])
    const organizationId = identityValue(value['organization_id'])
    if (enterpriseId) enterpriseIds.push(enterpriseId)
    if (organizationId) organizationIds.push(organizationId)
  }
  return {
    enterpriseIds: sorted(enterpriseIds),
    organizationIds: sorted(organizationIds),
  }
}

function unrecognizedFormatIssue(lines: ParsedLine[]): string {
  const expected = adapters
    .map((adapter) => `${adapter.label} (${adapter.requiredFields.join(', ')})`)
    .join('; ')
  const sample = lines.find(({ value }) => isObject(value))?.value
  const keys = isObject(sample) ? Object.keys(sample).slice(0, 12) : []
  return `Unrecognised content. Expected ${expected}.${keys.length > 0 ? ` Fields found: ${keys.join(', ')}.` : ''}`
}

function invalidResult(
  fileName: string,
  issues: string[],
  overrides: Partial<FileValidationResult> = {},
): FileValidationResult {
  return {
    fileName,
    valid: false,
    recordCount: 0,
    enterpriseIds: [],
    organizationIds: [],
    issues,
    records: [],
    ...overrides,
  }
}

/**
 * Validate one NDJSON document in full. File extensions are deliberately not
 * consulted: syntax and record content determine whether the file is usable.
 */
export function validateNdjsonText(text: string, fileName: string): FileValidationResult {
  const parsedLines: ParsedLine[] = []
  const malformedLines: number[] = []

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      parsedLines.push({ lineNumber: index + 1, value: JSON.parse(trimmed), malformed: false })
    } catch {
      malformedLines.push(index + 1)
      parsedLines.push({ lineNumber: index + 1, malformed: true })
    }
  }

  if (parsedLines.length === 0) {
    return invalidResult(fileName, [
      'The file is empty. Expected newline-delimited JSON with one usage record per line.',
    ])
  }

  const discoveredIds = idsFromParsedLines(parsedLines)
  const adapter = parsedLines.reduce<Adapter | undefined>(
    (found, line) => found ?? detectAdapter(line.value),
    undefined,
  )
  const issues: string[] = []

  if (malformedLines.length > 0) {
    issues.push(`Invalid JSON on ${lineSummary(malformedLines)}.`)
  }

  if (!adapter) {
    issues.push(unrecognizedFormatIssue(parsedLines))
    return invalidResult(fileName, issues, discoveredIds)
  }

  const records: UserDay[] = []
  const invalidRecordLines: number[] = []
  const missingEnterpriseLines: number[] = []
  const organizationLines: number[] = []
  const noOrganizationLines: number[] = []
  const invalidOrganizationLines: number[] = []
  let reportWindow: ReportWindow | undefined

  for (const line of parsedLines) {
    if (line.malformed) continue
    if (!adapter.matches(line.value)) {
      invalidRecordLines.push(line.lineNumber)
      continue
    }

    const record = adapter.toUserDay(line.value)
    if (!record) {
      invalidRecordLines.push(line.lineNumber)
      continue
    }

    records.push(record)
    reportWindow = unionWindow(reportWindow, adapter.reportWindow(line.value))
    if (!record.enterpriseId) missingEnterpriseLines.push(line.lineNumber)

    if (record.organizationId) organizationLines.push(line.lineNumber)
    else if (isObject(line.value) && Object.hasOwn(line.value, 'organization_id')) {
      invalidOrganizationLines.push(line.lineNumber)
    } else noOrganizationLines.push(line.lineNumber)
  }

  if (invalidRecordLines.length > 0) {
    issues.push(
      `Unusable usage record on ${lineSummary(invalidRecordLines)}. Every record needs a valid day and numeric user_id.`,
    )
  }
  if (missingEnterpriseLines.length > 0) {
    issues.push(`Missing enterprise_id on ${lineSummary(missingEnterpriseLines)}.`)
  }
  if (invalidOrganizationLines.length > 0) {
    issues.push(
      `Invalid organization_id on ${lineSummary(invalidOrganizationLines)}. Remove the field for an enterprise export or provide a non-empty ID.`,
    )
  }
  if (organizationLines.length > 0 && noOrganizationLines.length > 0) {
    issues.push(
      `Mixed export scope: organization_id is missing on ${lineSummary(noOrganizationLines)} but present on other records.`,
    )
  }

  let scope: FileScope | undefined
  if (missingEnterpriseLines.length === 0 && invalidOrganizationLines.length === 0) {
    if (records.length > 0 && organizationLines.length === records.length) scope = 'organization'
    if (records.length > 0 && noOrganizationLines.length === records.length) scope = 'enterprise'
  }

  const valid = issues.length === 0 && records.length > 0
  return {
    fileName,
    valid,
    scope,
    recordCount: records.length,
    enterpriseIds: discoveredIds.enterpriseIds,
    organizationIds: discoveredIds.organizationIds,
    issues,
    records: valid ? records : [],
    reportWindow,
    adapterId: adapter.id,
    adapterLabel: adapter.label,
  }
}

export async function validateFile(file: File): Promise<FileValidationResult> {
  try {
    return validateNdjsonText(await file.text(), file.name)
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : ''
    return invalidResult(file.name, [`The file could not be read.${detail}`])
  }
}

export function parseNdjsonText(text: string, fileName: string): Dataset {
  const result = validateNdjsonText(text, fileName)
  if (!result.valid) throw new ReportFormatError(result.issues.join(' '), [])
  return mergeValidatedFiles([result])
}

export async function parseFiles(files: File[]): Promise<Dataset> {
  const results: FileValidationResult[] = []
  for (const file of files) results.push(await validateFile(file))

  const invalid = results.filter((result) => !result.valid)
  if (invalid.length > 0) {
    throw new ReportFormatError(
      invalid.map((result) => `${result.fileName}: ${result.issues.join(' ')}`).join(' '),
      [],
    )
  }
  return mergeValidatedFiles(results)
}

export function mergeValidatedFiles(
  results: FileValidationResult[],
  aliases: EntityAliases = emptyEntityAliases(),
): Dataset {
  const validResults = results.filter(
    (result): result is FileValidationResult & { adapterId: string } =>
      result.valid && result.adapterId !== undefined,
  )
  if (validResults.length === 0) {
    throw new ReportFormatError('No valid files are available to visualize.', [])
  }

  const adapterIds = new Set(validResults.map((result) => result.adapterId))
  if (adapterIds.size !== 1) {
    throw new ReportFormatError('Valid files use incompatible report formats and cannot be merged.', [])
  }

  const enterpriseIds = new Set(validResults.flatMap((result) => result.enterpriseIds))
  const organizationIds = new Set(validResults.flatMap((result) => result.organizationIds))
  return mergeResults(
    validResults.map((result) => ({
      fileName: result.fileName,
      records: result.records,
      reportWindow: result.reportWindow,
      adapterId: result.adapterId,
    })),
    normalizeEntityAliases(aliases, enterpriseIds, organizationIds),
  )
}

function mergeResults(parsed: MergeableFile[], aliases: EntityAliases): Dataset {
  const adapter = adapters.find((candidate) => candidate.id === parsed[0]!.adapterId)!
  const byKey = new Map<string, UserDay>()
  let duplicates = 0
  let reportWindow: ReportWindow | undefined

  for (const file of parsed) {
    reportWindow = unionWindow(reportWindow, file.reportWindow)
    for (const record of file.records) {
      const key = `${organizationGroupKey(record.enterpriseId, record.organizationId)}|${record.userId}|${record.day}`
      if (byKey.has(key)) {
        duplicates++
        continue
      }
      byKey.set(key, record)
    }
  }

  const records = [...byKey.values()]
  if (records.length === 0) {
    throw new ReportFormatError(`${adapter.label} recognized, but no usable records were found.`, [])
  }

  const warnings: string[] = []
  if (duplicates > 0) {
    warnings.push(
      `${plural(duplicates, 'duplicate record')} dropped (same enterprise, organization, user, and day seen more than once).`,
    )
  }

  return {
    records,
    fileNames: parsed.map((file) => file.fileName),
    adapterId: adapter.id,
    adapterLabel: adapter.label,
    reportWindow,
    warnings,
    aliases,
  }
}
