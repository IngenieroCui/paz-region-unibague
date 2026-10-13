import { useCallback, useState } from 'react'
import { useResource } from '../../components/forms/useResource'
import { Editor, ConfirmDialog } from '../../components/forms/Editor'
import { text } from '../../components/forms/form-data'
import { Card } from '../../components/ui/Card'
import { Input, Checkbox } from '../../components/ui/Fields'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Progress'
import { EmptyState, ErrorState } from '../../components/feedback/States'
import { nullable } from '../../lib/supabase/feature-helpers'
import { loadOrganizationContacts, saveOrganizationContact, deleteOrganizationContact } from './services/contacts'
import type { OrganizationContact, ContactDraft } from './services/contacts'

export function OrganizationContacts({ organizationId, canManage }: { organizationId:string;canManage:boolean }) {
  const resource=useResource(useCallback(()=>loadOrganizationContacts(organizationId),[organizationId]))
  const [edit,setEdit]=useState<OrganizationContact|null>(null)
  const [draft,setDraft]=useState<{fields:ContactDraft;id?:string}|null>(null)
  const [removing,setRemoving]=useState<OrganizationContact|null>(null)
  return <Card><h2>Interlocutores de la organización</h2><p>Puedes registrar varios interlocutores. El contacto principal se utiliza para comunicaciones administrativas.</p>
    {resource.error ? <ErrorState title={resource.error} onRetry={()=>void resource.reload()}/> : resource.loading ? <Skeleton label="Cargando interlocutores"/> : !resource.data?.length ? <EmptyState title="Sin interlocutores">Registra el primer contacto de la organización.</EmptyState> : <ul className="module-list">{resource.data.map(row=><li key={row.id}><div><h3>{row.full_name}{row.is_primary?' · Principal':''}</h3><p>{row.position_title??'Sin cargo'} · {row.email??'Sin correo'} · {row.phone??'Sin teléfono'}</p></div>{canManage&&<div className="module-actions"><Button variant="secondary" onClick={()=>setEdit(row)}>Editar {row.full_name}</Button><Button variant="ghost" onClick={()=>setRemoving(row)}>Eliminar {row.full_name}</Button></div>}</li>)}</ul>}
    {canManage&&<><h3>{edit?'Editar interlocutor':'Nuevo interlocutor'}</h3><Editor key={edit?.id??'new'} label={edit?'Revisar cambios del interlocutor':'Revisar nuevo interlocutor'} successTitle="Cambio pendiente de confirmación" onSave={async form=>setDraft({id:edit?.id,fields:{full_name:text(form,'full_name'),position_title:nullable(text(form,'position_title')),email:nullable(text(form,'email')),phone:nullable(text(form,'phone')),user_id:nullable(text(form,'user_id')),is_primary:form.has('is_primary')}})}>
      <div className="form-grid"><Input label="Nombre completo" name="full_name" defaultValue={edit?.full_name??''} required maxLength={200}/><Input label="Cargo" name="position_title" defaultValue={edit?.position_title??''} maxLength={160}/><Input label="Correo del interlocutor" name="email" type="email" defaultValue={edit?.email??''} maxLength={254}/><Input label="Teléfono del interlocutor" name="phone" type="tel" defaultValue={edit?.phone??''} maxLength={40}/><Input label="Usuario vinculado (opcional)" name="user_id" defaultValue={edit?.user_id??''} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" hint="Identificador de una cuenta existente; vincularla no concede permisos."/></div><Checkbox label="Contacto principal administrativo" name="is_primary" defaultChecked={edit?.is_primary??false}/>
    </Editor>{edit&&<Button variant="secondary" onClick={()=>setEdit(null)}>Cancelar edición</Button>}</>}
    <ConfirmDialog open={Boolean(draft)} title="Confirmar interlocutor" confirmLabel="Guardar interlocutor" onCancel={()=>setDraft(null)} onConfirm={async()=>{if(!draft)return;await saveOrganizationContact(organizationId,draft.fields,draft.id);setEdit(null);await resource.reload()}}>{draft?.fields.full_name}.{draft?.fields.is_primary?' Este contacto reemplazará al principal administrativo actual.':''}</ConfirmDialog>
    <ConfirmDialog open={Boolean(removing)} title="Eliminar interlocutor" onCancel={()=>setRemoving(null)} onConfirm={async()=>{if(!removing)return;await deleteOrganizationContact(organizationId,removing.id);if(edit?.id===removing.id)setEdit(null);await resource.reload()}}>Se eliminará {removing?.full_name}. Si está vinculado a un proyecto, primero debe retirarse esa vinculación.</ConfirmDialog>
  </Card>
}
