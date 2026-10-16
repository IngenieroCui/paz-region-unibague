import { useCallback, useState } from 'react'
import { AdvisorTeams } from './AdvisorTeams'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useResource } from '../../components/forms/useResource'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { EmptyState, ErrorState } from '../../components/feedback/States'
import { PagedResults, SearchField } from '../../components/forms/PagedData'
import { loadAdvisorProfile, loadAdvisorWorkspace, loadPeriods } from './services'
import type { AdvisorData } from './services'

export function AdvisorWorkspace() {
  const section = useLocation().pathname.split('/')[3] ?? ''
  return section === 'profile' ? <AdvisorProfile /> : <Responsibilities section={section} />
}
function Responsibilities({ section }: { section: string }) {
  const periods = useResource(useCallback(() => loadPeriods(), []))
  const [override, setPeriod] = useState<string | null>(null)
  const period = override ?? periods.data?.find(row => row.is_current)?.id ?? periods.data?.[0]?.id ?? ''
  const resource = useResource(useCallback(async () => ({ period, ...await loadAdvisorWorkspace(period) }), [period]))
  const titles: Record<string,string> = { '': 'Mi asesoría regional', organizations: 'Mis organizaciones', students: 'Mis estudiantes', projects: 'Proyectos asociados' }
  return <div className="module-stack"><PageHeader eyebrow="Asesor regional" title={titles[section] ?? 'Mi asesoría regional'} description="Responsabilidades vigentes en el periodo seleccionado." />
    {periods.error ? <ErrorState title={periods.error} onRetry={() => void periods.reload()} /> : periods.loading ? <Skeleton label="Cargando periodos" /> : <Select label="Periodo académico" value={period} onChange={event => setPeriod(event.target.value)}><option value="">Selecciona un periodo</option>{periods.data?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>}
    {!periods.loading && !periods.error && !periods.data?.length && <EmptyState title="Sin periodos académicos">La Universidad debe configurar un periodo.</EmptyState>}
    {period && (resource.error ? <ErrorState title={resource.error} onRetry={() => void resource.reload()} /> : resource.loading || !resource.data || resource.data.period !== period ? <><Skeleton label="Cargando responsabilidades" /><Skeleton label="Cargando asesoría" /></> : <AdvisorContent key={`${period}-${section}`} data={resource.data} section={section} />)}
  </div>
}
function AdvisorContent({ data, section }: { data: AdvisorData; section: string }) {
  if (!section) return <><div className="dashboard-grid">{[['Mis organizaciones',data.organizations.length,'organizations'],['Mis estudiantes',data.students.length,'students'],['Proyectos asociados',data.projects.length,'projects']].map(([label,count,path]) => <Card key={String(path)}><h2>{label}</h2><p>{count} registro(s) vigentes.</p><Link className="button button--secondary" to={`/app/advisor/${path}`}>Consultar {String(label).toLowerCase()}</Link></Card>)}</div>
    {!data.organizations.length && !data.students.length && <EmptyState title="Sin responsabilidades vigentes">Las responsabilidades asignadas por la Universidad aparecerán aquí.</EmptyState>}</>
  if (section === 'organizations') return <AdvisorList rows={data.organizations} rowKey={row=>row.id} searchText={row=>`${row.name} ${row.description??''}`} render={row=><Card><h2>{row.name}</h2><p>{row.description ?? 'Sin descripción registrada.'}</p><p>Responsabilidad desde {row.starts_on}.</p><Contacts contacts={row.contacts} /></Card>} />
  if (section === 'students') return <AdvisorList rows={data.students} rowKey={row=>row.participation_id} searchText={row=>`${row.name} ${row.program??''}`} render={row=><Card><h2>{row.name}</h2><p>{row.program ?? 'Programa sin registrar'} · Semestre {row.semester ?? 'sin registrar'}</p><p>Responsabilidad desde {row.starts_on}.</p>
    <details><summary>Consultar perfil académico y profesional</summary><h3>Presentación profesional</h3><p>{row.bio ?? 'Sin presentación.'}</p><h3>Trabajo de interés</h3><p>{row.desired_work_description ?? 'Sin descripción.'}</p>
      <h3>Experiencia</h3>{row.experiences.length ? <ul>{row.experiences.map(e=><li key={e.id}><strong>{e.title}</strong> · {e.organization_name ?? 'Sin organización'}<p>{e.description}</p><p>{e.started_on ?? 'Sin fecha'} – {e.ended_on ?? 'Sin fecha de finalización'}</p></li>)}</ul> : <p>Sin experiencias registradas.</p>}
      <h3>Habilidades</h3>{row.skills.length ? <ul>{row.skills.map(s=><li key={s.id}><strong>{s.name}</strong><p>{s.evidence_text}</p></li>)}</ul> : <p>Sin habilidades registradas.</p>}
      <h3>Intereses</h3>{row.interests.length ? <ul>{row.interests.map(i=><li key={i.id}><strong>{i.label}</strong><p>{i.description}</p></li>)}</ul> : <p>Sin intereses registrados.</p>}
    </details></Card>} />
  return <AdvisorList rows={data.projects} rowKey={row=>row.id} searchText={row=>`${row.name} ${row.organization_name} ${row.municipality??''}`} render={row=><Card><h2>{row.name}</h2><p>{row.organization_name} · {row.municipality ?? 'Municipio sin registrar'} · {row.modality ?? 'Modalidad sin registrar'}</p><p>{row.summary ?? 'Sin resumen registrado.'}</p><details><summary>Ver descripción e interlocutores</summary><p>{row.description ?? 'Sin descripción registrada.'}</p><Contacts contacts={row.interlocutors} /></details><AdvisorTeams projectId={row.id} /></Card>} />
}
function Contacts({ contacts }: { contacts: AdvisorData['organizations'][number]['contacts'] }) {
  return <><h3>Interlocutores</h3>{contacts.length ? <ul className="module-list">{contacts.map(row=><li key={row.id}><div><strong>{row.full_name}{row.is_primary ? ' · Principal' : ''}</strong><p>{row.position_title ?? 'Cargo sin registrar'}</p><p>{row.email ?? 'Correo sin registrar'} · {row.phone ?? 'Teléfono sin registrar'}</p></div></li>)}</ul> : <p>Sin interlocutores registrados.</p>}</>
}
export function AdvisorList<T>({ rows, rowKey, searchText, render }: { rows: T[]; rowKey: (row:T)=>string; searchText: (row:T)=>string; render: (row:T)=>ReactNode }) {
  const [search,setSearch] = useState(''); const [page,setPage] = useState(0)
  const filtered = rows.filter(row=>searchText(row).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
  return <><SearchField value={search} onChange={value=>{setSearch(value);setPage(0)}} /><PagedResults loading={false} error="" count={filtered.length} page={page} setPage={setPage} reload={async()=>{}}><div className="module-stack">{filtered.slice(page*25,(page+1)*25).map(row=><div key={rowKey(row)}>{render(row)}</div>)}</div></PagedResults></>
}
function AdvisorProfile() {
  const resource = useResource(useCallback(() => loadAdvisorProfile(),[]))
  return <div className="module-stack"><PageHeader eyebrow="Asesor regional" title="Mi perfil" description="La Universidad administra tu perfil institucional y las responsabilidades." />
    {resource.error ? <ErrorState title={resource.error} onRetry={()=>void resource.reload()} /> : resource.loading || !resource.data ? <Skeleton label="Cargando perfil" /> : <Card><h2>{resource.data.profile?.display_name ?? 'Perfil institucional'}</h2><dl className="module-details"><dt>Correo institucional</dt><dd>{resource.data.profile?.institutional_email ?? 'Sin registrar'}</dd><dt>Código de personal</dt><dd>{resource.data.staff?.staff_code ?? 'Sin registrar'}</dd><dt>Teléfono</dt><dd>{resource.data.staff?.phone ?? 'Sin registrar'}</dd><dt>Unidad académica</dt><dd>{resource.data.staff?.academic_unit ?? 'Sin registrar'}</dd><dt>Estado</dt><dd>{resource.data.staff?.status === 'active' ? 'Activo' : resource.data.staff?.status ?? 'Perfil pendiente de registro'}</dd></dl></Card>}
  </div>
}
