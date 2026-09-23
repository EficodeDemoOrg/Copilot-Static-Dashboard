import { useRef, useState, type DragEvent } from 'react'
import type { EntityAliases, FileValidationResult } from '../data/types'

export interface UploadFileItem {
  id: string
  fileName: string
  status: 'validating' | 'validated'
  result?: FileValidationResult
}

interface Props {
  onFiles: (files: File[]) => void
  onSample: () => void
  onRemove: (id: string) => void
  onAliasChange: (type: 'enterprise' | 'organization', id: string, value: string) => void
  onContinue: () => void
  files: UploadFileItem[]
  aliases: EntityAliases
  enterpriseIds: string[]
  organizationIds: string[]
  error?: string
  busy: boolean
}

function FileIds({
  label,
  ids,
  emptyText,
}: {
  label: string
  ids: string[]
  emptyText: string
}) {
  return (
    <div className="upload-file__ids">
      <span>{label}</span>
      {ids.length > 0 ? (
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <code>{id}</code>
            </li>
          ))}
        </ul>
      ) : (
        <span className="upload-file__empty">{emptyText}</span>
      )}
    </div>
  )
}

function FileCard({ item, onRemove }: { item: UploadFileItem; onRemove: (id: string) => void }) {
  const result = item.result
  const state = item.status === 'validating' ? 'validating' : result?.valid ? 'valid' : 'invalid'
  const statusLabel =
    state === 'validating' ? 'Validating' : state === 'valid' ? 'Valid' : 'Invalid'
  const statusIcon = state === 'validating' ? '…' : state === 'valid' ? '✓' : '!'

  return (
    <article className={`upload-file upload-file--${state}`} aria-label={`${item.fileName}: ${statusLabel}`}>
      <header className="upload-file__header">
        <div className="upload-file__title">
          <span className="upload-file__status" aria-label={statusLabel}>
            <span aria-hidden="true">{statusIcon}</span> {statusLabel}
          </span>
          <strong title={item.fileName}>{item.fileName}</strong>
        </div>
        <button className="btn btn--small" onClick={() => onRemove(item.id)} type="button">
          Remove
        </button>
      </header>

      {state === 'validating' ? (
        <p className="upload-file__progress">Reading and validating every record…</p>
      ) : (
        result && (
          <>
            <dl className="upload-file__meta">
              <div>
                <dt>Detected scope</dt>
                <dd>
                  {result.scope === 'organization'
                    ? 'Organization export'
                    : result.scope === 'enterprise'
                      ? 'Enterprise export'
                      : 'Could not determine'}
                </dd>
              </div>
              <div>
                <dt>Recognized records</dt>
                <dd>{result.recordCount.toLocaleString()}</dd>
              </div>
            </dl>

            <div className="upload-file__identity">
              <FileIds
                label="Enterprise IDs"
                ids={result.enterpriseIds}
                emptyText="None found"
              />
              <FileIds
                label="Organization IDs"
                ids={result.organizationIds}
                emptyText={
                  result.scope === 'enterprise' ? 'None (enterprise scope)' : 'None found'
                }
              />
            </div>

            {!result.valid && (
              <div className="upload-file__errors" role="alert">
                <strong>What went wrong</strong>
                <ul>
                  {result.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      )}
    </article>
  )
}

function AliasRows({
  type,
  ids,
  aliases,
  onChange,
}: {
  type: 'enterprise' | 'organization'
  ids: string[]
  aliases: ReadonlyMap<string, string>
  onChange: (type: 'enterprise' | 'organization', id: string, value: string) => void
}) {
  const typeLabel = type === 'enterprise' ? 'Enterprise' : 'Organization'
  return ids.map((id) => (
    <div className="translation__row" key={`${type}:${id}`}>
      <span className="translation__type">{typeLabel}</span>
      <code title={id}>{id}</code>
      <span className="translation__arrow" aria-hidden="true">
        →
      </span>
      <input
        type="text"
        value={aliases.get(id) ?? ''}
        aria-label={`Display name for ${typeLabel.toLowerCase()} ID ${id}`}
        placeholder={`Use ${id}`}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(type, id, event.target.value)}
      />
    </div>
  ))
}

export function UploadPanel({
  onFiles,
  onSample,
  onRemove,
  onAliasChange,
  onContinue,
  files,
  aliases,
  enterpriseIds,
  organizationIds,
  error,
  busy,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const validCount = files.filter((item) => item.result?.valid).length
  const invalidCount = files.filter(
    (item) => item.status === 'validated' && !item.result?.valid,
  ).length

  const accept = (list: FileList | null) => {
    const selected = [...(list ?? [])]
    if (selected.length > 0) onFiles(selected)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setOver(false)
    accept(event.dataTransfer.files)
  }

  return (
    <div
      className={`upload${over ? ' upload--over' : ''}${files.length > 0 ? ' upload--review' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <h2 className="upload__headline">
        {files.length > 0 ? 'Review your Copilot exports' : 'Visualise your Copilot usage'}
      </h2>
      <p className="upload__lede">
        {files.length > 0
          ? 'Review each file, add any other export parts, and optionally name the enterprises and organizations before continuing.'
          : 'Drop your GitHub Copilot usage metrics export here. Each file is validated and stays available for review before any visualizations are created.'}
      </p>

      <div className="upload__actions">
        <button
          className="btn btn--primary"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {files.length > 0 ? 'Add files' : 'Choose files'}
        </button>
        <button className="btn" onClick={onSample} type="button">
          Add sample data
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".ndjson,.jsonl,.json,application/x-ndjson"
        multiple
        hidden
        onChange={(event) => {
          accept(event.target.files)
          event.target.value = ''
        }}
      />

      <p className="upload__privacy">
        Everything happens in this browser tab. Your export is never uploaded, and nothing is
        stored — reload the page and it is gone.
      </p>

      {files.length > 0 && (
        <section className="upload-review" aria-label="Uploaded file validation">
          <div className="upload-files">
            {files.map((item) => (
              <FileCard key={item.id} item={item} onRemove={onRemove} />
            ))}
          </div>

          {(enterpriseIds.length > 0 || organizationIds.length > 0) && (
            <section className="translations" aria-labelledby="translations-heading">
              <div>
                <h3 id="translations-heading">Display names</h3>
                <p>
                  Optional. A blank or whitespace-only value keeps the original ID. These names do
                  not change how records are grouped.
                </p>
              </div>
              <div className="translation-list">
                <AliasRows
                  type="enterprise"
                  ids={enterpriseIds}
                  aliases={aliases.enterprises}
                  onChange={onAliasChange}
                />
                <AliasRows
                  type="organization"
                  ids={organizationIds}
                  aliases={aliases.organizations}
                  onChange={onAliasChange}
                />
              </div>
            </section>
          )}

          {error && (
            <div className="alert" role="alert">
              <strong>Could not prepare the visualizations.</strong> {error}
            </div>
          )}

          <footer className="upload-review__footer">
            <p>
              <strong>
                {validCount.toLocaleString()} valid {validCount === 1 ? 'file' : 'files'}
              </strong>{' '}
              will be used.
              {invalidCount > 0 &&
                ` ${invalidCount.toLocaleString()} invalid ${invalidCount === 1 ? 'file' : 'files'} will be ignored.`}
              {busy && ' Validation is still running.'}
            </p>
            <button
              className="btn btn--primary"
              onClick={onContinue}
              type="button"
              disabled={validCount === 0 || busy}
            >
              Continue to visualizations
            </button>
          </footer>
        </section>
      )}

      {files.length === 0 && error && (
        <div className="alert" role="alert">
          <strong>Could not prepare the visualizations.</strong> {error}
        </div>
      )}

      <p className="upload__columns">
        Expects GitHub's Copilot usage metrics export — newline-delimited JSON, one record per user
        per day. Every record must include <code>day</code>, <code>user_id</code>, and{' '}
        <code>enterprise_id</code>. Organization exports must also include{' '}
        <code>organization_id</code> on every record.
      </p>
    </div>
  )
}
