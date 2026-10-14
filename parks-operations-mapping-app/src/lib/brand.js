import { modules, portal } from '../data/config'

/*
 * The portal's colour and mark, shared by the login and the sidebar.
 *
 * By default they come from the first module: `accent` is its accentText, the
 * shade check-data.mjs guards at 4.5:1 — which is why it, not the lighter
 * catalog accent, carries text and sits under white labels — and `tint` is
 * the lighter accent, used only for washes.
 *
 * A portal whose first module does not speak for the whole of it sets
 * `portal.login` ({ accent, tint, icon }) instead, and that wins.
 */
export const brand = {
  accent: portal.login?.accent || modules[0]?.accentText,
  tint: portal.login?.tint || modules[0]?.accent,
  icon: portal.login?.icon || modules[0]?.icon || 'map',
}
