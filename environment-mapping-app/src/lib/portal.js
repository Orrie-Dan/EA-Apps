/**
 * Turns a portal application URL into one served through this portal's proxy.
 *
 * The dashboards cannot be framed directly: they are privately shared, so an
 * iframe pointed at gh.space.gov.rw has no way to authenticate — a cross-origin
 * frame is sealed to us. Routing through /api/portal/gh makes the frame
 * same-origin, and the server attaches the signed-in user's portal token.
 */
import { APP_BASE_PATH } from '../config/application.js'
export const PORTAL_ORIGIN = 'https://gh.space.gov.rw/portal'
export const PROXY_BASE = '/api/portal/gh'

/*
 * The Ministry of Environment's Enterprise, proxied like GeoHub.
 *
 * Framed directly, its private apps showed ArcGIS's own "Please sign in"
 * prompt. Through /api/portal/moe the access server attaches the `moe` token
 * the Runtime Config broker issues from its MoE credential (MUST match
 * MOE_PROXY_BASE in server/access-server.js).
 */
export const MOE_PORTAL_ORIGIN = 'https://moegis.environment.gov.rw/portal'
export const MOE_PROXY_BASE = '/api/portal/moe'

/**
 * Where a catalog URL is framed from, or null when it cannot be framed at all —
 * config.js drops a solution with no embedUrl rather than show a refused frame.
 */
export function embedUrl(url) {
  if (typeof url !== 'string') return null
  if (url.startsWith(PORTAL_ORIGIN)) return PROXY_BASE + url.slice(PORTAL_ORIGIN.length)
  if (url.startsWith(MOE_PORTAL_ORIGIN)) return MOE_PROXY_BASE + url.slice(MOE_PORTAL_ORIGIN.length)
  return null
}

/*
 * Survey123 forms, framed through this portal too.
 *
 * MUST match FORMS_URL / FORMS_PROXY_BASE in server/access-server.js: the
 * browser bundle cannot read .env, so the client half of the setting is written
 * here.
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
 *     survey123.arcgis.com it is sealed to us, and the feature layer it submits
 *     to is not public — so ArcGIS Identity Manager prompts for a sign-in inside
 *     the frame.
 *  2. `portalUrl` is REPLACED. Survey123 reads it from its own query string and
 *     addresses the portal with it, so it must point at our portal proxy rather
 *     than straight at gh.space.gov.rw; that is what routes the form's portal
 *     calls back through this origin, where the session token is attached. It
 *     must be absolute — a relative value is not accepted.
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
