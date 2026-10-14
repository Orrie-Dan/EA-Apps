import {
  Building2,
  Bus,
  Car,
  Droplets,
  Home,
  Landmark,
  Layers,
  Radio,
  Route,
  Trees,
  Waves,
  Zap,
} from 'lucide-react'

const icons = {
  'building-2': Building2,
  bus: Bus,
  car: Car,
  droplets: Droplets,
  home: Home,
  landmark: Landmark,
  layers: Layers,
  radio: Radio,
  route: Route,
  trees: Trees,
  waves: Waves,
  zap: Zap,
}

export default function IconMark({ name, size = 16, strokeWidth = 1.6 }) {
  const Icon = icons[name] || Layers
  return <Icon size={size} strokeWidth={strokeWidth} />
}
