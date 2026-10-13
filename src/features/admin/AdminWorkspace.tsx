import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea, Checkbox } from '../../components/ui/Fields'
import { Alert, ErrorState } from '../../components/feedback/States'
import { Skeleton } from '../../components/ui/Progress'
import { ConfirmDialog, Editor } from '../../components/forms/Editor'
import { usePaged } from '../../components/forms/usePaged'
import { useResource } from '../../components/forms/useResource'
import { DataTable, PagedResults, SearchField } from '../../components/forms/PagedData'
import { FeatureError } from '../../lib/supabase/feature-helpers'
import { changeRole, dashboard, listAudit, listUsers } from './services/admin'
import { catalogFields, catalogNames, deactivateCatalog, deleteConfiguration, deleteUnusedPeriod, listCatalog, saveCatalog, setCurrentPeriod } from './services/catalogs'
import type { Catalog, CatalogRow } from './services/catalogs'
import { OrganizationsPage, StudentsPage } from './ReviewPages'

export default function AdminWorkspace(){
 const section=useLocation().pathname.split('/')[3]??''
 if(section==='students')return <StudentsPage/>
 if(section==='organizations')return <OrganizationsPage/>
 if(section==='users')return <UsersPage/>
 if(section==='settings')return <SettingsPage/>
 if(section==='audit')return <AuditPage/>
 return <Dashboard/>
}
function Dashboard(){
 const resource=useResource(useCallback(()=>dashboard(),[]))
 if(resource.error)return <ErrorState title={resource.error} onRetry={()=>void resource.reload()}/>
 if(!resource.data)return <><PageHeader title="Resumen administrativo"/><Skeleton label="Cargando métricas administrativas"/></>
 const data=resource.data
 const metrics=[['Estudiantes registrados',data.students],['Estudiantes participando',data.participating],['Elegibles para matching',data.eligible],['Organizaciones',data.organizations],['Organizaciones pendientes',data.pendingOrganizations],['Proyectos',data.projects],['Proyectos pendientes',data.pendingProjects],['Plazas',data.positions],['Capacidad total',data.capacity]] as const
 const missing=[['programs','Programas académicos'],['municipalities','Municipios'],['types','Tipos de organización'],['skills','Habilidades']] as const
 return <div className="module-stack"><PageHeader title="Resumen administrativo" description={'Periodo actual: '+(data.period??'Sin configurar')}/><p>Participación y elegibilidad corresponden al periodo actual. Las demás métricas abarcan los registros disponibles.</p><div className="p4-metrics">{metrics.map(([label,value])=><Card key={label}><h2>{label}</h2><strong>{value.toLocaleString('es-CO')}</strong></Card>)}</div>
 <Card><h2>Pendientes por periodo y exportaciones</h2><Link className="button button--secondary" to="/app/admin/operations">Abrir coordinación operativa y CSV</Link></Card>
 <Card><h2>Requieren atención · {data.pendingOrganizations+data.pendingProjects}</h2><div className="module-actions"><Link className="button button--secondary" to="/app/admin/organizations?status=pending">Revisar organizaciones ({data.pendingOrganizations})</Link><Link className="button button--secondary" to="/app/admin/projects?status=submitted">Revisar proyectos ({data.pendingProjects})</Link></div></Card>
 {!data.period&&<Alert tone="warning" title="Configura el periodo actual"><Link to="/app/admin/settings?catalog=AcademicPeriods">Crear o seleccionar periodo académico</Link></Alert>}
 {missing.filter(([key])=>data[key]===0).map(([key,label])=><Alert key={key} tone="warning" title={'Catálogo pendiente: '+label}><Link to={'/app/admin/settings?catalog='+({programs:'AcademicPrograms',municipalities:'Municipalities',types:'OrganizationTypes',skills:'Skills'}[key])}>Configurar {label.toLowerCase()}</Link></Alert>)}
 </div>
}
function UsersPage(){
 const {session}=useAuth();const list=usePaged(useCallback((page:number,search:string)=>listUsers(page,search),[]))
 const [action,setAction]=useState<{user:string;identity:string;role:string;code:string;assign:boolean}|null>(null)
 const [confirmation,setConfirmation]=useState('')
 return <div className="module-stack"><PageHeader title="Usuarios y roles" description="Identidad disponible en perfiles de aplicación y roles persistidos. Las cuentas se provisionan mediante Auth."/><Card><SearchField value={list.search} onChange={list.setSearch}/></Card>
 <PagedResults {...list} count={list.data?.count??0}><DataTable caption="Usuarios registrados" rows={list.data?.rows??[]} rowKey={row=>row.user_id} columns={[{label:'Identidad',cell:row=><><strong>{row.display_name??'Sin nombre'}</strong><p>{row.institutional_email??'Sin correo de perfil'}</p><small>{row.user_id}</small></>},{label:'Fecha',cell:row=>new Date(row.created_at).toLocaleDateString('es-CO',{timeZone:'America/Bogota'})},{label:'Estado de acceso',cell:row=>row.roles.length?'Roles asignados':'Sin roles de acceso'},{label:'Roles y acciones',cell:row=><div className="module-actions">{list.data?.catalog.map(role=>{const assigned=row.roles.some(item=>item.id===role.id);return <Button key={role.id} variant="secondary" onClick={()=>{setConfirmation('');setAction({user:row.user_id,identity:row.display_name??row.user_id,role:role.id,code:role.code,assign:!assigned})}}>{assigned?'Retirar':'Asignar'} {role.code}</Button>})}</div>}]}/></PagedResults>
 <ConfirmDialog open={Boolean(action)} title={`${action?.assign?'Asignar':'Retirar'} ${action?.code??'rol'}`} confirmLabel="Confirmar cambio de rol" onCancel={()=>setAction(null)} onConfirm={async()=>{if(!action)return;if(action.code==='ADMIN'&&confirmation!=='ADMIN')throw new FeatureError('Escribe ADMIN para confirmar este cambio privilegiado.');await changeRole(action.user,action.role,action.assign,session?.user.id??'');await list.reload()}}><span>{action?.identity}. {action?.code==='ADMIN'&&<><strong>Este rol concede gestión administrativa completa.</strong><label className="field">Escribe ADMIN para confirmar<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label></>}</span></ConfirmDialog>
 </div>
}
function SettingsPage(){
 const [params,setParams]=useSearchParams();const requested=params.get('catalog')??'AcademicPeriods'
 const catalog:Catalog=Object.hasOwn(catalogNames,requested)?requested as Catalog:'AcademicPeriods'
 return <div className="module-stack"><PageHeader title="Configuración y catálogos" description="Gestiona información institucional real. Desactiva catálogos para conservar referencias históricas."/><Select label="Catálogo o configuración" value={catalog} onChange={event=>setParams({catalog:event.target.value})}>{Object.entries(catalogNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>{catalog==='FeatureFlags'&&<Alert title="Los feature flags no sustituyen RLS">Los permisos se validan en la base de datos.</Alert>}<CatalogManager key={catalog} catalog={catalog}/></div>
}
function CatalogManager({catalog}:{catalog:Catalog}){
 const{session}=useAuth();const list=usePaged(useCallback((page:number,search:string)=>listCatalog(catalog,page,search),[catalog]))
 const[edit,setEdit]=useState<CatalogRow|null|undefined>(undefined)
 const[action,setAction]=useState<{row:CatalogRow;kind:'deactivate'|'current'|'delete'|'periodDelete'}|null>(null)
 const active=['AcademicPrograms','Municipalities','OrganizationTypes','Skills'].includes(catalog)
 const setting=catalog==='SystemConfigurations'||catalog==='FeatureFlags'
 return <><Card><div className="module-actions"><SearchField value={list.search} onChange={list.setSearch}/><Button onClick={()=>setEdit(null)}>Crear registro</Button></div></Card><PagedResults {...list} count={list.data?.count??0}><DataTable caption={catalogNames[catalog]} rows={list.data?.rows??[]} rowKey={row=>row.id} columns={[{label:'Registro',cell:row=>row.label},{label:'Estado',cell:row=>catalog==='AcademicPeriods'?`${row.fields.status} · ${row.fields.is_current?'Actual':'No actual'}`:active?row.fields.active?'Activo':'Inactivo':`${row.fields.is_public?'Público':'Privado'}${catalog==='FeatureFlags'?' · '+(row.fields.enabled?'Habilitado':'Deshabilitado'):''}`},{label:'Información',cell:row=><details><summary>Consultar campos</summary><pre className="p4-json">{JSON.stringify(row.fields,null,2)}</pre></details>},{label:'Acciones',cell:row=><div className="module-actions"><Button variant="secondary" onClick={()=>setEdit(row)}>Editar</Button>{active&&row.fields.active&&<Button variant="ghost" onClick={()=>setAction({row,kind:'deactivate'})}>Desactivar</Button>}{catalog==='AcademicPeriods'&&!row.fields.is_current&&<Button variant="secondary" onClick={()=>setAction({row,kind:'current'})}>Establecer actual</Button>}{catalog==='AcademicPeriods'&&!row.fields.is_current&&<Button variant="ghost" onClick={()=>setAction({row,kind:'periodDelete'})}>Eliminar periodo sin referencias</Button>}{setting&&<Button variant="ghost" onClick={()=>setAction({row,kind:'delete'})}>Eliminar configuración</Button>}</div>}]}/></PagedResults>
 <CatalogDialog open={edit!==undefined} catalog={catalog} row={edit??null} onClose={()=>setEdit(undefined)} onSave={async form=>{await saveCatalog(catalog,edit?.id??null,form,session?.user.id??'');await list.reload()}}/>
 <ConfirmDialog open={Boolean(action)} title={action?.kind==='current'?'Cambiar periodo actual':action?.kind==='delete'?'Eliminar configuración':action?.kind==='periodDelete'?'Eliminar periodo sin referencias':'Desactivar registro'} confirmLabel="Confirmar" onCancel={()=>setAction(null)} onConfirm={async()=>{if(!action)return;if(action.kind==='current')await setCurrentPeriod(action.row.id);else if(action.kind==='delete'&&(catalog==='FeatureFlags'||catalog==='SystemConfigurations'))await deleteConfiguration(catalog,action.row.id);else if(action.kind==='periodDelete')await deleteUnusedPeriod(action.row.id);else await deactivateCatalog(catalog,action.row.id);await list.reload()}}>{action?.row.label}. {action?.kind==='current'?'El cambio se guarda de forma transaccional.':action?.kind==='delete'?'Esta configuración se eliminará.':action?.kind==='periodDelete'?'Solo se elimina si no está vigente ni tiene referencias históricas. PostgreSQL impide borrar periodos referenciados.':'Sus referencias históricas se conservarán.'}</ConfirmDialog></>
}
function CatalogDialog({open,catalog,row,onClose,onSave}:{open:boolean;catalog:Catalog;row:CatalogRow|null;onClose:()=>void;onSave:(form:FormData)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);const id=useId();const[dirty,setDirty]=useState(false);const[busy,setBusy]=useState(false)
 useEffect(()=>{if(open){dialog.current?.showModal()}else if(dialog.current?.open){dialog.current.close()}},[open])
 function close(){if(busy)return;if(!dirty||window.confirm('¿Descartar los cambios de este formulario?')){setDirty(false);onClose()}}
 return <dialog ref={dialog} className="confirm-dialog p4-catalog-dialog" aria-labelledby={id} onCancel={event=>{event.preventDefault();close()}}><h2 id={id}>{row?'Editar':'Crear'} · {catalogNames[catalog]}</h2>{open&&<div onChange={()=>setDirty(true)}><Editor key={row?.id??'new'} onSave={async form=>{setBusy(true);try{await onSave(form);setDirty(false);onClose()}finally{setBusy(false)}}}><div className="form-grid">{catalogFields[catalog].map(field=>{
 const value=row?.fields[field.key];const disabled=Boolean(row&&field.key==='key')
 if(field.type==='checkbox')return <Checkbox key={field.key} label={field.label} name={field.key} defaultChecked={value===undefined?field.key==='active':value===true}/>
 const defaultValue=field.type==='json'?(value===undefined?'':JSON.stringify(value,null,2)):Array.isArray(value)?value.join('\n'):typeof value==='string'?value:''
 if(field.type==='textarea'||field.type==='json')return <Textarea key={field.key} label={field.label} name={field.key} defaultValue={defaultValue} required={field.required} rows={field.type==='json'?8:3} maxLength={50000}/>
 return <Input key={field.key} autoFocus={field===catalogFields[catalog][0]} label={field.label} name={field.key} type={field.type==='date'?'date':'text'} defaultValue={defaultValue} required={field.required} disabled={disabled} maxLength={240}/>
 })}</div></Editor></div>}<Button variant="secondary" onClick={close}>Cerrar</Button></dialog>
}
function AuditPage(){
 const[filters,setFilters]=useState({actor:'',action:'',entity:'',from:'',to:''})
 const list=usePaged(useCallback((page:number)=>listAudit(page,filters),[filters]))
 const filter=(key:keyof typeof filters,value:string)=>{setFilters(previous=>({...previous,[key]:value}));list.setPage(0)}
 return <div className="module-stack"><PageHeader title="Auditoría" description="Solo lectura. Se muestran nombres de campos modificados; la base de datos no almacena valores anteriores."/><Card><div className="form-grid"><Input label="Actor (UUID)" value={filters.actor} onChange={event=>filter('actor',event.target.value)} maxLength={36}/><Select label="Acción" value={filters.action} onChange={event=>filter('action',event.target.value)}><option value="">Todas</option><option value="INSERT">INSERT</option><option value="UPDATE">UPDATE</option><option value="DELETE">DELETE</option></Select><Input label="Entidad (nombre de tabla)" value={filters.entity} onChange={event=>filter('entity',event.target.value)} maxLength={100}/><Input label="Desde" type="date" value={filters.from} onChange={event=>filter('from',event.target.value)}/><Input label="Hasta" type="date" value={filters.to} min={filters.from||undefined} onChange={event=>filter('to',event.target.value)}/></div></Card><PagedResults {...list} count={list.data?.count??0}><DataTable caption="Registro de auditoría" rows={list.data?.rows??[]} rowKey={row=>row.id} columns={[{label:'Fecha',cell:row=>new Date(row.created_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})},{label:'Actor',cell:row=>row.actor},{label:'Acción',cell:row=>row.action},{label:'Entidad',cell:row=>row.entity_table},{label:'Identificador',cell:row=>row.entity_id??'—'},{label:'Campos modificados',cell:row=>row.changed_fields.join(', ')||'Sin campos registrados'}]}/></PagedResults></div>
}
