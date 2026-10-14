import { checkServerIdentity } from 'node:tls'
import { Agent, buildConnector, fetch as undiciFetch } from 'undici'

// Temporary, narrowly scoped acceptance of an EXPIRED portal certificate.
// Mirrors runtime-config-service src/portal/portal-fetch.ts.
//
// Only the exact certificate identified by its SHA-256 fingerprint is accepted,
// only for its host, only with the expiry as its sole defect, and only until
// `acceptUntil`. Any other certificate (including an impostor's) is still
// rejected, so portal tokens are never sent over an unauthenticated connection.
// Once the portal installs a valid certificate, normal validation passes and
// the exception becomes unused — remove it then.
export const EXPIRED_CERTIFICATE_EXCEPTIONS = Object.freeze([
  // gis.rbc.gov.rw RapidSSL cert expired 2026-10-08 23:59:59 GMT; RBC to renew.
  {
    host: 'gis.rbc.gov.rw',
    sha256:
      '79:01:B8:04:B6:15:2C:C5:6B:5E:35:DC:C8:7A:2E:B9:E4:19:3E:C9:B7:EB:3F:B1:30:B4:5F:95:81:D5:0C:27',
    acceptUntil: Date.parse('2026-11-15T00:00:00Z'),
  },
])

export function activeCertificateException(url, now, exceptions = EXPIRED_CERTIFICATE_EXCEPTIONS) {
  if (url.protocol !== 'https:') return undefined
  const host = url.hostname.toLowerCase()
  return exceptions.find((e) => e.host === host && now < e.acceptUntil)
}

// Returns why the connection must be refused, or null when it is acceptable.
export function pinnedCertificateProblem(tls, exception, now) {
  if (String(tls.hostname || '').toLowerCase() !== exception.host) {
    return new Error('Certificate exception does not cover this host')
  }
  if (tls.authorized) return null
  if (now >= exception.acceptUntil) return new Error('Certificate exception has lapsed')
  if (tls.authorizationError !== 'CERT_HAS_EXPIRED') {
    return new Error(`Certificate rejected: ${tls.authorizationError ?? 'unknown'}`)
  }
  const cert = tls.certificate
  if (!cert || cert.fingerprint256?.toUpperCase() !== exception.sha256) {
    return new Error('Certificate does not match the pinned fingerprint')
  }
  return checkServerIdentity(exception.host, cert) ?? null
}

const agents = new Map()

function agentFor(exception) {
  let agent = agents.get(exception.host)
  if (agent) return agent
  // Chain verification is done in pinnedCertificateProblem instead of by
  // OpenSSL rejection, so the one known expired certificate can pass.
  // No TLS session resumption: a resumed session presents no certificate, so
  // the fingerprint check would refuse every other connection.
  const base = buildConnector({ rejectUnauthorized: false, maxCachedSessions: 0 })
  agent = new Agent({
    connect: (opts, callback) =>
      base(opts, (error, socket) => {
        if (error || !socket) return callback(error ?? new Error('No socket'), null)
        const problem = pinnedCertificateProblem(
          {
            hostname: opts.hostname,
            authorized: socket.authorized,
            authorizationError: socket.authorizationError ? String(socket.authorizationError) : undefined,
            certificate: socket.getPeerCertificate?.() ?? null,
          },
          exception,
          Date.now(),
        )
        if (problem) {
          socket.destroy()
          return callback(problem, null)
        }
        callback(null, socket)
      }),
  })
  agents.set(exception.host, agent)
  return agent
}

// fetch() for portal upstreams. Identical to the global fetch except for hosts
// with an active expired-certificate exception.
export function portalFetch(input, init = {}) {
  const url = new URL(String(input))
  const exception = activeCertificateException(url, Date.now())
  if (!exception) return fetch(url, init)
  return undiciFetch(url, { ...init, dispatcher: agentFor(exception) })
}
