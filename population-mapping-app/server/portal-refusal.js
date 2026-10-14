/**
 * Stops ArcGIS Dashboards from retrying an item the signed-in user may not see.
 *
 * The portal refuses such an item with an error body of code 403 (GWM_0003).
 * The ArcGIS IdentityManager reads 403 as "credentials needed", re-acquires the
 * token it already holds and repeats the request: dozens of identical calls a
 * second, a spinner that never resolves and a frozen tab. The proxy always
 * attaches a token, so a 403 here means "not shared with you", which signing in
 * again cannot change. Reporting it as 400 (the code the portal uses for an
 * inaccessible item, CONT_0001) makes Dashboards show its error page instead.
 * The portal's message and messageCode are kept so the real reason is visible.
 */

// Error bodies are tiny; never parse a real payload looking for one.
const MAX_ERROR_BODY = 4096

export function softenPermissionRefusal(text, tokenAttached) {
  if (!tokenAttached || typeof text !== 'string' || text.length > MAX_ERROR_BODY) return text
  if (!/^\s*\{\s*"error"/.test(text)) return text
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return text
  }
  if (Number(body?.error?.code) !== 403) return text
  body.error.code = 400
  return JSON.stringify(body)
}
