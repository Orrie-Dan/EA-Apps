export default function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#166534" />
      <path d="M10 34V22l7-6 7 6v12H10Z" fill="white" />
      <path d="M24 34V18l7-6 7 6v16H24Z" fill="white" opacity="0.72" />
      <path d="M10 36h28" stroke="white" strokeWidth="2" />
    </svg>
  )
}
