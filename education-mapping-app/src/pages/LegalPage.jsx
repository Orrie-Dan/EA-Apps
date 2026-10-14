import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

export default function LegalPage() {
  const { page } = useParams()
  const { legal } = useRuntimeConfig()
  const current = legal[page]
  if (!current) return <Navigate to="/" replace />

  return (
    <div className="canvas legal-page">
      <nav className="crumbs">
        <Link to="/">
          <ArrowLeft size={14} strokeWidth={1.8} /> Home
        </Link>
        <span>/</span>
        <strong>{current.title}</strong>
      </nav>
      <div className="section-head" style={{ textAlign: 'left' }}>
        <h2>{current.title}</h2>
      </div>
      {current.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  )
}
