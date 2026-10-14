import { loadEnv } from 'vite'
import { createAccessMiddleware } from './access-server.js'
import { createPortalMirror } from './portal-mirror.js'

function installFirst(server, handle) {
  server.middlewares.stack.unshift({ route: '', handle })
}

function wrap(middleware) {
  return (req, res, next) => {
    Promise.resolve(middleware(req, res, next)).catch((error) => {
      if (res.headersSent) return void res.end()
      res.statusCode = error?.name === 'TimeoutError' ? 504 : 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: error.message || 'portal middleware error' }))
    })
  }
}

export function accessServerPlugin() {
  const mirror = createPortalMirror()
  return {
    name: 'infra-access-server',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      for (const [key, value] of Object.entries(env)) {
        process.env[key] = value
      }
    },
    configureServer(server) {
      // Preserve WASAC /portal mirror for localShell experience embeds.
      installFirst(server, wrap(mirror))
      server.middlewares.use(createAccessMiddleware())
    },
    configurePreviewServer(server) {
      installFirst(server, wrap(mirror))
      server.middlewares.use(createAccessMiddleware())
    },
  }
}
