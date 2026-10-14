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
  const { ensureToken, getHostState } = usePortalAccess()
  const [preparing, setPreparing] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [attempt, setAttempt] = useState(0)

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
    let settled = false
    setPreparing(true)
    setTimedOut(false)
    const timer = window.setTimeout(() => {
      if (!cancelled && !settled) {
        setPreparing(false)
        setTimedOut(true)
      }
    }, 20_000)
    void ensureToken(portalHostKey, { force: attempt > 0 })
      .then(() => {
        settled = true
        window.clearTimeout(timer)
        if (!cancelled) {
          setPreparing(false)
          setTimedOut(false)
        }
      })
      .catch(() => {
        settled = true
        window.clearTimeout(timer)
        if (!cancelled) setPreparing(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [attempt, ensureToken, portalHostKey, secured, solutionId, moduleId])

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

  // A static host cannot run the local shell; open the public site directly.
  const publicSrc =
    STATIC_BUILD && solution.localShellPath && PROXY_HOSTS[portalHostKey]
      ? PROXY_HOSTS[portalHostKey]
      : solution.embedUrl

  if (!publicSrc && !secured) {
    return (
      <div className="viewer viewer--pane">
        <p>Coming soon.</p>
      </div>
    )
  }

  if (!secured) {
    return (
      <div className="viewer viewer--pane">
        <ArcGisDashboardFrame key={publicSrc} title={solution.name} src={publicSrc} />
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

  // Local shells redirect into the proxy. The host cookie must exist first.
  if (solution.localShellPath && hostState.status === 'ready' && hostState.proxyReady && !timedOut) {
    return (
      <div className="viewer viewer--pane">
        <ArcGisDashboardFrame
          key={solution.localShellPath}
          title={solution.name}
          src={solution.embedUrl}
        />
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

  if (!timedOut && (preparing || hostState.status === 'loading')) {
    return (
      <div className="viewer viewer--pane viewer--status">
        <div className="boot-orbit" aria-label="Loading map" />
        <p>Connecting to the mapping portal…</p>
      </div>
    )
  }

  if (timedOut || hostState.status === 'error' || hostState.status === 'idle' || !proxySrc) {
    return (
      <div className="viewer viewer--pane viewer--status">
        <p role="alert">
          {timedOut
            ? 'This map took too long to open. Please try again.'
            : hostState.error ||
              'Unable to connect to the mapping portal. Please try again.'}
        </p>
        <button
          type="button"
          className="btn btn-cosmic"
          onClick={() => setAttempt((value) => value + 1)}
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
      <ArcGisDashboardFrame key={proxySrc} title={solution.name} src={proxySrc} />
    </div>
  )
}
