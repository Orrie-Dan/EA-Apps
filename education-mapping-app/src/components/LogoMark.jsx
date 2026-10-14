export default function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#3b5bdb" />
      <path d="M8 20.5 24 12l16 8.5v3L24 15.5 8 23.5v-3Z" fill="white" />
      <path d="M14 24v8.5c3.2 2.2 6.6 3.3 10 3.3s6.8-1.1 10-3.3V24L24 29.2 14 24Z" fill="white" />
    </svg>
  )
}
