import { text } from '../../components/forms/form-data'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { useOrganization } from './hooks/useOrganization'
import { organizationCompleteness, registerOrganization, saveOrganization, statusLabel, submitOrganization } from './services/organizations'
import type { OrganizationData } from './services/organizations'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Input, Select, Textarea } from '../../components/ui/Fields'
import { Progress, Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { Editor, ConfirmDialog } from '../../components/forms/Editor'
import { Button } from '../../components/ui/Button'
import { FeatureError, nullable, validUrl } from '../../lib/supabase/feature-helpers'
import { DocumentsPanel } from '../documents/DocumentsPanel'
import { OrganizationContacts } from './OrganizationContacts'
import { DocumentRequirements } from './DocumentRequirements'
import { organizationSubmissionAvailable } from './services/organizations'

export default function OrganizationWorkspace() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [submitting, setSubmitting] = useState(false)
  const [submissionReady, setSubmissionReady] = useState(false)
  useEffect(() => {
    let active = true
    void organizationSubmissionAvailable().then(value => { if (active) setSubmissionReady(value) }).catch(() => {})
    return () => { active = false }
  }, [])
  const resource = useOrganization(session?.user.id ?? '', params.get('organization') ?? undefined)
  const section = useLocation().pathname.split('/')[3] ?? ''
  if (!session) return null
  if (resource.loading && !resource.data) return <><PageHeader title="Mi organización" /><Skeleton label="Cargando organización" /><Skeleton label="Cargando documentación" /></>
  if (resource.error) return <><PageHeader title="Mi organización" /><ErrorState title={resource.error} onRetry={() => void resource.reload()} /></>
  const data = resource.data
  if (!data) return null
  if (!data.organization) return <div className="module-stack"><PageHeader eyebrow="Organización" title="Registra tu organización" description="Crea el perfil inicial. La revisión y verificación corresponden a la Universidad." /><OrganizationProfile data={data} reload={resource.reload} /></div>
  const org = data.organization
  return <div className="module-stack">
    {data.canManage && ['pending_review','changes_required','changes_requested'].includes(org.status) && <><Alert title="Solicitud de organización">Completa el perfil, el contacto principal y la documentación que coordinación te indique. Podrás consultar y corregir la información durante la revisión.</Alert>{!submissionReady && <p role="status">El envío de solicitudes está pendiente de activar en el servidor. Puedes completar y guardar el perfil con tu cuenta autorizada.</p>}<Button disabled={!submissionReady} onClick={() => setSubmitting(true)}>{org.status === 'pending_review' ? 'Solicitar revisión' : 'Reenviar solicitud corregida'}</Button></>}
    <ConfirmDialog open={submitting} title="Solicitar revisión de organización" confirmLabel="Enviar a coordinación" onCancel={() => setSubmitting(false)} onConfirm={async () => { await submitOrganization(org.id); await resource.reload() }}>La aprobación corresponde a ADMIN. Se conservarán las decisiones y observaciones anteriores.</ConfirmDialog>
    {data.organizations.length > 1 && <Select label="Organización activa" value={org.id} onChange={event => setParams({ organization: event.target.value })}>{data.organizations.map(row => <option key={row.id} value={row.id}>{row.display_name ?? row.legal_name}</option>)}</Select>}
    {!data.canManage && <Alert title="Acceso de consulta">Tu membresía permite consultar el perfil y sus revisiones. La edición y los documentos requieren permiso de gestión.</Alert>}
    {!section && <OrganizationHome data={data} />}
    {section === 'profile' && <><PageHeader title="Perfil de organización" description="Mantén actualizada la información de tu organización." /><OrganizationProfile key={org.id} data={data} reload={resource.reload} /><OrganizationContacts key={'contacts-'+org.id} organizationId={org.id} canManage={data.canManage} /><AdministrativeInfo data={data} /></>}
    {section === 'documents' && <><PageHeader title="Documentación" description="Gestiona documentos privados por categoría, pendientes de evaluación institucional." /><DocumentRequirements /><DocumentsPanel key={org.id} scope="organization" ownerId={org.id} userId={session.user.id} documents={data.documents} canManage={data.canManage} reload={resource.reload} /></>}
    {section === 'reviews' && <><PageHeader title="Revisión y estado" description="Consulta las decisiones de coordinación y reenvía la solicitud después de corregirla." /><AdministrativeInfo data={data} /><ReviewTimeline data={data} /></>}
  </div>
}
function OrganizationHome({ data }: { data: OrganizationData }) {
  const org = data.organization
  if (!org) return null
  const completion = organizationCompleteness(org)
  const type = data.types.find(row => row.id === org.organization_type_id)
  const municipality = data.municipalities.find(row => row.id === org.municipality_id)
  return <><PageHeader eyebrow="Organización" title={org.display_name ?? org.legal_name} description={`${type?.name ?? 'Tipo sin registrar'} · ${municipality?.municipality_name ?? 'Municipio sin registrar'}`} />
    <div className="dashboard-grid"><Card><h2>Perfil y próximos pasos</h2><Progress value={completion.percent} label="Completitud del perfil" /><ul className="module-list">{completion.sections.map(item => <li key={item.label}><span>{item.label}</span><strong>{item.complete ? 'Completo' : 'Por completar'}</strong></li>)}</ul><Link className="button button--secondary" to={'/app/organization/profile?organization=' + org.id}>Revisar perfil</Link><p className="workspace-note">La completitud no establece aprobación ni verificación.</p></Card><AdministrativeInfo data={data} /></div>
    <div className="dashboard-grid"><Card><h2>Documentos</h2><p>{data.documents.length ? `${data.documents.length} documento(s) disponible(s).` : data.canManage ? 'Aún no has subido documentos.' : 'Necesitas permiso de gestión para acceder a documentos.'}</p><Link className="button button--secondary" to={'/app/organization/documents?organization=' + org.id}>Ver documentación</Link></Card><Card><h2>Proyectos</h2><p>Gestiona proyectos, plazas y equipos de tu organización.</p><Link className="button button--secondary" to={'/app/organization/projects?organization=' + org.id}>Consultar proyectos y plazas</Link></Card></div><ReviewTimeline data={data} compact />
  </>
}
function AdministrativeInfo({ data }: { data: OrganizationData }) {
  const org = data.organization
  if (!org) return null
  return <Card><h2>Estado administrativo</h2><dl className="module-details"><dt>Estado</dt><dd>{statusLabel(org.status)}</dd><dt>Verificación</dt><dd>{org.verified_at ? `Verificada el ${new Date(org.verified_at).toLocaleDateString('es-CO')}` : 'Sin verificación registrada'}</dd><dt>Verificado por</dt><dd>{org.verified_by ?? 'Sin registrar'}</dd><dt>Creado por</dt><dd>{org.created_by ?? 'Sin registrar'}</dd></dl><p className="workspace-note">Solo coordinación puede modificar el estado y la verificación.</p><Link className="button button--ghost" to={'/app/organization/reviews?organization=' + org.id}>Ver historial</Link></Card>
}
function ReviewTimeline({ data, compact = false }: { data: OrganizationData; compact?: boolean }) {
  const reviews=compact?data.reviews.slice(0,3):data.reviews
  return <Card><h2>Historial de revisión</h2>{!data.reviews.length ? <EmptyState title="Sin revisiones registradas">Las decisiones que coordinación publique para esta organización aparecerán aquí.</EmptyState> : <><ol className="module-list review-timeline">{reviews.map(row => <li key={row.id}><div><h3>{statusLabel(row.decision)}</h3><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('es-CO')}</time><p>{row.notes ?? 'Sin observaciones.'}</p></div></li>)}</ol>{compact && data.reviews.length>3 && <Link className="text-link" to={'/app/organization/reviews?organization='+data.organization?.id}>Consultar historial completo ({data.reviews.length})</Link>}</>}</Card>
}
function OrganizationProfile({ data, reload }: { data: OrganizationData; reload: () => Promise<void> }) {
  const org = data.organization
  const [urlError, setUrlError] = useState('')
  const readOnly = Boolean(org && !data.canManage)
  return <Card><Editor readOnly={readOnly} label={org ? 'Guardar organización' : 'Registrar organización'} onSave={async form => {
    if (readOnly) throw new FeatureError('Tu membresía no permite editar esta organización.')
    const website = text(form, 'website'); setUrlError(validUrl(website) ? '' : 'Usa una URL http o https válida.')
    if (!validUrl(website)) throw new FeatureError('Revisa la URL de la organización.')
    const fields = { legal_name: text(form, 'legal_name'), display_name: nullable(text(form, 'display_name')), tax_id: nullable(text(form, 'tax_id')), organization_type_id: nullable(text(form, 'organization_type_id')), description: nullable(text(form, 'description')), website: nullable(website), municipality_id: nullable(text(form, 'municipality_id')) }
    if (org) await saveOrganization(org.id, fields); else await registerOrganization(fields)
    await reload()
  }}>
    <h2>Identidad</h2><div className="form-grid"><Input label="Nombre legal" name="legal_name" required maxLength={240} defaultValue={org?.legal_name ?? ''} disabled={readOnly} /><Input label="Nombre visible" name="display_name" maxLength={240} defaultValue={org?.display_name ?? ''} disabled={readOnly} />
    <Select label="Tipo de organización" name="organization_type_id" defaultValue={org?.organization_type_id ?? ''} disabled={readOnly}><option value="">Sin registrar</option>{data.types.filter(row => row.active || row.id === org?.organization_type_id).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>
    <Input label="Identificación tributaria" name="tax_id" maxLength={80} defaultValue={org?.tax_id ?? ''} disabled={readOnly} hint="Opcional mientras se definen los requisitos oficiales." /></div>
    {!data.types.length && <Alert title="Catálogo de tipos pendiente">La Universidad debe configurar los tipos de organización. Puedes guardar los demás datos.</Alert>}
    <h2>Presentación y ubicación</h2><Textarea label="Descripción" name="description" rows={4} maxLength={5000} defaultValue={org?.description ?? ''} disabled={readOnly} /><Input label="Sitio web" name="website" type="url" maxLength={2048} defaultValue={org?.website ?? ''} disabled={readOnly} error={urlError} />
    <Select label="Municipio" name="municipality_id" defaultValue={org?.municipality_id ?? ''} disabled={readOnly}><option value="">Sin registrar</option>{data.municipalities.filter(row => row.active || row.id === org?.municipality_id).map(row => <option key={row.id} value={row.id}>{row.municipality_name} · {row.department_name}</option>)}</Select>
    {!data.municipalities.length && <Alert title="Catálogo territorial pendiente">La Universidad debe cargar los municipios reales.</Alert>}
  </Editor></Card>
}
