import {
  ArrowLeftRight,
  BarChart3,
  HeartHandshake,
  Layers,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'

const icons = {
  'arrow-left-right': ArrowLeftRight,
  chart: BarChart3,
  heart: HeartHandshake,
  layers: Layers,
  'shopping-bag': ShoppingBag,
  store: Store,
  truck: Truck,
  users: Users,
  wallet: Wallet,
}

export default function IconMark({ name, size = 18 }) {
  const Icon = icons[name] || Users
  return <Icon size={size} strokeWidth={1.6} />
}
