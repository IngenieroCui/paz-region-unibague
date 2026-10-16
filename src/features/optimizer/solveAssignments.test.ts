import { describe, expect, it } from 'vitest'
import { solveAssignments } from './solveAssignments'
import { pool } from '../assignments/test-fixtures'

describe('capacitated global optimization', () => {
  it('finds Juan→B 92 and Carlos→A 94, total 186 instead of greedy 167', () => {
    const proposal = solveAssignments(pool([[95, 92], [94, 72]]))
    expect(proposal.rows.map(r => [r.studentId, r.positionId])).toEqual([['s0', 'p1'], ['s1', 'p0']]); expect(proposal.totalScore).toBe(186)
  })
  it('prioritizes cardinality before total compatibility', () => {
    const data = pool([[100, 1], [1, null]]); data.run!.threshold = 0
    expect(solveAssignments(data).rows).toHaveLength(2); expect(solveAssignments(data).totalScore).toBe(2)
  })
  it('capacity one is never exceeded', () => { const p = solveAssignments(pool([[95], [94], [93]])); expect(p.rows).toHaveLength(1); expect(p.rows[0]!.studentId).toBe('s0'); expect(p.available.p0).toBe(0) })
  it('supports multiple slots on one position', () => { const p = solveAssignments(pool([[95], [94], [93]], 2)); expect(p.rows).toHaveLength(2); expect(p.totalScore).toBe(189) })
  it('reports students without candidates', () => { const p = solveAssignments(pool([[95], []])); expect(p.unassigned).toEqual([{ studentId: 's1', reasons: ['Sin candidatos en la ejecución'] }]) })
  it('excludes below threshold and includes exact threshold', () => { const p = solveAssignments(pool([[69.99], [70]])); expect(p.rows[0]!.score).toBe(70); expect(p.unassigned[0]!.reasons).toContain('Score debajo del umbral histórico') })
  it('blockers and malformed blockers fail closed', () => {
    for (const blockers of [[{ code: 'BLOCKED' }], {}, null]) { const data = pool([[100]]); data.candidates[0]!.blockers = blockers; expect(solveAssignments(data).rows).toHaveLength(0) }
  })
  it('excludes historical candidates that fail current hard constraints', () => { const data = pool([[99]]); data.candidates[0]!.currentEligible = false; expect(solveAssignments(data).rows).toHaveLength(0) })
  it('ineligible, null, NaN, infinite and non-P5-precision scores fail closed', () => {
    for (const score of [null, NaN, Infinity, -1, 101, 99.999]) { const data = pool([[100]]); data.candidates[0]!.score = score; expect(solveAssignments(data).rows).toHaveLength(0) }
    const data = pool([[100]]); data.candidates[0]!.eligible = false; expect(solveAssignments(data).rows).toHaveLength(0)
  })
  it('tie result is identifier-stable regardless of input order', () => {
    const data = pool([[90, 90], [90, 90]]); const p = solveAssignments(data)
    for (let i = 0; i < 5; i++) { data.students.reverse(); data.positions.reverse(); data.candidates.reverse(); expect(solveAssignments(data)).toEqual(p) }
  })
  it('never proposes a previously assigned student', () => { const data = pool([[99, 98], [97, 96]]); data.existing = [{ id: 'old', studentId: 's0', positionId: 'p0', periodId: 'period', active: true }]; const p = solveAssignments(data); expect(p.rows.map(r => r.studentId)).toEqual(['s1']); expect(p.rows[0]!.positionId).toBe('p1') })
  it('counts occupied slots, including students outside the current candidate pool', () => { const data = pool([[99, 98]]); data.existing = [{ id: 'old', studentId: 'other', positionId: 'p0', periodId: 'period', active: true }]; expect(solveAssignments(data).rows[0]!.positionId).toBe('p1') })
  it('does not mix periods', () => {
    const data = pool([[99, 98], [97, 96]]); data.positions[0]!.periodId = 'different'; data.students[1]!.periodId = 'different'
    const p = solveAssignments(data); expect(p.rows.map(r => [r.studentId, r.positionId])).toEqual([['s0', 'p1']])
  })
  it('manual reassignment occupies its destination and frees the previous slot', () => {
    const data = pool([[99, 98], [97, 96]]); data.existing = [{ id: 'closed', studentId: 's0', positionId: 'p0', periodId: 'period', active: false }, { id: 'manual', studentId: 's0', positionId: 'p1', periodId: 'period', active: true }]
    expect(solveAssignments(data).rows.map(r => [r.studentId, r.positionId])).toEqual([['s1', 'p0']]); expect(data.existing).toHaveLength(2)
  })
  it('unassignment makes the student and slot available again without deleting history', () => {
    const data = pool([[99]]); data.existing = [{ id: 'closed', studentId: 's0', positionId: 'p0', periodId: 'period', active: false }]
    expect(solveAssignments(data).rows).toHaveLength(1); expect(data.existing).toHaveLength(1)
  })
  it('respects administrator exclusions and recalculates globally', () => { const p = solveAssignments(pool([[95, 92], [94, 72]]), ['c0-1']); expect(p.totalScore).toBe(167) })
  it('inactive/unapproved/unvalidated positions and ineligible students never enter automatic assignment', () => {
    for (const field of ['active', 'approved', 'validated'] as const) { const data = pool([[99]]); data.positions[0]![field] = false; expect(solveAssignments(data).rows).toHaveLength(0) }
    for (const field of ['active', 'eligible'] as const) { const data = pool([[99]]); data.students[0]![field] = false; expect(solveAssignments(data).rows).toHaveLength(0) }
  })
  it('rejects failed/running/wrong-period runs and unavailable snapshot thresholds', () => {
    for (const status of ['failed', 'running']) { const data = pool([[99]]); data.run!.status = status; expect(() => solveAssignments(data)).toThrow() }
    const data = pool([[99]]); data.run!.periodId = 'different'; expect(() => solveAssignments(data)).toThrow()
    data.run!.periodId = 'period'; data.run!.threshold = null; expect(() => solveAssignments(data)).toThrow(/umbral/)
  })
  it('does not mutate input and detects legacy overcapacity', () => {
    const data = pool([[95, 92], [94, 72]]); const before = structuredClone(data); solveAssignments(data); expect(data).toEqual(before)
    data.existing = [0, 1].map(i => ({ id: `a${i}`, studentId: `s${i}`, positionId: 'p0', periodId: 'period', active: true })); expect(() => solveAssignments(data)).toThrow(/excede/)
  })
  it('matches an exhaustive independent oracle on 120 small random graphs', () => {
    let seed = 7; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
    for (let trial = 0; trial < 120; trial++) {
      const scores = Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => random() < .2 ? null : Math.floor(random() * 101)))
      const data = pool(scores, trial % 2 + 1); data.run!.threshold = 0
      let bestCount = -1; let bestScore = -1
      const visit = (s: number, capacity: number[], count: number, score: number) => {
        if (s === scores.length) { if (count > bestCount || (count === bestCount && score > bestScore)) { bestCount = count; bestScore = score }; return }
        visit(s + 1, capacity, count, score)
        for (let p = 0; p < 3; p++) if (capacity[p]! > 0 && scores[s]![p] !== null) { capacity[p]!--; visit(s + 1, capacity, count + 1, score + scores[s]![p]!); capacity[p]!++ }
      }
      visit(0, data.positions.map(p => p.capacity), 0, 0)
      const actual = solveAssignments(data); expect([actual.rows.length, actual.totalScore]).toEqual([bestCount, bestScore])
    }
  })
  it('benchmarks 400 students × 120 positions (48000 candidates), deterministic valid capacities', () => {
    const data = pool(Array.from({ length: 400 }, (_, s) => Array.from({ length: 120 }, (_, p) => 70 + ((s * 17 + p * 29) % 3001) / 100)), 4)
    const start = performance.now(); const actual = solveAssignments(data); const elapsed = performance.now() - start
    console.info(`P6C benchmark: 400 students, 120 positions, 48000 edges, ${actual.rows.length} assigned in ${elapsed.toFixed(1)}ms`)
    expect(actual.rows).toHaveLength(400); expect(new Set(actual.rows.map(r => r.studentId)).size).toBe(400)
    for (const p of data.positions) expect(actual.rows.filter(r => r.positionId === p.id).length).toBeLessThanOrEqual(p.capacity)
    expect(elapsed).toBeLessThan(30000)
  })
})
