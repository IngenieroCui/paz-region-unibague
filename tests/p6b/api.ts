import type { Page } from '@playwright/test'
import { p4Api } from '../e2e/p4-api.js'
type Row = Record<string,unknown>
export async function p6bApi(page: Page, role: 'ADMIN' | 'ORGANIZATION' = 'ORGANIZATION', readOnly = false) {
  const api = await p4Api(page,role,{ readOnly })
  const table = (name: string) => api.tables['PYRUnibague_'+name] ??= []
  const now = '2026-10-13T15:00:00Z'
  table('Projects')[0]!.zone_type = 'rural'
  const secondProject = '54000000-0000-0000-0000-000000000002'
  table('Projects').push({ ...table('Projects')[0],id:secondProject,name:'Proyecto Mecánica P6B',zone_type:'urban' })
  table('ProjectPositions').push({ ...table('ProjectPositions')[0],id:'mechanical',project_id:secondProject,title:'Plaza Mecánica',capacity:1 })
  table('ProjectPositionPrograms').push({ id:'program-link',project_position_id:'position',academic_program_id:'program' })
  table('Assignments').push({ id:'assignment',student_id:api.sid,project_position_id:'position',academic_period_id:api.pid,is_active:true,status:'confirmed',unassigned_at:null })
  for (const name of ['Calls','CallPositions','Groups','GroupMembers']) table(name)
  let fail = ''
  await page.route('https://pyr-e2e.example.test/**',async route => {
    const request = route.request(), url = new URL(request.url()), name = url.pathname.split('/').at(-1) ?? '', method = request.method()
    const selection = url.searchParams.get('select') ?? ''
    const specialPositions = name === 'PYRUnibague_ProjectPositions' && selection.includes('!inner')
    if (!['PYRUnibague_Calls','PYRUnibague_CallPositions','PYRUnibague_Groups','PYRUnibague_GroupMembers','pyr_unibague_project_team'].includes(name) && !specialPositions && !(name === 'PYRUnibague_ProjectPositionPrograms' && selection.includes('PYRUnibague_AcademicPrograms'))) return route.fallback()
    let body: Row = {}; try { body = request.postDataJSON() as Row ?? {} } catch { /* GET */ }
    api.calls.push({ path:url.pathname,method,body,query:url.search })
    if (fail === name) { fail = ''; return route.fulfill({ status:500,json:{ code:'fixture_error',message:'Test failure' } }) }
    if (name === 'pyr_unibague_project_team') {
      const groups = table('Groups').filter(group => group.project_id === body.p_project_id)
      const members = table('GroupMembers').filter(member => groups.some(group => group.id === member.group_id))
      const assignments = table('Assignments').filter(assignment => table('ProjectPositions').some(position => position.id === assignment.project_position_id && position.project_id === body.p_project_id)).map(assignment => {
        const student = table('Students').find(student => student.id === assignment.student_id)
        return { id:assignment.id,student_id:assignment.student_id,is_active:assignment.is_active,status:assignment.status,unassigned_at:assignment.unassigned_at,display_name:table('UserProfiles').find(profile => profile.user_id === student?.user_id)?.display_name ?? null,program_name:table('AcademicPrograms').find(program => program.id === student?.academic_program_id)?.name ?? null,position_title:table('ProjectPositions').find(position => position.id === assignment.project_position_id)?.title }
      })
      return route.fulfill({ json:{ groups,members,assignments } })
    }
    const rows = api.tables[name] ?? []
    const match = (row: Row) => [...url.searchParams].every(([key,value]) => {
      if (key.startsWith('PYRUnibague_Projects.')) {
        const project = table('Projects').find(project => project.id === row.project_id)
        return String(project?.[key.split('.')[1]!]) === value.slice(3)
      }
      return value.startsWith('eq.') ? String(row[key]) === value.slice(3) : value.startsWith('in.') ? value.slice(4,-1).split(',').includes(String(row[key])) : true
    })
    let filtered = rows.filter(match)
    if (method === 'POST') { const row = { id:crypto.randomUUID(),created_at:now,updated_at:now,...(name.endsWith('Groups') ? { started_on:null,status:'active' } : name.endsWith('GroupMembers') ? { joined_on:null,left_on:null,status:'active' } : {}),...body }; rows.push(row); filtered = [row] }
    if (method === 'PATCH') filtered.forEach(row => Object.assign(row,body,{ updated_at:new Date().toISOString() }))
    if (method === 'DELETE') api.tables[name] = rows.filter(row => !match(row))
    const count = filtered.length
    filtered = filtered.slice(Number(url.searchParams.get('offset') ?? 0),Number(url.searchParams.get('offset') ?? 0)+Number(url.searchParams.get('limit') ?? 1000))
    if (specialPositions) filtered = filtered.map(row => ({ ...row,PYRUnibague_Projects:table('Projects').find(project => project.id === row.project_id),PYRUnibague_ProjectPositionPrograms:table('ProjectPositionPrograms').filter(link => link.project_position_id === row.id).map(link => ({ PYRUnibague_AcademicPrograms:table('AcademicPrograms').find(program => program.id === link.academic_program_id) })) }))
    if (name === 'PYRUnibague_ProjectPositionPrograms') filtered = filtered.map(row => ({ ...row,PYRUnibague_AcademicPrograms:table('AcademicPrograms').find(program => program.id === row.academic_program_id) }))
    const json = request.headers().accept?.includes('application/vnd.pgrst.object+json') ? filtered[0] : filtered
    return route.fulfill({ json,headers:{ 'content-range':`0-${Math.max(0,count-1)}/${count}`,'access-control-expose-headers':'content-range' } })
  })
  return { ...api,table,secondProject,failNext:(name:string) => { fail = name } }
}
