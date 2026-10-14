export default function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#2563eb" />
      {/* Awning */}
      <path d="M10 19h28l-2.4-7a1.4 1.4 0 0 0-1.3-.9H13.7a1.4 1.4 0 0 0-1.3.9L10 19Z" fill="white" />
      <path
        d="M12 19h4v2.5a2 2 0 0 1-4 0V19Zm10 0h4v2.5a2 2 0 0 1-4 0V19Zm10 0h4v2.5a2 2 0 0 1-4 0V19Z"
        fill="white"
      />
      {/* Shop body */}
      <path d="M13 23.5h22V37H13V23.5Z" fill="white" />
      {/* Door */}
      <path d="M21 28h6v9h-6v-9Z" fill="#2563eb" />
      {/* Windows */}
      <rect x="15.5" y="26" width="4" height="4" rx="0.6" fill="#2563eb" />
      <rect x="28.5" y="26" width="4" height="4" rx="0.6" fill="#2563eb" />
    </svg>
  )
}
