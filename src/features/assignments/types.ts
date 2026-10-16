import type { Row } from '../../lib/supabase/feature-helpers.ts'

export type AssignmentRow = Row<'PYRUnibague_Assignments'>
export type AssignmentEvent = Row<'PYRUnibague_AssignmentEvents'>
export type AssignmentStudent = { id: string; label: string; periodId: string; active: boolean; eligible: boolean }
export type AssignmentPosition = { id: string; label: string; projectId: string; projectName: string; organizationId: string; organizationName: string; periodId: string; capacity: number; active: boolean; approved: boolean; validated: boolean }
export type AssignmentCandidate = { id: string; runId: string; studentId: string; positionId: string; eligible: boolean; currentEligible: boolean; score: number | null; blockers: unknown }
export type Occupancy = { id: string; studentId: string; positionId: string; periodId: string; active: boolean }
export type AssignmentRun = { id: string; periodId: string; status: string; threshold: number | null; configurationId: string; snapshot: unknown }
export type AssignmentSnapshot = { periodId: string; run: AssignmentRun | null; students: AssignmentStudent[]; positions: AssignmentPosition[]; candidates: AssignmentCandidate[]; existing: Occupancy[]; revision: string }
export type ProposalRow = { studentId: string; positionId: string; candidateId: string; score: number }
export type Proposal = { rows: ProposalRow[]; unassigned: { studentId: string; reasons: string[] }[]; occupied: Record<string, number>; available: Record<string, number>; totalScore: number; eligibleStudents: number }
export const REASONS = [
  ['INSTITUTIONAL_NEED', 'Necesidad institucional'], ['AUTHORIZED_SPECIAL_CASE', 'Caso especial autorizado'],
  ['CONFLICT_OF_INTEREST', 'Conflicto de interés'], ['COORDINATION_REQUEST', 'Ajuste solicitado por coordinación'],
  ['DATA_CORRECTION', 'Corrección de datos'], ['OTHER', 'Otro con justificación'],
] as const
export type AssignmentAction = { kind: 'confirm' | 'reassign' | 'unassign'; student_id: string; position_id?: string; assignment_id?: string; candidate_id?: string | null; source?: 'MATCHING' | 'MANUAL'; reason_code?: string; reason_text?: string; allow_below_threshold?: boolean; allow_unscored?: boolean }
/** Integration payload only. No client callback performs historical A/B writes. */
export type AssignmentIntegrationContext = { assignmentId: string; studentId: string; positionId: string; projectId: string; organizationId: string; periodId: string; assignedAt: string; actorId: string }
export type AssignmentIntegrationBoundary = {
  resolveOrganizationAdvisor: (context: AssignmentIntegrationContext) => Promise<string | null>
  recordHistoricalResponsibility: (context: AssignmentIntegrationContext, advisorId: string | null) => Promise<void>
  validateProjectGroup: (context: AssignmentIntegrationContext, groupId: string) => Promise<boolean>
}
