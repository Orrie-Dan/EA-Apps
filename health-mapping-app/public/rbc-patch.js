(function () {
  // The RBC portal is mirrored at the root of this app, which is served under
  // a base path (e.g. /health-mapping) and loads this script from
  // <base>/rbc-patch.js. So the mirror lives at location.origin + BASE.
  var BASE = (function () {
    var src = (document.currentScript && document.currentScript.src) || ''
    var fromSrc = src.match(/^[a-z]+:\/\/[^/]+(\/[^?#]*?)?\/rbc-patch\.js(?:[?#]|$)/i)
    return fromSrc ? fromSrc[1] || '' : ''
  })()
  var origin = location.origin + BASE
  var portalUrl = origin + '/portal'
  var exbRoot = BASE + '/portal/apps/experiencebuilder'

  /** Same-origin URLs computed without the base get it put back. */
  function underBase(url) {
    if (!BASE) return url
    if (url.charAt(0) === '/' && url.charAt(1) !== '/') {
      return url === BASE || url.indexOf(BASE + '/') === 0 ? url : BASE + url
    }
    if (url.indexOf(location.origin + '/') === 0 && url.indexOf(origin + '/') !== 0 && url !== origin) {
      return origin + url.slice(location.origin.length)
    }
    return url
  }

  function stay(url) {
    var next = String(url || '')
    if (!next || next.indexOf('data:') === 0 || next.indexOf('blob:') === 0 || next === 'about:blank') {
      return next
    }
    next = next.replace(/https?:\/\/gis\.rbc\.gov\.rw/gi, origin)
    next = next.replace(/wss:\/\/gis\.rbc\.gov\.rw/gi, origin.replace(/^http/, 'ws'))
    next = next.replace(/ws:\/\/gis\.rbc\.gov\.rw/gi, origin.replace(/^https/, 'ws').replace(/^http/, 'ws'))
    if (next.indexOf('/rbc/') === 0) next = next.slice('/rbc'.length) || '/'
    if (next.indexOf(origin + '/rbc/') === 0) next = origin + next.slice((origin + '/rbc').length)
    if (next.indexOf(location.origin) === 0 || next.charAt(0) === '/') return underBase(next)
    if (next.charAt(0) === '?') return next
    if (/^https?:\/\//i.test(next) && next.indexOf(origin) !== 0) {
      try {
        var parsed = new URL(next)
        if (parsed.host === 'gis.rbc.gov.rw') return origin + parsed.pathname + parsed.search + parsed.hash
      } catch (e) {}
    }
    return next
  }

  var fetchFn = window.fetch
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = stay(input)
    else if (input && typeof input.url === 'string') input = new Request(stay(input.url), input)
    return fetchFn.call(this, input, init)
  }

  var xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    if (typeof arguments[1] === 'string') arguments[1] = stay(arguments[1])
    return xhrOpen.apply(this, arguments)
  }

  var setAttr = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    if ((name === 'src' || name === 'href' || name === 'action' || name === 'target') && typeof value === 'string') {
      if (name === 'target' && (value === '_top' || value === '_parent')) value = '_self'
      else if (name !== 'target') value = stay(value)
    }
    return setAttr.call(this, name, value)
  }

  function patchProp(proto, prop) {
    var desc = Object.getOwnPropertyDescriptor(proto, prop)
    if (!desc || !desc.set) return
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        desc.set.call(this, stay(String(value)))
      },
    })
  }

  patchProp(HTMLIFrameElement.prototype, 'src')
  patchProp(HTMLScriptElement.prototype, 'src')
  patchProp(HTMLImageElement.prototype, 'src')
  patchProp(HTMLAnchorElement.prototype, 'href')
  patchProp(HTMLLinkElement.prototype, 'href')
  patchProp(HTMLFormElement.prototype, 'action')

  var hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
  if (hrefDesc && hrefDesc.set) {
    Object.defineProperty(Location.prototype, 'href', {
      configurable: true,
      enumerable: true,
      get: hrefDesc.get,
      set: function (value) {
        hrefDesc.set.call(this, stay(String(value)))
      },
    })
  }
  ;['assign', 'replace'].forEach(function (method) {
    var orig = Location.prototype[method]
    if (!orig) return
    Location.prototype[method] = function (url) {
      return orig.call(this, stay(String(url)))
    }
  })

  var pushStateFn = history.pushState
  var replaceStateFn = history.replaceState
  history.pushState = function (state, title, url) {
    if (typeof url === 'string') url = stay(url)
    return pushStateFn.call(this, state, title, url)
  }
  history.replaceState = function (state, title, url) {
    if (typeof url === 'string') url = stay(url)
    return replaceStateFn.call(this, state, title, url)
  }

  var openFn = window.open
  window.open = function (url, target, features) {
    if (typeof url === 'string') url = stay(url)
    if (target === '_top' || target === '_parent') target = '_self'
    return openFn.call(this, url, target, features)
  }

  if (window.WebSocket) {
    var WS = window.WebSocket
    window.WebSocket = function (url, protocols) {
      return new WS(stay(String(url)), protocols)
    }
    window.WebSocket.prototype = WS.prototype
  }

  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: origin + '/portal/apps/experiencebuilder/',
        unregister: function () { return Promise.resolve(true) },
        update: function () { return Promise.resolve(this) },
        addEventListener: function () {},
        removeEventListener: function () {},
      })
    }
    if (navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister() })
      })
    }
  }

  window.esriConfig = window.esriConfig || {}
  window.esriConfig.portalUrl = portalUrl

  function applyJimu(cfg) {
    if (!cfg || typeof cfg !== 'object') return
    cfg.hostUrl = portalUrl
    cfg.portalUrl = portalUrl
    if (typeof cfg.mountPath === 'string') cfg.mountPath = exbRoot + '/'
  }
  if (window.jimuConfig) applyJimu(window.jimuConfig)
  try {
    var current = window.jimuConfig
    Object.defineProperty(window, 'jimuConfig', {
      configurable: true,
      enumerable: true,
      get: function () { return current },
      set: function (value) {
        current = value
        applyJimu(current)
      },
    })
  } catch (e) {}

  document.querySelectorAll('script[type="webpack-options"], script[type="systemjs-importmap"]').forEach(function (node) {
    var text = node.textContent || ''
    var updated = stay(text)
      .replace(/"mountPath"\s*:\s*"\/"/g, '"mountPath": "' + exbRoot + '/"')
      .replace(/https:\/\/BASE_URL/g, location.origin + exbRoot)
      .replace(/https:\/\/API_URL/g, origin + '/portal/jsapi/jsapi4')
      .replace(/https:\/\/amd-packages/g, origin + '/portal/jsapi/jsapi4')
    if (updated !== text) node.textContent = updated
  })

  console.info('[rbc-proxy] client rewrite active', { portalUrl: portalUrl, exbRoot: exbRoot })
})()
