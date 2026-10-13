import { text } from '../../components/forms/form-data'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { useStudent } from './hooks/useStudent'
import { studentCompleteness } from './services/completeness'
import { deleteStudentChild, orderInterests, saveExperience, saveInterest, saveSkill, saveStudent, setPreferences } from './services/students'
import type { StudentData } from './services/students'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Fields'
import { Progress, Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { ConfirmDialog, Editor } from '../../components/forms/Editor'
import { errorMessage, FeatureError, nullable, validUrl } from '../../lib/supabase/feature-helpers'
import { DocumentsPanel } from '../documents/DocumentsPanel'
import { StudentAssignment } from '../assignments/StudentAssignment'

export default function StudentWorkspace() {
  const { session } = useAuth()
  const resource = useStudent(session?.user.id ?? '')
  const section = useLocation().pathname.split('/')[3] ?? ''
  if (!session) return null
  if (resource.loading && !resource.data) return <><PageHeader title="Tu espacio" /><Skeleton label="Cargando perfil" /><Skeleton label="Cargando participación" /></>
  if (resource.error) return <><PageHeader title="Tu espacio" /><ErrorState title={resource.error} onRetry={() => void resource.reload()} /></>
  const data = resource.data
  if (!data) return null
  const common = { data, reload: resource.reload }
  return <div className="module-stack">
    {section === '' && <><StudentHome data={data} />{data.period && data.student && <StudentAssignment key={data.student.id+data.period.id} periodId={data.period.id}/>}</>}
    {section === 'profile' && <StudentProfile {...common} userId={session.user.id} />}
    {section !== '' && section !== 'profile' && !data.student && <><PageHeader title="Completa tu perfil" /><EmptyState title="Todavía no tienes un perfil">Guarda primero tus datos básicos para activar las demás secciones.</EmptyState><Link to="/app/student/profile" className="button button--primary">Crear mi perfil</Link></>}
    {data.student && section === 'experience' && <Experiences {...common} />}
    {data.student && section === 'skills' && <SkillsInterests {...common} />}
    {data.student && section === 'preferences' && <Preferences {...common} />}
    {data.student && section === 'documents' && <><PageHeader title="Documentos" description="Gestiona tu CV y documentos privados." /><DocumentsPanel scope="student" ownerId={data.student.id} userId={session.user.id} documents={data.documents} reload={resource.reload} /></>}
  </div>
}
function StudentHome({ data }: { data: StudentData }) {
  const completion = studentCompleteness(data)
  const program = data.programs.find(row => row.id === data.student?.academic_program_id)
  return <><PageHeader eyebrow="Estudiante" title="Tu espacio" description={data.profile?.display_name ? `Hola, ${data.profile.display_name}.` : 'Construye tu perfil para Paz y Región.'} />
    <div className="dashboard-grid"><Card><h2>Mi perfil</h2><p>{program?.name ?? 'Programa sin registrar'} · {data.student?.current_semester ? `Semestre ${data.student.current_semester}` : 'Semestre sin registrar'}</p><Progress value={completion.percent} label="Completitud del perfil" /><p className="workspace-note">Este indicador orienta tu preparación. La elegibilidad para matching la determina administración.</p><Link className="button button--secondary" to="/app/student/profile">{data.student ? 'Editar mi perfil' : 'Crear mi perfil'}</Link></Card>
    <Card><h2>Participación actual</h2>{!data.period ? <EmptyState title="Sin periodo actual">La Universidad debe configurar un periodo vigente.</EmptyState> : <><h3>{data.period.name}</h3>{data.participation ? <><p>Estado: {data.participation.status}</p><p>Elegibilidad administrativa: {data.participation.eligible_for_matching ? 'Habilitada' : 'No habilitada'}</p></> : <p>No tienes participación registrada en este periodo. Consulta con coordinación.</p>}</>}</Card></div>
    <Card><h2>Próximos pasos</h2><ul className="module-list">{completion.sections.map(item => <li key={item.label}><div><h3>{item.label}</h3><p>{item.complete ? 'Completo' : 'Por completar'}</p></div><Link className="button button--ghost" to={'/app/student/' + item.path}>Revisar</Link></li>)}</ul><p className="workspace-note">La experiencia y los enlaces son opcionales. No cambian tu elegibilidad.</p></Card>
    <Card><h2>Documentos</h2><p>{data.documents.length ? `${data.documents.length} documento(s) guardado(s).` : 'Aún no has subido documentos.'}</p><Link className="button button--secondary" to="/app/student/documents">Ver documentos</Link></Card>
  </>
}
function StudentProfile({ data, userId, reload }: { data: StudentData; userId: string; reload: () => Promise<void> }) {
  const student = data.student
  const links = student?.profile_links
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({})
  const linkValue = (key: string) => links && typeof links === 'object' && !Array.isArray(links) && typeof links[key] === 'string' ? links[key] : ''
  return <><PageHeader title="Mi perfil" description="Los datos académicos declarados no conceden elegibilidad institucional." />
    <Card><Editor onSave={async form => {
      const profileLinks: Record<string, string> = {}; const errors: Record<string, string> = {}
      for (const key of ['linkedin', 'github', 'website', 'other']) { const value = text(form, key); if (!validUrl(value)) errors[key] = 'Usa una URL http o https válida.'; else if (value) profileLinks[key] = value }
      setUrlErrors(errors)
      if (Object.keys(errors).length) throw new FeatureError('Revisa los enlaces señalados.')
      await saveStudent(userId, student?.id, text(form, 'display_name'), { student_code: nullable(text(form, 'student_code')), academic_program_id: nullable(text(form, 'academic_program_id')), current_semester: text(form, 'current_semester') ? Number(text(form, 'current_semester')) : null, bio: nullable(text(form, 'bio')), desired_work_description: nullable(text(form, 'desired_work_description')), origin_municipality_id: nullable(text(form, 'origin_municipality_id')), current_municipality_id: nullable(text(form, 'current_municipality_id')), profile_links: profileLinks }); await reload()
    }}>
      <h2>Identidad y formación</h2><div className="form-grid"><Input label="Nombre visible" name="display_name" defaultValue={data.profile?.display_name ?? ''} maxLength={160} /><Input label="Código estudiantil" name="student_code" defaultValue={student?.student_code ?? ''} maxLength={80} />
      <Select label="Programa académico" name="academic_program_id" defaultValue={student?.academic_program_id ?? ''}><option value="">Sin registrar</option>{data.programs.filter(row => row.active || row.id === student?.academic_program_id).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>
      <Input label="Semestre" name="current_semester" type="number" min={1} step={1} defaultValue={student?.current_semester ?? ''} /></div>
      {data.programs.length === 0 && <Alert title="Catálogo de programas pendiente">Coordinación debe cargar los programas académicos. Puedes guardar los demás datos.</Alert>}
      <h2>Presentación profesional</h2><Textarea label="Bio" name="bio" rows={4} maxLength={5000} defaultValue={student?.bio ?? ''} /><Textarea label="Qué trabajo te gustaría desarrollar" name="desired_work_description" rows={4} maxLength={5000} defaultValue={student?.desired_work_description ?? ''} />
      <h2>Territorio</h2><div className="form-grid">{(['origin_municipality_id', 'current_municipality_id'] as const).map(key => <Select key={key} label={key === 'origin_municipality_id' ? 'Municipio de origen' : 'Municipio actual'} name={key} defaultValue={student?.[key] ?? ''}><option value="">Sin registrar</option>{data.municipalities.filter(row => row.active || row.id === student?.[key]).map(row => <option key={row.id} value={row.id}>{row.municipality_name} · {row.department_name}</option>)}</Select>)}</div>
      {data.municipalities.length === 0 && <Alert title="Catálogo territorial pendiente">Coordinación debe cargar los municipios.</Alert>}
      <h2>Enlaces opcionales</h2><div className="form-grid">{[ ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['website', 'Portfolio / web'], ['other', 'Otro enlace'] ].map(([key, label]) => <Input key={key} label={label ?? ''} name={key} type="url" maxLength={2048} defaultValue={linkValue(key ?? '') ?? ''} error={urlErrors[key ?? '']} />)}</div>
    </Editor></Card></>
}
type ChildProps = { data: StudentData; reload: () => Promise<void> }
function Experiences({ data, reload }: ChildProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const current = data.experiences.find(row => row.id === editing)
  const [isCurrent, setIsCurrent] = useState(false)
  const [dateError, setDateError] = useState('')
  const studentId = data.student?.id ?? ''
  return <><PageHeader title="Experiencia" description="Agrega experiencias profesionales, académicas o de voluntariado." />
    <Card><h2>{current ? 'Editar experiencia' : 'Nueva experiencia'}</h2><Editor resetOnSave={!editing} key={editing ?? 'new'} label={current ? 'Guardar experiencia' : 'Agregar experiencia'} onSave={async form => {
      const start = text(form, 'started_on'); const end = isCurrent ? '' : text(form, 'ended_on')
      if (start && end && end < start) { setDateError('La fecha final debe ser posterior o igual a la inicial.'); throw new FeatureError('Revisa las fechas.') }
      setDateError(''); await saveExperience(studentId, { title: text(form, 'title'), organization_name: nullable(text(form, 'organization_name')), description: nullable(text(form, 'description')), started_on: nullable(start), ended_on: nullable(end), is_current: isCurrent }, editing ?? undefined); setEditing(null); setIsCurrent(false); await reload()
    }}>
      <Input label="Título" name="title" autoFocus={Boolean(editing)} required maxLength={200} defaultValue={current?.title ?? ''} /><Input label="Organización" name="organization_name" maxLength={200} defaultValue={current?.organization_name ?? ''} /><Textarea label="Descripción" name="description" rows={3} maxLength={5000} defaultValue={current?.description ?? ''} />
      <Checkbox label="Es mi experiencia actual" checked={isCurrent} onChange={event => setIsCurrent(event.target.checked)} />
      <div className="form-grid"><Input label="Fecha de inicio" name="started_on" type="date" defaultValue={current?.started_on ?? ''} /><Input label="Fecha de finalización" name="ended_on" type="date" disabled={isCurrent} defaultValue={current?.ended_on ?? ''} error={dateError} /></div>
      {editing && <Button variant="secondary" onClick={() => { setEditing(null); setIsCurrent(false) }}>Cancelar edición</Button>}
    </Editor></Card>
    <Card><h2>Experiencias guardadas</h2>{!data.experiences.length ? <EmptyState title="Sin experiencias">Puedes completar esta sección cuando tengas una experiencia que compartir.</EmptyState> : <ul className="module-list">{data.experiences.map(row => <li key={row.id}><div><h3>{row.title}</h3><p>{row.organization_name}</p><p>{row.description}</p><small>{row.started_on ?? 'Sin fecha inicial'} — {row.is_current ? 'Actual' : row.ended_on ?? 'Sin fecha final'}</small></div><div className="module-actions"><Button variant="secondary" onClick={() => { setEditing(row.id); setIsCurrent(row.is_current); setDateError(''); window.document.querySelector<HTMLInputElement>('input[name="title"]')?.focus() }}>Editar</Button><Button variant="ghost" onClick={() => setRemoving(row.id)}>Eliminar</Button></div></li>)}</ul>}</Card>
    <ConfirmDialog open={Boolean(removing)} title="Eliminar experiencia" onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) { await deleteStudentChild('PYRUnibague_StudentExperiences', studentId, removing); if (editing === removing) setEditing(null); await reload() } }}>Se retirará esta experiencia de tu perfil.</ConfirmDialog>
  </>
}
function SkillsInterests({ data, reload }: ChildProps) {
  const [search, setSearch] = useState('')
  const [skillEdit, setSkillEdit] = useState<string | null>(null)
  const [interestEdit, setInterestEdit] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ table: 'PYRUnibague_StudentSkills' | 'PYRUnibague_StudentInterests'; id: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const studentId = data.student?.id ?? ''
  const currentSkill = data.studentSkills.find(row => row.id === skillEdit)
  const currentInterest = data.interests.find(row => row.id === interestEdit)
  const available = data.skills.filter(row => row.active && !data.studentSkills.some(value => value.skill_id === row.id) && (row.name + ' ' + row.aliases.join(' ')).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
  return <><PageHeader title="Habilidades e intereses" description="Comparte lo que sabes y los temas que te motivan." />
    <div className="dashboard-grid"><Card><h2>Habilidades</h2>{!data.skills.length ? <EmptyState title="Catálogo de habilidades pendiente">Coordinación debe configurar las habilidades disponibles.</EmptyState> : <Editor resetOnSave={!skillEdit} key={skillEdit ?? 'new-skill'} label={currentSkill ? 'Guardar evidencia' : 'Agregar habilidad'} onSave={async form => { await saveSkill(studentId, currentSkill?.skill_id ?? text(form, 'skill_id'), text(form, 'evidence_text'), skillEdit ?? undefined); setSkillEdit(null); await reload() }}>
      {!currentSkill && <><Input label="Buscar habilidades" value={search} onChange={event => setSearch(event.target.value)} type="search" /><Select label="Habilidad" name="skill_id" required><option value="">Selecciona una habilidad</option>{available.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>{!available.length && <p>No hay habilidades disponibles para esta búsqueda o ya las agregaste.</p>}</>}
      {currentSkill && <p>{data.skills.find(row => row.id === currentSkill.skill_id)?.name}</p>}<Textarea label="Evidencia / descripción" name="evidence_text" rows={3} maxLength={5000} defaultValue={currentSkill?.evidence_text ?? ''} />{skillEdit && <Button variant="secondary" onClick={() => setSkillEdit(null)}>Cancelar edición</Button>}
    </Editor>}
    <ul className="module-list">{data.studentSkills.map(row => <li key={row.id}><div><h3>{data.skills.find(skill => skill.id === row.skill_id)?.name ?? 'Habilidad registrada'}</h3><p>{row.evidence_text}</p></div><div className="module-actions"><Button variant="secondary" onClick={() => setSkillEdit(row.id)}>Editar evidencia</Button><Button variant="ghost" onClick={() => setRemoving({ table: 'PYRUnibague_StudentSkills', id: row.id })}>Eliminar</Button></div></li>)}</ul></Card>
    <Card><h2>Intereses</h2><Editor resetOnSave={!interestEdit} key={interestEdit ?? 'new-interest'} label={currentInterest ? 'Guardar interés' : 'Agregar interés'} onSave={async form => { await saveInterest(studentId, text(form, 'label'), text(form, 'description'), Math.max(0, ...data.interests.map(row => row.sort_order)) + 1, interestEdit ?? undefined); setInterestEdit(null); await reload() }}>
      <Input label="Interés" name="label" autoFocus={Boolean(interestEdit)} required maxLength={200} defaultValue={currentInterest?.label ?? ''} /><Textarea label="Descripción del interés" name="description" rows={2} maxLength={2000} defaultValue={currentInterest?.description ?? ''} />{interestEdit && <Button variant="secondary" onClick={() => setInterestEdit(null)}>Cancelar edición</Button>}
    </Editor>{!data.interests.length && <p>Aún no has agregado intereses.</p>}
    <ol className="module-list">{data.interests.map((row, index) => <li key={row.id}><div><h3>{index + 1}. {row.label}</h3><p>{row.description}</p></div><div className="module-actions"><Button variant="secondary" onClick={() => setInterestEdit(row.id)}>Editar</Button><Button variant="ghost" onClick={() => setRemoving({ table: 'PYRUnibague_StudentInterests', id: row.id })}>Eliminar</Button>{[-1, 1].map(direction => <Button key={direction} variant="secondary" aria-label={`${direction < 0 ? 'Subir' : 'Bajar'} interés ${row.label}`} disabled={busy || index + direction < 0 || index + direction >= data.interests.length} onClick={async () => { setBusy(true); setError(''); try { const ids = data.interests.map(item => item.id); const other = index + direction; [ids[index], ids[other]] = [ids[other]!, ids[index]!]; await orderInterests(studentId, ids); await reload() } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) } }}>{direction < 0 ? 'Subir' : 'Bajar'}</Button>)}</div></li>)}</ol></Card></div>
    {error && <Alert tone="error" title={error} />}<ConfirmDialog open={Boolean(removing)} title="Eliminar elemento" onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) { await deleteStudentChild(removing.table, studentId, removing.id); if (skillEdit === removing.id) setSkillEdit(null); if (interestEdit === removing.id) setInterestEdit(null); await reload() } }}>Se retirará de tu perfil.</ConfirmDialog>
  </>
}
function Preferences({ data, reload }: ChildProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const ids = data.preferences.map(row => row.municipality_id)
  async function save(next: string[]) { setBusy(true); setError(''); setSuccess(''); try { await setPreferences(data.student?.id ?? '', next); await reload(); setSuccess('Preferencias guardadas') } catch (cause) { setError(errorMessage(cause)); throw cause } finally { setBusy(false) } }
  return <><PageHeader title="Preferencias territoriales" description="Indica y ordena los municipios que prefieres. Son orientaciones, no restricciones obligatorias." />
    <Card><h2>Agregar municipio</h2>{!data.municipalities.length ? <EmptyState title="Catálogo territorial pendiente">Coordinación debe cargar los municipios.</EmptyState> : <Editor resetOnSave label="Agregar preferencia" onSave={async form => { await save([...ids, text(form, 'municipality_id')]) }}><Select label="Municipio preferido" name="municipality_id" required disabled={busy}><option value="">Selecciona un municipio</option>{data.municipalities.filter(row => row.active && !ids.includes(row.id)).map(row => <option key={row.id} value={row.id}>{row.municipality_name} · {row.department_name}</option>)}</Select></Editor>}</Card>
    {error && <Alert tone="error" title={error} />}{success && <Alert tone="success" title={success} />}<Card><h2>Orden de preferencia</h2>{!ids.length ? <EmptyState title="Sin preferencias">Agrega el primer municipio.</EmptyState> : <ol className="module-list">{data.preferences.map((row, index) => { const municipality = data.municipalities.find(item => item.id === row.municipality_id); const label = municipality?.municipality_name ?? 'Municipio registrado'; return <li key={row.id}><h3>{index + 1}. {label}</h3><div className="module-actions">{[-1, 1].map(direction => <Button key={direction} aria-label={`${direction < 0 ? 'Subir' : 'Bajar'} preferencia ${label}`} variant="secondary" disabled={busy || index + direction < 0 || index + direction >= ids.length} onClick={async () => { const next = [...ids]; const other = index + direction; [next[index], next[other]] = [next[other]!, next[index]!]; try { await save(next) } catch { /* visible error */ } }}>{direction < 0 ? 'Subir' : 'Bajar'}</Button>)}<Button disabled={busy} variant="ghost" onClick={() => setRemoving(row.municipality_id)}>Eliminar</Button></div></li> })}</ol>}</Card>
    <ConfirmDialog open={Boolean(removing)} title="Eliminar preferencia" onCancel={() => setRemoving(null)} onConfirm={async () => { await save(ids.filter(id => id !== removing)) }}>Las demás preferencias conservarán su orden.</ConfirmDialog>
  </>
}
