/**
 * Generates golden parity fixtures FROM the authoritative TypeScript implementations.
 *   node matching_engine/parity/generate_golden.ts      (Node >= 22.18, type stripping)
 * Output: matching_engine/parity/golden_hybrid_v01.json and golden_p6c.json.
 * Python tests (tests/test_parity_*.py) and the vitest guard (src/features/matching/pyr-parity.test.ts)
 * both verify these files, so a silent change on either side fails CI.
 * All data is synthetic (ids s*, p*, m*); no institutional records.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALGORITHM_VERSION, calculatePair } from '../../supabase/functions/_shared/matching/engine.ts'
import type { Configuration, Position, Student } from '../../supabase/functions/_shared/matching/engine.ts'
import { solveAssignments } from '../../src/features/optimizer/solveAssignments.ts'
import { pool } from '../../src/features/assignments/test-fixtures.ts'

const here = dirname(fileURLToPath(import.meta.url))
let seed = 20261112
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!
const vocab = ['desarrollo', 'comunitario', 'agua', 'suelo', 'educación', 'niñez', 'software', 'datos', 'salud', 'pública', 'contabilidad', 'gestión', 'ambiental', 'paz', 'territorio', 'jóvenes', 'campesinos', 'cartografía', 'diseño', 'comunicación', 'Ingeniería', 'ÁRBOL', 'the', 'y', 'la', '2026']
const phrase = (n: number) => rnd() < 0.15 ? null : Array.from({ length: n }, () => pick(vocab)).join(' ')
const programs = ['prog-a', 'prog-b', 'prog-c']
const munis = ['m1', 'm2', 'm3', 'm4']

function student(i: number): Student {
  return {
    id: `s${i}`, academic_program_id: rnd() < 0.1 ? null : pick(programs), bio: phrase(4), desired_work_description: phrase(5),
    current_municipality_id: rnd() < 0.3 ? null : pick(munis), origin_municipality_id: rnd() < 0.5 ? null : pick(munis),
    experiences: Array.from({ length: Math.floor(rnd() * 3) }, () => ({ title: phrase(2) ?? 'x', organization_name: phrase(1), description: phrase(6) })),
    interests: Array.from({ length: Math.floor(rnd() * 3) }, () => ({ label: phrase(1) ?? 'y', description: phrase(3) })),
    skills: Array.from({ length: Math.floor(rnd() * 4) }, (_, k) => ({ skill_id: `k${Math.floor(rnd() * 6)}${k === 9 ? '' : ''}`, name: pick(vocab), evidence_text: phrase(3) }))
      .filter((s, idx, all) => all.findIndex(o => o.skill_id === s.skill_id) === idx),
    preferences: munis.filter(() => rnd() < 0.3).map((m, k) => ({ municipality_id: m, preference_order: k + 1 + Math.floor(rnd() * 3) })),
  }
}
function position(i: number): Position {
  return {
    id: `p${i}`, title: phrase(3) ?? 'Plaza', description: phrase(8),
    project: { name: phrase(3) ?? 'Proyecto', summary: phrase(5), description: phrase(10), municipality_id: rnd() < 0.15 ? null : pick(munis) },
    programs: programs.filter(() => rnd() < 0.4).map(p => ({ academic_program_id: p, is_required: rnd() < 0.4 })),
    skills: Array.from({ length: Math.floor(rnd() * 3) }, () => ({ skill_id: `k${Math.floor(rnd() * 6)}`, name: pick(vocab), is_required: rnd() < 0.5 }))
      .filter((s, idx, all) => all.findIndex(o => o.skill_id === s.skill_id) === idx),
    requirements: Array.from({ length: Math.floor(rnd() * 2) }, () => ({ label: phrase(2) ?? 'req', description: phrase(4) })),
  }
}
const configs: Configuration[] = [
  { algorithm_version: ALGORITHM_VERSION, minimum_recommended_score: 70, weights: { academic: 25, skills: 20, experience: 10, interests: 10, location: 10, preference: 10, semantic: 15 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: true } },
  { algorithm_version: ALGORITHM_VERSION, minimum_recommended_score: 55.5, weights: { academic: 40, skills: 0, experience: 12.5, interests: 12.5, location: 5, preference: 30, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: false, semanticEnabled: false } },
]
const cases = []
for (let i = 0; i < 160; i++) {
  const s = student(i); const p = position(i); const config = configs[i % 2]!
  const semantic = rnd() < 0.3 ? null : Math.round(rnd() * 10000) / 100
  cases.push({ student: s, position: p, config, semantic, expected: calculatePair(s, p, config, semantic) })
}
writeFileSync(join(here, 'golden_hybrid_v01.json'), JSON.stringify({ generator: 'parity/generate_golden.ts', source: 'supabase/functions/_shared/matching/engine.ts', algorithm_version: ALGORITHM_VERSION, cases }, null, 1) + '\n')

const solverCases = []
for (let trial = 0; trial < 60; trial++) {
  const rows = 2 + Math.floor(rnd() * 5); const cols = 1 + Math.floor(rnd() * 4)
  const scores = Array.from({ length: rows }, () => Array.from({ length: cols }, () => rnd() < 0.2 ? null : Math.floor(rnd() * 10001) / 100))
  const data = pool(scores, 1 + (trial % 3)); data.run!.threshold = trial % 4 === 0 ? 50 : 0
  const excluded = trial % 5 === 0 && data.candidates.length ? [data.candidates[0]!.id] : []
  if (trial % 7 === 0 && data.students.length > 1) data.existing = [{ id: 'e', studentId: 's1', positionId: 'p0', periodId: 'period', active: true }]
  solverCases.push({ input: data, excluded, expected: solveAssignments(data, excluded) })
}
writeFileSync(join(here, 'golden_p6c.json'), JSON.stringify({ generator: 'parity/generate_golden.ts', source: 'src/features/optimizer/solveAssignments.ts', cases: solverCases }, null, 1) + '\n')
console.info(`golden: ${cases.length} scorer cases, ${solverCases.length} solver cases`)
