import { PROXY_HOSTS } from '../src/lib/access.js'
import { keepStoryMapLinks } from './storymap-links.js'

const HTML_SSL_PATCH = '<script src="/dashboards/ssl-patch.js"></script>'
const ABSOLUTE_URL_KEYS = 'portalUrl|hostUrl|sharingUrl|portalHost|itemUrl|serviceUrl|mapUrl'

export function publicOrigin(req) {
  const envOrigin = process.env.PUBLIC_ORIGIN
  if (envOrigin) return envOrigin.replace(/\/$/, '')
  const forwarded = req?.headers?.['x-forwarded-proto']
  return `${forwarded || 'https'}://${req?.headers?.host || 'localhost'}`
}

const AUTH_URL_RE = /oauth2|signin\.html|\/signin(?:\?|$|\/|&|#)|generateToken|oauth-callback|\/authorize(?:\?|$|&|#)|platformSelf|home\/signin/i

export function isPortalAuthUrl(value = '') {
  return AUTH_URL_RE.test(String(value))
}

export function restoreAuthUrls(text, origin) {
  if (!text) return text
  const pairs = [
    [`${origin}/api/portal/proxy/gh`, 'https://gh.space.gov.rw/portal'],
    [`${origin}/api/portal/proxy/ghw`, 'https://gh.space.gov.rw'],
    [`${origin}/api/portal/proxy/rmb`, 'https://gis.rmb.gov.rw/portal'],
    [`${origin}/api/portal/proxy/rmbw`, 'https://gis.rmb.gov.rw'],
    ['/api/portal/proxy/gh', 'https://gh.space.gov.rw/portal'],
    ['/api/portal/proxy/ghw', 'https://gh.space.gov.rw'],
  ]
  let next = text
  for (const [from, to] of pairs) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    next = next.replace(new RegExp(`${escaped}([^\\s"'\\\\<>]*)`, 'g'), (full, path) => {
      if (!AUTH_URL_RE.test(full)) return full
      return `${to}${path}`
    })
  }
  return next
}

export function realPortalAuthUrl(hostKey, restPath, search = '') {
  const path = String(restPath || '').replace(/^\/+/, '').replace(/^\.$/, '')
  const query = search || ''
  const bases = {
    gh: 'https://gh.space.gov.rw/portal',
    ghw: 'https://gh.space.gov.rw',
    rmb: 'https://gis.rmb.gov.rw/portal',
    rmbw: 'https://gis.rmb.gov.rw',
  }
  const base = bases[hostKey] || 'https://gh.space.gov.rw/portal'
  const suffix = bases[hostKey] ? path : `${hostKey}/${path}`.replace(/\/+$/, '')
  return `${base}/${suffix}${query}`.replace(/([^:])\/{2,}/g, '$1/')
}

function requestHost(req) {
  return req?.headers?.host || new URL(publicOrigin(req)).host
}

function pageProtocol(req) {
  return publicOrigin(req).startsWith('https') ? 'https' : 'http'
}

function applyUrlPairs(text, pairs) {
  let next = text
  for (const [from, to] of pairs) {
    next = next.replaceAll(from, to)
    next = next.replaceAll(encodeURIComponent(from), encodeURIComponent(to))
    next = next.replaceAll(from.replaceAll('/', '\\/'), to.replaceAll('/', '\\/'))
  }
  return next
}

function portalProxyPath(hostKey) {
  if (hostKey === 'rmb' || hostKey === 'rmbw') return '/api/portal/proxy/rmb'
  if (hostKey === 'web') return '/api/portal/proxy/web'
  if (hostKey === 'ghw') return '/api/portal/proxy/ghw'
  return '/api/portal/proxy/gh'
}

function gisProxyPath(hostKey) {
  if (hostKey === 'rmb' || hostKey === 'rmbw') return '/api/portal/proxy/rmbw'
  return '/api/portal/proxy/ghw'
}

function rewritePairs(origin) {
  return {
    portal: [
      ['https://gh.space.gov.rw/portal', `${origin}/api/portal/proxy/gh`],
      ['http://gh.space.gov.rw/portal', `${origin}/api/portal/proxy/gh`],
      ['https://gis.rmb.gov.rw/portal', `${origin}/api/portal/proxy/rmb`],
      ['http://gis.rmb.gov.rw/portal', `${origin}/api/portal/proxy/rmb`],
    ],
    origin: [
      ['https://gh.space.gov.rw', `${origin}/api/portal/proxy/ghw`],
      ['http://gh.space.gov.rw', `${origin}/api/portal/proxy/ghw`],
      ['https://gis.rmb.gov.rw', `${origin}/api/portal/proxy/rmbw`],
      ['http://gis.rmb.gov.rw', `${origin}/api/portal/proxy/rmbw`],
      ['https://citizensemergencyreportingapp.netlify.app', `${origin}/api/portal/proxy/web`],
      ['http://citizensemergencyreportingapp.netlify.app', `${origin}/api/portal/proxy/web`],
    ],
  }
}

function rewriteQuotedRootPaths(text, portalBase, sharingBase) {
  return text
    .replaceAll('"/portal/', `"${portalBase}/`)
    .replaceAll("'/portal/", `'${portalBase}/`)
    .replaceAll('"/sharing/', `"${sharingBase}/sharing/`)
    .replaceAll("'/sharing/", `'${sharingBase}/sharing/`)
}

function absolutizeNamedUrls(text, origin) {
  const keys = ABSOLUTE_URL_KEYS
  return text.replace(
    new RegExp(`"(${keys})"\\s*:\\s*"(\\/[^"]*)"`, 'g'),
    (_, key, value) => `"${key}":"${origin}${value}"`,
  )
}

function isJavaScript(contentType) {
  return /javascript|ecmascript|module/i.test(contentType)
}

function isHtmlDocument(text, contentType) {
  if (/text\/html/i.test(contentType)) return true
  if (isJavaScript(contentType) || /json/i.test(contentType)) return false
  return /^\s*(<!doctype html|<html[\s>])/i.test(text)
}

export function rewritePayload(text, ...rest) {
  return keepStoryMapLinks(text, (t) => rewritePayloadUnshielded(t, ...rest))
}

function rewritePayloadUnshielded(text, hostKey, req, contentType = '') {
  if (!text || !PROXY_HOSTS[hostKey]) return text

  const origin = publicOrigin(req)
  const host = requestHost(req)
  const pageProto = pageProtocol(req)
  const otherProto = pageProto === 'https' ? 'http' : 'https'
  const relPortal = portalProxyPath(hostKey)
  const relBase = `/api/portal/proxy/${hostKey}`
  const gisBase = gisProxyPath(hostKey)
  const pairs = rewritePairs(origin)

  let next = applyUrlPairs(text, pairs.portal)
  next = applyUrlPairs(next, pairs.origin)

  next = next
    .replaceAll(`${otherProto}://${host}`, `${pageProto}://${host}`)
    .replaceAll(
      `${otherProto === 'https' ? 'wss' : 'ws'}://${host}`,
      `${pageProto === 'https' ? 'wss' : 'ws'}://${host}`,
    )

  const isJs = isJavaScript(contentType)
  const isHtml = isHtmlDocument(next, contentType)

  if (isHtml) {
    next = rewriteQuotedRootPaths(next, relPortal, relBase)
    next = absolutizeNamedUrls(next, origin)
    next = next
      .replaceAll('src="/portal/', `src="${relPortal}/`)
      .replaceAll('href="/portal/', `href="${relPortal}/`)
      .replaceAll('src="/sharing/', `src="${relBase}/sharing/`)
      .replaceAll('href="/sharing/', `href="${relBase}/sharing/`)
      .replaceAll('src="/assets/', `src="${relBase}/assets/`)
      .replaceAll('href="/assets/', `href="${relBase}/assets/`)
      .replaceAll('src="/cdn/', `src="${relBase}/cdn/`)
      .replaceAll('href="/cdn/', `href="${relBase}/cdn/`)
      .replaceAll('src="/apps/', `src="${relPortal}/apps/`)
      .replaceAll('href="/apps/', `href="${relPortal}/apps/`)

    if (!next.includes('ssl-patch.js')) {
      if (/<head[\s>]/i.test(next)) {
        next = next.replace(/<head[^>]*>/i, (tag) => `${tag}${HTML_SSL_PATCH}`)
      } else if (/<html[\s>]/i.test(next)) {
        next = next.replace(/<html[^>]*>/i, (tag) => `${tag}${HTML_SSL_PATCH}`)
      }
    }
  } else if (!isJs) {
    next = rewriteQuotedRootPaths(next, `${origin}${relPortal}`, `${origin}${relBase}`)
    next = next
      .replaceAll('"/server/', `"${origin}${gisBase}/server/`)
      .replaceAll("'/server/", `'${origin}${gisBase}/server/`)
    next = absolutizeNamedUrls(next, origin)
  }

  return restoreAuthUrls(next, origin)
}

export function rewriteLocation(location, hostKey, req) {
  if (!location) return location
  const origin = publicOrigin(req)
  const host = requestHost(req)
  const pageProto = pageProtocol(req)
  const portalProxy = `${origin}${portalProxyPath(hostKey)}`
  const pairs = rewritePairs(origin)
  let next = applyUrlPairs(location, pairs.portal)
  next = applyUrlPairs(next, pairs.origin)
  if (next.startsWith('/portal/')) next = `${portalProxy}${next.slice('/portal'.length)}`
  if (next.startsWith('/sharing/')) next = `${portalProxy}${next}`
  if (next.startsWith('/api/portal/proxy/')) next = `${origin}${next}`
  next = next.replaceAll(`http://${host}`, `${pageProto}://${host}`)
  next = next.replaceAll(`https://${host}`, `${pageProto}://${host}`)
  return restoreAuthUrls(next, origin)
}

export function hostKeyFromReferer(referer = '') {
  if (referer.includes('/api/portal/proxy/web') || referer.includes('/dashboards/citizen-reporting')) {
    return 'web'
  }
  if (referer.includes('/api/portal/proxy/rmbw')) return 'rmbw'
  if (referer.includes('/api/portal/proxy/rmb') || referer.includes('/dashboards/volcanic')) {
    return 'rmb'
  }
  if (referer.includes('/api/portal/proxy/ghw')) return 'ghw'
  if (referer.includes('/api/portal/proxy/gh') || referer.includes('/dashboards/')) return 'gh'
  return null
}

export function fallbackProxyTarget(url, req) {
  const path = url.pathname
  const refererKey = hostKeyFromReferer(req.headers.referer || '')
  const portalKey = refererKey === 'rmb' || refererKey === 'rmbw' ? 'rmb' : 'gh'
  const originKey = refererKey === 'rmb' || refererKey === 'rmbw' ? 'rmbw' : 'ghw'

  if (path.startsWith('/assets/') || path.startsWith('/cdn/')) {
    if (refererKey) return { hostKey: refererKey, path: path.replace(/^\//, '') }
    return { hostKey: portalKey, path: path.replace(/^\//, '') }
  }
  if (path.startsWith('/portal/')) {
    return { hostKey: portalKey, path: path.slice('/portal/'.length) }
  }
  if (path.startsWith('/sharing/')) {
    return { hostKey: portalKey, path: path.replace(/^\//, '') }
  }
  if (path.startsWith('/server/') || path.startsWith('/arcgis/')) {
    return { hostKey: originKey, path: path.replace(/^\//, '') }
  }
  if (
    path.startsWith('/apps/dashboards') ||
    path.startsWith('/apps/experiencebuilder') ||
    path.startsWith('/apps/sites')
  ) {
    return { hostKey: portalKey, path: path.replace(/^\//, '') }
  }
  return null
}
