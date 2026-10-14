// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_AUTH_TIMEOUT_MS = 20_000

function portalUrl() {
  return String(process.env.PORTAL_URL || 'https://infrastructure.space.gov.rw/portal').replace(/\/$/, '')
}

function clientId() {
  return String(process.env.PORTAL_CLIENT_ID || '').trim()
}

function clientSecret() {
  return String(process.env.PORTAL_CLIENT_SECRET || '').trim()
}

export function envPortalToken() {
  return String(process.env.PORTAL_TOKEN || '').trim()
}

function errorMessage(data, fallback = 'Invalid username or password') {
  return data?.error?.message || data?.error?.details?.[0] || data?.error_description || fallback
}

async function postForm(path, params) {
  const response = await fetch(`${portalUrl()}${path}`, {
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  return response.json()
}

async function generateToken(username, password, extra) {
  const body = new URLSearchParams({
    username,
    password,
    expiration: '20160',
    f: 'json',
    ...extra,
  })
  if (clientId()) body.set('clientid', clientId())
  const data = await postForm('/sharing/rest/generateToken', body)
  if (!data?.token) throw new Error(errorMessage(data))
  return {
    token: data.token,
    expires: Number(data.expires) || Date.now() + 20160 * 1000,
  }
}

async function oauthPasswordToken(username, password) {
  if (!clientId() || !clientSecret()) return null
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId(),
    client_secret: clientSecret(),
    username,
    password,
    f: 'json',
  })
  const data = await postForm('/sharing/rest/oauth2/token', body)
  const token = data.access_token || data.token
  if (!token) return null
  return {
    token,
    expires: Date.now() + Number(data.expires_in || 1800) * 1000,
  }
}

export async function hydrateUser(token) {
  if (!token) return null
  const url = `${portalUrl()}/sharing/rest/community/self?f=json&token=${encodeURIComponent(token)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS) })
  if (!response.ok) return null
  const data = await response.json()
  if (data?.error || !data?.username) return null
  return {
    username: data.username || data.fullName || 'User',
    fullName: data.fullName || data.username,
    email: data.email,
  }
}

export async function envTokenIfValid() {
  const token = envPortalToken()
  if (!token) return null
  const user = await hydrateUser(token)
  if (!user) return null
  return {
    token,
    expires: Date.now() + 60 * 60 * 1000,
    user,
  }
}

async function tryGenerate(username, password, extra) {
  try {
    return await generateToken(username, password, extra)
  } catch {
    return null
  }
}

export async function mintPortalTokens(username, password, reqOrigin) {
  const origin = String(reqOrigin || '').replace(/\/$/, '')
  const portalOrigin = new URL(portalUrl()).origin

  const [requestIp, originTok, surveyTok, portalTok, oauthTok] = await Promise.all([
    tryGenerate(username, password, { client: 'requestip' }),
    origin
      ? tryGenerate(username, password, { client: 'referer', referer: origin })
      : Promise.resolve(null),
    tryGenerate(username, password, {
      client: 'referer',
      referer: 'https://survey123.arcgis.com',
    }),
    tryGenerate(username, password, { client: 'referer', referer: portalOrigin }),
    oauthPasswordToken(username, password),
  ])

  const envTok = await envTokenIfValid()
  const first = requestIp || originTok || oauthTok || portalTok || surveyTok
  if (!first?.token) {
    throw new Error('Invalid username or password')
  }

  const originToken = requestIp?.token || originTok?.token || oauthTok?.token || first.token
  const surveyToken = surveyTok?.token || requestIp?.token || first.token
  const portalToken = portalTok?.token || requestIp?.token || envTok?.token || first.token

  return {
    token: originToken,
    tokens: {
      origin: originToken,
      survey123: surveyToken,
      portal: portalToken,
    },
    expires: first.expires || Date.now() + 20160 * 1000,
  }
}

export async function gisToken(sessionToken) {
  return sessionToken || envPortalToken() || ''
}
