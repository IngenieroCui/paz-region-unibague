import type { ReactNode } from 'react'
export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info'
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
