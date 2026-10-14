import { Link } from 'react-router-dom'
import { Mail, Phone, Sparkles } from 'lucide-react'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

export default function SiteFooter() {
  const { footer, portal, organization } = useRuntimeConfig()
  const { contact } = footer

  return (
    <footer className="site-footer">
      <div className="starfield" aria-hidden="true" />
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <div className="site-footer-identity">
              <div>
                <strong>{portal.name}</strong>
              </div>
            </div>
            <p>{footer.blurb}</p>
          </div>

          <div>
            <h2>
              <Sparkles size={16} strokeWidth={1.8} style={{ marginRight: 8, color: '#38bdf8' }} />
              Quick links
            </h2>
            <ul>
              {footer.quickLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2>{contact.heading}</h2>
            <div className="site-footer-contact">
              {contact.phone ? (
                <p className="site-footer-phone">
                  <Phone size={16} strokeWidth={1.8} />
                  <span>
                    <span>{contact.phoneLabel}</span>
                    <strong>{contact.phone}</strong>
                  </span>
                </p>
              ) : null}
              {contact.email ? (
                <p>
                  <Mail size={16} strokeWidth={1.8} />
                  <span>
                    Email:{' '}
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </span>
                </p>
              ) : null}
              {contact.agency ? <p className="site-footer-agency">{contact.agency}</p> : null}
            </div>
          </div>
        </div>

        <div className="site-footer-bar">
          <nav className="site-footer-legal">
            <Link to="/legal/disclaimer">Data Disclaimer</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms of Use</Link>
            <Link to="/legal/accessibility">Accessibility</Link>
          </nav>
          <p>Last updated: each mapping application shows its own data refresh time.</p>
          <p>
            © {organization.copyrightYear} {organization.name}
          </p>
        </div>
      </div>
    </footer>
  )
}
