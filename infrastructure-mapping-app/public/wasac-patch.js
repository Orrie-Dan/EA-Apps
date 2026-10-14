(function () {
  var prefix = '/wasac'
  var origin = location.origin
  var exbRoot = prefix + '/portal/apps/experiencebuilder'

  function undouble(url) {
    var next = String(url || '')
    next = next.replace(/^(https?:\/\/[^/]+)\/+(https?:\/\/[^/]+)/i, '$1')
    next = next.replace(/^\/+(https?:\/\/[^/]+)/i, '')
    next = next.replace(/^(https?:\/\/[^/]+)\/+(https?:\/)/i, '$1/')
    return next
  }

  function toPath(url) {
    var next = undouble(url)
    if (!next) return next
    if (next.indexOf('//') === 0 && next.indexOf('///') !== 0) next = location.protocol + next
    next = next.replace(/https?:\/\/gis\.wasac\.rw/gi, '')
    next = next.replace(/wss:\/\/gis\.wasac\.rw/gi, '')
    next = next.replace(/ws:\/\/gis\.wasac\.rw/gi, '')
    if (next.indexOf(origin) === 0) next = next.slice(origin.length) || '/'
    if (/^https?:\/\//i.test(next)) {
      try {
        var parsed = new URL(next)
        next = parsed.pathname + parsed.search + parsed.hash
      } catch (e) {}
    }
    if (!next) return next
    if (next.indexOf('wasac/') === 0) next = '/' + next
    if (next.charAt(0) !== '/') return next
    if (next.indexOf(prefix + '/https:') === 0 || next.indexOf(prefix + '/http:') === 0) {
      next = undouble(next.slice(prefix.length))
    }
    if (next.indexOf('/wasac/wasac/') === 0) next = next.replace(/^\/wasac\/wasac/, '/wasac')
    while (next.indexOf('/wasac/portal/wasac/portal/') === 0) {
      next = next.replace('/wasac/portal/wasac/portal/', '/wasac/portal/')
    }
    if (next.indexOf(prefix + '/portal/') === 0) return next.replace(/([^:])\/{2,}/g, '$1/')
    if (next.indexOf(prefix + '/apps/') === 0) next = prefix + '/portal' + next.slice(prefix.length)
    if (next.indexOf('/portal/') === 0) next = prefix + next
    else if (next.indexOf('/apps/') === 0) next = prefix + '/portal' + next
    else if (next.indexOf('/sharing/') === 0) next = prefix + '/portal' + next
    else if (next.indexOf('/home/') === 0) next = prefix + '/portal' + next
    else if (
      next.indexOf('/server/') === 0 ||
      next.indexOf('/arcgis/') === 0 ||
      next.indexOf('/cdn/') === 0 ||
      next.indexOf('/assets/') === 0 ||
      next.indexOf('/arcgisportal/') === 0
    ) {
      next = prefix + next
    } else if (
      next.indexOf('/jimu-') === 0 ||
      next.indexOf('/experience/') === 0 ||
      next.indexOf('/widgets/') === 0 ||
      next.indexOf('/themes/') === 0 ||
      next.indexOf('/calcite-components') === 0
    ) {
      next = exbRoot + next
    }
    if (next.charAt(0) !== '/') next = '/' + next
    return next.replace(/([^:])\/{2,}/g, '$1/')
  }

  function rewrite(url) {
    if (typeof url !== 'string' || !url) return url
    if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0 || url === 'about:blank') return url
    if (url.indexOf('/wasac-patch.js') !== -1 || url.indexOf('/@vite') === 0 || url.indexOf('/node_modules') === 0) {
      return url
    }
    return toPath(url)
  }

  var fetchFn = window.fetch
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = rewrite(input)
    else if (input && typeof input.url === 'string') input = new Request(rewrite(input.url), input)
    return fetchFn.call(this, input, init)
  }

  var xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    if (typeof arguments[1] === 'string') arguments[1] = rewrite(arguments[1])
    return xhrOpen.apply(this, arguments)
  }

  var setAttr = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    if ((name === 'src' || name === 'href' || name === 'action') && typeof value === 'string') {
      value = rewrite(value)
    }
    return setAttr.call(this, name, value)
  }

  function patchProp(proto, prop) {
    var desc = Object.getOwnPropertyDescriptor(proto, 'src')
    if (prop === 'href') desc = Object.getOwnPropertyDescriptor(proto, 'href')
    if (prop === 'action') desc = Object.getOwnPropertyDescriptor(proto, 'action')
    if (!desc || !desc.set) return
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        desc.set.call(this, rewrite(String(value)))
      },
    })
  }

  patchProp(HTMLIFrameElement.prototype, 'src')
  patchProp(HTMLScriptElement.prototype, 'src')
  patchProp(HTMLImageElement.prototype, 'src')
  patchProp(HTMLAnchorElement.prototype, 'href')
  patchProp(HTMLLinkElement.prototype, 'href')
  patchProp(HTMLFormElement.prototype, 'action')

  var pushStateFn = history.pushState
  var replaceStateFn = history.replaceState
  history.pushState = function (state, title, url) {
    if (typeof url === 'string') url = rewrite(url)
    return pushStateFn.call(this, state, title, url)
  }
  history.replaceState = function (state, title, url) {
    if (typeof url === 'string') url = rewrite(url)
    return replaceStateFn.call(this, state, title, url)
  }

  var openFn = window.open
  window.open = function (url, target, features) {
    if (typeof url === 'string') url = rewrite(url)
    return openFn.call(this, url, target, features)
  }

  if (window.WebSocket) {
    var WS = window.WebSocket
    window.WebSocket = function (url, protocols) {
      var next = rewrite(String(url))
      if (next.charAt(0) === '/') {
        next = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + next
      }
      return new WS(next, protocols)
    }
    window.WebSocket.prototype = WS.prototype
  }

  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: location.origin + prefix + '/',
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

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (!node || !node.tagName) return
        if (node.getAttribute && node.getAttribute('src')) {
          node.setAttribute('src', rewrite(node.getAttribute('src')))
        }
        if (node.getAttribute && node.getAttribute('href')) {
          node.setAttribute('href', rewrite(node.getAttribute('href')))
        }
      })
    })
  })
  observer.observe(document.documentElement || document, { childList: true, subtree: true })

  var portalUrl = origin + prefix + '/portal'
  var exbAbs = origin + exbRoot
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

  function hookIdentity(im) {
    if (!im || im.__wasacPatched) return
    im.__wasacPatched = true
    try { im.oAuthPopupConfirmation = false } catch (e) {}
  }

  function watchIdentity() {
    hookIdentity(window.esriId)
    hookIdentity(window.identityManager)
    hookIdentity(window.IdentityManager)
    if (typeof window.require === 'function') {
      try {
        window.require(['esri/identity/IdentityManager'], hookIdentity, function () {})
      } catch (e) {}
    }
  }
  watchIdentity()
  setInterval(watchIdentity, 1200)

  document.querySelectorAll('script[type="webpack-options"], script[type="systemjs-importmap"]').forEach(function (node) {
    var text = node.textContent || ''
    var updated = text
      .replace(/"mountPath"\s*:\s*"\/"/g, '"mountPath": "' + exbRoot + '/"')
      .replace(/https:\/\/BASE_URL/g, exbAbs)
      .replace(/https:\/\/API_URL/g, origin + prefix + '/portal/jsapi/jsapi4')
      .replace(/https:\/\/amd-packages/g, origin + prefix + '/portal/jsapi/jsapi4')
    if (updated !== text) node.textContent = updated
  })
})()
