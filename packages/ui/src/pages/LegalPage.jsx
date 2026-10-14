import { Link, Navigate, useParams } from 'react-router-dom'
import { useShell } from '../ShellProvider.jsx'

export default function LegalPage() {
  const { page } = useParams()
  const { config } = useShell()
  const article = config.legal?.[page]

  if (!article) return <Navigate to="/" replace />

  const paragraphs = article.body || article.paragraphs || []

  return (
    <div className="legal-page">
      <div className="legal-canvas">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
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
