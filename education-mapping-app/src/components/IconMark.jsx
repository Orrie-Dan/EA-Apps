import {
  GraduationCap,
  Layers,
  Route,
  School,
  Users,
} from 'lucide-react'

const icons = {
  'graduation-cap': GraduationCap,
  layers: Layers,
  route: Route,
  school: School,
  users: Users,
}

export default function IconMark({ name, size = 18 }) {
  const Icon = icons[name] || School
  return <Icon size={size} strokeWidth={1.6} />
}
