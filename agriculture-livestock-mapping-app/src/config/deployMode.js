/**
 * Deployment mode flag.
 *
 * STATIC_BUILD is true when the app is built for static-file hosting ON the
 * portal web server (gh.space.gov.rw) with no app server. Sign-in, the session
 * and the protected portal proxy are provided by the Runtime Config service
 * (same-origin /api/v1/app-auth and /api/v1/portal-proxy; see
 * src/auth/runtimeSessionAuth.js). The dev/preview server path is unchanged.
 *
 * Set VITE_STATIC_BUILD=1 at build time (see `.env.static` / `npm run build:static`).
 */
const raw = import.meta.env.VITE_STATIC_BUILD
export const STATIC_BUILD = raw === '1' || raw === 'true'
