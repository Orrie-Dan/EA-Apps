import {
  Activity,
  CloudRain,
  Droplets,
  Flame,
  Fuel,
  Layers,
  Mountain,
  Radio,
  Shield,
  Siren,
  Truck,
  Waves,
  Zap,
} from 'lucide-react'

const icons = {
  activity: Activity,
  'cloud-rain': CloudRain,
  droplets: Droplets,
  flame: Flame,
  fuel: Fuel,
  layers: Layers,
  mountain: Mountain,
  radio: Radio,
  shield: Shield,
  siren: Siren,
  truck: Truck,
  waves: Waves,
  zap: Zap,
  'fire-extinguisher': Flame,
}

export default function IconMark({ name, size = 16, strokeWidth = 1.6 }) {
  const Icon = icons[name] || Layers
  return <Icon size={size} strokeWidth={strokeWidth} />
}
