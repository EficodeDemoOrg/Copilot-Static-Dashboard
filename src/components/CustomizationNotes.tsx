import {
  CUSTOMIZATION_COVERAGE_NOTE,
  CUSTOMIZATION_DOCS_URL,
  CUSTOMIZATION_LABEL_NOTE,
} from '../data/customizations'

export function CustomizationNotes() {
  return (
    <div className="customization-notes">
      <p>{CUSTOMIZATION_COVERAGE_NOTE} {CUSTOMIZATION_LABEL_NOTE}</p>
      <p>
        MCP counts connection attempts, not tool calls. Plugin skill invocations are already
        included in skill counts; do not add them together.{' '}
        <a href={CUSTOMIZATION_DOCS_URL} target="_blank" rel="noreferrer">GitHub metric definitions</a>
      </p>
    </div>
  )
}
