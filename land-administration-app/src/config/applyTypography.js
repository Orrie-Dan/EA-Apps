/**
 * Shared typography from Runtime Config (`branding.typography`).
 *
 * The runtime-config-service merges the `shared-theme` default under each
 * app's own values. Each role/property becomes a CSS custom property
 * (`--type-<role>-<prop>`) that index.css reads; the :root block in index.css
 * holds the Infrastructure values used when the config sets nothing.
 *
 * Same value rules as the service (src/config/typography.ts) — anything else
 * is ignored so config can never inject arbitrary CSS.
 */

const ROLES = {
  body: ['size', 'lineHeight'],
  sidebarBrand: ['size', 'weight'],
  navGroup: ['size', 'weight'],
  navItem: ['size', 'weight', 'activeWeight'],
  sidebarAction: ['size', 'weight'],
  eyebrow: ['size', 'weight'],
  button: ['size', 'weight'],
  loginTitle: ['size', 'weight'],
}

const LENGTH = String.raw`\d+(?:\.\d+)?(?:px|rem|em|vw)`
const SIZE = new RegExp(
  String.raw`^(?:${LENGTH}|clamp\(\s*${LENGTH}\s*,\s*${LENGTH}\s*,\s*${LENGTH}\s*\))$`,
)
const LINE_HEIGHT = /^(?:\d+(?:\.\d+)?|\d+(?:\.\d+)?(?:px|rem|em))$/
const FONT_FAMILY = /^[A-Za-z0-9 ,'"-]{1,200}$/

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cssValue(prop, value) {
  if (prop === 'size') {
    return typeof value === 'string' && SIZE.test(value.trim()) ? value.trim() : null
  }
  if (prop === 'weight' || prop === 'activeWeight') {
    const n = typeof value === 'string' ? Number(value) : value
    return Number.isInteger(n) && n >= 100 && n <= 900 ? String(n) : null
  }
  const text = typeof value === 'number' ? String(value) : value
  return typeof text === 'string' && LINE_HEIGHT.test(text.trim()) ? text.trim() : null
}

/** `{ navItem: { size: '12px' } }` → `{ '--type-nav-item-size': '12px' }` (invalid values dropped). */
export function typographyToCssVars(typography) {
  const vars = {}
  if (!isPlainObject(typography)) return vars

  const family = typography.fontFamily
  if (typeof family === 'string' && FONT_FAMILY.test(family.trim())) {
    vars['--type-font-family'] = family.trim()
  }
  for (const [role, props] of Object.entries(ROLES)) {
    const values = typography[role]
    if (!isPlainObject(values)) continue
    for (const prop of props) {
      if (!(prop in values)) continue
      const value = cssValue(prop, values[prop])
      if (value !== null) vars[`--type-${kebab(role)}-${kebab(prop)}`] = value
    }
  }
  return vars
}

const applied = new WeakMap()

/** Set the typography variables on `root`, clearing ones a previous call set. */
export function applyTypography(typography, root = document.documentElement) {
  const vars = typographyToCssVars(typography)
  for (const name of applied.get(root) ?? []) {
    if (!(name in vars)) root.style.removeProperty(name)
  }
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
  applied.set(root, Object.keys(vars))
}
