/**
 * The embedded ArcGIS application.
 *
 * `src` is a same-origin path served by this app's access server for anything
 * on the portal's own Enterprise: the Portal sends X-Frame-Options, so a direct
 * frame is refused, and a cross-origin frame could not carry the user's session
 * either.
 *
 * A Survey123 data collection form is proxied too, at its own base, for the
 * same reason: the form item is public but the layer it submits to is not, so
 * a direct frame makes ArcGIS Identity Manager prompt for a sign-in inside the
 * iframe. Every src reaching this component is therefore same-origin.
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
