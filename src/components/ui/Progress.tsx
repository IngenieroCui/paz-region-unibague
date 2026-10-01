export function Progress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return <div className="progress"><div className="row"><span>{label}</span><strong>{safeValue}%</strong></div>
    <progress max={100} value={safeValue} aria-label={label} /></div>
}
export function Skeleton({ label = 'Cargando' }: { label?: string }) {
  return <div className="skeleton" role="status"><span className="sr-only">{label}</span></div>
}
