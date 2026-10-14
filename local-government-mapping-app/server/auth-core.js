import crypto from 'node:crypto'

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_AUTH_TIMEOUT_MS = 20_000

const PORTAL_URL = 'https://gh.space.gov.rw/portal'

function portalUrl() {
  return (process.env.PORTAL_URL || PORTAL_URL).replace(/\/$/, '')
}

export function publicOrigin(req) {
  const envOrigin = process.env.PUBLIC_ORIGIN
  if (envOrigin) return envOrigin.replace(/\/$/, '')
  const host = req?.headers?.host || 'localhost'
  const forwarded = req?.headers?.['x-forwarded-proto']
  const proto = forwarded || (process.env.VERCEL ? 'https' : 'https')
  return `${proto}://${host}`
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))]
      }),
  )
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}')
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

export function createAuthMiddleware({ cookie, secretFallback }) {
  function secret() {
    return process.env.SESSION_SECRET || secretFallback
  }

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
    return `${body}.${sig}`
  }

  function unsign(value) {
    if (!value || !value.includes('.')) return null
    const [body, sig] = value.split('.')
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString())
      if (data.expiresAt && Date.now() > data.expiresAt) return null
      return data
    } catch {
      return null
    }
  }

  function readSession(req) {
    return unsign(parseCookies(req.headers.cookie)[cookie])
  }

  function cookieSecure(req) {
    const origin = (process.env.PUBLIC_ORIGIN || publicOrigin(req) || '').replace(/\/$/, '')
    return origin.startsWith('https://') || process.env.NODE_ENV === 'production' || process.env.VERCEL
      ? '; Secure'
      : ''
  }

  function setSessionCookie(res, payload, maxAgeSec, req) {
    const secure = cookieSecure(req)
    res.setHeader('Set-Cookie', [
      `${cookie}=${sign(payload)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`,
    ])
  }

  function clearSessionCookie(res, req) {
    const secure = cookieSecure(req)
    res.setHeader('Set-Cookie', [`${cookie}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`])
  }

  async function generatePortalToken(username, password, req) {
    const { mintPortalTokens } = await import('./portal-auth.js')
    return mintPortalTokens(username, password, publicOrigin(req))
  }

  async function hydrateUser(token) {
    const url = `${portalUrl()}/sharing/rest/community/self?f=json&token=${encodeURIComponent(token)}`
    const response = await fetch(url, { signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS) })
    if (!response.ok) return { username: 'User' }
    const data = await response.json()
    if (data.error) return { username: 'User' }
    return {
      username: data.username || data.fullName || 'User',
      fullName: data.fullName || data.username,
      email: data.email,
    }
  }

  async function handleApi(req, res, url) {
    const { pathname } = url

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const username = String(body.username || '').trim()
      const password = String(body.password || '')
      if (!username || !password) {
        sendJson(res, 400, { error: 'Enter a username and password' })
        return true
      }
      try {
        const tokenData = await generatePortalToken(username, password, req)
        const user = await hydrateUser(tokenData.token)
        const expiresAt = Number(tokenData.expires) || Date.now() + 20160 * 1000
        setSessionCookie(
          res,
          {
            token: tokenData.token,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            expiresAt,
          },
          Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
          req,
        )
        sendJson(res, 200, {
          authenticated: true,
          user,
          token: tokenData.token,
          tokens: tokenData.tokens,
          expiresAt,
        })
      } catch (error) {
        sendJson(res, error?.name === 'TimeoutError' ? 504 : 401, {
          error: error?.name === 'TimeoutError' ? 'The mapping portal did not respond in time. Please try again.' : error.message || 'Invalid username or password',
        })
      }
      return true
    }

    if (pathname === '/api/auth/session' && req.method === 'GET') {
      const session = readSession(req)
      if (!session?.token) {
        sendJson(res, 200, { authenticated: false })
        return true
      }
      sendJson(res, 200, {
        authenticated: true,
        user: {
          username: session.username,
          fullName: session.fullName,
          email: session.email,
        },
      })
      return true
    }

    if (pathname === '/api/auth/logout') {
      clearSessionCookie(res, req)
      if (req.method === 'POST') {
        sendJson(res, 200, { authenticated: false })
        return true
      }
      res.statusCode = 302
      res.setHeader('Location', '/login')
      res.end()
      return true
    }

    return false
  }

  return async function authMiddleware(req, res, next) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      if (!url.pathname.startsWith('/api/auth')) {
        if (typeof next === 'function') next()
        else sendJson(res, 404, { error: 'Not found' })
        return
      }
      const handled = await handleApi(req, res, url)
      if (!handled) {
        if (typeof next === 'function') next()
        else sendJson(res, 404, { error: 'Not found' })
      }
    } catch (error) {
      if (res.headersSent) return void res.end()
      sendJson(res, error?.name === 'TimeoutError' ? 504 : 500, { error: error.message || 'Auth server error' })
    }
  }
}
