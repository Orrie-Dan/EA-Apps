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
    if (path.indexOf('/api/portal/proxy/ewis') === 0) return BASE + '/api/portal/proxy/ewis'
    if (path.indexOf('/api/portal/proxy/rmb') === 0) return BASE + '/api/portal/proxy/rmb'
    if (path.indexOf('/api/portal/proxy/web') === 0) return BASE + '/api/portal/proxy/web'
    return BASE + '/api/portal/proxy/gh'
  }

  function widePrefix() {
    var path = appPathname()
    if (path.indexOf('/api/portal/proxy/ewis') === 0) return BASE + '/api/portal/proxy/ewisw'
    if (path.indexOf('/api/portal/proxy/rmb') === 0) return BASE + '/api/portal/proxy/rmbw'
    if (path.indexOf('/api/portal/proxy/web') === 0) return BASE + '/api/portal/proxy/web'
    return BASE + '/api/portal/proxy/ghw'
  }

  function collapse(url) {
    return url.replace(
      new RegExp('(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/(?:ewisw|ewis|rmbw|rmb|ghw|gh|web)(?=(?:' + BASE_RE + ')?\\/api\\/portal\\/proxy\\/)', 'g'),
      '',
    )
  }

  function rewriteGeoHub(url) {
    return url
      .replace(/https:\/\/ewis\.minema\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/ewis')
      .replace(/https:\/\/ewis\.minema\.gov\.rw/g, origin + BASE + '/api/portal/proxy/ewisw')
      .replace(/https:\/\/gis\.rmb\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/rmb')
      .replace(/https:\/\/gis\.rmb\.gov\.rw/g, origin + BASE + '/api/portal/proxy/rmbw')
      .replace(/https:\/\/gh\.space\.gov\.rw\/portal/g, origin + BASE + '/api/portal/proxy/gh')
      .replace(/https:\/\/gh\.space\.gov\.rw/g, origin + BASE + '/api/portal/proxy/ghw')
  }

  function sameOriginLocal(url) {
    return url.replace(
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?/i,
      protoHost,
    )
  }

  function isHostedSurvey123(url) {
    return /survey123\.arcgis\.com/i.test(String(url || ''))
  }

  function isPortalSurvey(url) {
    return /\/apps\/survey123/i.test(String(url || ''))
  }

  function isPortalLoginOrApp(url) {
    return (
      isHostedSurvey123(url) ||
      isPortalSurvey(url) ||
      /\/apps\/(webappviewer|instant|dashboards|sites|storymaps|insights|minimal)/i.test(
        String(url || ''),
      ) ||
      /\/home\/signin/i.test(String(url || ''))
    )
  }

  function toLiveSurveyUrl(url) {
    var live = unbase(String(url || ''))
      .replaceAll(origin + BASE + '/api/portal/proxy/ewisw', 'https://ewis.minema.gov.rw')
      .replaceAll(origin + BASE + '/api/portal/proxy/ewis', 'https://ewis.minema.gov.rw/portal')
      .replaceAll(origin + BASE + '/api/portal/proxy/rmbw', 'https://gis.rmb.gov.rw')
      .replaceAll(origin + BASE + '/api/portal/proxy/rmb', 'https://gis.rmb.gov.rw/portal')
      .replaceAll(origin + BASE + '/api/portal/proxy/ghw', 'https://gh.space.gov.rw')
      .replaceAll(origin + BASE + '/api/portal/proxy/gh', 'https://gh.space.gov.rw/portal')
      .replaceAll(
        encodeURIComponent(origin + BASE + '/api/portal/proxy/gh'),
        encodeURIComponent('https://gh.space.gov.rw/portal'),
      )
    if (live.indexOf('http://') !== 0 && live.indexOf('https://') !== 0) {
      if (live.indexOf('/portal/') === 0) {
        live = 'https://gh.space.gov.rw' + live
      } else if (live.indexOf('/apps/') === 0 || live.indexOf('/home/') === 0 || live.indexOf('/sharing/') === 0) {
        live = 'https://gh.space.gov.rw/portal' + live
      } else if (live.indexOf('/api/portal/proxy/gh/') === 0) {
        live = 'https://gh.space.gov.rw/portal/' + live.slice('/api/portal/proxy/gh/'.length)
      }
    }
    return live
  }

  var lastSurvey = { url: '', at: 0 }
  var nativeOpen = window.open
  function openSurveyWindow(url) {
    var live = toLiveSurveyUrl(url)
    var now = Date.now()
    if (lastSurvey.url === live && now - lastSurvey.at < 1200) return null
    lastSurvey = { url: live, at: now }
    return nativeOpen.call(window, live, '_blank')
  }

  function prefixSkipped(url) {
    var prefix = proxyPrefix()
    var wide = widePrefix()
    var path = url
    var head = ''
    var match = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/)
    if (match) {
      head = match[1]
      path = match[2] || '/'
      // cdn.arcgis.com, elevation, and basemap hosts also use /sharing/ and /arcgis/.
      // Prefixing those paths makes https://cdn.arcgis.com/api/portal/proxy/gh/sharing/... which 404s.
      if (head !== origin) return url
    }
    path = unbase(path)
    if (path.indexOf('/api/portal/proxy/') === 0) return head + BASE + path
    if (
      path.indexOf('/sharing/') === 0 ||
      path.indexOf('/portal/') === 0 ||
      path.indexOf('/apps/') === 0 ||
      path.indexOf('/jsapi/') === 0 ||
      path.indexOf('/home/') === 0
    ) {
      if (path.indexOf('/portal/') === 0) path = prefix + path.slice('/portal'.length)
      else path = prefix + path
      return head + path
    }
    if (
      path.indexOf('/server/') === 0 ||
      path.indexOf('/arcgis/') === 0 ||
      path.indexOf('/cdn/') === 0 ||
      path.indexOf('/assets/') === 0
    ) {
      return head + wide + path
    }
    return url
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
    if (isHostedSurvey123(url)) return toLiveSurveyUrl(url)
    url = sameOriginLocal(url)
    url = rewriteGeoHub(url)
    url = collapse(url)
    url = prefixSkipped(url)
    url = collapse(url)
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
    if ((name === 'src' || name === 'href') && typeof value === 'string') {
      if (isHostedSurvey123(value)) {
        if (this.tagName === 'IFRAME') openSurveyWindow(value)
        value = toLiveSurveyUrl(value)
      } else if (name === 'href' && isPortalLoginOrApp(value)) {
        value = toLiveSurveyUrl(value)
      } else {
        value = fix(value)
      }
    }
    return setAttr.call(this, name, value)
  }

  function patchSrc(proto) {
    var desc = Object.getOwnPropertyDescriptor(proto, 'src')
    if (!desc || !desc.set) return
    var isIframe = proto === HTMLIFrameElement.prototype
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        var raw = String(value)
        if (isIframe && isHostedSurvey123(raw)) {
          openSurveyWindow(raw)
          desc.set.call(this, toLiveSurveyUrl(raw))
          return
        }
        desc.set.call(this, fix(raw))
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
        var raw = String(value)
        desc.set.call(
          this,
          isHostedSurvey123(raw) || isPortalLoginOrApp(raw) ? toLiveSurveyUrl(raw) : fix(raw),
        )
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
        if (node.src) {
          var nextSrc = isHostedSurvey123(node.src) ? toLiveSurveyUrl(node.src) : fix(node.src)
          if (nextSrc && nextSrc !== node.src) node.src = nextSrc
        }
        if (node.href && node.tagName !== 'BASE') {
          var nextHref =
            isHostedSurvey123(node.href) || isPortalLoginOrApp(node.href)
              ? toLiveSurveyUrl(node.href)
              : fix(node.href)
          if (nextHref && nextHref !== node.href) node.href = nextHref
        }
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

  window.open = function (url, target, features) {
    var href = typeof url === 'string' ? url : url && url.href
    if (typeof href === 'string' && /oauth2\/authorize|\/sharing\/oauth2|\/home\/signin/i.test(href)) {
      return nativeOpen.call(this, fix(href), target || 'arcgis_oauth', features)
    }
    if (typeof href === 'string' && isPortalLoginOrApp(href)) {
      return (
        openSurveyWindow(href) ||
        nativeOpen.call(this, toLiveSurveyUrl(href), target || '_blank', features)
      )
    }
    if (typeof href === 'string') url = fix(href)
    return nativeOpen.call(this, url, target, features)
  }
})()
