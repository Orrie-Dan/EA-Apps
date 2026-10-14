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
    if (navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          reg.unregister()
        })
      })
    }
  }

  function proxyPrefix() {
    var path = appPathname()
    if (path.indexOf('/api/portal/proxy/wasacw') === 0) return BASE + '/api/portal/proxy/wasac'
    if (path.indexOf('/api/portal/proxy/wasac') === 0) return BASE + '/api/portal/proxy/wasac'
    if (path.indexOf('/api/portal/proxy/ruraw') === 0) return BASE + '/api/portal/proxy/rura'
    if (path.indexOf('/api/portal/proxy/rura') === 0) return BASE + '/api/portal/proxy/rura'
    if (path.indexOf('/api/portal/proxy/regw') === 0) return BASE + '/api/portal/proxy/reg'
    if (path.indexOf('/api/portal/proxy/reg') === 0) return BASE + '/api/portal/proxy/reg'
    if (path.indexOf('/api/portal/proxy/cokw') === 0) return BASE + '/api/portal/proxy/cok'
    if (path.indexOf('/api/portal/proxy/cok') === 0) return BASE + '/api/portal/proxy/cok'
    if (path.indexOf('/api/portal/proxy/web') === 0) return BASE + '/api/portal/proxy/web'
    // gh2 (GeoHub under the geohub2 credential) before gh, which it contains.
    if (path.indexOf('/api/portal/proxy/gh2') === 0) return BASE + '/api/portal/proxy/gh2'
    if (path.indexOf('/api/portal/proxy/ghw') === 0) return BASE + '/api/portal/proxy/gh'
    if (path.indexOf('/api/portal/proxy/gh') === 0) return BASE + '/api/portal/proxy/gh'
    return BASE + '/api/portal/proxy/gh'
  }

  function widePrefix() {
    var path = appPathname()
    if (path.indexOf('/api/portal/proxy/wasac') === 0) return BASE + '/api/portal/proxy/wasacw'
    if (path.indexOf('/api/portal/proxy/rura') === 0) return BASE + '/api/portal/proxy/ruraw'
    if (path.indexOf('/api/portal/proxy/reg') === 0) return BASE + '/api/portal/proxy/regw'
    if (path.indexOf('/api/portal/proxy/cok') === 0) return BASE + '/api/portal/proxy/cokw'
    if (path.indexOf('/api/portal/proxy/web') === 0) return BASE + '/api/portal/proxy/web'
    if (path.indexOf('/api/portal/proxy/gh2') === 0) return BASE + '/api/portal/proxy/gh2w'
    return BASE + '/api/portal/proxy/ghw'
  }

  function collapse(url) {
    return String(url || '').replace(
      new RegExp('(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/(?:gh2w|gh2|gh|ghw|wasacw|wasac|ruraw|rura|regw|reg|cokw|cok|web)(?=(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/)', 'g'),
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

  function unglueProxyHost(url) {
    var next = String(url || '')
    next = next.replace(
      new RegExp('(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/(?:gh2w|gh2|gh|ghw|wasacw|wasac|ruraw|rura|regw|reg|cokw|cok|web)(?=https?:)', 'gi'),
      '',
    )
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
      .replace(/https:\/\/gis\.wasac\.rw\/portal/g, origin + BASE + '/api/portal/proxy/wasac')
      .replace(/https:\/\/gis\.wasac\.rw/g, origin + BASE + '/api/portal/proxy/wasacw')
      .replace(/https:\/\/arcgis\.rura\.rw\/portal/g, origin + BASE + '/api/portal/proxy/rura')
      .replace(/https:\/\/arcgis\.rura\.rw/g, origin + BASE + '/api/portal/proxy/ruraw')
      .replace(/https:\/\/gisweb\.reg\.rw\/portal/g, origin + BASE + '/api/portal/proxy/reg')
      .replace(/https:\/\/gisweb\.reg\.rw/g, origin + BASE + '/api/portal/proxy/regw')
      .replace(/https:\/\/inspection\.kigalicity\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/cok')
      .replace(/https:\/\/inspection\.kigalicity\.gov\.rw/g, origin + BASE + '/api/portal/proxy/cokw')
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

  /** ArcGIS portal proxy wraps absolute URLs — unwrap so we can same-origin them. */
  function unwrapSharingProxy(url) {
    var raw = String(url || '')
    var marker = '/sharing/proxy/'
    var idx = raw.indexOf(marker)
    if (idx < 0) {
      marker = '/sharing/proxy?'
      idx = raw.indexOf(marker)
      if (idx < 0) return url
    }
    var q = raw.indexOf('?', idx)
    if (q < 0) return url
    var target = raw.slice(q + 1)
    if (/^https?:\/\//i.test(target)) return target
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

  function experienceIdFromUrl(url) {
    var match = String(url || location.href).match(/id(?:=|%3D)([a-f0-9]{32})/i)
    return match ? match[1] : ''
  }

  function toPortalOauthPopup(url) {
    if (typeof url !== 'string' || !/oauth2\/authorize/i.test(url)) return null
    var appId = experienceIdFromUrl(url) || experienceIdFromUrl(location.href)
    var authorize = new URL('https://gh.space.gov.rw/portal/sharing/rest/oauth2/authorize')
    authorize.searchParams.set('client_id', 'experienceBuilder')
    authorize.searchParams.set('response_type', 'token')
    authorize.searchParams.set('expiration', '20160')
    authorize.searchParams.set('state', 'experienceBuilder')
    authorize.searchParams.set('popup', 'true')
    authorize.searchParams.set('force_login', 'false')
    var callback = new URL(
      'https://gh.space.gov.rw/portal/apps/experiencebuilder/jimu-core/oauth-callback.html',
    )
    callback.searchParams.set('clientId', 'experienceBuilder')
    callback.searchParams.set('portal', 'https://gh.space.gov.rw/portal/sharing/rest')
    callback.searchParams.set('popup', 'true')
    callback.searchParams.set('isInPortal', 'true')
    callback.searchParams.set('isDevEdition', 'false')
    callback.searchParams.set('isOutOfExb', 'false')
    callback.searchParams.set('mountPath', '/portal/apps/experiencebuilder/')
    if (appId) {
      callback.searchParams.set(
        'fromUrl',
        'https://gh.space.gov.rw/portal/apps/experiencebuilder/experience/?id=' + appId,
      )
    }
    authorize.searchParams.set('redirect_uri', callback.toString())
    return authorize.toString()
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
    if (/oauth2\/authorize/i.test(url)) return url
    url = unwrapSharingProxy(url)
    url = unglueProxyHost(url)
    url = undoubleOrigin(url)
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

  var fetchFn = window.fetch
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = fix(input)
    else if (input && typeof input.url === 'string') input = new Request(fix(input.url), input)
    return fetchFn.call(this, input, init)
  }

  var openFn = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    if (typeof arguments[1] === 'string') arguments[1] = fix(arguments[1])
    return openFn.apply(this, arguments)
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

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (!node || !node.tagName) return
        if (node.src) node.src = fix(node.src)
        if (node.href) node.href = fix(node.href)
      })
    })
  })
  observer.observe(document.documentElement || document, { childList: true, subtree: true })

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

  var nativeAdd = window.addEventListener
  window.addEventListener = function (type, listener, options) {
    if (type === 'message' && typeof listener === 'function') {
      var wrapped = function (event) {
        if (event.origin === 'https://gh.space.gov.rw') {
          return listener.call(this, {
            data: event.data,
            origin: location.origin,
            source: event.source,
            lastEventId: event.lastEventId,
            ports: event.ports,
            type: 'message',
            preventDefault: function () {
              event.preventDefault()
            },
            stopPropagation: function () {
              event.stopPropagation()
            },
            stopImmediatePropagation: function () {
              event.stopImmediatePropagation()
            },
          })
        }
        return listener.call(this, event)
      }
      return nativeAdd.call(this, type, wrapped, options)
    }
    return nativeAdd.call(this, type, listener, options)
  }

  var nativeOpen = window.open
  window.open = function (url, target, features) {
    var href = typeof url === 'string' ? url : url && url.href
    var oauth = toPortalOauthPopup(href)
    if (oauth) return nativeOpen.call(this, oauth, target || 'arcgis_oauth', features)
    if (typeof href === 'string') url = fix(href)
    return nativeOpen.call(this, url, target, features)
  }
})()
