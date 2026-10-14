(function () {
  // The app is served under a base path (e.g. /health-mapping) and loads this
  // script from <base>/dashboards/esrirw-patch.js. Every URL built here for our own
  // server carries that base; paths are compared with it removed.
  var BASE = (function () {
    var src = (document.currentScript && document.currentScript.src) || ''
    var fromSrc = src.match(/^[a-z]+:\/\/[^/]+(\/[^?#]*?)?\/dashboards\/esrirw-patch\.js(?:[?#]|$)/i)
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

  var origin = location.origin
  var protoHost = location.protocol + '//' + location.host

  var cover = document.createElement('style')
  cover.textContent = '#loading,#loading .loading-content{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;}'
  ;(document.head || document.documentElement).appendChild(cover)

  function proxyPrefix() {
    var path = appPathname()
    if (path.indexOf('/api/portal/proxy/esrirww') === 0) return BASE + '/api/portal/proxy/esrirw'
    if (path.indexOf('/api/portal/proxy/esrirw') === 0) return BASE + '/api/portal/proxy/esrirw'
    return BASE + '/api/portal/proxy/esrirw'
  }

  function widePrefix() {
    return BASE + '/api/portal/proxy/esrirww'
  }

  function collapse(url) {
    var next = String(url || '')
    var before
    do {
      before = next
      next = next.replace(new RegExp('(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/(?:esrirw|esrirww)(?=(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/)', 'g'), '')
      next = next.replace(/\/api\/portal\/proxy\/(?:esrirw|esrirww)(?=https?:\/\/)/g, '')
      next = next.replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?=https?:\/\/)/gi, '')
    } while (next !== before)
    return next
  }

  function unwrapNestedOrigin(url) {
    var marker = origin + '/'
    while (url.indexOf(marker + 'http') === 0) url = url.slice(marker.length)
    if (BASE) {
      // origin + BASE glued onto an absolute URL, with or without a slash.
      while (url.indexOf(origin + BASE + '/http') === 0) url = url.slice((origin + BASE + '/').length)
      while (url.indexOf(origin + BASE + 'http') === 0) url = url.slice((origin + BASE).length)
    }
    while (url.indexOf(origin + origin) === 0) url = url.slice(origin.length)
    url = url.replace(/^(https?:\/\/[^/]+)\/+(https?:\/\/)/i, '$2')
    url = url.replace(/^(https?:\/\/[^/]+)(?=https?:\/\/)/i, '')
    url = url.replace(/^\/+(https?:\/\/)/i, '$1')
    return url
  }

  function rewriteEsriRw(url) {
    return url
      .replace(/https:\/\/esrirw\.rw\/portal/g, origin + BASE + '/api/portal/proxy/esrirw')
      .replace(/https:\/\/esrirw\.rw(?!:)/g, origin + BASE + '/api/portal/proxy/esrirww')
  }

  function sameOriginLocal(url) {
    return url.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?/i, protoHost)
  }

  function toRelativeSameOrigin(url) {
    if (url.indexOf(origin) === 0) return url.slice(origin.length) || '/'
    if (url.indexOf(protoHost) === 0) return url.slice(protoHost.length) || '/'
    return url
  }

  function repairProtocol(url) {
    return String(url || '')
      .replace(/https:\/(?!\/)/gi, 'https://')
      .replace(/http:\/(?!\/)/gi, 'http://')
  }

  function alreadyProxied(url) {
    return /\/api\/portal\/proxy\/esrirw/i.test(url)
  }

  function prefixSkipped(url) {
    var prefix = proxyPrefix()
    var wide = widePrefix()
    url = repairProtocol(url)
    url = collapse(url)
    url = unwrapNestedOrigin(url)
    if (alreadyProxied(url) && /^https?:\/\//i.test(url) && url.indexOf('esrirwhttps') < 0) {
      return url.replace(
        /\/api\/portal\/proxy\/esrirww\/assets\//g,
        '/api/portal/proxy/esrirw/apps/dashboards/assets/',
      )
    }

    var path = url
    if (/^https?:\/\//i.test(url)) {
      var match = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/i)
      if (!match) return url
      path = match[2] || '/'
    }
    if (path.charAt(0) !== '/') path = '/' + path.replace(/^\/+/, '/')
    path = unbase(path)

    if (path.indexOf('/api/portal/proxy/') === 0) {
      path = path.replace(
        '/api/portal/proxy/esrirww/assets/',
        '/api/portal/proxy/esrirw/apps/dashboards/assets/',
      )
      return origin + BASE + path
    }

    if (path.indexOf('/sharing/') === 0 || path.indexOf('/portal/') === 0 || path.indexOf('/apps/') === 0) {
      if (path.indexOf('/portal/') === 0) path = prefix + path.slice('/portal'.length)
      else path = prefix + path
      return origin + path
    }

    if (path.indexOf('/assets/') === 0) {
      if (/\/apps\/mission(?:\/|$)/.test(appPathname())) {
        return origin + prefix + '/apps/mission' + path
      }
      if (/\/apps\/dashboards(?:\/|$)/.test(appPathname()) || /chunk\./.test(path)) {
        return origin + prefix + '/apps/dashboards' + path
      }
      return origin + wide + path
    }

    if (path.indexOf('/server/') === 0 || path.indexOf('/arcgis/') === 0 || path.indexOf('/cdn/') === 0) {
      return origin + wide + path
    }

    return url
  }

  function shouldFix(url) {
    if (typeof url !== 'string' || !url) return false
    if (/^(blob:|data:|javascript:|mailto:|#)/i.test(url)) return false
    if (/^https?:\/\//i.test(url)) return true
    return (
      url.charAt(0) === '/' &&
      /\/(sharing|apps|portal|server|assets|cdn|arcgis|api\/portal\/proxy)\//.test(url)
    )
  }

  function fix(url) {
    if (!shouldFix(url)) return url
    url = repairProtocol(url)
    url = unwrapNestedOrigin(url)
    url = repairProtocol(url)
    url = sameOriginLocal(url)
    url = rewriteEsriRw(url)
    url = collapse(url)
    url = prefixSkipped(url)
    url = collapse(url)
    url = unwrapNestedOrigin(url)
    url = repairProtocol(url)
    url = url.replace(/(\/api\/portal\/proxy\/esrirw)+/g, '/api/portal/proxy/esrirw')
    url = url.replace(origin + BASE + '/api/portal/proxy/esrirw' + origin, origin)
    url = url.replace(/\/api\/portal\/proxy\/esrirww?https:/g, 'https:')
    if (/oauth2\/authorize/i.test(url)) {
      url = url.replace(/\/sharing\/oauth2\//g, '/sharing/rest/oauth2/')
    }
    url = collapse(url)
    url = unwrapNestedOrigin(url)
    url = repairProtocol(url)
    if (alreadyProxied(url) && url.indexOf('http') !== 0) {
      url = origin + BASE + unbase(url.charAt(0) === '/' ? url : '/' + url)
    }
    return url
  }

  if (
    appPathname().indexOf('/apps/') === 0 ||
    appPathname().indexOf('/sharing/') === 0 ||
    appPathname().indexOf('/portal/') === 0
  ) {
    location.replace(proxyPrefix() + appPathname() + location.search + location.hash)
    return
  }

  var fetchFn = window.fetch
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = fix(input)
    else if (input && typeof input.url === 'string') input = new Request(fix(input.url), input)
    if (init) init = Object.assign({ credentials: 'include' }, init)
    return fetchFn.call(this, input, init)
  }

  var xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    if (typeof arguments[1] === 'string') arguments[1] = fix(arguments[1])
    return xhrOpen.apply(this, arguments)
  }

  var setAttr = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    if (name === 'sandbox' && typeof value === 'string') {
      value +=
        ' allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation-by-user-activation'
    }
    if (name === 'target' && (value === '_top' || value === '_parent')) value = '_self'
    if ((name === 'src' || name === 'href') && typeof value === 'string') value = fix(value)
    return setAttr.call(this, name, value)
  }

  document.addEventListener(
    'click',
    function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a') : null
      if (link && (link.target === '_top' || link.target === '_parent')) {
        event.preventDefault()
        if (link.href) location.assign(fix(link.href))
      }
    },
    true,
  )

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

  function patchHref(proto) {
    var desc = Object.getOwnPropertyDescriptor(proto, 'href')
    if (!desc || !desc.set) return
    Object.defineProperty(proto, 'href', {
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
  patchHref(HTMLAnchorElement.prototype)
  patchHref(HTMLLinkElement.prototype)

  var pushStateFn = history.pushState
  var replaceStateFn = history.replaceState
  history.pushState = function (state, title, url) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) url = fix(url)
    return pushStateFn.call(this, state, title, url)
  }
  history.replaceState = function (state, title, url) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) url = fix(url)
    return replaceStateFn.call(this, state, title, url)
  }

  var NativeURL = window.URL
  function SafeURL(path, base) {
    var href = path
    if (typeof href === 'string') {
      href = collapse(repairProtocol(href))
      href = href.replace(/\/api\/portal\/proxy\/esrirww?https:/g, 'https:')
      if (!href || href === 'https:' || href === 'http:') href = origin + proxyPrefix()
      if (href.charAt(0) === '/' && arguments.length < 2) {
        return new NativeURL(href, origin)
      }
    }
    try {
      return arguments.length >= 2 ? new NativeURL(href, base) : new NativeURL(href)
    } catch (err) {
      try {
        return new NativeURL(String(href || '/'), origin)
      } catch (err2) {
        return new NativeURL(origin + '/')
      }
    }
  }
  SafeURL.prototype = NativeURL.prototype
  SafeURL.createObjectURL = function () {
    return NativeURL.createObjectURL.apply(NativeURL, arguments)
  }
  SafeURL.revokeObjectURL = function () {
    return NativeURL.revokeObjectURL.apply(NativeURL, arguments)
  }
  if (NativeURL.canParse) {
    SafeURL.canParse = function () {
      return NativeURL.canParse.apply(NativeURL, arguments)
    }
  }
  window.URL = SafeURL

  var openFn = window.open
  window.open = function (url, target, features) {
    if (typeof url === 'string') {
      url = fix(url)
      if (/oauth2\/authorize/i.test(url)) {
        return {
          closed: true,
          close: function () {},
          focus: function () {},
          blur: function () {},
          location: { href: url, replace: function () {} },
        }
      }
    }
    return openFn.call(this, url, target, features)
  }

  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: location.origin + BASE + '/',
        unregister: function () {
          return Promise.resolve(true)
        },
        update: function () {
          return Promise.resolve(this)
        },
        addEventListener: function () {},
        removeEventListener: function () {},
      })
    }
  }

  if (/\/apps\/dashboards(?:\/|$)/.test(appPathname())) {
    window.__webpack_public_path__ =
      origin + proxyPrefix() + '/apps/dashboards/assets/'
  }

  var portalUrl = origin + proxyPrefix()
  window.esriConfig = window.esriConfig || {}
  window.esriConfig.portalUrl = portalUrl

  function applyJimu(cfg) {
    if (!cfg || typeof cfg !== 'object') return
    cfg.hostUrl = portalUrl
    cfg.portalUrl = portalUrl
  }

  if (window.jimuConfig) applyJimu(window.jimuConfig)
  try {
    var current = window.jimuConfig
    Object.defineProperty(window, 'jimuConfig', {
      configurable: true,
      enumerable: true,
      get: function () {
        return current
      },
      set: function (value) {
        current = value
        applyJimu(current)
      },
    })
  } catch (e) {}

  function sessionServers(session) {
    var rest = origin + BASE + '/api/portal/proxy/esrirw/sharing/rest'
    var hostServer = origin + BASE + '/api/portal/proxy/esrirww/server'
    var missionServer = origin + BASE + '/api/portal/proxy/esrirww/missionserver'
    var extra = session && session.server ? [session.server] : []
    return [
      rest,
      origin + BASE + '/api/portal/proxy/esrirw',
      hostServer,
      hostServer + '/rest/services',
      missionServer,
      missionServer + '/rest',
      'https://esrirw.rw/portal/sharing/rest',
      'https://esrirw.rw/portal',
      'https://esrirw.rw/server',
      'https://esrirw.rw/server/rest/services',
      'https://esrirw.rw/missionserver',
    ]
      .concat(extra)
      .map(function (server) {
        if (!server) return ''
        if (server.charAt(0) === '/') return origin + server
        return server
      })
      .filter(function (server) {
        try {
          return Boolean(server) && new NativeURL(server).protocol.indexOf('http') === 0
        } catch (e) {
          return false
        }
      })
  }

  function credentialFor(session, server) {
    return {
      server: server,
      token: session.token,
      expires: Number(session.expires) || Date.now() + 14 * 24 * 60 * 60 * 1000,
      ssl: session.ssl !== false,
    }
  }

  function applyIdentity(im, session) {
    if (!im || !session || !session.token || typeof im.registerToken !== 'function') return
    sessionServers(session).forEach(function (server) {
      try {
        im.registerToken(credentialFor(session, server))
      } catch (err) {}
    })
    if (im.__esrirwCredHook) return
    im.__esrirwCredHook = true
    var origGet = typeof im.getCredential === 'function' ? im.getCredential.bind(im) : null
    var origCheck = typeof im.checkSignInStatus === 'function' ? im.checkSignInStatus.bind(im) : null
    if (origGet) {
      im.getCredential = function (resUrl, opts) {
        sessionServers(session).forEach(function (server) {
          try {
            im.registerToken(credentialFor(session, server))
          } catch (err) {}
        })
        return origGet(resUrl, opts).catch(function () {
          var server = origin + BASE + '/api/portal/proxy/esrirw/sharing/rest'
          try {
            if (resUrl) server = new NativeURL(String(resUrl), origin).href.split('?')[0]
          } catch (e) {}
          var cred = credentialFor(session, server)
          try {
            im.registerToken(cred)
          } catch (e2) {}
          return cred
        })
      }
    }
    if (origCheck) {
      im.checkSignInStatus = function (resUrl) {
        sessionServers(session).forEach(function (server) {
          try {
            im.registerToken(credentialFor(session, server))
          } catch (err) {}
        })
        return origCheck(resUrl).catch(function () {
          var server = origin + BASE + '/api/portal/proxy/esrirw/sharing/rest'
          try {
            if (resUrl) server = new NativeURL(String(resUrl), origin).href.split('?')[0]
          } catch (e) {}
          var cred = credentialFor(session, server)
          try {
            im.registerToken(cred)
          } catch (e2) {}
          return cred
        })
      }
    }
  }

  function watchIdentity(session) {
    if (!session || !session.token) return
    function hook(im) {
      applyIdentity(im, session)
    }
    hook(window.esriId)
    ;['esriId', 'identityManager', 'IdentityManager'].forEach(function (key) {
      try {
        var current = window[key]
        Object.defineProperty(window, key, {
          configurable: true,
          enumerable: true,
          get: function () {
            return current
          },
          set: function (value) {
            current = value
            hook(current)
          },
        })
        if (current) hook(current)
      } catch (e) {}
    })
    try {
      if (window.require) {
        window.require(['esri/identity/IdentityManager'], hook, function () {})
      }
    } catch (e) {}
  }

  var bootSession = window.__ESRIRW_SESSION__ || null
  watchIdentity(bootSession)
  fetch(BASE + '/api/gis/esrirw-session', { credentials: 'same-origin' })
    .then(function (response) {
      return response.ok ? response.json() : null
    })
    .then(function (session) {
      bootSession = session || bootSession
      window.__ESRIRW_SESSION__ = bootSession
      watchIdentity(bootSession)
      var n = 0
      var timer = setInterval(function () {
        watchIdentity(bootSession)
        n += 1
        if (n > 40) clearInterval(timer)
      }, 250)
    })
    .catch(function () {})
})()
