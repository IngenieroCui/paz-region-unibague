/** Authoritative hybrid-v0.1. Change the version when changing scoring semantics. */
export const ALGORITHM_VERSION = 'hybrid-v0.1'
export const COMPONENTS = ['academic', 'skills', 'experience', 'interests', 'location', 'preference', 'semantic'] as const
export type Component = typeof COMPONENTS[number]
export type Weights = Record<Component, number>
export type Configuration = { algorithm_version: string; minimum_recommended_score: number; weights: Weights; rules: { requiredSkillsAreHardConstraint: boolean; semanticEnabled: boolean } }
export type Student = {
  id: string; academic_program_id: string | null; bio: string | null; desired_work_description: string | null
  current_municipality_id: string | null; origin_municipality_id: string | null
  experiences: { title: string; organization_name: string | null; description: string | null }[]
  interests: { label: string; description: string | null }[]
  skills: { skill_id: string; name: string; evidence_text: string | null }[]
  preferences: { municipality_id: string; preference_order: number }[]
}
export type Position = {
  id: string; title: string; description: string | null
  project: { name: string; summary: string | null; description: string | null; municipality_id: string | null }
  programs: { academic_program_id: string; is_required: boolean }[]
  skills: { skill_id: string; name: string; is_required: boolean }[]
  requirements: { label: string; description: string | null }[]
}
export type Blocker = { code: 'ACADEMIC_PROGRAM_REQUIRED' | 'REQUIRED_SKILL_MISSING'; skill_id?: string }
export type ComponentScore = { raw_score: number | null; configured_weight: number; effective_weight: number; available: boolean }
export type Recommendation = { code: string; component?: Component; skill_id?: string; message: string }
export type PairResult = {
  student_id: string; project_position_id: string; is_eligible: boolean; total_score: number | null
  component_scores: Record<Component, ComponentScore>; blockers: Blocker[]; recommendations: Recommendation[]; explanation: string
}
const stopwords = new Set(('a al algo algunas algunos ante antes como con contra cual cuando de del desde donde el ella ellas ellos en entre era es esa esas ese eso esos esta estaba estamos estan estar estas este esto estos fue ha hasta hay la las le les lo los mas me mi mis mucha mucho muy no nos o otra otro para pero poco por porque que quien se ser si sin sobre son su sus te tiene todo tu tus un una unas uno unos y ya the and for with from this that these those are was were been being have has had not but you your our their they them into its can could would should will about any all also more most some than then there which who how what where when is of to on in as it an be at by or'.split(/\s+/)))
export function normalizeTokens(value: string): string[] {
  return [...new Set(value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? [])]
    .filter(token => token.length >= 3 && !stopwords.has(token)).sort()
}
export function textScore(left: string, right: string): number | null {
  const a = normalizeTokens(left); const b = new Set(normalizeTokens(right))
  if (!a.length || !b.size) return null
  return Math.max(0, Math.min(100, Math.round(100 * a.filter(token => b.has(token)).length / Math.sqrt(a.length * b.size))))
}
export function embeddingScore(a: number[], b: number[]): number | null {
  if (!a.length || a.length !== b.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return null
  let dot = 0; let na = 0; let nb = 0
  for (let i = 0; i < a.length; i++) { const x = a[i]!; const y = b[i]!; dot += x * y; na += x * x; nb += y * y }
  if (!na || !nb) return null
  const cosine = dot / (Math.sqrt(na) * Math.sqrt(nb))
  return Number.isFinite(cosine) ? Math.max(0, Math.min(1, cosine)) * 100 : null
}
export function validateConfiguration(input: unknown): Configuration {
  const fail = () => { throw new Error('Configuración inválida: versión, pesos, umbral o reglas.') }
  if (!input || typeof input !== 'object') return fail()
  const c = input as Partial<Configuration>
  if (c.algorithm_version !== ALGORITHM_VERSION || typeof c.minimum_recommended_score !== 'number' || !Number.isFinite(c.minimum_recommended_score) || c.minimum_recommended_score < 0 || c.minimum_recommended_score > 100) return fail()
  if (!c.weights || Object.keys(c.weights).length !== COMPONENTS.length || COMPONENTS.some(key => typeof c.weights?.[key] !== 'number' || !Number.isFinite(c.weights[key]) || c.weights[key] < 0)) return fail()
  // Decimal arithmetic via scaled integers; at most 4 decimal places per weight.
  if (COMPONENTS.some(key => Math.abs(c.weights![key] * 10000 - Math.round(c.weights![key] * 10000)) > 1e-7) || COMPONENTS.reduce((sum, key) => sum + Math.round(c.weights![key] * 10000), 0) !== 1000000) return fail()
  if (!c.rules || Object.keys(c.rules).length !== 2 || typeof c.rules.requiredSkillsAreHardConstraint !== 'boolean' || typeof c.rules.semanticEnabled !== 'boolean') return fail()
  return { algorithm_version: c.algorithm_version, minimum_recommended_score: c.minimum_recommended_score, weights: { ...c.weights }, rules: { ...c.rules } }
}
export function constraints(student: Student, position: Position, config: Configuration): Blocker[] {
  const blockers: Blocker[] = []
  const required = position.programs.filter(program => program.is_required)
  if (required.length && !required.some(program => program.academic_program_id === student.academic_program_id)) blockers.push({ code: 'ACADEMIC_PROGRAM_REQUIRED' })
  const skills = new Set(student.skills.map(skill => skill.skill_id))
  if (config.rules.requiredSkillsAreHardConstraint) for (const skill of position.skills) if (skill.is_required && !skills.has(skill.skill_id)) blockers.push({ code: 'REQUIRED_SKILL_MISSING', skill_id: skill.skill_id })
  return blockers
}
function join(values: (string | null | undefined)[]) { return values.filter(Boolean).join(' ') }
export function positionText(position: Position) {
  return join([position.project.name, position.project.summary, position.project.description, position.title, position.description, ...position.requirements.flatMap(r => [r.label, r.description]), ...position.skills.map(s => s.name)])
}
export function experienceText(student: Student) { return join(student.experiences.flatMap(e => [e.title, e.organization_name, e.description])) }
export function interestsText(student: Student) { return join(student.interests.flatMap(i => [i.label, i.description])) }
export function preferenceText(student: Student) { return join([student.desired_work_description, student.bio]) }
/** Explicit professional whitelist. No documents, identifiers, identity or geography. */
export function studentSemanticText(student: Student) { return join([preferenceText(student), experienceText(student), interestsText(student), ...student.skills.flatMap(s => [s.name, s.evidence_text])]) }
export function locationScore(student: Student, municipality: string | null): number | null {
  if (!municipality) return null
  const preferred = student.preferences.find(p => p.municipality_id === municipality)
  if (preferred) return Math.max(50, 100 - 10 * (preferred.preference_order - 1))
  if (student.current_municipality_id === municipality) return 70
  if (student.origin_municipality_id === municipality) return 60
  return student.current_municipality_id || student.origin_municipality_id || student.preferences.length ? 40 : null
}
export function calculatePair(student: Student, position: Position, config: Configuration, semantic: number | null = null): PairResult {
  const blockers = constraints(student, position, config)
  const owned = new Set(student.skills.map(s => s.skill_id))
  const matched = position.skills.filter(s => owned.has(s.skill_id))
  const requestedWeight = position.skills.reduce((sum, s) => sum + (s.is_required ? 2 : 1), 0)
  const target = positionText(position)
  const raw: Record<Component, number | null> = {
    academic: position.programs.length ? (position.programs.some(p => p.academic_program_id === student.academic_program_id) ? 100 : 0) : null,
    skills: requestedWeight ? 100 * matched.reduce((sum, s) => sum + (s.is_required ? 2 : 1), 0) / requestedWeight : null,
    experience: textScore(experienceText(student), target), interests: textScore(interestsText(student), target),
    location: locationScore(student, position.project.municipality_id), preference: textScore(preferenceText(student), target),
    semantic: config.rules.semanticEnabled && semantic !== null && Number.isFinite(semantic) && semantic >= 0 && semantic <= 100 ? semantic : null,
  }
  const availableWeight = COMPONENTS.reduce((sum, key) => sum + (raw[key] !== null ? config.weights[key] : 0), 0)
  const component_scores = Object.fromEntries(COMPONENTS.map(key => [key, { raw_score: raw[key], configured_weight: config.weights[key], effective_weight: raw[key] !== null && availableWeight ? config.weights[key] * 100 / availableWeight : 0, available: raw[key] !== null }])) as Record<Component, ComponentScore>
  const total = COMPONENTS.reduce((sum, key) => sum + (raw[key] ?? 0) * component_scores[key].effective_weight / 100, 0)
  const total_score = blockers.length ? null : Math.round(Math.min(100, Math.max(0, total)) * 100) / 100
  const recommendations: Recommendation[] = []
  for (const skill of position.skills) if (skill.is_required && !owned.has(skill.skill_id)) recommendations.push({ code: 'REQUIRED_SKILL_MISSING', component: 'skills', skill_id: skill.skill_id, message: `Falta la habilidad requerida: ${skill.name}.` })
  if (blockers.some(b => b.code === 'ACADEMIC_PROGRAM_REQUIRED')) recommendations.push({ code: 'ACADEMIC_PROGRAM_REQUIRED', component: 'academic', message: 'Revisar una plaza compatible con el programa requerido.' })
  for (const key of ['skills', 'experience', 'interests'] as const) if (raw[key] !== null && raw[key] < 50) recommendations.push({ code: 'LOW_' + key.toUpperCase(), component: key, message: `Poca coincidencia en ${key === 'skills' ? 'habilidades solicitadas' : key === 'experience' ? 'experiencia declarada' : 'intereses declarados'}.` })
  if (raw.location !== null && !student.preferences.some(p => p.municipality_id === position.project.municipality_id)) recommendations.push({ code: 'OUTSIDE_LOCATION_PREFERENCES', component: 'location', message: 'El proyecto está fuera de las preferencias territoriales declaradas; no es una prohibición.' })
  if (!availableWeight) recommendations.push({ code: 'NO_WEIGHTED_EVIDENCE', message: 'No hay evidencia disponible con peso positivo; revisar la configuración y los perfiles.' })
  recommendations.push({ code: total_score !== null && total_score >= config.minimum_recommended_score ? 'RECOMMENDED' : 'BELOW_THRESHOLD_OR_BLOCKED', message: `Umbral de esta ejecución: ${config.minimum_recommended_score}.` })
  const strengths = COMPONENTS.filter(key => raw[key] !== null && raw[key] >= 75).sort((a, b) => component_scores[b].effective_weight - component_scores[a].effective_weight || COMPONENTS.indexOf(a) - COMPONENTS.indexOf(b)).slice(0, 3)
  const gaps = COMPONENTS.filter(key => raw[key] !== null && raw[key] < 50)
  const explanation = [
    blockers.length ? 'Compatibilidad calculada: pareja bloqueada por restricciones obligatorias.' : `Compatibilidad calculada: ${total_score}/100.`,
    raw.academic === null ? 'Programa: no disponible.' : raw.academic === 100 ? 'El programa aparece entre los programas asociados.' : 'El programa no coincide.',
    `Habilidades solicitadas coincidentes: ${matched.length}/${position.skills.length}.`,
    raw.location === null ? 'Territorio: no disponible.' : `Compatibilidad territorial: ${raw.location}/100${student.preferences.find(p => p.municipality_id === position.project.municipality_id) ? ` (preferencia ${student.preferences.find(p => p.municipality_id === position.project.municipality_id)!.preference_order})` : ''}.`,
    `Componentes fuertes: ${strengths.join(', ') || 'sin evidencia suficiente'}.`, `Brechas: ${gaps.join(', ') || 'sin coincidencias bajas disponibles'}.`,
    raw.semantic === null ? 'Semántica no disponible; pesos renormalizados.' : 'Semántica disponible mediante embeddings.',
    !availableWeight ? 'Sin componentes disponibles con peso positivo: total 0, pesos efectivos 0.' : '',
  ].filter(Boolean).join(' ')
  return { student_id: student.id, project_position_id: position.id, is_eligible: !blockers.length, total_score, component_scores, blockers, recommendations, explanation }
}
