/**
 * The embedded ArcGIS application.
 *
 * `src` is always a same-origin path served by this app's access server, never
 * a gh.space.gov.rw URL: the Portal sends X-Frame-Options, so a direct frame is
 * refused, and a cross-origin frame could not carry the user's session either.
 *
 * flex-basis 0 matters — an iframe has a short intrinsic height, so without it
 * the frame renders ~150px tall instead of filling the pane.
 */
import { appPath } from '../lib/appPath.js'
export default function ArcGisDashboardFrame({ src, title }) {
  return (
    <iframe
      key={src}
      src={appPath(src)}
      title={title}
      className="app-frame"
      allow="geolocation; microphone; camera; fullscreen"
    />
  )
}
