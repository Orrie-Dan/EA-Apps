import {
  Building2,
  Grid2x2,
  Layers,
  Map,
  MapPin,
  Receipt,
  Scale,
} from 'lucide-react'

const icons = {
  building: Building2,
  grid: Grid2x2,
  layers: Layers,
  map: Map,
  'map-pin': MapPin,
  receipt: Receipt,
  scale: Scale,
}

export default function IconMark({ name, size = 18 }) {
  const Icon = icons[name] || Map
  return <Icon size={size} strokeWidth={1.6} />
}
