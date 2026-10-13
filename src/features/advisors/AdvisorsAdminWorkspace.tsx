import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageHeader } from '../../components/layout/Headers'
import { useResource } from '../../components/forms/useResource'
import { Editor, ConfirmDialog } from '../../components/forms/Editor'
import { text } from '../../components/forms/form-data'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { nullable } from '../../lib/supabase/feature-helpers'
import { OrganizationContacts } from '../organizations/OrganizationContacts'
import { AdvisorList } from './AdvisorWorkspace'
import { changeOrganizationAdvisor, changeStudentAdvisor, loadAdminAdvisors, loadPeriods, saveArl, saveSpecialCase, saveStaff } from './services'
import type { AdminAdvisorData, Staff, SpecialCase } from './services'

export function AdvisorsAdminWorkspace() {
  const section=useLocation().pathname.split('/')[3]??''
  const periods=useResource(useCallback(()=>loadPeriods(),[]))
  const [override,setPeriod]=useState<string|null>(null)
  const period=override??periods.data?.find(row=>row.is_current)?.id??periods.data?.[0]?.id??''
  const resource=useResource(useCallback(async()=>({period,...await loadAdminAdvisors(period)}),[period]))
  return <div className="module-stack"><PageHeader eyebrow="Administración" title={section==='special-cases'?'Casos especiales y ARL':'Asesores y responsabilidades'} description={section==='special-cases'?'Información administrativa mínima por participación académica.':'Asignación manual por periodo e historial independiente de cada estudiante.'}/>
    {periods.error?<ErrorState title={periods.error} onRetry={()=>void periods.reload()}/>:periods.loading?<Skeleton label="Cargando periodos"/>:<Select label="Periodo académico" value={period} onChange={event=>setPeriod(event.target.value)}><option value="">Selecciona un periodo</option>{periods.data?.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select>}
    {resource.loading&&resource.data?.period===period&&<Skeleton label="Actualizando responsabilidades"/>}
    {resource.error&&<ErrorState title={resource.error} onRetry={()=>void resource.reload()}/>}
    {!resource.data||resource.data.period!==period?!resource.error&&<><Skeleton label="Cargando personal y responsabilidades"/><Skeleton/></>:section==='special-cases'?<SpecialCases key={period} data={resource.data} reload={resource.reload}/>:<AdminContent key={period} data={resource.data} period={period} reload={resource.reload}/>}
  </div>
}
function profileName(data:AdminAdvisorData,user:string) { return data.profiles.find(row=>row.user_id===user)?.display_name??'Cuenta sin nombre' }
function staffName(data:AdminAdvisorData,id:string) { const staff=data.staff.find(row=>row.id===id);return staff?profileName(data,staff.user_id):'Personal sin perfil' }
function studentName(data:AdminAdvisorData,participation:string) {
  const part=data.participations.find(row=>row.id===participation),student=data.students.find(row=>row.id===part?.student_id)
  return student?`${profileName(data,student.user_id)} · ${student.student_code??'Sin código'}`:'Participación sin estudiante'
}
function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()) }
type Reload={reload:()=>Promise<void>}
function AdminContent({data,period,reload}:{data:AdminAdvisorData;period:string}&Reload) {
  const [tab,setTab]=useState('profiles')
  return <><nav className="module-actions" aria-label="Administrar asesores">{[['profiles','Perfiles de personal'],['organizations','Asesores de organizaciones'],['students','Asesores de estudiantes']].map(([key,label])=><Button key={key} variant={tab===key?'primary':'secondary'} aria-pressed={tab===key} onClick={()=>setTab(key!)}>{label}</Button>)}</nav>
    {tab==='profiles'?<StaffProfiles data={data} reload={reload}/>:!period?<EmptyState title="Selecciona un periodo">Las responsabilidades se administran en un periodo académico.</EmptyState>:tab==='organizations'?<OrganizationResponsibilities data={data} period={period} reload={reload}/>:<StudentResponsibilities data={data} reload={reload}/>}</>
}
function StaffProfiles({data,reload}:{data:AdminAdvisorData}&Reload) {
  const [edit,setEdit]=useState<Staff|null>(null)
  const available=data.profiles.filter(row=>!data.staff.some(staff=>staff.user_id===row.user_id)||row.user_id===edit?.user_id)
  return <><Card><h2>{edit?'Editar perfil de personal':'Registrar perfil de personal'}</h2><p>Registra personal con una cuenta existente. Para recibir responsabilidades, debe tener habilitado el rol Asesor regional y un perfil activo.</p><Link to="/app/admin/users">Administrar usuarios y roles</Link>
    <Editor key={edit?.id??'new'} label={edit?'Guardar perfil de personal':'Registrar personal'} resetOnSave={!edit} onSave={async form=>{await saveStaff({user_id:edit?.user_id??text(form,'user_id'),staff_code:nullable(text(form,'staff_code')),phone:nullable(text(form,'phone')),academic_unit:nullable(text(form,'academic_unit')),status:text(form,'status')},edit?.id);setEdit(null);await reload()}}>
      <div className="form-grid"><Select label="Cuenta de personal" name="user_id" required defaultValue={edit?.user_id??''} disabled={Boolean(edit)}><option value="">Selecciona una cuenta</option>{available.map(row=><option key={row.user_id} value={row.user_id}>{row.display_name??'Sin nombre'} · {row.institutional_email??row.user_id}{data.advisorUsers.has(row.user_id)?' · ADVISOR':''}</option>)}</Select><Input label="Código de personal" name="staff_code" defaultValue={edit?.staff_code??''} maxLength={80}/><Input label="Teléfono institucional" name="phone" type="tel" defaultValue={edit?.phone??''} maxLength={40}/><Input label="Unidad académica" name="academic_unit" defaultValue={edit?.academic_unit??''} maxLength={160}/><Select label="Estado del personal" name="status" defaultValue={edit?.status??'active'}><option value="active">Activo</option><option value="inactive">Inactivo</option>{edit&&!['active','inactive'].includes(edit.status)&&<option value={edit.status}>{edit.status}</option>}</Select></div>
    </Editor>{edit&&<Button variant="secondary" onClick={()=>setEdit(null)}>Cancelar edición</Button>}</Card>
    <AdvisorList rows={data.staff} rowKey={row=>row.id} searchText={row=>`${profileName(data,row.user_id)} ${row.staff_code??''} ${row.academic_unit??''}`} render={row=><Card><h2>{profileName(data,row.user_id)}</h2><p>{row.academic_unit??'Unidad sin registrar'} · {row.status==='active'?'Activo':row.status==='inactive'?'Inactivo':row.status}</p><p>{data.advisorUsers.has(row.user_id)?'Rol Asesor regional habilitado':'Sin rol Asesor regional; puede tener una vinculación técnica opcional.'}</p><p>Organizaciones vigentes en este periodo: {data.organizationHistory.filter(a=>a.advisor_id===row.id&&a.is_current).length}.</p><ul>{data.organizationHistory.filter(a=>a.advisor_id===row.id&&a.is_current).map(a=><li key={a.id}>{data.organizations.find(org=>org.id===a.organization_id)?.legal_name??'Organización sin nombre'}</li>)}</ul><Button variant="secondary" onClick={()=>setEdit(row)}>Editar perfil de {profileName(data,row.user_id)}</Button></Card>}/>
  </>
}
function AdvisorOptions({data}:{data:AdminAdvisorData}) { return <>{data.staff.filter(row=>row.status==='active'&&data.advisorUsers.has(row.user_id)).map(row=><option key={row.id} value={row.id}>{staffName(data,row.id)}</option>)}</> }
function OrganizationResponsibilities({data,period,reload}:{data:AdminAdvisorData;period:string}&Reload) {
  const [organization,setOrganization]=useState(data.organizations[0]?.id??'')
  const [pending,setPending]=useState<{advisor:string|null;date:string}|null>(null)
  const history=data.organizationHistory.filter(row=>row.organization_id===organization)
  const current=history.find(row=>row.is_current)
  const name=data.organizations.find(row=>row.id===organization)?.legal_name
  if(!data.organizations.length)return <EmptyState title="Sin organizaciones">Registra una organización para asignar un asesor.</EmptyState>
  return <><Select label="Organización para asesoría" value={organization} onChange={event=>setOrganization(event.target.value)}>{data.organizations.map(row=><option key={row.id} value={row.id}>{row.display_name??row.legal_name}</option>)}</Select>
    <Card><h2>Responsable de {name}</h2><p>Asesor vigente: {current?staffName(data,current.advisor_id):'Sin asignar'}.</p><Alert title="Asesores de estudiantes independientes">Cambiar o finalizar esta responsabilidad conserva los asesores individuales de los estudiantes.</Alert>
      <Editor key={`${organization}-${current?.id??'none'}`} label="Revisar responsabilidad de organización" successTitle="Cambio pendiente de confirmación" onSave={async form=>setPending({advisor:nullable(text(form,'advisor')),date:text(form,'starts_on')})}>
        <Select label="Nuevo asesor de organización" name="advisor" defaultValue={current?.advisor_id??''}><option value="">Sin asesor (finalizar responsabilidad)</option><AdvisorOptions data={data}/></Select><Input label="Fecha de cambio de organización" name="starts_on" type="date" required defaultValue={today()} max={today()} min={current?.starts_on}/>
      </Editor>
    </Card><Card><h2>Historial de asesores de organización</h2>{history.length?<ol className="module-list">{history.map(row=><li key={row.id}><div><strong>{staffName(data,row.advisor_id)} · {row.is_current?'Vigente':'Finalizado'}</strong><p>{row.starts_on} – {row.ends_on??'Sin finalización'}</p><p>Asignado por {row.assigned_by?profileName(data,row.assigned_by):'Actor no disponible'}.</p></div></li>)}</ol>:<EmptyState title="Sin historial">Las responsabilidades se conservarán al cambiar de asesor.</EmptyState>}</Card>
    <OrganizationContacts key={organization} organizationId={organization} canManage/>
    <ConfirmDialog open={Boolean(pending)} title={pending?.advisor?'Confirmar asesor de organización':'Finalizar responsabilidad de organización'} confirmLabel="Confirmar responsabilidad" onCancel={()=>setPending(null)} onConfirm={async()=>{if(!pending)return;await changeOrganizationAdvisor(organization,period,pending.advisor,pending.date);await reload()}}>{name}: {pending?.advisor?staffName(data,pending.advisor):'sin asesor vigente'} desde {pending?.date}. Se conservará el historial y no se cambiarán los asesores de estudiantes.</ConfirmDialog>
  </>
}
function StudentResponsibilities({data,reload}:{data:AdminAdvisorData}&Reload) {
  const [participation,setParticipation]=useState(data.participations[0]?.id??'')
  const [pending,setPending]=useState<{advisor:string|null;date:string;reason:string;source:string|null}|null>(null)
  const history=data.studentHistory.filter(row=>row.participation_id===participation)
  const current=history.find(row=>row.is_current)
  const part=data.participations.find(row=>row.id===participation)
  if(!data.participations.length)return <EmptyState title="Sin participaciones académicas">Configura la participación del estudiante en el periodo desde administración.</EmptyState>
  return <><Select label="Participación del estudiante" value={participation} onChange={event=>setParticipation(event.target.value)}>{data.participations.map(row=><option key={row.id} value={row.id}>{studentName(data,row.id)}</option>)}</Select>
    <Card><h2>Asesor individual</h2><p>Asesor vigente: {current?staffName(data,current.advisor_id):'Sin asignar'}.</p><Editor key={`${participation}-${current?.id??'none'}`} label="Revisar asesor individual" successTitle="Cambio pendiente de confirmación" onSave={async form=>setPending({advisor:nullable(text(form,'advisor')),date:text(form,'starts_on'),reason:text(form,'reason'),source:nullable(text(form,'source'))})}>
      <Select label="Nuevo asesor del estudiante" name="advisor" defaultValue={current?.advisor_id??''}><option value="">Sin asesor (finalizar responsabilidad)</option><AdvisorOptions data={data}/></Select><Input label="Fecha de cambio individual" name="starts_on" type="date" required defaultValue={today()} max={today()} min={current?.starts_on}/><Textarea label="Motivo administrativo" name="reason" maxLength={1000}/><Select label="Asignación de origen (opcional)" name="source"><option value="">Sin asignación de origen</option>{data.assignments.filter(row=>row.student_id===part?.student_id).map(row=><option key={row.id} value={row.id}>{row.id} · {row.is_active?'Vigente':'Histórica'}</option>)}</Select>
    </Editor></Card><Card><h2>Historial de asesores del estudiante</h2>{history.length?<ol className="module-list">{history.map(row=><li key={row.id}><div><strong>{staffName(data,row.advisor_id)} · {row.is_current?'Vigente':'Finalizado'}</strong><p>{row.starts_on} – {row.ends_on??'Sin finalización'}</p><p>{row.reason??'Sin motivo registrado.'}</p></div></li>)}</ol>:<EmptyState title="Sin historial individual">La asignación individual se administra de forma independiente.</EmptyState>}</Card>
    <ConfirmDialog open={Boolean(pending)} title={pending?.advisor?'Confirmar asesor individual':'Finalizar asesoría individual'} confirmLabel="Confirmar asesor individual" onCancel={()=>setPending(null)} onConfirm={async()=>{if(!pending)return;await changeStudentAdvisor(participation,pending.advisor,pending.date,pending.reason,pending.source);await reload()}}>{studentName(data,participation)}: {pending?.advisor?staffName(data,pending.advisor):'sin asesor vigente'} desde {pending?.date}. El cambio afecta únicamente esta participación.</ConfirmDialog>
  </>
}
function SpecialCases({data,reload}:{data:AdminAdvisorData}&Reload) {
  const [edit,setEdit]=useState<SpecialCase|null>(null)
  const [pending,setPending]=useState<{participation_id:string;case_type_code:string;requested_municipality_id:string|null;status:string;decision_notes:string|null}|null>(null)
  const [arl,setArl]=useState<{participation:string;provider:string}|null>(null)
  const [participation,setParticipation]=useState(data.participations[0]?.id??'')
  if(!data.participations.length)return <EmptyState title="Sin participaciones académicas">Selecciona un periodo con participaciones registradas.</EmptyState>
  return <><Alert title="Registro administrativo restringido">Registra solo información administrativa mínima. Los tipos de caso son códigos abiertos pendientes de definición institucional; evita diagnósticos e información médica.</Alert>
    <Card><h2>{edit?'Revisar caso especial':'Registrar caso especial'}</h2><Editor key={edit?.id??'new'} label="Revisar caso administrativo" successTitle="Decisión pendiente de confirmación" onSave={async form=>setPending({participation_id:text(form,'participation'),case_type_code:text(form,'case_type_code'),requested_municipality_id:nullable(text(form,'municipality')),status:text(form,'status'),decision_notes:nullable(text(form,'decision_notes'))})}>
      <Select label="Participación del caso" name="participation" required defaultValue={edit?.participation_id??''}><option value="">Selecciona una participación</option>{data.participations.map(row=><option key={row.id} value={row.id}>{studentName(data,row.id)}</option>)}</Select><Input label="Código del tipo de caso" name="case_type_code" required maxLength={80} defaultValue={edit?.case_type_code??''}/><Select label="Municipio solicitado (opcional)" name="municipality" defaultValue={edit?.requested_municipality_id??''}><option value="">Sin municipio solicitado</option>{data.municipalities.map(row=><option key={row.id} value={row.id}>{row.municipality_name} · {row.department_name}</option>)}</Select><Input label="Estado administrativo del caso" name="status" required maxLength={80} defaultValue={edit?.status??''}/><Textarea label="Observaciones de decisión" name="decision_notes" maxLength={2000} defaultValue={edit?.decision_notes??''}/>
    </Editor>{edit&&<Button variant="secondary" onClick={()=>setEdit(null)}>Cancelar revisión</Button>}</Card>
    <AdvisorList rows={data.cases} rowKey={row=>row.id} searchText={row=>`${studentName(data,row.participation_id)} ${row.case_type_code} ${row.status}`} render={row=><Card><h2>{studentName(data,row.participation_id)}</h2><p>{row.case_type_code} · {row.status}</p><p>{row.decision_notes??'Sin observaciones de decisión.'}</p><p>Revisor: {row.reviewed_by?profileName(data,row.reviewed_by):'Sin revisor registrado'}.</p><Button variant="secondary" onClick={()=>setEdit(row)}>Revisar caso de {studentName(data,row.participation_id)}</Button></Card>}/>
    <Card><h2>Entidad ARL</h2><Select label="Participación para ARL" value={participation} onChange={event=>setParticipation(event.target.value)}>{data.participations.map(row=><option key={row.id} value={row.id}>{studentName(data,row.id)}</option>)}</Select><Editor key={participation} label="Revisar nombre de ARL" successTitle="Cambio pendiente de confirmación" onSave={async form=>setArl({participation,provider:text(form,'arl')})}><Input label="Nombre de la entidad ARL (opcional)" name="arl" maxLength={200} defaultValue={data.participations.find(row=>row.id===participation)?.arl_provider_name??''}/></Editor></Card>
    <ConfirmDialog open={Boolean(pending)} title="Confirmar revisión de caso especial" confirmLabel="Guardar revisión administrativa" onCancel={()=>setPending(null)} onConfirm={async()=>{if(!pending)return;await saveSpecialCase(pending,edit?.id);setEdit(null);await reload()}}>{pending?studentName(data,pending.participation_id):''} · {pending?.case_type_code} · {pending?.status}. La revisión quedará vinculada a tu cuenta administrativa.</ConfirmDialog>
    <ConfirmDialog open={Boolean(arl)} title="Confirmar entidad ARL" confirmLabel="Guardar entidad ARL" onCancel={()=>setArl(null)} onConfirm={async()=>{if(!arl)return;await saveArl(arl.participation,arl.provider);await reload()}}>{arl?studentName(data,arl.participation):''}: {arl?.provider||'sin entidad registrada'}.</ConfirmDialog>
  </>
}
