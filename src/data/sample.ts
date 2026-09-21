// Synthetic data — invented logins, no real users or organisations. Bundled
// rather than fetched so the page keeps `connect-src 'none'` and makes no
// network request at all.
import ndjson from './sample.ndjson?raw'

export const SAMPLE_NDJSON = ndjson
export const SAMPLE_FILE_NAME = 'copilot-usage-metrics-sample.ndjson'
