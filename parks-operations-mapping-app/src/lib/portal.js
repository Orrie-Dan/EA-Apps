/**
 * Turns a portal application URL into one served through this portal's proxy.
 *
 * The dashboards cannot be framed directly: they are privately shared, so an
 * iframe pointed at gis.rdb.rw has no way to authenticate — a cross-origin
 * frame is sealed to us. Routing through /api/portal/gh makes the frame
 * same-origin, and the server attaches the signed-in user's portal token.
 */
import { APP_BASE_PATH } from '../config/application.js'
/*
 * MUST match PORTAL_URL in .env — this is the client half of the same setting.
 * The browser bundle cannot read .env (nothing here is VITE_-prefixed, by
 * design, so no server config leaks to the page), so the origin is repeated
 * here. If one moves and the other does not, embedUrl() stops rewriting and
 * every dashboard silently loads cross-origin and is refused.
 *
 * This portal's content lives on RDB's ArcGIS Enterprise, not on GeoHub.
 */
export const PORTAL_ORIGIN = 'https://gis.rdb.rw/portal'
export const PROXY_BASE = '/api/portal/gh'

export function embedUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(PORTAL_ORIGIN)) return url
  return PROXY_BASE + url.slice(PORTAL_ORIGIN.length)
}

/*
 * Survey123 forms, framed through this portal too.
 *
 * MUST match FORMS_URL / FORMS_PROXY_BASE in server/access-server.js, for the
 * same reason PORTAL_ORIGIN is repeated above: the browser bundle cannot read
 * .env, so the client half of the setting is written here.
 */
export const FORMS_ORIGIN = 'https://survey123.arcgis.com'
export const FORMS_PROXY_BASE = '/api/forms'

/** The origin the page is served from, which the form must be told about. */
function pageOrigin() {
  return typeof window !== 'undefined' && window.location ? window.location.origin : ''
}

/**
 * Turn a Survey123 share URL into one served through this portal's proxy.
 *
 * Two things have to happen, and neither is optional:
 *
 *  1. The form is framed at FORMS_PROXY_BASE so it is same-origin. Framed at
 *     survey123.arcgis.com it is sealed to us, and although the form ITEM is
 *     public, the feature layer it submits to is not — so ArcGIS Identity
 *     Manager prompts for a sign-in inside the frame.
 *  2. `portalUrl` is REPLACED. Survey123 reads it from its own query string and
 *     addresses the portal with it, so it must point at our portal proxy rather
 *     than straight at gis.rdb.rw; that is what routes the form's portal calls
 *     back through this origin, where the session token is attached. It must be
 *     absolute — a relative value is not accepted.
 *
 * Whatever portalUrl the catalog URL carried is dropped: it names the upstream
 * for a human reading the catalog, and PORTAL_ORIGIN is what actually decides
 * where the proxy points.
 *
 * NOTE: forms only work over https. Survey123 forces https on the portal URL,
 * so under `npm run start:local` (HTTP_ONLY=1) its very first portal calls go
 * to an https port with no listener and the form dies. Use `npm start`, which
 * serves TLS from .certs.
 */
export function formEmbedUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(FORMS_ORIGIN)) return null
  const path = url.slice(FORMS_ORIGIN.length).split('?')[0]
  const portalUrl = `${pageOrigin()}${APP_BASE_PATH}${PROXY_BASE}`
  return `${FORMS_PROXY_BASE}${path}?portalUrl=${encodeURIComponent(portalUrl)}`
}
