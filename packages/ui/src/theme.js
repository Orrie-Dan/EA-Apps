/**
 * Per-app colour. An app gives one accent; styles.css derives the sidebar,
 * button and focus shades from it. An app that already has a tuned palette
 * may pin any shade exactly.
 *
 * @typedef {object} ShellTheme
 * @property {string} accent        Main brand colour (text-safe on white).
 * @property {string} [mid]         Icons in the sidebar.
 * @property {string} [soft]        Borders.
 * @property {string} [tint]        Hover/toggle washes.
 * @property {string} [activeFill]  Active sidebar row background.
 * @property {string} [activeText]  Active sidebar row text.
 */

const VARS = {
  accent: '--brand',
  mid: '--brand-mid',
  soft: '--brand-soft',
  tint: '--brand-tint',
  activeFill: '--brand-active-fill',
  activeText: '--brand-active-text',
}

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i

/**
 * Sets the theme's CSS variables on `el`; returns a function that removes them.
 * Values that are not plain colours are ignored, so config can never inject CSS.
 */
export function applyTheme(el, theme) {
  const set = []
  for (const [key, name] of Object.entries(VARS)) {
    const value = theme?.[key]
    if (typeof value === 'string' && COLOR.test(value.trim())) {
      el.style.setProperty(name, value.trim())
      set.push(name)
    }
  }
  return () => set.forEach((name) => el.style.removeProperty(name))
}
