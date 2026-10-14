import appIcon from '../assets/app-icon.png'

export default function LogoMark({ size = 48 }) {
  return (
    <img
      className="logo-mark"
      src={appIcon}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.33),
        objectFit: 'cover',
        display: 'block',
      }}
    />
  )
}
