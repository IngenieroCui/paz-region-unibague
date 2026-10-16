import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { ConfirmDialog, Editor } from '../../components/forms/Editor'
import { text } from '../../components/forms/form-data'
import { useResource } from '../../components/forms/useResource'
import { DataTable, PagedResults } from '../../components/forms/PagedData'
import { nullable } from '../../lib/supabase/feature-helpers'
import { bogotaDateTime, bogotaInstant, callContext, callDetail, callEditable, callStates, changeCallState, linkCallPosition, listCalls, saveCall, unlinkCallPosition } from './services/calls'
import type { Call, CallStatus } from './services/calls'
type Context = Awaited<ReturnType<typeof callContext>>

export function OrganizationCallsPage() { return <CallsWorkspace/> }
export function AdminCallsPage() { return <CallsWorkspace admin/> }
export default function CallsWorkspace({ admin = false }: { admin?: boolean }) {
  const { session, roles } = useAuth()
  const allowed = !!session && roles.includes(admin ? 'ADMIN' : 'ORGANIZATION')
  const [params, setParams] = useSearchParams()
  const { callId } = useParams()
  const user = session?.user.id ?? ''
  const context = useResource(useCallback(() => allowed ? callContext(user,admin) : Promise.resolve(null), [allowed,user,admin]))
  if (!allowed) return <Alert tone="error" title="No tienes permiso para consultar convocatorias."/>
  if (context.loading && !context.data) return <Skeleton label="Cargando convocatorias"/>
  if (context.error) return <ErrorState title={context.error} onRetry={() => void context.reload()}/>
  if (!context.data) return null
  const data = context.data
  const organization = admin ? params.get('organization') ?? '' : data.memberships.find(member => member.organization_id === params.get('organization'))?.organization_id ?? data.memberships[0]?.organization_id ?? ''
  const manage = admin || !!data.memberships.find(member => member.organization_id === organization)?.can_manage
  const selectedOrganization = data.organizations.find(org => org.id === organization)
  const base = admin ? '/app/admin/calls' : '/app/organization/calls'
  const suffix = organization ? '?organization=' + organization : ''
  if (!admin && !organization) return <div className="module-stack"><PageHeader title="Convocatorias" description="Publica y consulta las plazas de tu organización." /><EmptyState title="Sin organización disponible">Registra una organización para gestionar convocatorias. <Link to="/app/organization/profile">Registrar organización</Link></EmptyState></div>
  return <div className="module-stack">
    {!admin && (selectedOrganization?.status !== 'approved' || !selectedOrganization.verified_at) && <Alert title="Organización pendiente de validación">Puedes preparar tu convocatoria. La publicación requiere aprobación y verificación de coordinación.</Alert>}
    <Select label={admin ? 'Filtrar organización' : 'Organización activa'} value={organization} onChange={event => { const next = new URLSearchParams(params); if(event.target.value) next.set('organization',event.target.value); else next.delete('organization'); setParams(next) }}>
      {admin && <option value="">Todas las organizaciones</option>}
      {data.organizations.filter(org => admin || data.memberships.some(member => member.organization_id === org.id)).map(org => <option key={org.id} value={org.id}>{org.legal_name}</option>)}
    </Select>
    {callId ? <CallDetail key={callId+organization} id={callId} context={data} admin={admin} organization={organization} base={base} suffix={suffix}/> : params.get('new') === '1' ? <>
      <PageHeader title="Crear convocatoria" description="Primero guarda el borrador; después vincula sus plazas."/>
      {manage ? <CallForm key={organization} context={data} organization={organization} base={base} suffix={suffix}/> : <Alert title="Tu membresía permite únicamente consultar."/>}
      <Link to={base+suffix}>Volver a convocatorias</Link>
    </> : <CallList key={organization} context={data} organization={organization} base={base} suffix={suffix} manage={manage}/>}
  </div>
}
function CallList({ context, organization, base, suffix, manage }: { context: Context; organization: string; base: string; suffix: string; manage: boolean }) {
  const [period,setPeriod] = useState(''), [status,setStatus] = useState(''), [page,setPage] = useState(0)
  const list = useResource(useCallback(() => listCalls(page,{ organization,period,status }),[page,organization,period,status]))
  return <><PageHeader title="Convocatorias" description="Una convocatoria publica plazas existentes. Los estados son provisionales." action={manage ? <Link className="button button--primary" to={base+'?new=1'+(organization?'&organization='+organization:'')}>Crear convocatoria</Link> : undefined}/>
    <div className="form-grid"><Select label="Periodo" value={period} onChange={event => { setPeriod(event.target.value); setPage(0) }}><option value="">Todos</option>{context.periods.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select><Select label="Estado" value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">Todos</option>{Object.entries(callStates).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
    <PagedResults {...list} page={page} setPage={setPage} count={list.data?.count ?? 0}>
      <DataTable caption="Convocatorias registradas" rows={list.data?.rows ?? []} rowKey={row => row.id} columns={[
        { label:'Convocatoria',cell:row => <Link to={base+'/'+row.id+suffix}>{row.title}</Link> },
        { label:'Institución',cell:row => context.organizations.find(org => org.id === row.organization_id)?.legal_name ?? 'Sin registrar' },
        { label:'Periodo',cell:row => context.periods.find(period => period.id === row.academic_period_id)?.name ?? 'Sin registrar' },
        { label:'Estado',cell:row => callStates[row.status] }, { label:'Cupos',cell:row => row.capacity },
      ]}/>
      <p>Capacidad única de las plazas en esta página: {list.data?.uniqueCapacity ?? 0}. Una plaza publicada en varias convocatorias mantiene los mismos cupos.</p>
    </PagedResults>
  </>
}
function CallForm({ call, context, organization, base, suffix, readOnly = false, reload }: { call?: Call; context: Context; organization: string; base: string; suffix: string; readOnly?: boolean; reload?: () => Promise<void> }) {
  const [created,setCreated] = useState('')
  if (created) return <Card><Alert tone="success" title="Convocatoria creada"/><Link className="button button--primary" to={base+'/'+created+suffix}>Vincular plazas</Link></Card>
  return <Card><Editor readOnly={readOnly} label={call?'Guardar convocatoria':'Guardar borrador'} onSave={async form => {
    const id = await saveCall(call?.id ?? null,call?.organization_id ?? (text(form,'organization_id') || organization),{ title:text(form,'title'),details:nullable(text(form,'details')),academic_period_id:text(form,'academic_period_id'),opens_at:bogotaInstant(text(form,'opens_at')),closes_at:bogotaInstant(text(form,'closes_at')) })
    if (reload) await reload(); else setCreated(id)
  }}>
    {!call && <Select label="Institución titular" name="organization_id" required defaultValue={organization} disabled={readOnly}><option value="">Selecciona institución</option>{context.organizations.filter(org => !context.memberships.length || (org.id === organization && context.memberships.some(member => member.organization_id === org.id && member.can_manage))).map(org => <option key={org.id} value={org.id}>{org.legal_name}</option>)}</Select>}
    <Input label="Nombre de la convocatoria" name="title" required maxLength={240} defaultValue={call?.title ?? ''} disabled={readOnly}/>
    <Textarea label="Detalles de la convocatoria" name="details" maxLength={10000} defaultValue={call?.details ?? ''} disabled={readOnly}/>
    <Select label="Periodo académico" name="academic_period_id" required defaultValue={call?.academic_period_id ?? context.periods.find(period => period.is_current)?.id ?? ''} disabled={readOnly}><option value="">Selecciona periodo</option>{context.periods.map(period => <option key={period.id} value={period.id}>{period.name}</option>)}</Select>
    <div className="form-grid"><Input label="Apertura (hora de Colombia)" name="opens_at" type="datetime-local" defaultValue={bogotaDateTime(call?.opens_at ?? null)} disabled={readOnly}/><Input label="Cierre (hora de Colombia)" name="closes_at" type="datetime-local" defaultValue={bogotaDateTime(call?.closes_at ?? null)} disabled={readOnly}/></div>
    {!context.periods.length && <Alert tone="warning" title="Solicita configurar los periodos académicos."/>}
  </Editor></Card>
}
function CallDetail({ id, context, admin, organization, base, suffix }: { id: string; context: Context; admin: boolean; organization: string; base: string; suffix: string }) {
  const resource = useResource(useCallback(() => callDetail(id),[id]))
  const [decision,setDecision] = useState<CallStatus | null>(null)
  const [unlink,setUnlink] = useState('')
  if (resource.loading && !resource.data) return <Skeleton label="Cargando convocatoria y plazas"/>
  if (resource.error) return <ErrorState title={resource.error} onRetry={() => void resource.reload()}/>
  if (!resource.data) return null
  const { call,links,positions } = resource.data
  if (!admin && call.organization_id !== organization) return <Alert tone="error" title="Esta convocatoria pertenece a otra organización seleccionada."/>
  const manage = admin || !!context.memberships.find(member => member.organization_id === call.organization_id)?.can_manage
  const editable = manage && (admin || callEditable(call.status))
  const capacity = positions.filter(position => links.some(link => link.project_position_id === position.id)).reduce((sum,position) => sum+position.capacity,0)
  return <><PageHeader title={call.title} description={callStates[call.status]} action={<Link to={base+suffix}>Volver a convocatorias</Link>}/>
    <p>Capacidad ofertada: {capacity} cupos. Para cupos diferentes por carrera, configura plazas diferentes.</p>
    <CallForm key={call.updated_at} call={call} context={context} organization={call.organization_id} base={base} suffix={suffix} readOnly={!editable} reload={resource.reload}/>
    <h2>Plazas vinculadas</h2>{links.length ? links.map(link => {
      const position = positions.find(position => position.id === link.project_position_id)
      return <Card key={link.id}><h3>{position?.title ?? 'Plaza no disponible'}</h3><p>{position?.PYRUnibague_Projects.name} · {position?.capacity ?? '—'} cupos · {position?.status}</p><p>Programas compatibles: {position?.PYRUnibague_ProjectPositionPrograms.map(program => program.PYRUnibague_AcademicPrograms?.name).filter(Boolean).join(', ') || 'Sin registrar'}</p>{editable && <Button variant="secondary" onClick={() => setUnlink(link.id)}>Retirar plaza</Button>}</Card>
    }) : <EmptyState title="Sin plazas vinculadas">Selecciona plazas de proyectos de esta institución y periodo.</EmptyState>}
    {editable && <Card><Editor label="Vincular plaza" onSave={async form => { const position = positions.find(position => position.id === text(form,'position')); if (!position) return; await linkCallPosition(call,position); await resource.reload() }}><Select label="Plaza existente" name="position" required><option value="">Selecciona plaza</option>{positions.filter(position => !links.some(link => link.project_position_id === position.id)).map(position => <option key={position.id} value={position.id}>{position.PYRUnibague_Projects.name} · {position.title} · {position.capacity} cupos</option>)}</Select></Editor></Card>}
    {manage && <div className="module-actions">{(admin ? Object.keys(callStates) as CallStatus[] : callEditable(call.status) ? ['submitted','open','closed'] as const : call.status !== 'closed' ? ['closed'] as const : []).filter(status => status !== call.status).map(status => <Button key={status} disabled={status === 'open' && !context.organizations.some(org => org.id === call.organization_id && org.status === 'approved' && org.verified_at)} variant="secondary" onClick={() => setDecision(status)}>{status === 'submitted' ? 'Enviar para revisión' : status === 'open' ? 'Publicar convocatoria' : callStates[status]}</Button>)}</div>}
    <ConfirmDialog open={decision !== null} title="Cambiar estado de convocatoria" confirmLabel="Confirmar estado" onCancel={() => setDecision(null)} onConfirm={async () => { if (decision) { await changeCallState(id,decision); await resource.reload() } }}>Nuevo estado: {decision ? callStates[decision] : ''}. Estados provisionales sujetos a validación institucional.</ConfirmDialog>
    <ConfirmDialog open={!!unlink} title="Retirar plaza de convocatoria" confirmLabel="Retirar plaza" onCancel={() => setUnlink('')} onConfirm={async () => { await unlinkCallPosition(unlink); await resource.reload() }}>La plaza conserva su capacidad y sus otras relaciones.</ConfirmDialog>
  </>
}
