import { createAccessMiddleware } from './access-server.js'

export function accessServerPlugin() {
  const middleware = createAccessMiddleware()
  return {
    name: 'education-mapping-access-server',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
