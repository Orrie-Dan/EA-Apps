import {
  HardHat,
  Landmark,
  Layers,
  Megaphone,
  Monitor,
} from 'lucide-react'

const icons = {
  'hard-hat': HardHat,
  landmark: Landmark,
  layers: Layers,
  megaphone: Megaphone,
  monitor: Monitor,
}

export default function IconMark({ name, size = 18 }) {
  const Icon = icons[name] || Landmark
  return <Icon size={size} strokeWidth={1.6} />
}
