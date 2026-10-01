import { useCallback, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { ConfirmDialog, Editor } from '../../components/forms/Editor'
import { text } from '../../components/forms/form-data'
import { usePaged } from '../../components/forms/usePaged'
import { useResource } from '../../components/forms/useResource'
import { DataTable, PagedResults, SearchField } from '../../components/forms/PagedData'
import { nullable } from '../../lib/supabase/feature-helpers'
import { changeProjectState, editableState, listProjects, projectCatalogs, projectDetail, projectMemberships, projectStateLabel, projectStates, removeProjectPart, savePosition, savePositionProgram, savePositionSkill, saveProject, saveRequirement } from './services/projects'
import type { Position, Project, ProjectDetail } from './services/projects'

type Catalogs = Awaited<ReturnType<typeof projectCatalogs>>
export default function ProjectsWorkspace() {
  const { session, roles } = useAuth()
  const admin = useLocation().pathname.startsWith('/app/admin') && roles.includes('ADMIN')
  const [params,setParams]=useSearchParams()
  const {projectId}=useParams()
  const location=useLocation()
  const user=session?.user.id??''
  const resource=useResource(useCallback(async()=>{const[catalogs,members]=await Promise.all([projectCatalogs(),admin?Promise.resolve([]):projectMemberships(user)]);return {catalogs,members}},[admin,user]))
  if (resource.loading&&!resource.data) return <><PageHeader title="Proyectos y plazas"/><Skeleton label="Cargando proyectos"/></>
  if (resource.error) return <ErrorState title={resource.error} onRetry={()=>void resource.reload()}/>
  if (!resource.data || !session) return null
  const {catalogs,members}=resource.data
  const member=members.find(row=>row.organization_id===params.get('organization'))??members.find(row=>row.can_manage)??members[0]
  if (!admin&&!member) return <EmptyState title="Registra tu organización">Completa el perfil desde <Link to="/app/organization/profile">Organización</Link> antes de crear proyectos.</EmptyState>
  const base=admin?'/app/admin/projects':'/app/organization/projects'
  const suffix=admin?'':'?organization='+member?.organization_id
  const organization=member?.organization_id??''
  const canManage=admin||Boolean(member?.can_manage)
  return <div className="module-stack">{!admin&&members.length>1&&<Select label="Organización activa" value={organization} onChange={event=>setParams({organization:event.target.value})}>{members.map(row=><option key={row.id} value={row.organization_id}>{row.PYRUnibague_Organizations?.legal_name??row.organization_id}</option>)}</Select>}
    {!canManage&&<Alert title="Acceso de consulta">Tu membresía no permite escribir proyectos ni plazas.</Alert>}
    {projectId?<ProjectEditor key={projectId+organization} id={projectId} catalogs={catalogs} user={user} organization={organization} canManage={canManage} admin={admin} base={base} suffix={suffix}/>:location.pathname.endsWith('/new')?<><PageHeader title="Crear proyecto" description="Primero define el proyecto. Después añade sus plazas y el perfil requerido."/>{canManage?<GeneralForm catalogs={catalogs} user={user} organization={organization} onCreated={base} suffix={suffix}/>:<Alert title="Se requiere permiso de gestión"/>}</>:<ProjectList catalogs={catalogs} organization={admin?params.get('organization')??'':organization} canManage={canManage} base={base} suffix={suffix} admin={admin}/>}
  </div>
}
function ProjectList({catalogs,organization,canManage,base,suffix,admin}:{catalogs:Catalogs;organization:string;canManage:boolean;base:string;suffix:string;admin:boolean}) {
  const [params]=useSearchParams()
  const [status,setStatus]=useState(params.get('status')??'')
  const [period,setPeriod]=useState('')
  const [municipality,setMunicipality]=useState('')
  const [modality,setModality]=useState('')
  const list=usePaged(useCallback((page:number,search:string)=>listProjects(page,search,{organization,period,status,municipality,modality}),[organization,period,status,municipality,modality]))
  const filter=(setter:(v:string)=>void,value:string)=>{setter(value);list.setPage(0)}
  return <><PageHeader title="Proyectos y plazas" description="Proyecto → Plazas → Perfil requerido. Los estados son provisionales." action={!admin&&canManage?<Link className="button button--primary" to={base+'/new'+suffix}>Crear proyecto</Link>:undefined}/>
    <Card><div className="form-grid"><SearchField value={list.search} onChange={list.setSearch}/><Select label="Estado" value={status} onChange={event=>filter(setStatus,event.target.value)}><option value="">Todos</option>{Object.entries(projectStates).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><Select label="Periodo" value={period} onChange={event=>filter(setPeriod,event.target.value)}><option value="">Todos</option>{catalogs.periods.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select><Select label="Municipio" value={municipality} onChange={event=>filter(setMunicipality,event.target.value)}><option value="">Todos</option>{catalogs.municipalities.map(row=><option key={row.id} value={row.id}>{row.municipality_name}</option>)}</Select><Input label="Modalidad" value={modality} onChange={event=>filter(setModality,event.target.value)}/></div></Card>
    <PagedResults {...list} count={list.data?.count??0}><DataTable caption="Proyectos registrados" rows={list.data?.rows??[]} rowKey={row=>row.id} columns={[
      {label:'Nombre',cell:row=><Link to={base+'/'+row.id+suffix}>{row.name}</Link>},
      ...(admin?[{label:'Organización',cell:(row:Awaited<ReturnType<typeof listProjects>>['rows'][number])=>row.PYRUnibague_Organizations?.legal_name??'—'}]:[]),
      {label:'Periodo',cell:row=>row.PYRUnibague_AcademicPeriods?.name??'—'}, {label:'Municipio',cell:row=>row.PYRUnibague_Municipalities?.municipality_name??'—'},
      {label:'Modalidad',cell:row=>row.modality??'—'},{label:'Estado',cell:row=>projectStateLabel(row.status)},{label:'Plazas',cell:row=>row.PYRUnibague_ProjectPositions[0]?.count??0},{label:'Capacidad total',cell:row=>row.capacity},
    ]}/></PagedResults></>
}
function GeneralForm({project,catalogs,user,organization,reload,onCreated,suffix,readOnly=false}:{project?:Project;catalogs:Catalogs;user:string;organization:string;reload?:()=>Promise<void>;onCreated?:string;suffix:string;readOnly?:boolean}) {
  const [createdId,setCreatedId]=useState('')
  if(createdId&&onCreated)return <Card><Alert tone="success" title="Proyecto creado">Continúa con sus plazas y perfiles requeridos.</Alert><Link className="button button--primary" to={onCreated+'/'+createdId+suffix}>Configurar plazas</Link></Card>
  return <Card><Editor label={project?'Guardar proyecto':'Guardar y añadir plazas'} readOnly={readOnly} onSave={async form=>{
    const id=await saveProject(project?.id??null,organization,user,{name:text(form,'name'),summary:nullable(text(form,'summary')),description:nullable(text(form,'description')),academic_period_id:text(form,'academic_period_id'),municipality_id:nullable(text(form,'municipality_id')),modality:nullable(text(form,'modality'))})
    if(reload) await reload();if(onCreated)setCreatedId(id)
  }}><h2>General</h2><Input label="Nombre del proyecto" name="name" required maxLength={240} defaultValue={project?.name??''} disabled={readOnly}/><Textarea label="Resumen" name="summary" maxLength={1000} defaultValue={project?.summary??''} disabled={readOnly}/><Textarea label="Descripción del proyecto" name="description" maxLength={10000} rows={5} defaultValue={project?.description??''} disabled={readOnly}/>
    <h2>Contexto</h2><div className="form-grid"><Select label="Periodo académico" name="academic_period_id" required defaultValue={project?.academic_period_id??catalogs.periods.find(row=>row.is_current)?.id??''} disabled={readOnly}><option value="">Selecciona periodo</option>{catalogs.periods.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select><Select label="Municipio del proyecto" name="municipality_id" defaultValue={project?.municipality_id??''} disabled={readOnly}><option value="">Sin registrar</option>{catalogs.municipalities.filter(row=>row.active||row.id===project?.municipality_id).map(row=><option key={row.id} value={row.id}>{row.municipality_name} · {row.department_name}</option>)}</Select><Input label="Modalidad del proyecto" name="modality" maxLength={80} defaultValue={project?.modality??''} disabled={readOnly} hint="Utiliza la denominación acordada con coordinación."/></div>
    {!catalogs.periods.length&&<Alert tone="warning" title="Falta configurar el periodo académico">Solicita a coordinación que configure los catálogos.</Alert>}
  </Editor></Card>
}
function ProjectEditor({id,catalogs,user,organization,canManage,admin,base,suffix}:{id:string;catalogs:Catalogs;user:string;organization:string;canManage:boolean;admin:boolean;base:string;suffix:string}) {
  const [page,setPage]=useState(0)
  const resource=useResource(useCallback(()=>projectDetail(id,page),[id,page]))
  const [decision,setDecision]=useState('')
  const data=resource.data
  if(resource.loading&&!data) return <Skeleton label="Cargando proyecto y plazas"/>
  if(resource.error) return <ErrorState title={resource.error} onRetry={()=>void resource.reload()}/>
  if(!data) return null
  if(!admin&&data.project.organization_id!==organization) return <Alert tone="error" title="El proyecto no pertenece a la organización seleccionada"/>
  const readOnly=!canManage||(!admin&&!editableState(data.project.status))
  return <><PageHeader title={data.project.name} description={`${projectStateLabel(data.project.status)} · ${data.project.PYRUnibague_Organizations?.legal_name??''}`} action={<Link className="button button--secondary" to={base+suffix}>Volver a proyectos</Link>}/>
    {data.project.status==='submitted'&&<Alert tone="warning" title="Pendiente de revisión administrativa">La solicitud está enviada. Coordinación puede aprobarla o solicitar cambios.</Alert>}
    <div className="module-actions">{!admin&&!readOnly&&<Button onClick={()=>setDecision('submitted')}>Enviar para revisión</Button>}{admin&&['approved','changes_required','closed'].map(status=><Button key={status} variant={status==='approved'?'primary':'secondary'} onClick={()=>setDecision(status)}>{projectStateLabel(status)}</Button>)}</div>
    <ConfirmDialog open={Boolean(decision)} title={projectStateLabel(decision)} confirmLabel="Confirmar estado" onCancel={()=>setDecision('')} onConfirm={async()=>{await changeProjectState(id,decision);await resource.reload()}}>Confirma el cambio del estado del proyecto. La organización podrá editar únicamente borradores o solicitudes de cambios.</ConfirmDialog>
    <GeneralForm key={data.project.updated_at} project={data.project} catalogs={catalogs} user={user} organization={data.project.organization_id} suffix={suffix} reload={resource.reload} readOnly={readOnly}/>
    <h2>Plazas y perfil requerido</h2><p>Cada plaza define su capacidad, programas, habilidades y requisitos.</p>
    <PagedResults loading={resource.loading} error={resource.error} count={data.count} page={page} setPage={setPage} reload={resource.reload}>{data.positions.map(position=><Card key={position.id}><h3>{position.title} · Capacidad {position.capacity}</h3><details><summary>Consultar o editar plaza y perfil requerido</summary><PositionForm key={position.updated_at} project={id} position={position} readOnly={readOnly} reload={resource.reload}/><PositionProfile position={position} data={data} catalogs={catalogs} readOnly={readOnly} reload={resource.reload}/></details>{!readOnly&&<RemovePart table="PYRUnibague_ProjectPositions" id={position.id} reload={resource.reload} label="Eliminar plaza"/>}</Card>)}</PagedResults>
    {!readOnly&&<Card><h2>Añadir plaza</h2><PositionForm project={id} reload={resource.reload}/></Card>}
  </>
}
function PositionForm({project,position,readOnly=false,reload}:{project:string;position?:Position;readOnly?:boolean;reload:()=>Promise<void>}) {
  return <Editor readOnly={readOnly} resetOnSave={!position} label={position?'Guardar plaza':'Añadir plaza'} onSave={async form=>{await savePosition(position?.id??null,project,{title:text(form,'title'),description:nullable(text(form,'description')),capacity:Number(text(form,'capacity')),status:text(form,'status'),is_active:form.has('is_active')});await reload()}}><Input label="Título de la plaza" name="title" required defaultValue={position?.title??''} maxLength={240} disabled={readOnly}/><Textarea label="Descripción de la plaza" name="description" defaultValue={position?.description??''} maxLength={5000} disabled={readOnly}/><div className="form-grid"><Input label="Capacidad" name="capacity" type="number" min={1} max={2147483647} step={1} required defaultValue={position?.capacity??1} disabled={readOnly}/><Input label="Estado de la plaza" name="status" required defaultValue={position?.status??'draft'} maxLength={80} disabled={readOnly}/></div><Checkbox label="Plaza activa" name="is_active" defaultChecked={position?.is_active??true} disabled={readOnly}/></Editor>
}
function PositionProfile({position,data,catalogs,readOnly,reload}:{position:Position;data:ProjectDetail;catalogs:Catalogs;readOnly:boolean;reload:()=>Promise<void>}) {
  const programs=data.programs.filter(row=>row.project_position_id===position.id),skills=data.skills.filter(row=>row.project_position_id===position.id),requirements=data.requirements.filter(row=>row.project_position_id===position.id)
  return <div className="p4-subsection"><h3>Perfil requerido</h3><h4>Programas</h4><ul className="module-list">{programs.map(row=><li key={row.id}><span>{catalogs.programs.find(item=>item.id===row.academic_program_id)?.name??row.academic_program_id} · {row.is_required?'Requerido':'Deseable'}</span>{!readOnly&&<RemovePart table="PYRUnibague_ProjectPositionPrograms" id={row.id} reload={reload}/>}</li>)}</ul>{!readOnly&&<Editor label="Guardar programa" onSave={async form=>{await savePositionProgram(position.id,text(form,'program'),form.has('required'));await reload()}}><Select label="Programa para la plaza" name="program" required><option value="">Selecciona programa</option>{catalogs.programs.filter(row=>row.active||programs.some(link=>link.academic_program_id===row.id)).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select><Checkbox label="Programa requerido" name="required" defaultChecked/></Editor>}
    <h4>Habilidades</h4><ul className="module-list">{skills.map(row=><li key={row.id}><span>{catalogs.skills.find(item=>item.id===row.skill_id)?.name??row.skill_id} · {row.is_required?'Requerida':'Deseable'}</span>{!readOnly&&<RemovePart table="PYRUnibague_ProjectPositionSkills" id={row.id} reload={reload}/>}</li>)}</ul>{!readOnly&&<Editor label="Guardar habilidad" onSave={async form=>{await savePositionSkill(position.id,text(form,'skill'),form.has('required'));await reload()}}><Select label="Habilidad para la plaza" name="skill" required><option value="">Selecciona habilidad</option>{catalogs.skills.filter(row=>row.active||skills.some(link=>link.skill_id===row.id)).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select><Checkbox label="Habilidad requerida" name="required" defaultChecked/></Editor>}
    <h4>Requisitos</h4>{requirements.map(row=><details key={row.id}><summary>{row.sort_order}. {row.label} · {row.is_mandatory?'Obligatorio':'Deseable'}</summary><RequirementForm key={row.updated_at} position={position.id} requirement={row} readOnly={readOnly} reload={reload}/>{!readOnly&&<RemovePart table="PYRUnibague_ProjectRequirements" id={row.id} reload={reload}/>}</details>)}{!readOnly&&<RequirementForm position={position.id} reload={reload}/>}</div>
}
function RequirementForm({position,requirement,readOnly=false,reload}:{position:string;requirement?:ProjectDetail['requirements'][number];readOnly?:boolean;reload:()=>Promise<void>}) {
  return <Editor readOnly={readOnly} resetOnSave={!requirement} label={requirement?'Guardar requisito':'Añadir requisito'} onSave={async form=>{await saveRequirement(requirement?.id??null,position,{label:text(form,'label'),description:nullable(text(form,'description')),is_mandatory:form.has('mandatory'),sort_order:Number(text(form,'order'))});await reload()}}><Input label="Requisito" name="label" required maxLength={240} defaultValue={requirement?.label??''} disabled={readOnly}/><Textarea label="Descripción del requisito" name="description" maxLength={5000} defaultValue={requirement?.description??''} disabled={readOnly}/><Input label="Orden" name="order" type="number" required min={0} step={1} defaultValue={requirement?.sort_order??0} disabled={readOnly}/><Checkbox label="Requisito obligatorio" name="mandatory" defaultChecked={requirement?.is_mandatory??true} disabled={readOnly}/></Editor>
}
function RemovePart({table,id,reload,label='Quitar'}:{table:Parameters<typeof removeProjectPart>[0];id:string;reload:()=>Promise<void>;label?:string}) {const[open,setOpen]=useState(false);return <><Button variant="ghost" onClick={()=>setOpen(true)}>{label}</Button><ConfirmDialog open={open} title={label} onCancel={()=>setOpen(false)} onConfirm={async()=>{await removeProjectPart(table,id);await reload()}}>Confirma la eliminación. Las referencias históricas pueden impedir eliminar una plaza.</ConfirmDialog></>}
