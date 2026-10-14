import { createAccessMiddleware } from './access-server.js'

export function accessServerPlugin() {
  const middleware = createAccessMiddleware()
  return {
    name: 'district-auth-server',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
