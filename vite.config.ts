import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub project Pages serve from /<repo>/, user/org Pages and custom domains from /.
// CI sets BASE_PATH from the repo name; override locally if you deploy elsewhere.
const base = process.env.BASE_PATH ?? '/copilot-dash/'

/**
 * The shipped index.html carries a deliberately strict CSP (connect-src 'none').
 * Vite's dev server needs a websocket and eval for HMR, so relax it for `vite dev`
 * only — the production HTML is never rewritten.
 */
function devCsp(): Plugin {
  return {
    name: 'copilot-dash:dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /content="default-src 'self'; connect-src 'none';[^"]*"/,
        `content="default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'"`,
      )
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), devCsp()],
  build: { outDir: 'dist', sourcemap: false },
})
