// Asserts the portal's displayed content matches the source spreadsheet.
// Runs inside `npm run build`, so the UI can never silently drift from the data.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { modules, totals, leafApps, leafForms } from '../src/data/modules.js'
import { manifest } from '../src/config/image-manifest.js'

const EXPECTED = { modules: 1, apps: 9, forms: 9, features: 10 }

/*
 * Per-module expected counts.
 *
 * Applications are counted as LEAVES, so a group label never inflates the
 * total. The spreadsheet lists this module's park operations as one entry,
 * being one Experience Builder app; it is published here as the four dashboards
 * that app navigated to, which is the same content addressed one level down.
 * The feature list is untouched — the spreadsheet records features per module,
 * not per application.
 *
 * Wildlife Conservation Mapping arrived from the Conservation portal as a
 * single entry; it is published here as the five dashboards it actually covers.
 * So nine applications under two groups, where the spreadsheet lists two.
 */
const PER_MODULE = {
  parks: { apps: 9, forms: 9, features: 10 },
}
// This portal's applications live on RDB's ArcGIS Enterprise, not on GeoHub.
// Must agree with PORTAL_URL in .env and PORTAL_ORIGIN in src/lib/portal.js.
const PORTAL_HOST = 'https://gis.rdb.rw/'
/*
 * Survey123 forms are the one thing here NOT served from the portal host, so
 * they get their own rule rather than a hole in the one above.
 *
 * `portalUrl` is required in the CATALOG so the entry says, to anyone reading
 * it, which Enterprise the form belongs to. It is not what the browser uses:
 * formEmbedUrl() replaces it with this origin's own portal proxy, which is what
 * routes the form's portal calls somewhere the session token is attached.
 */
const FORM_HOST = 'https://survey123.arcgis.com/share/'
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
if (totals.forms !== EXPECTED.forms)
  failures.push(`forms: expected ${EXPECTED.forms}, got ${totals.forms}`)
if (totals.features !== EXPECTED.features)
  failures.push(`features: expected ${EXPECTED.features}, got ${totals.features}`)

for (const m of modules) {
  const apps = leafApps(m)

  if (!m.features.length) failures.push(`${m.id}: no features`)
  if (!apps.length) failures.push(`${m.id}: no applications`)

  const expected = PER_MODULE[m.id]
  if (!expected) {
    failures.push(`${m.id}: unexpected module id, not in PER_MODULE`)
  } else {
    if (apps.length !== expected.apps)
      failures.push(`${m.id}: expected ${expected.apps} applications, got ${apps.length}`)
    const forms = leafForms(m).length
    if (forms !== expected.forms)
      failures.push(`${m.id}: expected ${expected.forms} forms, got ${forms}`)
    if (m.features.length !== expected.features)
      failures.push(`${m.id}: expected ${expected.features} features, got ${m.features.length}`)
  }

  const ratio = contrast(m.accentText, GROUND)
  if (ratio < 4.5)
    failures.push(
      `${m.id}: accentText ${m.accentText} is ${ratio.toFixed(2)}:1 on ${GROUND}, needs 4.5:1`,
    )

  /*
   * A group is a label over other applications, so it must look like one:
   * a name, children, and NO url of its own. A group that kept a url would be
   * embedded as a fifth row alongside the dashboards it is meant to head.
   */
  for (const app of m.apps) {
    if (!app.apps) continue
    if (!app.name) failures.push(`${m.id}: a group has no name`)
    if (app.url) failures.push(`${m.id}: group "${app.name}" carries a url; groups do not open`)
    if (!app.apps.length) failures.push(`${m.id}: group "${app.name}" has no applications`)
  }

  for (const app of apps) {
    if (!app.url || !app.url.startsWith(PORTAL_HOST))
      failures.push(`${m.id}: "${app.name}" url is not an absolute ${PORTAL_HOST} https URL`)

    if (!app.form) continue
    if (!app.form.name)
      failures.push(`${m.id}: "${app.name}" form has no name of its own`)
    if (!app.form.url || !app.form.url.startsWith(FORM_HOST))
      failures.push(`${m.id}: "${app.name}" form is not a ${FORM_HOST} URL`)
    else if (!app.form.url.includes(`portalUrl=${PORTAL_HOST}portal`))
      failures.push(`${m.id}: "${app.name}" form is missing portalUrl=${PORTAL_HOST}portal`)
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
  `check-data OK: ${totals.modules} module, ${totals.apps} applications, ` +
    `${totals.forms} forms, ${totals.features} features`,
)
