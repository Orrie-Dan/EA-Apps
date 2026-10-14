import { Link, Navigate, useParams } from 'react-router-dom'
import IconMark from '../components/IconMark'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

export default function LegalPage() {
  const { legal } = useRuntimeConfig()
  const { page } = useParams()
  const content = legal[page]
  if (!content) return <Navigate to="/" replace />

  return (
    <article className="legal">
      <nav className="legal__crumbs" aria-label="Breadcrumb">
        <Link to="/">
          <IconMark name="arrowLeft" size={14} />
          <span>Home</span>
        </Link>
      </nav>
      <h1 className="legal__title">{content.title}</h1>
      {content.body.map((paragraph) => (
        <p key={paragraph.slice(0, 40)} className="legal__para">
          {paragraph}
        </p>
      ))}
    </article>
  )
}
