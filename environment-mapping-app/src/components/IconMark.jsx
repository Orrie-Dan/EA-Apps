/**
 * Inline SVG icon set.
 *
 * Hand-rolled rather than pulled from an icon package: the portal makes no CDN
 * calls and must work fully offline, and this is the whole set the catalog uses.
 */
const PATHS = {
  cloud: <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97 6 6 0 0 0-11.66-1.4A4.5 4.5 0 0 0 6.5 19Z" />,
  droplet: <path d="M12 3s6 5.5 6 9.5a6 6 0 0 1-12 0C6 8.5 12 3 12 3Z" />,
  mountain: <path d="m3 19 6.5-11 4 6 2.5-3.5L21 19H3Z" />,
  leaf: (
    <>
      <path d="M4 20c0-8 5-13 16-13 0 9-5 13-11 13H4Z" />
      <path d="M4 20c4-5 8-7.5 12-9" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3 5 12h3l-3 5h14l-3-5h3L12 3Z" />
      <path d="M12 17v4" />
    </>
  ),
  pickaxe: (
    <>
      <path d="M4 14c3-6 9-9 15-9-3 3-3 8-9 11" />
      <path d="m10 13 7 7" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 14 9 5 9-5" />
    </>
  ),
  activity: <path d="M3 12h4l3 7 4-15 3 8h4" />,
  clipboard: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H15" />
      <path d="M8.5 12h7M8.5 16h4" />
    </>
  ),
  download: <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  panelLeft: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M10 4v16" />
    </>
  ),
  panelLeftClose: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M10 4v16M16 9l-3 3 3 3" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
      <path d="M18 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" />
    </>
  ),
  arrowLeft: <path d="M19 12H5m6-7-7 7 7 7" />,
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </>
  ),
}

export default function IconMark({ name, size = 16, className = '', title }) {
  const path = PATHS[name] || PATHS.map
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  )
}
