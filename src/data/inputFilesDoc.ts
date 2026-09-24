export const inputFilesDocumentation = `
## What Input Files Are Required?

This dashboard visualizes GitHub Copilot usage metrics. It requires NDJSON files (newline-delimited JSON) exported from GitHub's Copilot settings.

**File Format:**
- Extensions: .ndjson, .jsonl, or .json
- Structure: One JSON object per line
- Each line represents one user's metrics for one day

## Where to Get Them?

### Option 1: Enterprise Copilot Metrics

1. Go to your GitHub Enterprise Settings
2. Navigate to Copilot → Usage metrics
3. Click the Download export button (exact button name may vary by GitHub version)
4. This exports metrics for all organizations in your enterprise

### Option 2: Organization Copilot Metrics

1. Go to your GitHub Organization Settings
2. Navigate to Copilot → Usage metrics
3. Click the Download export button
4. This exports metrics for that specific organization only

## How to Use the Files

1. Download the NDJSON file(s) from GitHub
2. Open this dashboard
3. Use the upload panel to add your file(s):
   - Drag and drop the file(s), or
   - Click to select file(s) from your computer
4. Multiple files can be combined and analyzed together

All processing happens locally in your browser, no data is sent to external servers.
`.trim();
