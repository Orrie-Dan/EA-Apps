import { Link } from 'react-router-dom'
import { Mail, Phone, Sparkles } from 'lucide-react'
import LogoMark from './LogoMark'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

function FooterNavLink({ to, children }) {
  if (to) return <Link to={to}>{children}</Link>
  return (
    <span className="footer-link-static" aria-disabled="true">
      {children}
    </span>
  )
}

export default function SiteFooter() {
  const { portal, footer, organization } = useRuntimeConfig()
  const email = footer.contact?.email
  const phone = footer.contact?.phone
  const agency = footer.contact?.agency

  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="starfield" aria-hidden="true" />
      <div className="footer-inner">
        <div className="footer-grid">
          <section className="footer-branding" aria-labelledby="footer-brand-heading">
            <LogoMark size={40} />
            <h2 id="footer-brand-heading">{portal.name}</h2>
            <p className="footer-kicker">GeoHub Rwanda</p>
            <p className="footer-blurb">{footer.blurb}</p>
          </section>

          <nav className="footer-col" aria-labelledby="footer-quick-heading">
            <h3 id="footer-quick-heading">
              <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
              Quick links
            </h3>
            <ul>
              {footer.quickLinks.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <FooterNavLink to={item.to}>{item.label}</FooterNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <section className="footer-col footer-contact" aria-labelledby="footer-contact-heading">
            <h3 id="footer-contact-heading">Contact</h3>
            {phone ? (
              <p className="footer-meta">
                <Phone size={15} strokeWidth={1.7} aria-hidden="true" />
                <a href={`tel:${phone}`}>{phone}</a>
              </p>
            ) : null}
            {email ? (
              <p className="footer-meta">
                <Mail size={15} strokeWidth={1.7} aria-hidden="true" />
                <a href={`mailto:${email}`}>{email}</a>
              </p>
            ) : null}
            {agency ? <p className="footer-ministry">{agency}</p> : null}
            {!phone && !email && !agency ? (
              <p className="footer-blurb">Contact details will appear here when available.</p>
            ) : null}
          </section>
        </div>

        <div className="footer-base">
          <nav className="footer-legal" aria-label="Legal and information">
            <Link to="/legal/disclaimer">Data Disclaimer</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms of Use</Link>
            <Link to="/legal/accessibility">Accessibility</Link>
          </nav>
          <p className="footer-freshness">
            Last updated: each mapping application shows its own data refresh time.
          </p>
          <p className="footer-copy">© {organization.copyrightYear} {organization.name}</p>
        </div>
      </div>
    </footer>
  )
}
