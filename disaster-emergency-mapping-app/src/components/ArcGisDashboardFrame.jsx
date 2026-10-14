import { appPath } from '../lib/appPath.js'

export default function ArcGisDashboardFrame({ title, src }) {
  return (
    <iframe
      className="app-frame"
      title={title}
      src={appPath(src)}
      referrerPolicy="no-referrer-when-downgrade"
      allow="geolocation; microphone; camera; fullscreen"
    />
  )
}
