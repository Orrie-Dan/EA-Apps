export default function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="16" fill="#b45309" />
      <circle cx="24" cy="24" r="10" fill="white" />
      <circle cx="24" cy="24" r="4" fill="#b45309" />
    </svg>
  )
}
