// Read-only verification of real Auth/Data/Storage and effective RLS for nine existing accounts.
import assert from 'node:assert/strict'
import { context, inspect, readManifest, rows, table, check, save, ref, SCENARIO } from './p12-context.mjs'
import { publicClient } from './supabase-admin.mjs'

const results = []
let ctx
async function test(label, run) {
  try { await run(); results.push({ label, status: 'PASS' }); console.log('PASS', label) }
  catch (error) { results.push({ label, status: 'FAIL', error: error.message }); console.log('FAIL', label); process.exitCode = 1 }
}
try {
  ctx = await context()
  const preflight = await inspect(ctx), m = await readManifest(), a = ctx.admin
  assert.equal(m.students?.length, 4, 'Falta ejecutar --apply')
  const students = ctx.byRole('STUDENT').sort((x,y) => Number(x.account.email.match(/estudiante(\d*)@/)[1] || 1) - Number(y.account.email.match(/estudiante(\d*)@/)[1] || 1))
  const orgs = ctx.byRole('ORGANIZATION')
  const assignments = await rows(a, 'Assignments', { academic_period_id: m.period_id })
  await test('Nueve cuentas: UUID, perfil y roles reales; asesores activos', async () => {
    assert.equal(ctx.clients.length, 9)
    for (const x of ctx.byRole('ADVISOR')) assert.equal((await rows(a, 'StaffProfiles', { user_id: x.account.user_id }))[0].status, 'active')
  })
  await test('Periodo actual activo visible para estudiantes y asesores', async () => {
    for (const { client } of [...students, ...ctx.byRole('ADVISOR')]) {
      const current = await rows(client, 'AcademicPeriods', { is_current: true })
      assert.equal(current.length, 1); assert.equal(current[0].id, m.period_id); assert.equal(current[0].status, 'active')
    }
  })
  for (const [i, { client: c, account }] of students.entries()) {
    await test(`Estudiante ${i+1}: perfil distinto, programa, habilidades, preferencias, participación`, async () => {
      const own = await rows(c, 'Students', { id: m.students[i] })
      assert.equal(own.length, 1); assert.equal(own[0].user_id, account.user_id)
      assert.equal(own[0].student_code, `TEST-PYR-2026B-E${i+1}`)
      assert.ok(own[0].academic_program_id && own[0].current_semester && own[0].origin_municipality_id && own[0].current_municipality_id)
      assert.ok((await rows(c, 'StudentSkills', { student_id: own[0].id })).length)
      assert.ok((await rows(c, 'StudentLocationPreferences', { student_id: own[0].id })).length)
      const participation = (await rows(c, 'StudentPeriodParticipations', { id: m.participations[i] }))[0]
      assert.equal(participation.eligible_for_matching, i !== 3); assert.equal(participation.status, 'active')
      if (i === 1) assert.ok(!own[0].profile_links?.github, 'El segundo estudiante no necesita GitHub')
    })
    await test(`Estudiante ${i+1}: aislamiento de perfiles/documentos y denegación ADMIN`, async () => {
      for (const other of m.students.filter(id => id !== m.students[i])) {
        assert.deepEqual(await rows(c, 'Students', { id: other }), [])
        assert.deepEqual(await rows(c, 'StudentDocuments', { student_id: other }), [])
      }
      const denied = await c.rpc('pyr_unibague_assignment_snapshot', { p_period_id: m.period_id, p_run_id: null })
      assert.ok(denied.error, 'Snapshot ADMIN debe denegarse')
    })
    await documentAccess(c, 'Student', m.students[i], students.find(x => x.account.user_id !== account.user_id).client, `Estudiante ${i+1}`)
  }
  await test('Organización A aprobada; B con cambios solicitados y observaciones visibles', async () => {
    const first = (await rows(a, 'Organizations', { id: m.organizations[0] }))[0]
    const second = (await rows(a, 'Organizations', { id: m.organizations[1] }))[0]
    assert.equal(first.status, 'approved'); assert.ok(first.verified_at)
    assert.equal(second.status, 'changes_required'); assert.equal(second.verified_at, null)
    const owner = orgs.find(x => x.account.user_id === second.created_by)
    assert.ok((await rows(owner.client, 'OrganizationReviews', { organization_id: second.id })).some(r => r.notes?.includes(SCENARIO)))
    assert.ok((await rows(owner.client, 'OrganizationContacts', { organization_id: second.id })).some(c => c.is_primary))
  })
  for (const [i, x] of orgs.entries()) {
    const own = (await rows(x.client, 'Organizations', { created_by: x.account.user_id }))[0]
    const foreign = m.organizations.find(id => id !== own.id)
    await test(`Organización ${i+1}: documentos/contactos/proyectos ajenos aislados`, async () => {
      for (const name of ['OrganizationContacts', 'OrganizationDocuments', 'OrganizationReviews', 'Projects']) assert.deepEqual(await rows(x.client, name, { organization_id: foreign }), [])
      assert.ok((await x.client.rpc('pyr_unibague_review_organization', { p_organization_id: own.id, p_decision: 'approved' })).error)
    })
    await documentAccess(x.client, 'Organization', own.id, orgs.find(y => y !== x).client, `Organización ${i+1}`)
  }
  await test('Responsabilidades por periodo e individuales independientes', async () => {
    const orgAssignments = await rows(a, 'AdvisorOrganizationAssignments', { academic_period_id: m.period_id, is_current: true })
    for (const id of m.organizations) assert.equal(orgAssignments.filter(x => x.organization_id === id).length, 1)
    const individual = []
    for (const id of m.participations.slice(0,2)) {
      const found = await rows(a, 'AdvisorStudentAssignments', { participation_id: id, is_current: true })
      assert.equal(found.length, 1); individual.push(found[0])
    }
    assert.notEqual(individual[0].advisor_id, individual[1].advisor_id)
    for (const { client: c, account } of ctx.byRole('ADVISOR')) {
      const staff = (await rows(a, 'StaffProfiles', { user_id: account.user_id }))[0]
      const workspace = check(await c.rpc('pyr_unibague_advisor_workspace', { p_academic_period_id: m.period_id }), 'Workspace asesor')
      assert.equal(workspace.students.length, individual.filter(x => x.advisor_id === staff.id).length)
      const foreignParticipation = individual.find(x => x.advisor_id !== staff.id).participation_id
      const foreignStudent = m.students[m.participations.indexOf(foreignParticipation)]
      // Effective permissions may include organization supervision independently; report actual result.
      const visible = await rows(c, 'StudentDocuments', { student_id: foreignStudent })
      assert.equal(visible.length, 0, 'Asesor no tiene permiso para documentos privados de estudiantes')
    }
  })
  await test('Integridad de proyecto/plazas/convocatoria y capacidad persistida', async () => {
    const project = (await rows(a, 'Projects', { id: m.project_id }))[0]
    assert.equal(project.organization_id, m.organizations[0]); assert.equal(project.academic_period_id, m.period_id)
    const call = (await rows(a, 'Calls', { id: m.call_id }))[0]
    assert.equal(call.academic_period_id, m.period_id); assert.equal(call.organization_id, project.organization_id)
    const links = await rows(a, 'CallPositions', { call_id: m.call_id })
    assert.equal(links.length, 2)
    for (const id of m.positions) {
      const p = (await rows(a, 'ProjectPositions', { id }))[0]
      assert.equal(p.project_id, project.id); assert.equal(p.capacity, 1)
      assert.ok(assignments.filter(x => x.is_active && x.project_position_id === id).length <= p.capacity)
      assert.equal((await rows(a, 'ProjectPositionPrograms', { project_position_id: id })).length, 1)
    }
    if (preflight.blockers.length) { assert.equal(project.status, 'draft'); assert.equal(call.status, 'draft') }
  })
  await test('Estudiantes 3/4 sin asignación y 4 no elegible', async () => {
    assert.ok(!assignments.some(x => x.is_active && m.students.slice(2).includes(x.student_id)))
  })
  await test('ADMIN: métricas y exportaciones desde RPC reales', async () => {
    const dashboard = check(await a.rpc('pyr_unibague_admin_dashboard'), 'Dashboard ADMIN')
    assert.ok(dashboard && typeof dashboard === 'object')
    check(await a.rpc('pyr_unibague_operational_summary', { p_period_id: m.period_id }), 'Resumen operativo')
    for (const kind of ['assignments', 'positions']) assert.ok(Array.isArray(check(await a.rpc('pyr_unibague_operational_export', { p_period_id: m.period_id, p_kind: kind, p_after_id: null }), 'Exportación real ' + kind)))
    // Query exact records; global dashboard may include other previous TEST data.
    assert.equal((await rows(a, 'StudentPeriodParticipations', { academic_period_id: m.period_id })).filter(x => m.participations.includes(x.id)).length, 4)
  })
  await test('Anónimo no puede leer datos privados', async () => {
    const anon = await publicClient()
    for (const name of ['Students', 'OrganizationDocuments', 'Assignments', 'UserProfiles']) {
      const r = await table(anon, name).select('*'); assert.ok(r.error || !r.data.length)
    }
  })
  if (preflight.blockers.length) {
    for (const label of ['Asignaciones 1/2 mediante matching real y optimizador', 'Notificaciones automáticas de asignación', 'Equipo con dos miembros confirmados', 'Ciclo retiro/restauración, cupo y no elegible', 'RLS SQL/pgTAP y restricciones remotas P11/P11.1']) results.push({ label, status: 'BLOCKED', reason: preflight.blockers.join('; ') })
    if (!process.exitCode) process.exitCode = 2
  } else await test('Final: dos confirmados con candidatos reales y notificaciones automáticas', async () => {
    assert.ok(m.run_id)
    for (const id of m.students.slice(0,2)) {
      const active = assignments.filter(x => x.student_id === id && x.is_active)
      assert.equal(active.length, 1); assert.equal(active[0].source, 'MATCHING'); assert.ok(active[0].match_candidate_id)
      const candidate = (await rows(a, 'MatchCandidates', { id: active[0].match_candidate_id }))[0]
      assert.equal(candidate.matching_run_id, m.run_id); assert.ok(candidate.is_eligible && candidate.total_score >= 70)
      const owner = (await rows(a, 'Students', { id }))[0]
      assert.ok((await rows(a, 'Notifications', { user_id: owner.user_id })).length)
    }
  })
  if (!preflight.blockers.length) {
    // Never certify lifecycle/concurrency merely because final rows happen to exist.
    results.push({ label: 'Ciclo de vida real y restauración por RPC', status: 'BLOCKED', reason: 'Pendiente de ejecutar y registrar con dependencias P11/matching operativas; no cubierto por esta verificación de solo lectura.' })
    if (!process.exitCode) process.exitCode = 2
  }
  async function documentAccess(owner, kind, id, foreign, label) {
    await test(label + ': PDF válido privado, propietario/ADMIN y denegación ajena', async () => {
      const field = kind === 'Student' ? 'student_id' : 'organization_id'
      const doc = (await rows(owner, kind + 'Documents', { [field]: id })).find(d => d.file_name === SCENARIO + '-TEST.pdf')
      assert.ok(doc)
      for (const c of [owner, a]) {
        const blob = check(await c.storage.from(doc.bucket_id).download(doc.object_path), 'Documento autorizado')
        const bytes = Buffer.from(await blob.arrayBuffer()); assert.equal(bytes.subarray(0,5).toString(), '%PDF-'); assert.ok(bytes.includes(Buffer.from('startxref')))
      }
      assert.ok((await foreign.storage.from(doc.bucket_id).createSignedUrl(doc.object_path, 30)).error)
      const publicUrl = owner.storage.from(doc.bucket_id).getPublicUrl(doc.object_path).data.publicUrl
      assert.ok([400,403,404].includes((await fetch(publicUrl)).status))
    })
  }
} catch (error) { results.push({ label: 'Preparación', status: 'FAIL', error: error.message }); process.exitCode = 1 }
finally {
  if (ctx) await ctx.close()
  await save('verification.local.json', { checked_at: new Date().toISOString(), project_ref: ref, scenario: SCENARIO, mode: 'real Supabase Auth/Data/Storage', results })
  console.log(JSON.stringify({ pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length, blocked: results.filter(x => x.status === 'BLOCKED').length }))
}
