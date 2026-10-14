import { createAuthMiddleware } from '../../server/auth-core.js'

const middleware = createAuthMiddleware({
  cookie: 'land_hub_session',
  secretFallback: 'land-dev-session-secret',
})

export default function handler(req, res) {
  return middleware(req, res)
}
