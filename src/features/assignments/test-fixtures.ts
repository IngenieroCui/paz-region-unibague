import type { AssignmentSnapshot } from './types.ts'
export function pool(scores: (number | null)[][], capacity = 1): AssignmentSnapshot {
  const count = Math.max(0, ...scores.map(row => row.length))
  return { periodId: 'period', revision: 'draft', run: { id: 'run', periodId: 'period', status: 'completed', threshold: 70, configurationId: 'config', snapshot: {} },
    students: scores.map((_, i) => ({ id: `s${i}`, label: `Estudiante ${i}`, active: true, eligible: true, periodId: 'period' })),
    positions: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, label: `Plaza ${i}`, projectId: `project${i}`, projectName: `Proyecto ${i}`, organizationId: 'org', organizationName: 'Organización', active: true, approved: true, validated: true, capacity, periodId: 'period' })),
    candidates: scores.flatMap((row, s) => row.flatMap((score, p) => score === null ? [] : [{ id: `c${s}-${p}`, runId: 'run', studentId: `s${s}`, positionId: `p${p}`, score, eligible: true, currentEligible: true, blockers: [] }])), existing: [] }
}
