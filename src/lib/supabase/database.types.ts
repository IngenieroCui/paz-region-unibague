// Official schema lives in database.generated.ts. PostgreSQL type generation cannot
// infer nullable function arguments/returns or text CHECK constraints. These
// refinements mirror the SQL contracts; tables, relationships and RPCs stay generated.
import type { Database as Generated } from './database.generated.ts'
export type { Json } from './database.generated.ts'

type Refine<T, Values> = { [K in keyof T]: K extends keyof Values ? Values[K] : T[K] }
type Table<T extends { Row: object; Insert: object; Update: object }, Values> =
  Omit<T, 'Row' | 'Insert' | 'Update'> & {
    Row: Refine<T['Row'], Values>
    Insert: Refine<T['Insert'], Values>
    Update: Refine<T['Update'], Values>
  }
type Tables = Generated['public']['Tables']
type Functions = Generated['public']['Functions']
type NullableArguments = {
  pyr_unibague_admin_students: 'p_program' | 'p_period' | 'p_eligible' | 'p_active' | 'p_status' | 'p_semester'
  pyr_unibague_review_organization: 'p_notes'
  pyr_unibague_change_organization_advisor: 'p_advisor_id'
  pyr_unibague_change_student_advisor: 'p_advisor_id' | 'p_reason' | 'p_source_assignment_id'
  pyr_unibague_assignment_snapshot: 'p_run_id'
  pyr_unibague_confirm_assignment: 'p_run_id'
  pyr_unibague_confirm_assignment_batch: 'p_run_id'
  pyr_unibague_reassign_assignment: 'p_run_id'
  pyr_unibague_unassign_assignment: 'p_run_id'
  pyr_unibague_operational_export: 'p_after_id'
  pyr_unibague_save_organization_contact: 'p_id' | 'p_position_title' | 'p_email' | 'p_phone' | 'p_user_id'
  pyr_unibague_register_organization: 'p_display_name' | 'p_tax_id' | 'p_description' | 'p_website' | 'p_organization_type_id' | 'p_municipality_id'
}
type Rpc<N extends keyof Functions> = Omit<Functions[N], 'Args' | 'Returns'> & {
  Args: { [A in keyof Functions[N]['Args']]: Functions[N]['Args'][A] |
    (N extends keyof NullableArguments ? A extends NullableArguments[N] ? null : never : never) }
  Returns: Functions[N]['Returns'] |
    (N extends 'pyr_unibague_change_organization_advisor' | 'pyr_unibague_change_student_advisor' ? null : never)
}
export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Tables' | 'Functions'> & {
    Tables: Omit<Tables, 'PYRUnibague_Projects' | 'PYRUnibague_Calls' | 'PYRUnibague_Groups' | 'PYRUnibague_GroupMembers'> & {
      PYRUnibague_Projects: Table<Tables['PYRUnibague_Projects'], { zone_type: 'rural' | 'urban' | null }>
      PYRUnibague_Calls: Table<Tables['PYRUnibague_Calls'], { status: 'draft' | 'submitted' | 'changes_required' | 'open' | 'closed' }>
      PYRUnibague_Groups: Table<Tables['PYRUnibague_Groups'], { status: 'active' | 'closed' }>
      PYRUnibague_GroupMembers: Table<Tables['PYRUnibague_GroupMembers'], { status: 'active' | 'inactive' }>
    }
    Functions: { [N in keyof Functions]: Rpc<N> }
  }
}
