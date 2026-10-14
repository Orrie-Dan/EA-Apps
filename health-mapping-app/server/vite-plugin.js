import { loadEnv } from 'vite'
import { createAccessMiddleware } from './access-server.js'
import { handleRbcProxy, isRbcMirrorRequest, isRbcProxyPath } from './rbc-proxy.js'

function installFirst(server, handle) {
  server.middlewares.stack.unshift({ route: '', handle })
}

function rbcMirror(req, res, next) {
  Promise.resolve(
    (async () => {
      const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
      if (isRbcProxyPath(url.pathname) || isRbcMirrorRequest(url.pathname, req.headers.referer || '')) {
        await handleRbcProxy(req, res, url)
        return
      }
      next()
    })(),
  ).catch((error) => {
    if (res.headersSent) return void res.end()
    res.statusCode = error?.name === 'TimeoutError' ? 504 : 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: error.message || 'RBC proxy error' }))
  })
}

export function accessServerPlugin() {
  return {
    name: 'derma-access-server',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      for (const [key, value] of Object.entries(env)) {
        process.env[key] = value
      }
    },
    configureServer(server) {
      installFirst(server, rbcMirror)
      server.middlewares.use(createAccessMiddleware())
    },
    configurePreviewServer(server) {
      installFirst(server, rbcMirror)
      server.middlewares.use(createAccessMiddleware())
    },
  }
}
