import { resolveIcon } from './IconMark.jsx'
import { useShell } from './ShellProvider.jsx'

/**
 * The app's mark: its logo image when it has one, otherwise its brand icon on
 * an accent tile (same rounded-square shape, so both read as one family).
 */
export default function LogoMark({ size = 32 }) {
  const { logo, brandIcon, icons } = useShell()
  const radius = Math.round(size * 0.3)

  if (logo) {
    return (
      <img
        className="logo-mark"
        src={logo}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    )
  }

  const Icon = resolveIcon(brandIcon || 'map', icons)
  return (
    <span
      className="logo-mark logo-mark--tile"
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={1.8} />
    </span>
  )
}
