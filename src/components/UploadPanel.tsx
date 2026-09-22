import { useRef, useState, type DragEvent } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  onSample: () => void
  error?: string
  busy: boolean
}

export function UploadPanel({ onFiles, onSample, error, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const accept = (list: FileList | null) => {
    const files = [...(list ?? [])]
    if (files.length > 0) onFiles(files)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    accept(e.dataTransfer.files)
  }

  return (
    <div
      className={`upload${over ? ' upload--over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <h2 className="upload__headline">Visualise your Copilot usage</h2>
      <p className="upload__lede">
        Drop your GitHub Copilot usage metrics export here to see how Copilot is actually being used,
        then export the result as a PDF. Exports arrive split into several <code>part-…</code> files —
        select them all at once and they are merged.
      </p>

      <div className="upload__actions">
        <button className="btn btn--primary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Reading…' : 'Upload export'}
        </button>
        <button className="btn" onClick={onSample} disabled={busy}>
          Try with sample data
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".ndjson,.jsonl,.json,application/x-ndjson"
        multiple
        hidden
        onChange={(e) => {
          accept(e.target.files)
          // Reset so re-picking the same files fires change again.
          e.target.value = ''
        }}
      />

      <p className="upload__privacy">
        Everything happens in this browser tab. Your export is never uploaded, and nothing is stored —
        reload the page and it is gone.
      </p>

      {error && (
        <div className="alert" role="alert">
          <strong>Could not read that export.</strong> {error}
        </div>
      )}

      <p className="upload__columns">
        Expects GitHub's Copilot usage metrics export — newline-delimited JSON, one record per user per
        day, with at least <code>day</code> and <code>user_id</code>. Download it from your
        enterprise or organization Copilot settings.
      </p>
    </div>
  )
}
