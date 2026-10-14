import { appPath } from '../lib/appPath.js'

export default function ArcGisDashboardFrame({ title, src }) {
  return (
    <iframe
      className="app-frame"
      title={title}
      src={appPath(src)}
      allow="geolocation; microphone; camera; fullscreen"
    />
  )
}
