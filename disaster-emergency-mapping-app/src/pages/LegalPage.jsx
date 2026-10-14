import { Link, Navigate, useParams } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

export default function LegalPage() {
  const { page } = useParams()
  const { legal } = useRuntimeConfig()
  const article = legal[page]

  if (!article) return <Navigate to="/" replace />

  const paragraphs = article.body || article.paragraphs || []

  return (
    <div className="legal-page">
      <div className="legal-canvas">
        <nav className="crumbs">
          <Link to="/">Home</Link>
          <span>/</span>
          <strong>{article.title}</strong>
        </nav>
        <h1>{article.title}</h1>
        {paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </div>
  )
}
