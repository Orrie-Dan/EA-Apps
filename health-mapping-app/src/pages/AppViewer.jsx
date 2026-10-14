import { Navigate, useParams } from 'react-router-dom'
import { ViewerFrame, ViewerLoading, ViewerMessage, ViewerError } from '@ea/ui'
import { useEffect, useMemo, useState } from 'react'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { usePortalAccess } from '../auth/PortalAccessProvider'
import {
  buildProxyEmbedUrl,
  sanitizePortalEmbedUrl,
  PORTAL_URL,
  PROXY_HOSTS,
  SURVEY123_ORIGIN,
} from '../lib/access.js'
import { STATIC_BUILD } from '../config/deployMode.js'
import { runtimeProxyFrameUrl } from '../auth/runtimeSessionAuth.js'

function needsPortalBroker(solution) {
  if (!solution) return false
  if (solution.localShellPath) return false
  if (solution.portalHostKey === 'web') return false
  // Public Survey123 shares keep absolute embed URLs; Esri Rwanda forms need the proxy.
  if (solution.kind === 'survey123' && solution.portalHostKey !== 'esrirw') {
    return false
  }
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
    const itemId = solution.portalItemId
    const root = String(PROXY_HOSTS[portalHostKey] || PORTAL_URL).replace(/\/$/, '')
    const kind = solution.authKind || solution.kind
    // Survey123 runs on survey123.arcgis.com, not on the portal; the form asks
    // for a portal sign-in itself.
    if (kind === 'survey123') {
      return `${SURVEY123_ORIGIN}/share/${itemId}?portalUrl=${root}`
    }
    const portalUrl =
      kind === 'experience'
        ? `${root}/apps/experiencebuilder/experience/?id=${itemId}`
        : `${root}/apps/dashboards/${itemId}`
    return runtimeProxyFrameUrl(portalUrl, portalHostKey)
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

  const publicSrc =
    solution.localShellPath ||
    (solution.embedUrl && !secured ? solution.embedUrl : null)

  if (!publicSrc && !secured) {
    return <ViewerMessage>Coming soon.</ViewerMessage>
  }

  if (!secured) {
    return <ViewerFrame title={solution.name} src={publicSrc} />
  }

  if (!portalHostKey) {
    return (
      <ViewerMessage alert>
        This map is missing a Portal host configuration. Ask an administrator
        to set portalHostKey on the catalog item.
      </ViewerMessage>
    )
  }

  if (STATIC_BUILD) {
    if (!directSrc) {
      return (
        <ViewerMessage alert>
          This map is missing a Portal item configuration. Ask an
          administrator to set portalItemId on the catalog item.
        </ViewerMessage>
      )
    }
    return <ViewerFrame title={solution.name} src={directSrc} />
  }

  if (preparing || hostState.status === 'loading' || hostState.status === 'idle') {
    return <ViewerLoading />
  }

  if (hostState.status === 'error' || !proxySrc) {
    return (
      <ViewerError
        message={hostState.error ||
          'Unable to connect to the mapping portal. Please try again.'}
        onRetry={() => {
          setPreparing(true)
          void refresh(portalHostKey)
            .then(() => setPreparing(false))
            .catch(() => setPreparing(false))
        }}
      />
    )
  }

  if (import.meta.env.DEV) {
    console.info('[portal-embed]', sanitizePortalEmbedUrl(proxySrc))
  }

  return <ViewerFrame title={solution.name} src={proxySrc} />
}
