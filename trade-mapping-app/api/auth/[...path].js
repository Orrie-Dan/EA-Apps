import { createAuthMiddleware } from '../../server/auth-core.js'

const middleware = createAuthMiddleware({
  cookie: 'trade_hub_session',
  secretFallback: 'demotrade-dev-session-secret',
})

export default function handler(req, res) {
  return middleware(req, res)
}
