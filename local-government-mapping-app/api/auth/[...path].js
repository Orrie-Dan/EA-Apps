import { createAuthMiddleware } from '../../server/auth-core.js'

const middleware = createAuthMiddleware({
  cookie: 'district_hub_session',
  secretFallback: 'district-dev-session-secret',
})

export default function handler(req, res) {
  return middleware(req, res)
}
