import { solveAssignments } from '../../src/features/optimizer/solveAssignments.ts'
const students = Array.from({ length: 400 }, (_, i) => ({ id: `s${i}`, label: `s${i}`, periodId: 'p', active: true, eligible: true }))
const positions = Array.from({ length: 120 }, (_, i) => ({ id: `p${i}`, label: `p${i}`, periodId: 'p', projectId: `j${i}`, projectName: `j${i}`, organizationId: 'o', organizationName: 'o', capacity: 4, active: true, approved: true, validated: true }))
const candidates = students.flatMap((s, i) => positions.map((p, j) => ({ id: `${s.id}-${p.id}`, studentId: s.id, positionId: p.id, runId: 'r', score: 70 + ((i * 17 + j * 29) % 3001) / 100, eligible: true, currentEligible: true, blockers: [] })))
const snapshot = { periodId: 'p', revision: 'benchmark', students, positions, candidates, existing: [], run: { id: 'r', periodId: 'p', status: 'completed', threshold: 70, configurationId: 'c', snapshot: {} } }
const start = performance.now(); const result = solveAssignments(snapshot)
console.log(JSON.stringify({ students: students.length, positions: positions.length, candidateEdges: candidates.length, assigned: result.rows.length, totalScore: result.totalScore, elapsedMs: Number((performance.now() - start).toFixed(1)) }))
if (result.rows.length !== 400 || positions.some(p => result.rows.filter(r => r.positionId === p.id).length > p.capacity)) throw new Error('Invalid benchmark result')
