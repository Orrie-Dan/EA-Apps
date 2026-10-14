import { Navigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import ArcGisDashboardFrame from '../components/ArcGisDashboardFrame'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { usePortalAccess } from '../auth/PortalAccessProvider'
import {
  buildAppSource,
  buildProxyEmbedUrl,
  sanitizePortalEmbedUrl,
  PORTAL_URL,
  PROXY_HOSTS,
} from '../lib/access.js'
import { STATIC_BUILD } from '../config/deployMode.js'
import { runtimeProxyFrameUrl } from '../auth/runtimeSessionAuth.js'

function needsPortalBroker(solution) {
  if (!solution) return false
  if (solution.localShellPath) return false
  if (solution.kind === 'external') return false
  if (solution.kind === 'survey123') return false
  if (solution.portalHostKey === 'web') return false
  return Boolean(solution.portalItemId && solution.portalHostKey)
}

/**
 * Secured ArcGIS content viewer (AUTH-04).
 * Broker token is deposited into an HttpOnly host session, then content is
 * loaded through the same-origin portal proxy — never via ?token= iframe URLs.
 */
export default function AppViewer() {
  const { getSolution } = useRuntimeConfig()
  const { moduleId, solutionId } = useParams()
  const { module, solution } = getSolution(moduleId, solutionId)
  const { ensureToken, refresh, getHostState } = usePortalAccess()
  const [preparing, setPreparing] = useState(true)

  const portalHostKey =
    typeof solution?.portalHostKey === 'string'
      ? solution.portalHostKey.trim().toLowerCase()
      : ''
  const secured = needsPortalBroker(solution)
  const hostState = getHostState(portalHostKey)

  // Static hosting frames the portal through the Runtime Config service's
  // session-gated proxy, which attaches the portal token server-side.
  const directSrc = useMemo(() => {
    if (!STATIC_BUILD || !secured || !portalHostKey) return null
    const source = buildAppSource({
      portalItemId: solution.portalItemId,
      kind:
        (solution.authKind || solution.kind) === 'experience'
          ? 'experience'
          : 'dashboard',
      host: portalHostKey,
      portalUrl: PROXY_HOSTS[portalHostKey] || PORTAL_URL,
    })
    return runtimeProxyFrameUrl(source?.portalUrl, portalHostKey)
  }, [secured, solution, portalHostKey])

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

  if (!module || !solution) return <Navigate to="/" replace />

  if (!solution.embedUrl && !secured) {
    return (
      <div className="viewer viewer--pane">
        <p>Coming soon.</p>
      </div>
    )
  }

  if (!secured) {
    return (
      <div className="viewer viewer--pane">
        <ArcGisDashboardFrame title={solution.name} src={solution.embedUrl} />
      </div>
    )
  }

  if (!portalHostKey) {
    return (
      <div className="viewer viewer--pane viewer--status">
        <p role="alert">
          This map is missing a Portal host configuration. Ask an administrator
          to set portalHostKey on the catalog item.
        </p>
      </div>
    )
  }

  if (STATIC_BUILD) {
    if (!directSrc) {
      return (
        <div className="viewer viewer--pane viewer--status">
          <p role="alert">
            This map is missing a Portal item configuration. Ask an
            administrator to set portalItemId on the catalog item.
          </p>
        </div>
      )
    }
    return (
      <div className="viewer viewer--pane">
        <ArcGisDashboardFrame key={directSrc} title={solution.name} src={directSrc} />
      </div>
    )
  }

  if (preparing || hostState.status === 'loading' || hostState.status === 'idle') {
    return (
      <div className="viewer viewer--pane viewer--status">
        <div className="boot-orbit" aria-label="Loading map" />
        <p>Connecting to the mapping portal…</p>
      </div>
    )
  }

  if (hostState.status === 'error' || !proxySrc) {
    return (
      <div className="viewer viewer--pane viewer--status">
        <p role="alert">
          {hostState.error ||
            'Unable to connect to the mapping portal. Please try again.'}
        </p>
        <button
          type="button"
          className="btn btn-cosmic"
          onClick={() => {
            setPreparing(true)
            void refresh(portalHostKey)
              .then(() => setPreparing(false))
              .catch(() => setPreparing(false))
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (import.meta.env.DEV) {
    console.info('[portal-embed]', sanitizePortalEmbedUrl(proxySrc))
  }

  return (
    <div className="viewer viewer--pane">
      <ArcGisDashboardFrame title={solution.name} src={proxySrc} />
    </div>
  )
}
