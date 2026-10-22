import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { deleteStudentChild, loadStudent, orderInterests, saveExperience, saveInterest, saveSkill, saveStudent, setPreferences, validateExperience } from './students'
import { studentCompleteness } from './completeness'
import type { ExperienceEdit, StudentData, StudentEdit } from './students'
import { allPages, validUrl } from '../../../lib/supabase/feature-helpers'
const clientMock = vi.hoisted(() => ({ get: vi.fn() }))
import { clearCatalogCache } from '../../../lib/supabase/catalog-cache'
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: clientMock.get }))
let mock: ReturnType<typeof mockFeatureClient>
const studentEdit: StudentEdit = { student_code: 'A1', academic_program_id: null, current_semester: 1, bio: 'Perfil', desired_work_description: 'Trabajo', origin_municipality_id: null, current_municipality_id: null, profile_links: {} }
const experience: ExperienceEdit = { title: 'Experiencia', organization_name: 'Entidad', description: null, started_on: '2026-01-01', ended_on: '2026-02-01', is_current: false }
beforeEach(() => { clearCatalogCache(); mock = mockFeatureClient(); clientMock.get.mockResolvedValue(mock.db) })
describe('Student data workflows', () => {
  it('loads documents without unrelated catalogs or experience requests', async () => {
    mock.enqueue({user_id:'u'}); mock.enqueue({id:'s'}); mock.enqueue([])
    const data = await loadStudent('u','documents')
    expect(data.documents).toEqual([])
    expect([...new Set(mock.calls.map(call=>call.table))]).toEqual(['PYRUnibague_UserProfiles','PYRUnibague_Students','PYRUnibague_StudentDocuments'])
  })
  it('loads home without municipalities, skill catalog or experiences and keeps history', async () => {
    mock.enqueue({user_id:'u'});mock.enqueue({id:'s'});mock.enqueue([]);mock.enqueue({id:'current'})
    for(let i=0;i<4;i++) mock.enqueue([])
    mock.enqueue([{id:'old',academic_period_id:'old-period',status:'completed'},{id:'now',academic_period_id:'current',status:'active'}])
    const data=await loadStudent('u','home')
    expect(data.participations).toHaveLength(2);expect(data.participation?.id).toBe('now')
    expect(mock.calls.some(c=>/Municipalities|Experiences|^PYRUnibague_Skills$/.test(c.table))).toBe(false)
  })
  it('saves a nontechnology profile without links, bio or work experience', async () => {
    mock.enqueue({id:'s'});mock.enqueue({user_id:'u'})
    await saveStudent('u',undefined,'Estudiante de Derecho',{...studentEdit,academic_program_id:'law',bio:null,desired_work_description:null,profile_links:{}})
    expect(mock.calls.find(c=>c.operation==='insert')?.args[0]).toMatchObject({academic_program_id:'law',profile_links:{},bio:null})
  })
  it('loads a missing student without creating data or inventing catalogs', async () => {
    mock.enqueue({ user_id: 'u', display_name: 'Nombre' }); mock.enqueue(null); mock.enqueue([]); mock.enqueue([]); mock.enqueue([]); mock.enqueue(null)
    const data = await loadStudent('u')
    expect(data.student).toBeNull(); expect(data.programs).toEqual([]); expect(data.participation).toBeNull(); expect(mock.calls.some(call => call.operation === 'insert')).toBe(false)
  })
  it('creates the own profile and excludes administrative fields', async () => {
    mock.enqueue({ id: 's' }); mock.enqueue({ user_id: 'u' })
    await saveStudent('u', undefined, 'Nombre', { ...studentEdit, is_active: false } as StudentEdit)
    const insert = mock.calls.find(call => call.operation === 'insert')
    expect(insert?.args[0]).toMatchObject({ user_id: 'u', student_code: 'A1' }); expect(insert?.args[0]).not.toHaveProperty('is_active')
  })
  it('updates an existing profile and reports partial identity failure', async () => {
    mock.enqueue({ id: 's' }); mock.enqueue(null, { code: '42501', message: 'denied' })
    await expect(saveStudent('u', 's', 'Nombre', studentEdit)).rejects.toMatchObject({ code: 'partial' })
    expect(mock.calls.filter(call => call.operation === 'update')).toHaveLength(2)
  })
  it('rejects invalid dates and current experiences with an end date before network writes', async () => {
    expect(() => validateExperience({ ...experience, ended_on: '2025-01-01' })).toThrow()
    expect(() => validateExperience({ ...experience, started_on: '2026-02-30' })).toThrow()
    await expect(saveExperience('s', { ...experience, is_current: true })).rejects.toThrow()
    expect(mock.calls).toHaveLength(0)
  })
  it('creates, edits and removes experience scoped to the student', async () => {
    mock.enqueue({ id: 'e' }); await saveExperience('s', experience)
    mock.enqueue({ id: 'e' }); await saveExperience('s', { ...experience, title: 'Actualizada' }, 'e')
    mock.enqueue({ id: 'e' }); await deleteStudentChild('PYRUnibague_StudentExperiences', 's', 'e')
    expect(mock.calls.some(call => call.operation === 'delete')).toBe(true)
    expect(mock.calls.filter(call => call.operation === 'eq' && call.args[0] === 'student_id')).toHaveLength(2)
  })
  it('shows duplicate skills as a meaningful error and edits evidence only', async () => {
    mock.enqueue(null, { code: '23505', message: 'duplicate' })
    await expect(saveSkill('s', 'skill', 'Evidencia')).rejects.toThrow('ya está registrado')
    mock.enqueue({ id: 'ss' }); await saveSkill('s', 'skill', 'Nueva evidencia', 'ss')
    expect(mock.calls.find(call => call.operation === 'update')?.args[0]).toEqual({ evidence_text: 'Nueva evidencia' })
  })
  it('creates, edits, deletes and atomically orders interests', async () => {
    mock.enqueue({ id: 'i' }); await saveInterest('s', 'Interés', '', 1)
    mock.enqueue({ id: 'i' }); await saveInterest('s', 'Nuevo', 'Detalle', 1, 'i')
    mock.enqueue(null); await orderInterests('s', ['i2', 'i'])
    expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_order_student_interests', { p_student_id: 's', p_ids: ['i2', 'i'] })
    mock.enqueue({ id: 'i' }); await deleteStudentChild('PYRUnibague_StudentInterests', 's', 'i')
  })
  it('rejects duplicate municipalities and preserves the requested order', async () => {
    await expect(setPreferences('s', ['m', 'm'])).rejects.toThrow('repetir')
    expect(mock.rpc).not.toHaveBeenCalled()
    mock.enqueue(null); await setPreferences('s', ['b', 'a'])
    expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_set_student_preferences', { p_student_id: 's', p_municipality_ids: ['b', 'a'] })
  })
  it('completeness cannot alter eligibility; experience and links are optional', () => {
    const data = { profile: { display_name: 'Nombre' }, student: { ...studentEdit, academic_program_id: 'p', origin_municipality_id: 'm', current_municipality_id: 'm' }, studentSkills: [{}], interests: [{}], preferences: [{}], documents: [{ category_code: 'CV', status: 'uploaded' }], participation: { eligible_for_matching: false }, experiences: [] } as unknown as StudentData
    expect(studentCompleteness(data).percent).toBe(100)
    expect(data.participation?.eligible_for_matching).toBe(false)
    expect(studentCompleteness({ ...data, documents: [] }).sections.at(-1)?.complete).toBe(false)
  })
  it('validates optional links without allowing script or credential URLs', () => {
    expect(validUrl('')).toBe(true); expect(validUrl('https://example.test')).toBe(true); expect(validUrl('javascript:alert(1)')).toBe(false); expect(validUrl('https://u:password@example.test')).toBe(false)
  })
  it('loads the complete territorial catalog across the Supabase page limit', async () => {
    const query = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => id), error: null }).mockResolvedValueOnce({ data: [1000, 1001], error: null })
    expect(await allPages<number>(query)).toHaveLength(1002); expect(query).toHaveBeenLastCalledWith(1000, 1999)
  })
})
