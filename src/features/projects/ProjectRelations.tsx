import { useCallback } from 'react'
import { allPages, check, client } from '../../lib/supabase/feature-helpers'
import { useResource } from '../../components/forms/useResource'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { ErrorState } from '../../components/feedback/States'
import { Editor } from '../../components/forms/Editor'
import { text } from '../../components/forms/form-data'

export function ProjectRelations({ projectId, organizationId, admin, readOnly, onChange }: { projectId: string; organizationId: string; admin: boolean; readOnly: boolean; onChange: () => Promise<void> }) {
  const resource = useResource(useCallback(async () => {
    const db = await client()
    const [contacts, interlocutors, partners, organizations] = await Promise.all([
      allPages((f,t) => db.from('PYRUnibague_OrganizationContacts').select('id,full_name').eq('organization_id',organizationId).order('id').range(f,t)),
      allPages((f,t) => db.from('PYRUnibague_ProjectInterlocutors').select('*').eq('project_id',projectId).order('id').range(f,t)),
      allPages((f,t) => db.from('PYRUnibague_ProjectParticipatingOrganizations').select('*').eq('project_id',projectId).order('id').range(f,t)),
      admin ? allPages((f,t) => db.from('PYRUnibague_Organizations').select('id,legal_name').neq('id',organizationId).order('id').range(f,t)) : [],
    ])
    return { contacts, interlocutors, partners, organizations }
  }, [projectId,organizationId,admin]))
  const refresh = async () => { await resource.reload(); await onChange() }
  if (resource.loading) return <Skeleton label="Cargando relaciones de la ficha"/>
  if (resource.error) return <ErrorState title={resource.error} onRetry={() => void resource.reload()}/>
  const data = resource.data
  if (!data || readOnly) return null
  return <Card><h2>Relaciones de la ficha institucional</h2><p>El interlocutor operativo se elige entre los contactos de la organización. El asesor regional se gestiona en Asesores y responsabilidades.</p>
    <Editor label="Vincular interlocutor" resetOnSave onSave={async form => {
      const db = await client(); check((await db.from('PYRUnibague_ProjectInterlocutors').insert({ project_id:projectId,organization_contact_id:text(form,'contact') }).select('id').single()).error); await refresh()
    }}><Select label="Interlocutor operativo" name="contact" required><option value="">Selecciona contacto</option>{data.contacts.filter(c => !data.interlocutors.some(i => i.organization_contact_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</Select></Editor>
    {data.interlocutors.map(i => <Editor key={i.id} label="Retirar vínculo de interlocutor" onSave={async () => {
      const db = await client(); check((await db.from('PYRUnibague_ProjectInterlocutors').delete().eq('id',i.id)).error); await refresh()
    }}><p>{data.contacts.find(c => c.id === i.organization_contact_id)?.full_name ?? 'No registrado'}</p></Editor>)}
    {admin && <><Editor label="Vincular institución colaboradora" resetOnSave onSave={async form => {
      const db = await client(); check((await db.from('PYRUnibague_ProjectParticipatingOrganizations').insert({ project_id:projectId,organization_id:text(form,'partner') }).select('id').single()).error); await refresh()
    }}><Select label="Institución colaboradora" name="partner" required><option value="">Selecciona institución</option>{data.organizations.filter(o => !data.partners.some(p => p.organization_id === o.id)).map(o => <option key={o.id} value={o.id}>{o.legal_name}</option>)}</Select></Editor>
    {data.partners.map(p => <Editor key={p.id} label="Retirar vínculo de institución" onSave={async () => {
      const db = await client(); check((await db.from('PYRUnibague_ProjectParticipatingOrganizations').delete().eq('id',p.id)).error); await refresh()
    }}><p>{data.organizations.find(o => o.id === p.organization_id)?.legal_name ?? 'No registrado'}</p></Editor>)}</>}
    <Button variant="secondary" onClick={() => void resource.reload()}>Actualizar contactos</Button>
  </Card>
}
