import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
export function MetricCard({ title, value, note, icon: Icon }: { title: string; value: string; note: string; icon: LucideIcon }) {
  return <Card className="metric-card"><div className="row"><span className="muted">{title}</span><Icon size={19} aria-hidden="true" /></div>
    <strong className="metric-value">{value}</strong><p className="muted">{note}</p></Card>
}
export function QuickActionCard({ title, description, to, icon: Icon }: { title: string; description: string; to: string; icon: LucideIcon }) {
  return <Link className="quick-action" to={to}><span className="icon-tile"><Icon size={22} aria-hidden="true" /></span>
    <div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight size={19} aria-hidden="true" /></Link>
}
