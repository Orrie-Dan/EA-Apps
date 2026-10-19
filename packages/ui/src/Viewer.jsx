import { useShell } from './ShellProvider.jsx'

/**
 * The content pane's states. Each app's AppViewer decides WHICH state applies
 * (auth, proxy and portal-host logic stay in the app); these decide how it looks.
 */

/** The embedded ArcGIS application. `src` is app-relative or absolute. */
export function ViewerFrame({ title, src }) {
  const { appPath } = useShell()
  return (
    <div className="viewer viewer--pane">
      {/* key: a new src must load a fresh frame, never reuse the old document. */}
      <iframe
        key={src}
        className="app-frame"
        title={title}
        src={appPath(src)}
        allow="geolocation; microphone; camera; fullscreen"
      />
    </div>
  )
}

export function ViewerLoading({ label = 'Connecting to the mapping portal…' }) {
  return (
    <div className="viewer viewer--pane viewer--status" role="status">
      <div className="boot-orbit" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

/** A message in the pane; `alert` for problems the user should notice. */
export function ViewerMessage({ children, alert = false, title }) {
  return (
    <div className="viewer viewer--pane viewer--status">
      {title ? <h1 className="workspace-home-title">{title}</h1> : null}
      <p role={alert ? 'alert' : undefined}>{children}</p>
    </div>
  )
}

export function ViewerError({
  message = 'Unable to connect to the mapping portal. Please try again.',
  onRetry,
}) {
  return (
    <div className="viewer viewer--pane viewer--status">
      <p role="alert">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}
