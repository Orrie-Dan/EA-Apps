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
    [`${origin}/api/portal/proxy/ghw`, 'https://gh.space.gov.rw'],
    [`${origin}/api/portal/proxy/gh`, 'https://gh.space.gov.rw/portal'],
    [`${origin}/api/portal/proxy/infraw`, 'https://infrastructure.space.gov.rw'],
    [`${origin}/api/portal/proxy/infra`, 'https://infrastructure.space.gov.rw/portal'],
    [`${origin}/api/portal/proxy/rmbw`, 'https://gis.rmb.gov.rw'],
    [`${origin}/api/portal/proxy/rmb`, 'https://gis.rmb.gov.rw/portal'],
    ['/api/portal/proxy/ghw', 'https://gh.space.gov.rw'],
    ['/api/portal/proxy/gh', 'https://gh.space.gov.rw/portal'],
    ['/api/portal/proxy/infraw', 'https://infrastructure.space.gov.rw'],
    ['/api/portal/proxy/infra', 'https://infrastructure.space.gov.rw/portal'],
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
    infra: 'https://infrastructure.space.gov.rw/portal',
    infraw: 'https://infrastructure.space.gov.rw',
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
  if (hostKey === 'infra' || hostKey === 'infraw') return '/api/portal/proxy/infra'
  if (hostKey === 'rmb' || hostKey === 'rmbw') return '/api/portal/proxy/rmb'
  if (hostKey === 'web') return '/api/portal/proxy/web'
  if (hostKey === 'ghw') return '/api/portal/proxy/ghw'
  return '/api/portal/proxy/gh'
}

function gisProxyPath(hostKey) {
  if (hostKey === 'infra' || hostKey === 'infraw') return '/api/portal/proxy/infraw'
  if (hostKey === 'rmb' || hostKey === 'rmbw') return '/api/portal/proxy/rmbw'
  return '/api/portal/proxy/ghw'
}

function rewritePairs(origin) {
  return {
    portal: [
      ['https://infrastructure.space.gov.rw/portal', `${origin}/api/portal/proxy/infra`],
      ['http://infrastructure.space.gov.rw/portal', `${origin}/api/portal/proxy/infra`],
      ['https://infrastructure.space.gov.rw/apps/', `${origin}/api/portal/proxy/infra/apps/`],
      ['http://infrastructure.space.gov.rw/apps/', `${origin}/api/portal/proxy/infra/apps/`],
      ['https://gh.space.gov.rw/portal', `${origin}/api/portal/proxy/gh`],
      ['http://gh.space.gov.rw/portal', `${origin}/api/portal/proxy/gh`],
      ['https://gh.space.gov.rw/apps/', `${origin}/api/portal/proxy/gh/apps/`],
      ['http://gh.space.gov.rw/apps/', `${origin}/api/portal/proxy/gh/apps/`],
      ['https://gis.rmb.gov.rw/portal', `${origin}/api/portal/proxy/rmb`],
      ['http://gis.rmb.gov.rw/portal', `${origin}/api/portal/proxy/rmb`],
    ],
    origin: [
      ['https://infrastructure.space.gov.rw', `${origin}/api/portal/proxy/infraw`],
      ['http://infrastructure.space.gov.rw', `${origin}/api/portal/proxy/infraw`],
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

function collapseProxyDoubleSlashes(text) {
  if (!text) return text
  return text.replace(/(\/api\/portal\/proxy\/(?:ghw|rmbw|rmb|web|gh|infra|infraw))\/+/g, '$1/')
}

function hubSessionScript(origin, relPortal, session) {
  const token = session?.token
  if (!token) return ''
  const expiresAt = Number(session?.expiresAt) || Date.now() + 6 * 60 * 60 * 1000
  const payload = {
    clientId: 'arcgisHub',
    username: session?.username || '',
    token,
    tokenExpires: new Date(expiresAt).toISOString(),
    portal: `${origin}${relPortal}/sharing/rest`,
    ssl: true,
  }
  const esriAuth = {
    portalApp: true,
    token,
    expires: expiresAt,
    ssl: true,
    username: session?.username || '',
    email: session?.email || '',
  }
  return `<script>(function(){try{var raw=${JSON.stringify(JSON.stringify(payload))};var auth=${JSON.stringify(JSON.stringify(esriAuth))};localStorage.setItem('__ARCGIS_REST_USER_SESSION__',raw);localStorage.setItem('arcgis-hub-session',raw);sessionStorage.setItem('__ARCGIS_REST_USER_SESSION__',raw);document.cookie='esri_auth='+encodeURIComponent(auth)+'; path=/; SameSite=Lax';}catch(e){}})();</script>`
}

function relaxPrivateHubSite(text) {
  if (!text) return text
  if (!/Hub Site Application|isHubSite|"siteUrl"|opendata-ui|defaultHostname/i.test(text)) return text
  return text
    .replace(/"access"\s*:\s*"(?:org|private|shared)"/g, '"access":"public"')
    .replace(/"isPublic"\s*:\s*false/g, '"isPublic":true')
}

function injectHeadScripts(html, scripts) {
  const block = scripts.filter(Boolean).join('')
  if (!block || !html) return html
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (tag) => `${tag}${block}`)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (tag) => `${tag}${block}`)
  return block + html
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

function rewritePayloadUnshielded(text, hostKey, req, contentType = '', restPath = '', session = null) {
  if (!text || !PROXY_HOSTS[hostKey]) return text

  const origin = publicOrigin(req)
  const host = requestHost(req)
  const pageProto = pageProtocol(req)
  const otherProto = pageProto === 'https' ? 'http' : 'https'
  const relPortal = portalProxyPath(hostKey)
  const relBase = `/api/portal/proxy/${hostKey}`
  const gisBase = gisProxyPath(hostKey)
  const pairs = rewritePairs(origin)
  const isHubSite =
    /apps\/sites/i.test(restPath || '') || /apps\/sites/i.test(String(req?.headers?.referer || ''))

  let next = applyUrlPairs(text, pairs.portal)
  next = applyUrlPairs(next, pairs.origin)
  next = collapseProxyDoubleSlashes(next)

  next = next
    .replaceAll(`${otherProto}://${host}`, `${pageProto}://${host}`)
    .replaceAll(
      `${otherProto === 'https' ? 'wss' : 'ws'}://${host}`,
      `${pageProto === 'https' ? 'wss' : 'ws'}://${host}`,
    )

  const isJs = isJavaScript(contentType)
  const isHtml = isHtmlDocument(next, contentType)

  if (isHtml) {
    if (isHubSite) {
      next = rewriteQuotedRootPaths(next, relPortal, relBase)
      next = absolutizeNamedUrls(next, origin)
      next = next
        .replaceAll('src="/portal/', `src="${relPortal}/`)
        .replaceAll('href="/portal/', `href="${relPortal}/`)
        .replaceAll('src="/sharing/', `src="${relBase}/sharing/`)
        .replaceAll('href="/sharing/', `href="${relBase}/sharing/`)
      next = injectHeadScripts(next, [
        hubSessionScript(origin, relPortal, session),
        next.includes('ssl-patch.js') ? '' : HTML_SSL_PATCH,
      ])
      return collapseProxyDoubleSlashes(next)
    }
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

    next = injectHeadScripts(next, [
      hubSessionScript(origin, relPortal, session),
      next.includes('ssl-patch.js') ? '' : HTML_SSL_PATCH,
    ])
  } else if (!isJs) {
    next = rewriteQuotedRootPaths(next, `${origin}${relPortal}`, `${origin}${relBase}`)
    next = next
      .replaceAll('"/server/', `"${origin}${gisBase}/server/`)
      .replaceAll("'/server/", `'${origin}${gisBase}/server/`)
    next = absolutizeNamedUrls(next, origin)
    if (isHubSite) next = relaxPrivateHubSite(next)
  }

  return restoreAuthUrls(collapseProxyDoubleSlashes(next), origin)
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
  if (next.startsWith('/apps/')) next = `${origin}${portalProxyPath(hostKey)}${next}`
  next = next.replaceAll('/api/portal/proxy/ghw/apps/', '/api/portal/proxy/gh/apps/')
  next = next.replaceAll('/api/portal/proxy/infraw/apps/', '/api/portal/proxy/infra/apps/')
  if (next.startsWith('/api/portal/proxy/')) next = `${origin}${next}`
  next = next.replaceAll(`http://${host}`, `${pageProto}://${host}`)
  next = next.replaceAll(`https://${host}`, `${pageProto}://${host}`)
  return restoreAuthUrls(collapseProxyDoubleSlashes(next), origin)
}

export function hostKeyFromReferer(referer = '') {
  if (referer.includes('/api/portal/proxy/web') || referer.includes('/dashboards/citizen-reporting')) {
    return 'web'
  }
  if (referer.includes('/api/portal/proxy/infraw')) return 'infraw'
  if (referer.includes('/api/portal/proxy/infra')) return 'infra'
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
  const portalKey =
    refererKey === 'infra' || refererKey === 'infraw'
      ? 'infra'
      : refererKey === 'rmb' || refererKey === 'rmbw'
        ? 'rmb'
        : 'gh'
  const originKey =
    refererKey === 'infra' || refererKey === 'infraw'
      ? 'infraw'
      : refererKey === 'rmb' || refererKey === 'rmbw'
        ? 'rmbw'
        : 'ghw'

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
