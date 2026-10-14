/** Permanent Runtime Config application key. Do not derive from URL or package name. */
export const APPLICATION_KEY = 'disaster-emergency-mapping'

/**
 * Where the app is served: /<APPLICATION_KEY>/, so apps can share one host.
 * Vite's `base`, the router basename and every same-origin URL derive from it.
 */
export const APP_BASE_PATH = `/${APPLICATION_KEY}`
