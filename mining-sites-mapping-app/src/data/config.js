/**
 * @deprecated Prefer useRuntimeConfig() from RuntimeConfigProvider.
 * Kept as a thin compatibility export of default-resolved config for non-React paths.
 * Runtime-managed content must not be edited here — edit src/config/defaults.js
 * or the central Runtime Config service.
 */
export { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'
export {
  resolveDefaultRuntimeConfig,
  resolveRuntimeConfig,
} from '../config/resolveRuntimeConfig.js'

import { resolveDefaultRuntimeConfig } from '../config/resolveRuntimeConfig.js'

const resolved = resolveDefaultRuntimeConfig()

export const portal = resolved.portal
export const modules = resolved.modules
export const footer = resolved.footer
export const stats = resolved.stats
export const getModule = resolved.getModule
export const getSolution = resolved.getSolution
export const getFirstSolutionPath = resolved.getFirstSolutionPath
