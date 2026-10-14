/**
 * Loads .env into process.env. server/index.js imports this FIRST.
 *
 * It has to be its own module: ES imports are evaluated before the importing
 * file's body runs, so a loader called from index.js ran only after
 * access-server.js had already read PORTAL_URL and friends — values in .env
 * were silently ignored. Importing this module first fixes that ordering.
 *
 * Kept dependency-free: the file is a handful of KEY=value lines. Real
 * environment variables always win, so a deployment can set them without .env.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile() {
  const file = path.join(ROOT, '.env')
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvFile()

// `npm start` used to set this inline (NODE_ENV=production node ...), which
// cmd.exe cannot parse, so the script failed outright on Windows. This entry
// point only ever serves a production build, so production is the default.
process.env.NODE_ENV ||= 'production'
