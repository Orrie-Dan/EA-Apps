import { Navigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import ArcGisDashboardFrame from '../components/ArcGisDashboardFrame'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { usePortalAccess } from '../auth/PortalAccessProvider'
import {
  buildProxyEmbedUrl,
  portalHostForUrl,
  sanitizePortalEmbedUrl,
  PORTAL_URL,
  PROXY_HOSTS,
  PROXY_PATHS,
  SURVEY123_ORIGIN,
} from '../lib/access.js'
import { STATIC_BUILD } from '../config/deployMode.js'
import { runtimeProxyFrameUrl } from '../auth/runtimeSessionAuth.js'

function needsPortalBroker(solution) {
  if (!solution) return false
  if (solution.localShellPath) return false
  if (solution.portalHostKey === 'web') return false
  if (solution.kind === 'external' && solution.externalUrl) return false
  if (solution.kind === 'survey123') return false
  return Boolean(solution.portalItemId && solution.portalHostKey)
}

/**
 * Frame source for a static build (no app server). Protected portal pages go
 * through the Runtime Config service's session-gated proxy, which attaches the
 * portal token server-side (MoE included, with its own `moe` credential). Hosts
 * that are never proxied (null PROXY_PATHS) are framed at their portal URL. Survey123
 * forms are framed from survey123.arcgis.com and ask for a portal sign-in
 * themselves.
 */
export function staticFrameSrc(solution, portalHostKey) {
  if (!solution) return null
  const itemId = String(solution.portalItemId || '').trim()
  const kind = solution.authKind || solution.kind
  const root = String(PROXY_HOSTS[portalHostKey] || PORTAL_URL).replace(/\/$/, '')

  if (kind === 'survey123') {
    if (!itemId) return null
    return `${SURVEY123_ORIGIN}/share/${encodeURIComponent(itemId)}?portalUrl=${encodeURIComponent(root)}`
  }
  if (solution.localShellPath) {
    // A shell on a proxied portal goes through the Runtime Config proxy too.
    const shellHost = portalHostForUrl(solution.localShellPath, portalHostKey)
    if (shellHost && PROXY_PATHS[shellHost] !== null) {
      return runtimeProxyFrameUrl(solution.localShellPath, shellHost)
    }
    return solution.localShellPath
  }
  if (!needsPortalBroker(solution)) return solution.embedUrl || null
  if (!PROXY_HOSTS[portalHostKey]) return null

  const portalUrl =
    kind === 'experience'
      ? `${root}/apps/experiencebuilder/experience/?id=${encodeURIComponent(itemId)}`
      : `${root}/apps/dashboards/${encodeURIComponent(itemId)}`
  if (PROXY_PATHS[portalHostKey] === null) return portalUrl
  return runtimeProxyFrameUrl(portalUrl, portalHostKey)
}

/**
 * Secured ArcGIS content viewer (AUTH-04).
 * Broker token is deposited into an HttpOnly host session, then content is
 * loaded through the same-origin portal proxy — never via ?token= iframe URLs.
 */
export default function AppViewer() {
  const { getSolution } = useRuntimeConfig()
  const { moduleId, solutionId } = useParams()
  const { module: current, solution } = getSolution(moduleId, solutionId)
  const { ensureToken, refresh, getHostState } = usePortalAccess()
  const [preparing, setPreparing] = useState(true)

  const portalHostKey =
    typeof solution?.portalHostKey === 'string'
      ? solution.portalHostKey.trim().toLowerCase()
      : ''
  const secured = needsPortalBroker(solution)
  const hostState = getHostState(portalHostKey)
  const staticSrc = useMemo(
    () => (STATIC_BUILD ? staticFrameSrc(solution, portalHostKey) : null),
    [solution, portalHostKey],
  )

  useEffect(() => {
    if (STATIC_BUILD || !secured || !portalHostKey) {
      setPreparing(false)
      return undefined
    }

    let cancelled = false
    setPreparing(true)
    void ensureToken(portalHostKey)
      .then(() => {
        if (!cancelled) setPreparing(false)
      })
      .catch(() => {
        if (!cancelled) setPreparing(false)
      })

    return () => {
      cancelled = true
    }
  }, [ensureToken, portalHostKey, secured, solutionId, moduleId])

  const proxySrc = useMemo(() => {
    if (!secured || hostState.status !== 'ready' || !hostState.proxyReady) {
      return null
    }
    return buildProxyEmbedUrl({
      kind: solution.authKind || solution.kind,
      authKind: solution.authKind,
      portalItemId: solution.portalItemId,
      portalHostKey,
      host: portalHostKey,
    })
  }, [secured, solution, hostState.status, hostState.proxyReady, portalHostKey])

  if (!current || !solution) return <Navigate to="/" replace />

  if (STATIC_BUILD) {
    if (!staticSrc) {
      return (
        <section className="viewer viewer--pane viewer--status">
          <p role="alert">
            {secured
              ? 'This map is missing a Portal item configuration. Ask an administrator to set portalItemId and portalHostKey on the catalog item.'
              : 'Coming soon.'}
          </p>
        </section>
      )
    }
    return (
      <section className="viewer viewer--pane">
        <ArcGisDashboardFrame key={staticSrc} title={solution.name} src={staticSrc} />
      </section>
    )
  }

  if (!solution.embedUrl && !secured) {
    return (
      <section className="viewer viewer--pane">
        <p>Coming soon.</p>
      </section>
    )
  }

  if (!secured) {
    return (
      <section className="viewer viewer--pane">
        <ArcGisDashboardFrame title={solution.name} src={solution.embedUrl} />
      </section>
    )
  }

  if (!portalHostKey) {
    return (
      <section className="viewer viewer--pane viewer--status">
        <p role="alert">
          This map is missing a Portal host configuration. Ask an administrator
          to set portalHostKey on the catalog item.
        </p>
      </section>
    )
  }

  if (preparing || hostState.status === 'loading' || hostState.status === 'idle') {
    return (
      <section className="viewer viewer--pane viewer--status">
        <div className="boot-orbit" aria-label="Loading map" />
        <p>Connecting to the mapping portal…</p>
      </section>
    )
  }

  if (hostState.status === 'error' || !proxySrc) {
    return (
      <section className="viewer viewer--pane viewer--status">
        <p role="alert">
          {hostState.error ||
            'Unable to connect to the mapping portal. Please try again.'}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setPreparing(true)
            void refresh(portalHostKey)
              .then(() => setPreparing(false))
              .catch(() => setPreparing(false))
          }}
        >
          Retry
        </button>
      </section>
    )
  }

  if (import.meta.env.DEV) {
    console.info('[portal-embed]', sanitizePortalEmbedUrl(proxySrc))
  }

  return (
    <section className="viewer viewer--pane">
      <ArcGisDashboardFrame title={solution.name} src={proxySrc} />
    </section>
  )
}
