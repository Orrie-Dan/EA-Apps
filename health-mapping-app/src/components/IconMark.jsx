import {
  Activity,
  Ambulance,
  ClipboardList,
  HeartPulse,
  Hospital,
  Layers,
  MapPin,
  Pill,
  Route,
  Shield,
  Siren,
  Stethoscope,
  Syringe,
  Utensils,
} from 'lucide-react'

const icons = {
  activity: Activity,
  ambulance: Ambulance,
  'clipboard-list': ClipboardList,
  'heart-pulse': HeartPulse,
  hospital: Hospital,
  layers: Layers,
  'map-pin': MapPin,
  pill: Pill,
  route: Route,
  shield: Shield,
  siren: Siren,
  stethoscope: Stethoscope,
  syringe: Syringe,
  utensils: Utensils,
}

export default function IconMark({ name, size = 16, strokeWidth = 1.6 }) {
  const Icon = icons[name] || Layers
  return <Icon size={size} strokeWidth={strokeWidth} />
}
