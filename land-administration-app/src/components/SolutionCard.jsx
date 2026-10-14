import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import IconMark from './IconMark'
import { appPath } from '../lib/appPath.js'

export default function SolutionCard({ moduleId, solution }) {
  const ready = Boolean(solution.embedUrl)
  const body = (
    <>
      <div className="media">
        <img src={appPath(solution.image)} alt={solution.name} />
        <span className={`media-badge ${ready ? '' : 'soon'}`}>
          <IconMark name={solution.icon} size={14} />
          {ready ? solution.type : 'Soon'}
        </span>
      </div>
      <div className="copy">
        <h3>{solution.name}</h3>
        <p>{solution.description}</p>
        <span className={`go ${ready ? '' : 'is-soon'}`}>
          {ready ? 'Open map' : 'Coming soon'}
          {ready ? <ArrowUpRight size={16} strokeWidth={1.7} /> : null}
        </span>
      </div>
    </>
  )

  if (!ready) return null

  return (
    <Link to={`/module/${moduleId}/app/${solution.id}`} className="tile">
      {body}
    </Link>
  )
}
