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

  var origin = location.origin
  var protoHost = location.protocol + '//' + location.host

  function proxyPrefix() {
    var path = appPathname()
    if (path.indexOf('/api/portal/proxy/rmbw') === 0) return BASE + '/api/portal/proxy/rmb'
    if (path.indexOf('/api/portal/proxy/rmb') === 0) return BASE + '/api/portal/proxy/rmb'
    if (path.indexOf('/api/portal/proxy/rbcw') === 0) return BASE + '/api/portal/proxy/rbc'
    if (path.indexOf('/api/portal/proxy/rbc') === 0) return BASE + '/api/portal/proxy/rbc'
    if (path.indexOf('/api/portal/proxy/web') === 0) return BASE + '/api/portal/proxy/web'
    // gh2 (GeoHub under the geohub2 credential) before gh, which it contains.
    if (path.indexOf('/api/portal/proxy/gh2') === 0) return BASE + '/api/portal/proxy/gh2'
    if (path.indexOf('/api/portal/proxy/ghw') === 0) return BASE + '/api/portal/proxy/gh'
    if (path.indexOf('/api/portal/proxy/gh') === 0) return BASE + '/api/portal/proxy/gh'
    return BASE + '/api/portal/proxy/gh'
  }

  function widePrefix() {
    var path = appPathname()
    if (path.indexOf('/api/portal/proxy/rmb') === 0) return BASE + '/api/portal/proxy/rmbw'
    if (path.indexOf('/api/portal/proxy/rbc') === 0) return BASE + '/api/portal/proxy/rbcw'
    if (path.indexOf('/api/portal/proxy/web') === 0) return BASE + '/api/portal/proxy/web'
    if (path.indexOf('/api/portal/proxy/gh2') === 0) return BASE + '/api/portal/proxy/gh2w'
    return BASE + '/api/portal/proxy/ghw'
  }

  function collapse(url) {
    return String(url || '').replace(
      new RegExp('(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/(?:gh2w|gh2|gh|ghw|rmb|rmbw|rbc|rbcw|web)(?=(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/)', 'g'),
      '',
    )
  }

  function undoubleOrigin(url) {
    var next = String(url || '')
    // origin + BASE glued onto an absolute URL, with or without a slash.
    if (BASE) next = next.replace(new RegExp('^(https?:\\/\\/[^/?#]+)' + BASE_RE + '\\/*https?:\\/\\/[^/?#]+', 'i'), '$1')
    return next.replace(
      /^(https?:\/\/[^/?#]+)\/+https?:\/\/[^/?#]+/i,
      '$1',
    )
  }

  /** Strip /api/portal/proxy/{host} glued onto an absolute URL (rbchttps://…). */
  function unglueProxyHost(url) {
    var next = String(url || '')
    next = next.replace(
      new RegExp('(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/(?:gh2w|gh2|gh|ghw|rmb|rmbw|rbc|rbcw|web|esrirw|esrirww|s123)(?=https?:)', 'gi'),
      '',
    )
    // Repair https:/host → https://host after glue
    next = next.replace(/^(https?:)\/(?!\/)/i, '$1//')
    next = next.replace(/(https?:)\/(?!\/)/gi, '$1//')
    return next
  }

  // A gh2 frame keeps GeoHub on its own gh2 keys, so it keeps the gh2 token.
  var GH = appPathname().indexOf('/api/portal/proxy/gh2') === 0 ? 'gh2' : 'gh'

  function rewriteGeoHub(url) {
    return url
      .replace(/https:\/\/gh\.space\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/' + GH)
      .replace(/https:\/\/gh\.space\.gov\.rw/g, origin + BASE + '/api/portal/proxy/' + GH + 'w')
      .replace(/https:\/\/gis\.rmb\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/rmb')
      .replace(/https:\/\/gis\.rmb\.gov\.rw/g, origin + BASE + '/api/portal/proxy/rmbw')
      .replace(/https:\/\/gis\.rbc\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/rbc')
      .replace(/https:\/\/gis\.rbc\.gov\.rw/g, origin + BASE + '/api/portal/proxy/rbcw')
  }

  function sameOriginLocal(url) {
    return url.replace(
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?/i,
      protoHost,
    )
  }

  function toRelativeSameOrigin(url) {
    if (url.indexOf(origin) === 0) return url.slice(origin.length) || '/'
    if (url.indexOf(protoHost) === 0) return url.slice(protoHost.length) || '/'
    return url
  }

  function prefixSkipped(url) {
    var prefix = proxyPrefix()
    var wide = widePrefix()
    var path = url

    if (/^https?:\/\//i.test(url)) {
      var match = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/i)
      if (!match) return url
      path = match[2] || '/'
    }

    path = unbase(path)
    if (path.indexOf('/api/portal/proxy/') === 0) return BASE + path

    if (path.indexOf('/sharing/') === 0 || path.indexOf('/portal/') === 0 || path.indexOf('/apps/') === 0) {
      if (path.indexOf('/portal/') === 0) path = prefix + path.slice('/portal'.length)
      else path = prefix + path
      return path
    }

    if (
      path.indexOf('/server/') === 0 ||
      path.indexOf('/arcgis/') === 0 ||
      path.indexOf('/cdn/') === 0 ||
      path.indexOf('/assets/') === 0
    ) {
      return wide + path
    }

    return url
  }

  function isArcGisLoginUrl(url) {
    return /home\/signin|\/signin\.html|oauth2\/authorize|oauth2\/signout|oauth2\/approval|\/oauth2\/nativeApp|platformSelf/i.test(
      String(url || ''),
    )
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
    // Do not open / rewrite ArcGIS sign-in surfaces — auth is disabled.
    if (isArcGisLoginUrl(url) && /signin|authorize|signout|approval|nativeApp/i.test(url)) {
      return 'about:blank'
    }
    url = unglueProxyHost(url)
    url = undoubleOrigin(url)
    if (url.indexOf('//') === 0 && url.indexOf('///') !== 0) {
      url = location.protocol + url
    }
    url = sameOriginLocal(url)
    url = rewriteGeoHub(url)
    url = collapse(url)
    url = unglueProxyHost(url)
    url = prefixSkipped(url)
    url = collapse(url)
    url = unglueProxyHost(url)
    url = undoubleOrigin(url)
    url = toRelativeSameOrigin(url)
    url = url.replace(/([^:])\/{2,}/g, '$1/')
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

  // Hide ArcGIS / Experience Builder sign-in UI.
  var hideAuth = document.createElement('style')
  hideAuth.textContent = [
    '.esri-identity-modal,',
    '.esri-authentication,',
    '.jimu-sign-in,',
    '.sign-in-page,',
    '[class*="SignIn"],',
    '[class*="sign-in"],',
    '[class*="signin"],',
    'calcite-dialog.esri-identity-modal,',
    'iframe[src*="signin"],',
    'iframe[src*="oauth2/authorize"]',
    '{ display: none !important; visibility: hidden !important; pointer-events: none !important; }',
  ].join('\n')
  ;(document.head || document.documentElement).appendChild(hideAuth)

  function scrubAuthNode(node) {
    if (!node || node.nodeType !== 1) return
    var cls = String(node.className || '')
    var id = String(node.id || '')
    var tag = String(node.tagName || '').toLowerCase()
    if (
      /sign-?in|identity-modal|authentication|oauth/i.test(cls + ' ' + id) ||
      (tag === 'iframe' && isArcGisLoginUrl(node.getAttribute('src') || ''))
    ) {
      node.remove()
      return
    }
    if (node.src) node.src = fix(node.src)
    if (node.href) node.href = fix(node.href)
  }

  var fetchFn = window.fetch
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = fix(input)
    else if (input && typeof input.url === 'string') input = new Request(fix(input.url), input)
    return fetchFn.call(this, input, init)
  }

  var xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    if (typeof arguments[1] === 'string') arguments[1] = fix(arguments[1])
    return xhrOpen.apply(this, arguments)
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
    if (typeof url === 'string') url = fix(url)
    return pushStateFn.call(this, state, title, url)
  }
  history.replaceState = function (state, title, url) {
    if (typeof url === 'string') url = fix(url)
    return replaceStateFn.call(this, state, title, url)
  }

  // Block ArcGIS login popups completely.
  var openFn = window.open
  window.open = function (url, target, features) {
    if (typeof url === 'string' && isArcGisLoginUrl(url)) return null
    if (typeof url === 'string') url = fix(url)
    return openFn.call(this, url, target, features)
  }

  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: location.origin + BASE + '/',
        unregister: function () { return Promise.resolve(true) },
        update: function () { return Promise.resolve(this) },
        addEventListener: function () {},
        removeEventListener: function () {},
      })
    }
    if (navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          reg.unregister()
        })
      })
    }
  }

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(scrubAuthNode)
    })
  })
  observer.observe(document.documentElement || document, { childList: true, subtree: true })

  function disableIdentityManager(im) {
    if (!im || im.__authDisabled) return
    im.__authDisabled = true
    try {
      if (im.destroyCredentials) im.destroyCredentials()
    } catch (e) {}
    if (typeof im.getCredential === 'function') {
      im.getCredential = function () {
        return Promise.reject({ name: 'identity-manager:disabled', message: 'Sign-in disabled' })
      }
    }
    if (typeof im.checkSignInStatus === 'function') {
      im.checkSignInStatus = function () {
        return Promise.reject({ name: 'identity-manager:disabled', message: 'Sign-in disabled' })
      }
    }
    if (typeof im.signIn === 'function') {
      im.signIn = function () {
        return Promise.reject({ name: 'identity-manager:disabled', message: 'Sign-in disabled' })
      }
    }
  }

  function watchIdentityManager() {
    try {
      if (window.require) {
        window.require(['esri/identity/IdentityManager'], function (im) {
          disableIdentityManager(im)
        }, function () {})
      }
    } catch (e) {}
    if (window.esriId) disableIdentityManager(window.esriId)
    ;['IdentityManager', 'identityManager', 'esriId'].forEach(function (key) {
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
            disableIdentityManager(current)
          },
        })
        if (current) disableIdentityManager(current)
      } catch (e) {}
    })
  }
  watchIdentityManager()
  setInterval(watchIdentityManager, 1500)

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
})()
