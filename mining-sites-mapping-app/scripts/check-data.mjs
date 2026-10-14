// Asserts the portal's displayed content matches the source spreadsheet.
// Runs inside `npm run build`, so the UI can never silently drift from the data.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { modules, totals } from '../src/data/modules.js'
import { manifest } from '../src/config/image-manifest.js'

const EXPECTED = { modules: 1, apps: 2, features: 8 }

// Per-module expected counts, transcribed from the source spreadsheet.
const PER_MODULE = {
  mining: { apps: 2, features: 8 },
}
const GROUND = '#FBFAF7'
const failures = []

const srgb = (c) => {
  c /= 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

if (totals.modules !== EXPECTED.modules)
  failures.push(`modules: expected ${EXPECTED.modules}, got ${totals.modules}`)
if (totals.apps !== EXPECTED.apps)
  failures.push(`applications: expected ${EXPECTED.apps}, got ${totals.apps}`)
if (totals.features !== EXPECTED.features)
  failures.push(`features: expected ${EXPECTED.features}, got ${totals.features}`)

for (const m of modules) {
  if (!m.features.length) failures.push(`${m.id}: no features`)
  if (!m.apps.length) failures.push(`${m.id}: no applications`)

  const expected = PER_MODULE[m.id]
  if (!expected) {
    failures.push(`${m.id}: unexpected module id, not in PER_MODULE`)
  } else {
    if (m.apps.length !== expected.apps)
      failures.push(`${m.id}: expected ${expected.apps} applications, got ${m.apps.length}`)
    if (m.features.length !== expected.features)
      failures.push(`${m.id}: expected ${expected.features} features, got ${m.features.length}`)
  }

  const ratio = contrast(m.accentText, GROUND)
  if (ratio < 4.5)
    failures.push(
      `${m.id}: accentText ${m.accentText} is ${ratio.toFixed(2)}:1 on ${GROUND}, needs 4.5:1`,
    )

  for (const app of m.apps) {
    if (!app.url.startsWith('https://gh.space.gov.rw/'))
      failures.push(`${m.id}: "${app.name}" url is not an absolute GeoHub https URL`)
  }
}

/*
 * Every image slug must resolve, and the files must actually be on disk.
 *
 * srcSet() throws on an unknown slug, and it is called while src/data/config.js
 * is still initialising — so a missing slug is not a broken picture, it is a
 * blank portal. `vite build` does not catch it either: the bundler never
 * executes the module, so the build goes green and the failure only appears in
 * the browser. This portal was split out of a combined one and its manifest was
 * briefly emptied in the process; the build passed and every page was dead.
 */
const IMAGES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images')
for (const m of modules) {
  for (const slug of [m.cardSlug, m.heroSlug]) {
    const widths = manifest[slug]
    if (!widths || !widths.length) {
      failures.push(`${m.id}: image slug "${slug}" is missing from image-manifest.js`)
      continue
    }
    for (const w of widths) {
      const file = path.join(IMAGES, `${slug}-${w}.webp`)
      if (!fs.existsSync(file))
        failures.push(`${m.id}: ${slug}-${w}.webp is in the manifest but not in public/images/`)
    }
  }
}

if (failures.length) {
  console.error('check-data FAILED:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}
console.log(
  `check-data OK: ${totals.modules} module, ${totals.apps} applications, ${totals.features} features`,
)
