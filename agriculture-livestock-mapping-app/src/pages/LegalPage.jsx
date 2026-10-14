import { Link, Navigate, useParams } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

export default function LegalPage() {
  const { legal } = useRuntimeConfig()
  const { page } = useParams()
  const content = legal[page]

  if (!content) return <Navigate to="/" replace />

  return (
    <article className="legal">
      <p className="legal-crumbs">
        <Link to="/">Home</Link> / {content.title}
      </p>
      <h1>{content.title}</h1>
      {content.body.map((paragraph) => (
        <p key={paragraph.slice(0, 32)}>{paragraph}</p>
      ))}
    </article>
  )
}
