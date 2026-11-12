import { describe, expect, it } from 'vitest'
import { calculatePair } from '../../../supabase/functions/_shared/matching/engine'
import type { Configuration, Position, Student } from '../../../supabase/functions/_shared/matching/engine'
import { solveAssignments } from '../optimizer/solveAssignments'
import type { AssignmentSnapshot } from '../assignments/types'

/**
 * Guard for the standalone Python engine (matching_engine/). The golden files were generated from these
 * TypeScript implementations; the Python port is tested against the same files. If either side changes
 * semantics, one of the two suites fails – avoiding two silently divergent business-rule implementations.
 * Regenerate deliberately with: node matching_engine/parity/generate_golden.ts
 */
type ScorerCase = { student: Student; position: Position; config: Configuration; semantic: number | null; expected: unknown }
type SolverCase = { input: AssignmentSnapshot; excluded: string[]; expected: unknown }
const files = import.meta.glob('../../../matching_engine/parity/golden_*.json', { eager: true, import: 'default' })
const cases = <T>(name: string) => (files[`../../../matching_engine/parity/${name}`] as { cases: T[] }).cases

describe('PyR standalone engine parity guard', () => {
  it('hybrid-v0.1 golden cases still match the TypeScript scorer', () => {
    const all = cases<ScorerCase>('golden_hybrid_v01.json')
    expect(all.length).toBe(160)
    for (const c of all) expect(calculatePair(c.student, c.position, c.config, c.semantic)).toEqual(c.expected)
  })
  it('P6-C golden cases still match the TypeScript optimizer', () => {
    const all = cases<SolverCase>('golden_p6c.json')
    expect(all.length).toBe(60)
    for (const c of all) expect(solveAssignments(c.input, c.excluded)).toEqual(c.expected)
  })
})
