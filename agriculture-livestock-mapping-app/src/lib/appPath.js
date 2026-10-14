import { APP_BASE_PATH } from '../config/application.js'

/**
 * A root-relative path for this app's own server, under the base it is served
 * from (APP_BASE_PATH). Absolute URLs, protocol-relative URLs and paths that
 * already carry the base are returned unchanged, so config values that are
 * either root-relative ("/hero.jpg") or full URLs both work.
 */
export function appPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path
  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) return path
  return `${APP_BASE_PATH}${path}`
}
