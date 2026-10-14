(function () {
  // The app is served under a base path (e.g. /health-mapping) and loads this
  // script from <base>/dashboards/ssl-patch.js. Every URL built here for our own
  // server carries that base; paths are compared with it removed.
  var BASE = (function () {
    var src = (document.currentScript && document.currentScript.src) || ''
    var fromSrc = src.match(/^[a-z]+:\/\/[^/]+(\/[^?#]*?)?\/dashboards\/ssl-patch\.js(?:[?#]|$)/i)
    if (fromSrc) return fromSrc[1] || ''
    var fromPath = location.pathname.match(/^(\/[^/]+)\/api\/portal\//)
    return fromPath ? fromPath[1] : ''
  })()
  var BASE_RE = BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  function unbase(path) {
    if (!BASE || (path !== BASE && String(path).indexOf(BASE + '/') !== 0)) return path
    return path.slice(BASE.length) || '/'
  }
  function appPathname() {
    return unbase(location.pathname)
  }

  var host = location.host
  var pageOrigin = location.protocol + '//' + host
  // Where this app's server lives on the page origin (its base path).
  var appOrigin = pageOrigin + BASE
  var otherProto = location.protocol === 'https:' ? 'http:' : 'https:'
  var otherOrigin = otherProto + '//' + host
  var REAL_PORTAL = 'https://gh.space.gov.rw/portal'
  var REAL_GIS = 'https://gh.space.gov.rw'
  var REAL_INFRA_PORTAL = 'https://infrastructure.space.gov.rw/portal'
  var REAL_INFRA = 'https://infrastructure.space.gov.rw'
  var REAL_RMB_PORTAL = 'https://gis.rmb.gov.rw/portal'
  var REAL_RMB = 'https://gis.rmb.gov.rw'

  function portalProxy() {
    var path = appPathname() || ''
    if (isInfraPage()) return appOrigin + '/api/portal/proxy/infra'
    if (path.indexOf('/api/portal/proxy/rmb') === 0) return appOrigin + '/api/portal/proxy/rmb'
    if (path.indexOf('/api/portal/proxy/web') === 0) return appOrigin + '/api/portal/proxy/web'
    if (path.indexOf('/api/portal/proxy/ghw') === 0) return appOrigin + '/api/portal/proxy/ghw'
    return appOrigin + '/api/portal/proxy/gh'
  }

  function gisProxy() {
    var path = appPathname() || ''
    if (isInfraPage()) return appOrigin + '/api/portal/proxy/infraw'
    if (path.indexOf('/api/portal/proxy/rmb') === 0 || path.indexOf('/api/portal/proxy/rmbw') === 0) {
      return appOrigin + '/api/portal/proxy/rmbw'
    }
    return appOrigin + '/api/portal/proxy/ghw'
  }

  // Matches both infra and infraw.
  function isInfraPage() {
    return (appPathname() || '').indexOf('/api/portal/proxy/infra') === 0
  }

  function isAuthUrl(url) {
    if (typeof url !== 'string' || !url) return false
    return /oauth2|signin\.html|\/signin(?:\?|$|\/|&|#)|generateToken|oauth-callback|\/authorize(?:\?|$|&|#)|platformSelf|home\/signin/i.test(
      url,
    )
  }

  function toRealPortal(url) {
    if (typeof url !== 'string' || !url) return url
    var next = unbase(url)
    // Wide keys first: '/proxy/gh' is a prefix of '/proxy/ghw' (same for infra, rmb).
    next = next.replace(appOrigin + '/api/portal/proxy/ghw', REAL_GIS)
    next = next.replace(appOrigin + '/api/portal/proxy/gh', REAL_PORTAL)
    next = next.replace(appOrigin + '/api/portal/proxy/infraw', REAL_INFRA)
    next = next.replace(appOrigin + '/api/portal/proxy/infra', REAL_INFRA_PORTAL)
    next = next.replace(appOrigin + '/api/portal/proxy/rmbw', REAL_RMB)
    next = next.replace(appOrigin + '/api/portal/proxy/rmb', REAL_RMB_PORTAL)
    next = next.replace(/^\/api\/portal\/proxy\/ghw/, REAL_GIS)
    next = next.replace(/^\/api\/portal\/proxy\/gh/, REAL_PORTAL)
    next = next.replace(/^\/api\/portal\/proxy\/infraw/, REAL_INFRA)
    next = next.replace(/^\/api\/portal\/proxy\/infra/, REAL_INFRA_PORTAL)
    next = next.replace(/^\/api\/portal\/proxy\/rmbw/, REAL_RMB)
    next = next.replace(/^\/api\/portal\/proxy\/rmb/, REAL_RMB_PORTAL)
    if (next.indexOf('http') !== 0) {
      var real = isInfraPage() ? REAL_INFRA_PORTAL : REAL_PORTAL
      var realGis = isInfraPage() ? REAL_INFRA : REAL_GIS
      if (next.indexOf('/sharing/') === 0) next = real + next
      else if (next.indexOf('/portal/') === 0) next = realGis + next
      else if (next.indexOf('/home/signin') === 0) next = real + next
    }
    return next
  }

  // StoryMaps run only at their own /<adaptor>/apps/storymaps/ path, so a
  // story on another host is framed from its portal, never via the proxy.
  function isForeignStoryMap(url) {
    var m = typeof url === 'string' && url.match(/^(?:https?:)?\/\/([^/]+)\/[^/]+\/apps\/storymaps(?:[/?#]|$)/i)
    return Boolean(m) && m[1] !== location.host
  }

  function fix(url) {
    if (isForeignStoryMap(url)) return url
    if (typeof url !== 'string' || !url) return url
    if (isAuthUrl(url)) return toRealPortal(url)
    var next = url
    if (next.indexOf(otherOrigin) === 0) next = pageOrigin + next.slice(otherOrigin.length)
    if (next.indexOf('https://localhost:') === 0 || next.indexOf('http://localhost:') === 0) {
      next = pageOrigin + next.replace(/^https?:\/\/localhost:\d+/i, '')
    }
    if (next.indexOf('https://127.0.0.1:') === 0 || next.indexOf('http://127.0.0.1:') === 0) {
      next = pageOrigin + next.replace(/^https?:\/\/127\.0\.0\.1:\d+/i, '')
    }
    // Our own routes on this origin live under the base.
    if (BASE && next.indexOf(pageOrigin + '/api/') === 0) next = appOrigin + next.slice(pageOrigin.length)
    next = next.replace('https://infrastructure.space.gov.rw/portal', appOrigin + '/api/portal/proxy/infra')
    next = next.replace('http://infrastructure.space.gov.rw/portal', appOrigin + '/api/portal/proxy/infra')
    next = next.replace('https://infrastructure.space.gov.rw/apps/', appOrigin + '/api/portal/proxy/infra/apps/')
    next = next.replace('http://infrastructure.space.gov.rw/apps/', appOrigin + '/api/portal/proxy/infra/apps/')
    next = next.replace('https://gh.space.gov.rw/portal', appOrigin + '/api/portal/proxy/gh')
    next = next.replace('http://gh.space.gov.rw/portal', appOrigin + '/api/portal/proxy/gh')
    next = next.replace('https://gh.space.gov.rw/apps/', appOrigin + '/api/portal/proxy/gh/apps/')
    next = next.replace('http://gh.space.gov.rw/apps/', appOrigin + '/api/portal/proxy/gh/apps/')
    next = next.replace('https://gis.rmb.gov.rw/portal', appOrigin + '/api/portal/proxy/rmb')
    next = next.replace('http://gis.rmb.gov.rw/portal', appOrigin + '/api/portal/proxy/rmb')
    next = next.replace('https://infrastructure.space.gov.rw', appOrigin + '/api/portal/proxy/infraw')
    next = next.replace('http://infrastructure.space.gov.rw', appOrigin + '/api/portal/proxy/infraw')
    next = next.replace('https://gh.space.gov.rw', appOrigin + '/api/portal/proxy/ghw')
    next = next.replace('http://gh.space.gov.rw', appOrigin + '/api/portal/proxy/ghw')
    next = next.replace('https://gis.rmb.gov.rw', appOrigin + '/api/portal/proxy/rmbw')
    next = next.replace('http://gis.rmb.gov.rw', appOrigin + '/api/portal/proxy/rmbw')
    if (next === '/portal' || next === '/portal/') next = portalProxy()
    if (next.indexOf('/portal/') === 0) next = portalProxy() + next.slice('/portal'.length)
    if (next.indexOf('/sharing/') === 0) next = portalProxy() + next
    if (next.indexOf('/server/') === 0 || next.indexOf('/arcgis/') === 0) next = gisProxy() + next
    if (next.indexOf('/api/portal/proxy/') === 0) next = appOrigin + next
    next = next.replace(/(\/api\/portal\/proxy\/(?:ghw|rmbw|rmb|web|gh|infra|infraw))\/+/g, '$1/')
    if (isAuthUrl(next)) return toRealPortal(next)
    return next
  }

  function forcePortal() {
    var portal = portalProxy()
    window.esriConfig = window.esriConfig || {}
    window.esriConfig.has = window.esriConfig.has || {}
    window.esriConfig.has['esri-workers'] = false
    window.esriConfig.portalUrl = portal
    window.esriConfig.request = window.esriConfig.request || {}
    window.esriConfig.request.trustedServers = window.esriConfig.request.trustedServers || []
    ;[pageOrigin, portal, gisProxy(), REAL_PORTAL, REAL_GIS, REAL_INFRA_PORTAL, REAL_INFRA].forEach(function (server) {
      if (window.esriConfig.request.trustedServers.indexOf(server) === -1) {
        window.esriConfig.request.trustedServers.push(server)
      }
    })
    var httpsDomains = Array.isArray(window.esriConfig.request.httpsDomains)
      ? window.esriConfig.request.httpsDomains
      : []
    ;[host, 'localhost', '127.0.0.1', 'gh.space.gov.rw', 'infrastructure.space.gov.rw', 'www.arcgis.com', 'static.arcgis.com', 'js.arcgis.com'].forEach(
      function (domain) {
        if (httpsDomains.indexOf(domain) === -1) httpsDomains.push(domain)
      },
    )
    window.esriConfig.request.httpsDomains = httpsDomains
    if (window.jimuConfig) {
      window.jimuConfig.hostUrl = portal
      window.jimuConfig.portalUrl = portal
    }
  }

  var fetchFn = window.fetch
  window.fetch = function (input, init) {
    init = Object.assign({ credentials: 'include' }, init || {})
    if (typeof input === 'string') input = fix(input)
    else if (input && typeof input.url === 'string') input = new Request(fix(input.url), input)
    return fetchFn.call(this, input, init)
  }

  var openFn = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    if (typeof arguments[1] === 'string') arguments[1] = fix(arguments[1])
    return openFn.apply(this, arguments)
  }

  var windowOpen = window.open
  window.open = function (url, name, specs) {
    if (typeof url === 'string' && (isAuthUrl(url) || url.indexOf('/api/portal/proxy/') !== -1)) {
      url = isAuthUrl(url) ? toRealPortal(url) : fix(url)
      if (isAuthUrl(url)) url = toRealPortal(url)
    }
    return windowOpen.call(this, url, name, specs)
  }

  if (window.Worker) {
    var WorkerOrig = window.Worker
    window.Worker = function (scriptURL, options) {
      return new WorkerOrig(fix(String(scriptURL)), options)
    }
    window.Worker.prototype = WorkerOrig.prototype
  }

  var setAttr = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    if ((name === 'src' || name === 'href') && typeof value === 'string') value = fix(value)
    return setAttr.call(this, name, value)
  }

  function patchSrc(proto) {
    var desc = Object.getOwnPropertyDescriptor(proto, 'src')
    if (!desc || !desc.set) return
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        desc.set.call(this, fix(String(value)))
      },
    })
  }

  patchSrc(HTMLIFrameElement.prototype)
  patchSrc(HTMLScriptElement.prototype)
  patchSrc(HTMLImageElement.prototype)

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (!node || node.nodeType !== 1) return
        if (node.tagName === 'IFRAME' && node.getAttribute('src')) {
          node.setAttribute('src', fix(node.getAttribute('src')))
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('iframe[src]').forEach(function (frame) {
            frame.setAttribute('src', fix(frame.getAttribute('src')))
          })
        }
      })
    })
  })
  observer.observe(document.documentElement || document, { childList: true, subtree: true })

  forcePortal()
  document.addEventListener('DOMContentLoaded', forcePortal)
  var n = 0
  var timer = setInterval(function () {
    forcePortal()
    n += 1
    if (n > 24) clearInterval(timer)
  }, 250)

  function attachInterceptor() {
    if (!window.esriConfig || !window.esriConfig.request) return false
    var interceptors = window.esriConfig.request.interceptors
    if (!Array.isArray(interceptors)) {
      window.esriConfig.request.interceptors = interceptors = []
    }
    if (interceptors.some(function (item) { return item && item._jadoProxyFix })) return true
    interceptors.unshift({
      _jadoProxyFix: true,
      urls: /.*/,
      before: function (params) {
        if (params && typeof params.url === 'string') params.url = fix(params.url)
      },
    })
    return true
  }
  attachInterceptor()
  var interceptTries = 0
  var interceptTimer = setInterval(function () {
    interceptTries += 1
    if (attachInterceptor() || interceptTries > 40) clearInterval(interceptTimer)
  }, 250)
})()
