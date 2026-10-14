import { Link } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import LogoMark from '../components/LogoMark'
import { appPath } from '../lib/appPath.js'

export default function EnterPage() {
  const { portal, getFirstSolutionPath } = useRuntimeConfig()
  const first = getFirstSolutionPath() || '/'

  return (
    <div className="login-page">
      <div className="login-visual">
        <img src={appPath(portal.hero)} alt="" />
        <div className="hero-scrim" />
        <div className="starfield" aria-hidden="true" />
      </div>
      <div className="login-card">
        <LogoMark size={52} />
        <h1>{portal.name}</h1>
        <Link className="btn btn-cosmic login-btn" to={first}>
          Click to enter
        </Link>
      </div>
    </div>
  )
}
