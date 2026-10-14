import { Link } from 'react-router-dom'
import IconMark from './IconMark'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

const BOTTOM = [
  { label: 'Data Disclaimer', to: '/legal/disclaimer' },
  { label: 'Privacy', to: '/legal/privacy' },
  { label: 'Terms of Use', to: '/legal/terms' },
  { label: 'Accessibility', to: '/legal/accessibility' },
]

export default function SiteFooter() {
  const { portal, footer } = useRuntimeConfig()
  const { email, phone } = footer.contact
  const hasContact = Boolean(email || phone)

  return (
    <footer className="footer">
      <div className="contours" aria-hidden="true" />
      <div className="footer__inner">
        <div className="footer__cols">
          <div>
            <p className="footer__brand">{portal.name}</p>
            <p className="footer__sub">{portal.identity.name}</p>
            <p className="footer__blurb">{footer.blurb}</p>
            {footer.agency ? <p className="footer__sub">{footer.agency}</p> : null}
          </div>

          <div>
            <p className="footer__heading">
              <IconMark name="sparkles" size={14} className="footer__spark" />
              <span>Quick links</span>
            </p>
            <ul className="footer__links">
              {footer.quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {hasContact && (
            <div>
              <p className="footer__heading">
                <span>Contact</span>
              </p>
              <ul className="footer__links">
                {email && (
                  <li>
                    <a href={`mailto:${email}`}>{email}</a>
                  </li>
                )}
                {phone && (
                  <li>
                    <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="footer__bottom">
          <ul className="footer__bottomlinks">
            {BOTTOM.map((link) => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
          <p className="footer__note">
            Last updated: each mapping application shows its own data refresh time.
          </p>
          <p className="footer__copy">© 2026 Rwanda Space Agency</p>
        </div>
      </div>
    </footer>
  )
}
