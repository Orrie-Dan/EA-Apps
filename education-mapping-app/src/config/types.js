/**
 * @typedef {'experience'|'dashboard'|'survey123'|'external'|'localShell'} RuntimeConfigKind
 *
 * @typedef {object} RuntimeApp
 * @property {string} [name]
 * @property {string} [shortName]
 * @property {string} [description]
 * @property {string} [eyebrow]
 * @property {string} [homeTitle]
 * @property {string} [homeLead]
 * @property {string} [tagline]
 * @property {string} [hero]
 * @property {string} [documentTitle]
 *
 * @typedef {object} RuntimeModuleApp
 * @property {string} id
 * @property {string} name
 * @property {string} [footerLabel]
 * @property {string} [description]
 * @property {string} [type]
 * @property {string} [image]
 * @property {string} [icon]
 * @property {RuntimeConfigKind} [kind]
 * @property {string} [portalItemId]
 * @property {string} [portalHostKey]
 * @property {string} [externalUrl]
 * @property {string} [localShellPath]
 * @property {boolean} [published]
 *
 * @typedef {object} RuntimeModule
 * @property {string} id
 * @property {string} name
 * @property {string} [icon]
 * @property {string} [description]
 * @property {string} [image]
 * @property {boolean} [hidden]
 * @property {RuntimeModuleApp[]} [apps]
 *
 * @typedef {object} RuntimeConfigDocument
 * @property {RuntimeApp} [app]
 * @property {object} [branding]
 * @property {object} [organization]
 * @property {object} [contact]
 * @property {object} [footer]
 * @property {object} [legal]
 * @property {RuntimeModule[]} [modules]
 * @property {object} [extensions]
 *
 * @typedef {'remote'|'defaults'} RuntimeConfigSource
 */

export {}
