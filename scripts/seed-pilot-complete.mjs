import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { context, inspect, readManifest, lock, writer, rows, table, check, save, ref, SCENARIO } from './p12-context.mjs'

const prefix = SCENARIO + ' · TEST · '
const args = process.argv.slice(2)
const modes = ['--plan', '--apply', '--verify', '--cleanup'].filter(flag => args.includes(flag))
assert.equal(modes.length, 1, 'Usar exactamente --plan, --apply, --verify o --cleanup')
assert.ok(args.every(a => modes.includes(a) || a === '--confirm=' + SCENARIO), 'Argumento desconocido')
if (modes[0] === '--verify') {
  await import('./verify-demo-final.mjs')
} else {
  if (modes[0] === '--cleanup') assert.ok(args.includes('--confirm=' + SCENARIO), 'Cleanup requiere --confirm=' + SCENARIO)
  if (modes[0] === '--apply') {
    execFileSync(process.execPath, ['scripts/generate-demo-ledger.mjs'], { stdio: 'inherit' })
    execFileSync(process.execPath, ['scripts/crear-cuentas-piloto.mjs', '--apply'], { stdio: 'inherit' })
  }
  const release = await lock()
  let ctx
  try {
    ctx = await context()
    const preflight = await inspect(ctx)
    const manifest = await readManifest()
    if (modes[0] === '--plan') {
      const periods = await rows(ctx.admin, 'AcademicPeriods', { is_current: true })
      console.log(JSON.stringify({ scenario: SCENARIO, project: ref, mode: 'READ ONLY', accounts_verified: ctx.clients.map(x => ({ email: x.account.email, role: x.account.role })),
        current_period: periods[0]?.name ?? 'Se crearía 2026B — Piloto TEST',
        intended: ['4 perfiles distintos y documentos privados', '3 programas TEST si faltan', 'municipios/tipo/habilidades reutilizados o TEST', '4 participaciones: 3 elegibles, 1 no elegible', '2 organizaciones demo creadas mediante cuentas propias', 'contactos, documentos y responsabilidades independientes', '2 proyectos, 4 plazas con capacidad disponible y convocatorias', 'publicación, matching real, optimizador y RPC solo tras preflight completo'],
        recorded_entities: Object.keys(manifest.records).length, blockers: preflight.blockers }, null, 2))
    } else if (modes[0] === '--cleanup') {
      // Deliberately preserve parent entities, reviews, audit, assignments and responsibility history.
      // Cleanup only removes seed-created leaves; re-applying reconstructs these leaves.
      const removable = new Set(['StudentInterests', 'StudentSkills', 'ProjectPositionSkills', 'ProjectPositionPrograms', 'ProjectInterlocutors'])
      if (manifest.configuration_id) assert.equal((await rows(ctx.admin, 'MatchingRuns', { matching_configuration_id: manifest.configuration_id })).length, 0, 'Hay historial de matching: cleanup cancelado para conservar evidencia')
      for (const id of manifest.positions ?? []) assert.equal((await rows(ctx.admin, 'Assignments', { project_position_id: id })).length, 0, 'Hay historial de asignaciones: cleanup cancelado')
      let deleted = 0
      for (const [key, record] of Object.entries(manifest.records)) {
        if (!record.created || !removable.has(record.table)) continue
        const existing = await rows(ctx.service, record.table, { id: record.id })
        if (existing.length) {
          assert.ok(Object.entries(record.filter).every(([k,v]) => existing[0][k] === v), 'Identidad fuera del manifiesto')
          check(await table(ctx.admin, record.table).delete().eq('id', record.id).match(record.filter), 'Limpiar hoja TEST')
        }
        delete manifest.records[key]; deleted++
        await save('manifest.local.json', manifest)
      }
      console.log(JSON.stringify({ removed_leaves: deleted, preserved: 'Perfiles, periodos, organizaciones, archivos privados e historial conservados. No se realiza un reset.' }))
    } else await apply(ctx, manifest, preflight)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally { if (ctx) await ctx.close(); await release() }
}

async function apply(ctx, m, preflight) {
  const { ensure, update, persist } = writer(m)
  const a = ctx.admin, students = ctx.byRole('STUDENT'), organizations = ctx.byRole('ORGANIZATION'), advisors = ctx.byRole('ADVISOR')
  // Original account ordering is not trusted: exact addresses select each scenario slot.
  students.sort((x,y) => studentIndex(x.account.email) - studentIndex(y.account.email))
  advisors.sort((x,y) => Number(x.account.email.includes('asesor2@')) - Number(y.account.email.includes('asesor2@')))
  const staff = []
  for (const x of advisors) {
    const found = await rows(a, 'StaffProfiles', { user_id: x.account.user_id, status: 'active' })
    assert.equal(found.length, 1, 'Se exige StaffProfile activo preexistente'); staff.push(found[0])
  }
  let current = await rows(a, 'AcademicPeriods', { is_current: true })
  assert.ok(current.length <= 1)
  if (!current.length) {
    const p = await ensure(a, 'AcademicPeriods', 'period', { code: 'TEST-PYR-2026B' }, { name: '2026B — Piloto TEST', starts_on: '2026-07-01', ends_on: '2026-12-31', status: 'active', is_current: false })
    assert.equal(p.name, '2026B — Piloto TEST')
    // Recheck immediately; never intentionally displace an institutional period.
    current = await rows(a, 'AcademicPeriods', { is_current: true })
    if (!current.length) {
      // Direct ADMIN UPDATE uses the partial unique index as the race guard;
      // unlike set_current RPC it cannot clear a concurrently created real period.
      check(await table(a, 'AcademicPeriods').update({ is_current: true }).eq('id', p.id).eq('is_current', false), 'Activar periodo TEST')
      current = await rows(a, 'AcademicPeriods', { is_current: true })
    }
  }
  assert.equal(current.length, 1); const period = current[0]; assert.equal(period.status, 'active')
  if (m.period_id) assert.equal(m.period_id, period.id, 'Cambió el periodo actual; revisar escenario sin trasladar historial')
  m.period_id = period.id; await persist()
  const programs = []
  for (const [code, name] of [['TEST-PYR-SIS','Ingeniería de Sistemas'], ['TEST-PYR-COM','Comunicación Social'], ['TEST-PYR-DER','Derecho']]) {
    const existing = (await rows(a, 'AcademicPrograms', { active: true })).filter(p => p.name === name)
    assert.ok(existing.length <= 1)
    programs.push(existing[0] ?? await ensure(a, 'AcademicPrograms', code, { code }, { name: `${name} (TEST — catálogo ficticio)`, faculty_name: 'TEST · Facultad ficticia', active: true }))
  }
  const municipalities = await rows(a, 'Municipalities', { active: true })
  const rememberedMunicipalities = m.references?.municipalities
  if (rememberedMunicipalities) assert.ok(rememberedMunicipalities.every(id => municipalities.some(x => x.id === id)), 'Catálogo territorial de referencia cambió; revisar antes de reemplazarlo')
  const municipality = (rememberedMunicipalities ? municipalities.find(x => x.id === rememberedMunicipalities[0]) : municipalities.find(x => x.municipality_code === 'TEST-P11') ?? municipalities[0]) ?? await ensure(a, 'Municipalities', 'municipality', { country_code: 'CO', department_code: 'TEST-PYR', municipality_code: 'TEST-PYR' }, { department_name: 'TEST · Departamento ficticio', municipality_name: 'TEST · Municipio ficticio' })
  const alternate = (rememberedMunicipalities ? municipalities.find(x => x.id === rememberedMunicipalities[1]) : municipalities.find(x => x.id !== municipality.id)) ?? await ensure(a, 'Municipalities', 'municipality2', { country_code: 'CO', department_code: 'TEST-PYR', municipality_code: 'TEST-PYR-2' }, { department_name: 'TEST · Departamento ficticio', municipality_name: 'TEST · Municipio alternativo ficticio' })
  const skillNames = ['Programación comunitaria', 'Comunicación comunitaria', 'Análisis territorial']
  const skills = []
  for (const name of skillNames) skills.push(await ensure(a, 'Skills', 'skill-' + name, { name: prefix + name }, { category: 'TEST · Piloto interdisciplinario' }))
  m.students = []; m.participations = []
  for (const [i, { client: c, account }] of students.entries()) {
    const program = programs[i === 1 ? 1 : i === 3 ? 2 : 0]
    const edit = { student_code: `TEST-PYR-2026B-E${i+1}`, academic_program_id: program.id, current_semester: 8 + i % 2,
      bio: prefix + ['Desarrollo de herramientas para comunidades.', 'Comunicación social y participación ciudadana.', 'Interés en iniciativas territoriales; espera una plaza.', 'Perfil de Derecho para probar elegibilidad administrativa deshabilitada.'][i],
      desired_work_description: prefix + 'Trabajo interdisciplinario con comunidades ficticias.', origin_municipality_id: municipality.id, current_municipality_id: i % 2 ? alternate.id : municipality.id }
    let student = await ensure(c, 'Students', 'student-' + i, { user_id: account.user_id }, edit)
    assert.equal(student.student_code, edit.student_code, 'No sobrescribir perfil preexistente ajeno al escenario')
    student = await update(c, 'Students', student.id, edit)
    const skill = skills[i === 1 ? 1 : i === 3 ? 2 : 0]
    await ensure(c, 'StudentSkills', 'student-skill-' + i, { student_id: student.id, skill_id: skill.id }, { evidence_text: prefix + 'Evidencia ficticia de aprendizaje' })
    await ensure(c, 'StudentInterests', 'interest-' + i, { student_id: student.id, label: prefix + 'Participación e innovación territorial' }, { description: 'Interés TEST', sort_order: 0 })
    const prefs = await rows(c, 'StudentLocationPreferences', { student_id: student.id })
    if (!prefs.length) check(await c.rpc('pyr_unibague_set_student_preferences', { p_student_id: student.id, p_municipality_ids: [municipality.id, alternate.id] }), 'Preferencias propias')
    const participation = await ensure(a, 'StudentPeriodParticipations', 'participation-' + i, { student_id: student.id, academic_period_id: period.id }, { status: 'active', eligible_for_matching: i !== 3 })
    // Same persisted ADMIN flow as saveParticipation; no new institutional reason is invented.
    assert.equal(participation.status, 'active'); assert.equal(participation.eligible_for_matching, i !== 3, 'Elegibilidad cambió fuera del seed; requiere revisión')
    m.students.push(student.id); m.participations.push(participation.id)
    await document(c, account, 'Student', student.id, 'student-doc-' + i)
    await persist()
  }
  const orgRecords = []
  for (const [i, x] of organizations.entries()) {
    const own = await rows(x.client, 'Organizations', { created_by: x.account.user_id })
    let org = own.find(o => o.legal_name === `TEST P11 Organización ${i + 1}` || o.description?.includes(SCENARIO))
    if (!org) {
      const id = check(await x.client.rpc('pyr_unibague_register_organization', {
        p_legal_name: `TEST P11 Organización ${i + 1}`, p_display_name: `TEST P11 Organización ${i + 1}`,
        p_tax_id: `TEST-PYR-${i + 1}`, p_description: prefix + `Organización ${i + 1} ficticia`,
        p_website: 'https://example.test/paz-region', p_organization_type_id: null, p_municipality_id: municipality.id,
      }), 'Crear organización demo')
      org = (await rows(a, 'Organizations', { id }))[0]
    }
    assert.ok(org && org.created_by === x.account.user_id, 'Organización demo propia')
    const members = await rows(a, 'OrganizationMembers', { organization_id: org.id, status: 'active' })
    assert.ok(members.some(member => member.user_id === x.account.user_id && member.can_manage))
    assert.ok(!members.some(member => member.user_id === ctx.clients.find(u => u.client === a).account.user_id), 'ADMIN debe ser independiente')
    orgRecords.push({ ...x, org })
  }
  // Both organizations are created by their demo accounts; ADMIN reviews them below.
  m.organizations = orgRecords.map(x => x.org.id)
  for (const [i, { client: c, account, org }] of orgRecords.entries()) {
    await update(c, 'Organizations', org.id, { description: prefix + (i ? 'Organización B ficticia; revisión y correcciones.' : 'Organización A ficticia; innovación y comunicación comunitaria.') })
    const contacts = await rows(c, 'OrganizationContacts', { organization_id: org.id })
    for (const n of [0,1]) {
      const name = prefix + (n ? 'Interlocutor adicional' : 'Representante responsable')
      let contact = contacts.find(p => p.full_name === name)
      if (!contact) {
        const key = `contact-${i}-${n}`
        m.operations[key] = { status: 'intent', organization_id: org.id, name }; await persist()
        const id = check(await c.rpc('pyr_unibague_save_organization_contact', { p_organization_id: org.id, p_full_name: name, p_email: account.email, p_position_title: n ? 'TEST · Enlace comunitario' : 'TEST · Representante', p_is_primary: n === 0 }), 'Contacto propio RPC')
        m.records[key] = { table: 'OrganizationContacts', id, created: true, filter: { organization_id: org.id, full_name: name } }
        m.operations[key].status = 'done'; await persist()
        contact = { id }
      }
      if (i === 0 && n === 0) m.primary_contact_id = contact.id
    }
    await document(c, account, 'Organization', org.id, 'org-doc-' + i)
    // Existing P4 review remains supported; formal P11 submission is never simulated.
    const decision = 'approved'
    const fresh = (await rows(a, 'Organizations', { id: org.id }))[0]
    if (fresh.status !== decision) check(await a.rpc('pyr_unibague_review_organization', { p_organization_id: org.id, p_decision: decision, p_notes: prefix + 'Observación de demostración: revisar descripción y contacto ficticios.' }), 'Revisión ADMIN independiente P4')
    const responsibilities = await rows(a, 'AdvisorOrganizationAssignments', { organization_id: org.id, academic_period_id: period.id, is_current: true })
    assert.ok(responsibilities.length <= 1)
    if (responsibilities[0]) assert.equal(responsibilities[0].advisor_id, staff[i].id, 'No sustituir responsabilidad ajena')
    else check(await a.rpc('pyr_unibague_change_organization_advisor', { p_organization_id: org.id, p_academic_period_id: period.id, p_advisor_id: staff[i].id }), 'Asesor organizacional RPC')
  }
  for (const i of [0,1]) {
    const found = await rows(a, 'AdvisorStudentAssignments', { participation_id: m.participations[i], is_current: true })
    if (found[0]) assert.equal(found[0].advisor_id, staff[i].id, 'No sustituir asesor individual ajeno')
    else check(await a.rpc('pyr_unibague_change_student_advisor', { p_participation_id: m.participations[i], p_advisor_id: staff[i].id, p_reason: prefix + 'Responsabilidad individual independiente' }), 'Asesor individual RPC')
  }
  const { client: orgA, org, account } = orgRecords[0]
  const project = await ensure(orgA, 'Projects', 'project', { organization_id: org.id, name: prefix + 'Innovación y comunicación para el territorio' }, { academic_period_id: period.id, summary: prefix + 'Proyecto interdisciplinario ficticio', description: prefix + 'Prototipo de información y comunicación comunitaria.', municipality_id: municipality.id, zone_type: 'urban', modality: 'Presencial (TEST)', status: 'draft', created_by: account.user_id })
  assert.equal(project.academic_period_id, period.id); m.project_id = project.id
  await ensure(orgA, 'ProjectInterlocutors', 'project-contact', { project_id: project.id, organization_contact_id: m.primary_contact_id }, { is_primary_for_project: true })
  m.positions = []
  for (const i of [0,1]) {
    const position = await ensure(orgA, 'ProjectPositions', 'position-' + i, { project_id: project.id, title: prefix + (i ? 'Comunicación Social' : 'Ingeniería de Sistemas') }, { description: prefix + 'Plaza de formación interdisciplinaria', capacity: 2, status: 'active', is_active: true })
    if (position.capacity !== 2) await update(orgA, 'ProjectPositions', position.id, { capacity: 2 }); assert.equal(position.is_active, true)
    await ensure(orgA, 'ProjectPositionPrograms', 'position-program-' + i, { project_position_id: position.id, academic_program_id: programs[i].id }, { is_required: true })
    await ensure(orgA, 'ProjectPositionSkills', 'position-skill-' + i, { project_position_id: position.id, skill_id: skills[i].id }, { is_required: true })
    m.positions.push(position.id)
  }
  const call = await ensure(orgA, 'Calls', 'call', { organization_id: org.id, title: prefix + 'Convocatoria interdisciplinaria' }, { academic_period_id: period.id, details: prefix + 'Dos plazas de capacidad uno', status: 'draft' })
  assert.equal(call.academic_period_id, period.id); m.call_id = call.id
  for (const id of m.positions) await ensure(orgA, 'CallPositions', 'call-position-' + id, { call_id: call.id, project_position_id: id })
  const orgB = orgRecords[1]
  const projectB = await ensure(orgB.client, 'Projects', 'project-b', { organization_id: orgB.org.id, name: prefix + 'Educación ambiental comunitaria' }, { academic_period_id: period.id, summary: prefix + 'Segundo proyecto ficticio', description: prefix + 'Comunicación y herramientas comunitarias para el ambiente.', municipality_id: municipality.id, zone_type: 'urban', modality: 'Presencial (TEST)', status: 'draft', created_by: orgB.account.user_id })
  m.projects = [project.id, projectB.id]
  const callB = await ensure(orgB.client, 'Calls', 'call-b', { organization_id: orgB.org.id, title: prefix + 'Convocatoria ambiental' }, { academic_period_id: period.id, details: prefix + 'Plazas de evaluación', status: 'draft' })
  for (const i of [0,1]) {
    const position = await ensure(orgB.client, 'ProjectPositions', 'position-b-' + i, { project_id: projectB.id, title: prefix + (i ? 'Comunicación ambiental' : 'Tecnología comunitaria') }, { description: prefix + 'Plaza ficticia disponible', capacity: 2, status: 'active', is_active: true })
    await ensure(orgB.client, 'ProjectPositionPrograms', 'position-b-program-' + i, { project_position_id: position.id, academic_program_id: programs[i].id }, { is_required: true })
    await ensure(orgB.client, 'ProjectPositionSkills', 'position-b-skill-' + i, { project_position_id: position.id, skill_id: skills[i].id }, { is_required: true })
    await ensure(orgB.client, 'CallPositions', 'call-b-position-' + i, { call_id: callB.id, project_position_id: position.id })
    m.positions.push(position.id)
  }
  const config = await ensure(a, 'MatchingConfigurations', 'matching-config', { name: prefix + 'Matching estructurado', academic_period_id: period.id }, { algorithm_version: 'hybrid-v0.1', minimum_recommended_score: 70, weights: { academic: 40, skills: 30, experience: 0, interests: 0, location: 10, preference: 20, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false }, is_active: true, created_by: ctx.clients.find(x => x.client === a).account.user_id })
  m.configuration_id = config.id; m.blockers = preflight.blockers
  m.references = { accounts: ctx.clients.map(x => ({ email: x.account.email, user_id: x.account.user_id, role: x.account.role })), municipalities: [municipality.id, alternate.id], programs: programs.map(x => x.id), staff: staff.map(x => x.id), organizations: orgRecords.map(x => ({ id: x.org.id, created_by: x.account.user_id, reused: true })) }
  await persist()
  if (!preflight.blockers.length) {
    if (['draft', 'changes_required'].includes(project.status)) await update(orgA, 'Projects', project.id, { status: 'submitted' })
    if (project.status !== 'approved') await update(a, 'Projects', project.id, { status: 'approved' })
    if (['draft', 'changes_required'].includes(call.status)) await update(orgA, 'Calls', call.id, { status: 'submitted' })
    if (call.status !== 'open') await update(a, 'Calls', call.id, { status: 'open' })
    if (['draft', 'changes_required'].includes(projectB.status)) await update(orgB.client, 'Projects', projectB.id, { status: 'submitted' })
    if (projectB.status !== 'approved') await update(a, 'Projects', projectB.id, { status: 'approved' })
    if (['draft', 'changes_required'].includes(callB.status)) await update(orgB.client, 'Calls', callB.id, { status: 'submitted' })
    if (callB.status !== 'open') await update(a, 'Calls', callB.id, { status: 'open' })
    await matchAndConfirm()
  }
  m.last_applied_at = new Date().toISOString(); await persist()
  console.log(JSON.stringify({ scenario: SCENARIO, tracked_created_records: Object.values(m.records).filter(x => x.created).length, reused_organizations: m.references.organizations.length, status: preflight.blockers.length ? 'PARTIAL_BLOCKED' : 'SEE_VERIFY', blockers: preflight.blockers }, null, 2))
  if (preflight.blockers.length) process.exitCode = 2

  async function document(c, user, kind, owner, key) {
    const field = kind === 'Student' ? 'student_id' : 'organization_id', name = kind + 'Documents'
    const bytes = await readFile(`tests/fixtures/PYR-DEMO-${kind.toLowerCase()}.pdf`)
    assert.ok(bytes.subarray(0,5).toString() === '%PDF-' && bytes.includes(Buffer.from('startxref')))
    const bucket = `pyrunibague-${kind.toLowerCase()}-documents`, file = SCENARIO + '-TEST.pdf'
    const documentId = m.records[key]?.id ?? randomUUID()
    const objectPath = `${owner}/${documentId}/${file}`
    if (!m.records[key]) {
      m.records[key] = { table: name, id: documentId, created: true, filter: { [field]: owner, object_path: objectPath } }
      await persist()
    }
    const found = await rows(c, name, { [field]: owner, object_path: objectPath })
    if (!found.length) {
      const upload = await c.storage.from(bucket).upload(objectPath, bytes, { contentType: 'application/pdf', upsert: false })
      if (upload.error && !['Duplicate', 'KeyAlreadyExists', '409'].includes(String(upload.error.code ?? upload.error.statusCode))) check(upload, 'Subir PDF privado')
    }
    const expectedCategory = kind === 'Student' ? 'CV' : 'TEST-DEMO'
    const doc = await ensure(c, name, key, { [field]: owner, object_path: objectPath }, { category_code: expectedCategory, file_name: file, bucket_id: bucket, mime_type: 'application/pdf', size_bytes: bytes.length, status: 'uploaded', uploaded_by: user.user_id })
    assert.equal(doc.uploaded_by, user.user_id)
    // Only the exact scenario-owned object may be refreshed; metadata still follows real bucket rules.
    if (doc.category_code !== expectedCategory || doc.size_bytes !== bytes.length) {
      check(await c.storage.from(bucket).upload(objectPath, bytes, { contentType: 'application/pdf', upsert: true }), 'Actualizar PDF propio del escenario')
      await update(c, name, doc.id, { category_code: expectedCategory, size_bytes: bytes.length })
    }
    const downloaded = check(await c.storage.from(bucket).download(objectPath), 'Leer PDF propio')
    assert.equal(createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex'), createHash('sha256').update(bytes).digest('hex'))
  }
  async function matchAndConfirm() {
    if (!m.run_id || m.matching_input_version !== 'two-projects-v1') {
      m.operations.matching = { status: 'intent', started_at: new Date().toISOString() }; await persist()
      const result = check(await a.functions.invoke('matching-run', { body: { academic_period_id: period.id, matching_configuration_id: config.id } }), 'Matching real')
      m.run_id = result.run_id
      assert.ok(m.run_id, 'Matching no devolvió identificador')
      m.matching_input_version = 'two-projects-v1'
      m.operations.matching.status = 'done'
      await persist()
    }
    // This demo requires persisted matching results, not automatic assignments.
    return
    const snap = check(await a.rpc('pyr_unibague_assignment_snapshot', { p_period_id: period.id, p_run_id: m.run_id }), 'Snapshot real')
    const { transform } = await import('esbuild')
    const source = await readFile('src/features/optimizer/solveAssignments.ts', 'utf8')
    const js = (await transform(source, { loader: 'ts', format: 'esm' })).code
    const { solveAssignments } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
    // Real candidates/scores, scoped to scenario students 1/2 and scenario positions.
    const wanted = new Set(m.students.slice(0,2)), positions = new Set(m.positions)
    const proposal = solveAssignments({ ...snap, students: snap.students.filter(s => wanted.has(s.id)), positions: snap.positions.filter(p => positions.has(p.id)), candidates: snap.candidates.filter(c => wanted.has(c.studentId) && positions.has(c.positionId)) })
    const actions = proposal.rows.map(r => ({ kind: 'confirm', student_id: r.studentId, position_id: r.positionId, candidate_id: r.candidateId, source: 'MATCHING' }))
    if (actions.length) check(await a.rpc('pyr_unibague_confirm_assignment_batch', { p_period_id: period.id, p_run_id: m.run_id, p_revision: snap.revision, p_actions: actions }), 'Confirmación optimista ADMIN')
    const group = await ensure(orgA, 'Groups', 'group', { project_id: project.id, name: prefix + 'Equipo interdisciplinario' })
    for (const id of wanted) {
      const active = await rows(a, 'Assignments', { student_id: id, academic_period_id: period.id, is_active: true })
      assert.equal(active.length, 1); assert.ok(positions.has(active[0].project_position_id))
      await ensure(orgA, 'GroupMembers', 'member-' + active[0].id, { group_id: group.id, assignment_id: active[0].id })
    }
  }
}

function studentIndex(email) {
  return Number(email.match(/^pyrdemo\.estudiante(\d*)@/)?.[1] || 1)
}
