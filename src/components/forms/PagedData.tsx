import type { ReactNode } from 'react'
import { Input } from '../ui/Fields'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Progress'
import { EmptyState, ErrorState } from '../feedback/States'
import './paged-data.css'

const PAGE_SIZE = 25
export function DataTable<T>({ caption, rows, columns, rowKey }: { caption: string; rows: T[]; columns: { label: string; cell: (row: T) => ReactNode }[]; rowKey: (row: T) => string }) {
  return <div className="p4-table" role="region" aria-label={caption} tabIndex={0}><table><caption>{caption}</caption><thead><tr>{columns.map(column => <th scope="col" key={column.label}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.label}>{column.cell(row)}</td>)}</tr>)}</tbody></table></div>
}
export function PagedResults({ loading, error, count, page, setPage, reload, children }: { loading: boolean; error: string; count: number; page: number; setPage: (page: number) => void; reload: () => Promise<void>; children: ReactNode }) {
  if (error) return <ErrorState title={error} onRetry={() => void reload()} />
  if (loading && count===0) return <><Skeleton label="Cargando registros" /><Skeleton /></>
  return <>{loading && <Skeleton label="Actualizando registros" />}{count ? children : <EmptyState title="Sin resultados">Ajusta los filtros o crea el primer registro.</EmptyState>}<div className="module-actions p4-pagination"><Button variant="secondary" disabled={loading||page===0} onClick={() => setPage(page-1)}>Anterior</Button><span role="status">{count} registros · Página {page+1} de {Math.max(1,Math.ceil(count/PAGE_SIZE))}</span><Button variant="secondary" disabled={loading||(page+1)*PAGE_SIZE>=count} onClick={() => setPage(page+1)}>Siguiente</Button></div></>
}
export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <Input label="Buscar" type="search" value={value} onChange={event => onChange(event.target.value)} maxLength={160} /> }
