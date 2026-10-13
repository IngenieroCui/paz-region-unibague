export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      PYRUnibague_AcademicPeriods: {
        Row: {
          code: string
          created_at: string
          ends_on: string | null
          id: string
          is_current: boolean
          name: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          name: string
          starts_on?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          name?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      PYRUnibague_AcademicPrograms: {
        Row: {
          active: boolean
          code: string
          created_at: string
          faculty_name: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          faculty_name?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          faculty_name?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      PYRUnibague_AdvisorOrganizationAssignments: {
        Row: {
          academic_period_id: string
          advisor_id: string
          assigned_by: string | null
          created_at: string
          ends_on: string | null
          id: string
          is_current: boolean
          organization_id: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          academic_period_id: string
          advisor_id: string
          assigned_by?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          organization_id: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string
          advisor_id?: string
          assigned_by?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          organization_id?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_AdvisorOrganizationAssignments_academic_period_id"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_AdvisorOrganizationAssignments_advisor_id"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_StaffProfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_AdvisorOrganizationAssignments_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_AdvisorStudentAssignments: {
        Row: {
          advisor_id: string
          created_at: string
          ends_on: string | null
          id: string
          is_current: boolean
          participation_id: string
          reason: string | null
          source_assignment_id: string | null
          starts_on: string
          updated_at: string
        }
        Insert: {
          advisor_id: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          participation_id: string
          reason?: string | null
          source_assignment_id?: string | null
          starts_on: string
          updated_at?: string
        }
        Update: {
          advisor_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          participation_id?: string
          reason?: string | null
          source_assignment_id?: string | null
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_AdvisorStudentAssignments_advisor_id"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_StaffProfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_AdvisorStudentAssignments_participation_id"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_StudentPeriodParticipations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_AdvisorStudentAssignments_source_assignment_id"
            columns: ["source_assignment_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_AssignmentEvents: {
        Row: {
          actor_user_id: string | null
          assignment_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          reason_code: string | null
          reason_text: string | null
        }
        Insert: {
          actor_user_id?: string | null
          assignment_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          reason_code?: string | null
          reason_text?: string | null
        }
        Update: {
          actor_user_id?: string | null
          assignment_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          reason_code?: string | null
          reason_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_AssignmentEvents_assignment_id"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Assignments: {
        Row: {
          academic_period_id: string
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          is_active: boolean
          match_candidate_id: string | null
          notes: string | null
          project_position_id: string
          source: string
          status: string
          student_id: string
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          academic_period_id: string
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          match_candidate_id?: string | null
          notes?: string | null
          project_position_id: string
          source: string
          status: string
          student_id: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          academic_period_id?: string
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          match_candidate_id?: string | null
          notes?: string | null
          project_position_id?: string
          source?: string
          status?: string
          student_id?: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_Assignments_match_candidate_id"
            columns: ["match_candidate_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_MatchCandidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_MatchCandidates_project_position_id"
            columns: ["project_position_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_ProjectPositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_academic_period_id"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_AuditLogs: {
        Row: {
          action: string
          actor_user_id: string | null
          changed_fields: string[]
          context: Json
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          changed_fields?: string[]
          context?: Json
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          changed_fields?: string[]
          context?: Json
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
        }
        Relationships: []
      }
      PYRUnibague_CallPositions: {
        Row: {
          call_id: string
          created_at: string
          id: string
          project_position_id: string
          updated_at: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          project_position_id: string
          updated_at?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          project_position_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "PYRUnibague_CallPositions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PYRUnibague_CallPositions_project_position_id_fkey"
            columns: ["project_position_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_ProjectPositions"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Calls: {
        Row: {
          academic_period_id: string
          closes_at: string | null
          created_at: string
          details: string | null
          id: string
          opens_at: string | null
          organization_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          academic_period_id: string
          closes_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          opens_at?: string | null
          organization_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string
          closes_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          opens_at?: string | null
          organization_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "PYRUnibague_Calls_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PYRUnibague_Calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_FeatureFlags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      PYRUnibague_GroupMembers: {
        Row: {
          assignment_id: string
          created_at: string
          group_id: string
          id: string
          joined_on: string | null
          left_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          group_id: string
          id?: string
          joined_on?: string | null
          left_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          group_id?: string
          id?: string
          joined_on?: string | null
          left_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "PYRUnibague_GroupMembers_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PYRUnibague_GroupMembers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Groups"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Groups: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          started_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "PYRUnibague_Groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_MatchCandidates: {
        Row: {
          blockers: Json
          component_scores: Json
          created_at: string
          explanation: string | null
          id: string
          is_eligible: boolean
          matching_run_id: string
          project_position_id: string
          recommendations: Json
          student_id: string
          total_score: number | null
        }
        Insert: {
          blockers?: Json
          component_scores?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          is_eligible: boolean
          matching_run_id: string
          project_position_id: string
          recommendations?: Json
          student_id: string
          total_score?: number | null
        }
        Update: {
          blockers?: Json
          component_scores?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          is_eligible?: boolean
          matching_run_id?: string
          project_position_id?: string
          recommendations?: Json
          student_id?: string
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_MatchCandidates_matching_run_id"
            columns: ["matching_run_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_MatchingRuns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_MatchCandidates_project_position_id"
            columns: ["project_position_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_ProjectPositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_MatchingConfigurations: {
        Row: {
          academic_period_id: string | null
          algorithm_version: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          minimum_recommended_score: number | null
          name: string
          rules: Json
          updated_at: string
          weights: Json
        }
        Insert: {
          academic_period_id?: string | null
          algorithm_version: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          minimum_recommended_score?: number | null
          name: string
          rules?: Json
          updated_at?: string
          weights?: Json
        }
        Update: {
          academic_period_id?: string | null
          algorithm_version?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          minimum_recommended_score?: number | null
          name?: string
          rules?: Json
          updated_at?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_MatchingConfigurations_academic_period_id"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_MatchingRuns: {
        Row: {
          academic_period_id: string
          completed_at: string | null
          created_at: string
          id: string
          matching_configuration_id: string
          started_at: string | null
          started_by: string | null
          status: string
          summary: Json
        }
        Insert: {
          academic_period_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          matching_configuration_id: string
          started_at?: string | null
          started_by?: string | null
          status: string
          summary?: Json
        }
        Update: {
          academic_period_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          matching_configuration_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_MatchingRuns_matching_configuration_id"
            columns: ["matching_configuration_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_MatchingConfigurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_academic_period_id"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Municipalities: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          department_code: string
          department_name: string
          id: string
          municipality_code: string
          municipality_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country_code?: string
          created_at?: string
          department_code: string
          department_name: string
          id?: string
          municipality_code: string
          municipality_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          department_code?: string
          department_name?: string
          id?: string
          municipality_code?: string
          municipality_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      PYRUnibague_Notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link_path: string | null
          read_at: string | null
          title: string
          type_code: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link_path?: string | null
          read_at?: string | null
          title: string
          type_code: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link_path?: string | null
          read_at?: string | null
          title?: string
          type_code?: string
          user_id?: string
        }
        Relationships: []
      }
      PYRUnibague_OrganizationContacts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          organization_id: string
          phone: string | null
          position_title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          organization_id: string
          phone?: string | null
          position_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          phone?: string | null
          position_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_OrganizationContacts_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_OrganizationDocuments: {
        Row: {
          bucket_id: string
          category_code: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          object_path: string
          organization_id: string
          size_bytes: number | null
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket_id: string
          category_code: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          object_path: string
          organization_id: string
          size_bytes?: number | null
          status: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket_id?: string
          category_code?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          object_path?: string
          organization_id?: string
          size_bytes?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_OrganizationDocuments_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_OrganizationMembers: {
        Row: {
          can_manage: boolean
          created_at: string
          id: string
          is_primary_contact: boolean
          membership_role: string
          organization_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage?: boolean
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          membership_role: string
          organization_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage?: boolean
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          membership_role?: string
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_OrganizationMembers_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_OrganizationReviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          organization_id: string
          reviewer_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          organization_id: string
          reviewer_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          organization_id?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_OrganizationMembers_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Organizations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string | null
          id: string
          legal_name: string
          municipality_id: string | null
          organization_type_id: string | null
          status: string
          tax_id: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          legal_name: string
          municipality_id?: string | null
          organization_type_id?: string | null
          status: string
          tax_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          legal_name?: string
          municipality_id?: string | null
          organization_type_id?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_Organizations_municipality_id"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_Organizations_organization_type_id"
            columns: ["organization_type_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_OrganizationTypes"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_OrganizationTypes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      PYRUnibague_ProjectInterlocutors: {
        Row: {
          created_at: string
          id: string
          is_primary_for_project: boolean
          notes: string | null
          organization_contact_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary_for_project?: boolean
          notes?: string | null
          organization_contact_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary_for_project?: boolean
          notes?: string | null
          organization_contact_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_ProjectInterlocutors_organization_contact_id"
            columns: ["organization_contact_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_OrganizationContacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_ProjectInterlocutors_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_ProjectParticipatingOrganizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          participation_note: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          participation_note?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          participation_note?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_ProjectParticipatingOrganizations_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_ProjectParticipatingOrganizations_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_ProjectPositionPrograms: {
        Row: {
          academic_program_id: string
          created_at: string
          id: string
          is_required: boolean
          project_position_id: string
          updated_at: string
        }
        Insert: {
          academic_program_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          project_position_id: string
          updated_at?: string
        }
        Update: {
          academic_program_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          project_position_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_ProjectPositionPrograms_project_position_id"
            columns: ["project_position_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_ProjectPositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_Students_academic_program_id"
            columns: ["academic_program_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPrograms"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_ProjectPositions: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          project_id: string
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_ProjectPositions_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_ProjectPositionSkills: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          project_position_id: string
          skill_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          project_position_id: string
          skill_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          project_position_id?: string
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_ProjectPositionPrograms_project_position_id"
            columns: ["project_position_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_ProjectPositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentSkills_skill_id"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Skills"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_ProjectRequirements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_mandatory: boolean
          label: string
          project_position_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          label: string
          project_position_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          label?: string
          project_position_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_ProjectPositionPrograms_project_position_id"
            columns: ["project_position_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_ProjectPositions"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Projects: {
        Row: {
          academic_period_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          modality: string | null
          municipality_id: string | null
          name: string
          organization_id: string
          status: string
          summary: string | null
          updated_at: string
          zone_type: string | null
        }
        Insert: {
          academic_period_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          modality?: string | null
          municipality_id?: string | null
          name: string
          organization_id: string
          status: string
          summary?: string | null
          updated_at?: string
          zone_type?: string | null
        }
        Update: {
          academic_period_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          modality?: string | null
          municipality_id?: string | null
          name?: string
          organization_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_OrganizationMembers_organization_id"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_Organizations_municipality_id"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_academic_period_id"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_ProjectTechnicalTeachers: {
        Row: {
          created_at: string
          id: string
          project_id: string
          responsibility: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          responsibility?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          responsibility?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_ProjectTechnicalTeachers_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_ProjectTechnicalTeachers_teacher_id"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_StaffProfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      PYRUnibague_Skills: {
        Row: {
          active: boolean
          aliases: string[]
          category: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          category?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      PYRUnibague_StaffProfiles: {
        Row: {
          academic_unit: string | null
          created_at: string
          id: string
          phone: string | null
          staff_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_unit?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          staff_code?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_unit?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          staff_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      PYRUnibague_StudentDocuments: {
        Row: {
          bucket_id: string
          category_code: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          object_path: string
          size_bytes: number | null
          status: string
          student_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket_id: string
          category_code: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          object_path: string
          size_bytes?: number | null
          status: string
          student_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket_id?: string
          category_code?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          object_path?: string
          size_bytes?: number | null
          status?: string
          student_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_StudentExperiences_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_StudentExperiences: {
        Row: {
          created_at: string
          description: string | null
          ended_on: string | null
          id: string
          is_current: boolean
          organization_name: string | null
          started_on: string | null
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_on?: string | null
          id?: string
          is_current?: boolean
          organization_name?: string | null
          started_on?: string | null
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_on?: string | null
          id?: string
          is_current?: boolean
          organization_name?: string | null
          started_on?: string | null
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_StudentExperiences_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_StudentInterests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          sort_order: number
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          sort_order?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_StudentExperiences_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_StudentLocationPreferences: {
        Row: {
          created_at: string
          id: string
          municipality_id: string
          preference_order: number
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipality_id: string
          preference_order: number
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          municipality_id?: string
          preference_order?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_StudentExperiences_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentLocationPreferences_municipality_id"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_StudentPeriodParticipations: {
        Row: {
          academic_period_id: string
          arl_provider_name: string | null
          created_at: string
          eligible_for_matching: boolean
          id: string
          profile_completed_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_period_id: string
          arl_provider_name?: string | null
          created_at?: string
          eligible_for_matching?: boolean
          id?: string
          profile_completed_at?: string | null
          status: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string
          arl_provider_name?: string | null
          created_at?: string
          eligible_for_matching?: boolean
          id?: string
          profile_completed_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_academic_period_id"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPeriods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentPeriodParticipations_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_Students: {
        Row: {
          academic_program_id: string | null
          bio: string | null
          created_at: string
          current_municipality_id: string | null
          current_semester: number | null
          desired_work_description: string | null
          id: string
          is_active: boolean
          origin_municipality_id: string | null
          profile_links: Json
          student_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_program_id?: string | null
          bio?: string | null
          created_at?: string
          current_municipality_id?: string | null
          current_semester?: number | null
          desired_work_description?: string | null
          id?: string
          is_active?: boolean
          origin_municipality_id?: string | null
          profile_links?: Json
          student_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_program_id?: string | null
          bio?: string | null
          created_at?: string
          current_municipality_id?: string | null
          current_semester?: number | null
          desired_work_description?: string | null
          id?: string
          is_active?: boolean
          origin_municipality_id?: string | null
          profile_links?: Json
          student_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_Students_academic_program_id"
            columns: ["academic_program_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_AcademicPrograms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_Students_current_municipality_id"
            columns: ["current_municipality_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_Students_origin_municipality_id"
            columns: ["origin_municipality_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_StudentSkills: {
        Row: {
          created_at: string
          evidence_text: string | null
          id: string
          skill_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_text?: string | null
          id?: string
          skill_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_text?: string | null
          id?: string
          skill_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_StudentExperiences_student_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_fk_StudentSkills_skill_id"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Skills"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_StudentSpecialCases: {
        Row: {
          case_type_code: string
          created_at: string
          decision_notes: string | null
          id: string
          participation_id: string
          requested_municipality_id: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_type_code: string
          created_at?: string
          decision_notes?: string | null
          id?: string
          participation_id: string
          requested_municipality_id?: string | null
          reviewed_by?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          case_type_code?: string
          created_at?: string
          decision_notes?: string | null
          id?: string
          participation_id?: string
          requested_municipality_id?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_p6a_StudentSpecialCases_participation_id"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_StudentPeriodParticipations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyr_p6a_StudentSpecialCases_requested_municipality_id"
            columns: ["requested_municipality_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      PYRUnibague_SystemConfigurations: {
        Row: {
          created_at: string
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      PYRUnibague_UserProfiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          institutional_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          institutional_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          institutional_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      PYRUnibague_UserRoles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyr_fk_UserRoles_role_id"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "PYRUnibague_Roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pyr_unibague_admin_dashboard: { Args: never; Returns: Json }
      pyr_unibague_admin_students: {
        Args: {
          p_active?: boolean
          p_eligible?: boolean
          p_page?: number
          p_period?: string
          p_program?: string
          p_search?: string
          p_semester?: number
          p_status?: string
        }
        Returns: Json
      }
      pyr_unibague_advisor_project_team: {
        Args: { p_project_id: string }
        Returns: Json
      }
      pyr_unibague_advisor_workspace: {
        Args: { p_academic_period_id: string }
        Returns: Json
      }
      pyr_unibague_assignment_snapshot: {
        Args: { p_period_id: string; p_run_id?: string }
        Returns: Json
      }
      pyr_unibague_can_manage_org: {
        Args: { organization_id: string }
        Returns: boolean
      }
      pyr_unibague_change_organization_advisor: {
        Args: {
          p_academic_period_id: string
          p_advisor_id: string
          p_organization_id: string
          p_starts_on?: string
        }
        Returns: string
      }
      pyr_unibague_change_student_advisor: {
        Args: {
          p_advisor_id: string
          p_participation_id: string
          p_reason?: string
          p_source_assignment_id?: string
          p_starts_on?: string
        }
        Returns: string
      }
      pyr_unibague_confirm_assignment: {
        Args: {
          p_action: Json
          p_period_id: string
          p_revision: string
          p_run_id: string
        }
        Returns: Json
      }
      pyr_unibague_confirm_assignment_batch: {
        Args: {
          p_actions: Json
          p_period_id: string
          p_revision: string
          p_run_id: string
        }
        Returns: Json
      }
      pyr_unibague_current_roles: { Args: never; Returns: string[] }
      pyr_unibague_has_role: { Args: { role_code: string }; Returns: boolean }
      pyr_unibague_is_org_member: {
        Args: { organization_id: string }
        Returns: boolean
      }
      pyr_unibague_is_student_owner: {
        Args: { student_id: string }
        Returns: boolean
      }
      pyr_unibague_mark_notification_read: {
        Args: { notification_id: string }
        Returns: boolean
      }
      pyr_unibague_operational_export: {
        Args: { p_after_id?: string; p_kind: string; p_period_id: string }
        Returns: Json
      }
      pyr_unibague_operational_summary: {
        Args: { p_period_id: string }
        Returns: Json
      }
      pyr_unibague_order_student_interests: {
        Args: { p_ids: string[]; p_student_id: string }
        Returns: undefined
      }
      pyr_unibague_project_institutional: {
        Args: { p_project_id: string }
        Returns: Json
      }
      pyr_unibague_project_team: {
        Args: { p_project_id: string }
        Returns: Json
      }
      pyr_unibague_project_totals: {
        Args: { p_project_ids: string[] }
        Returns: {
          project_id: string
          total_capacity: number
        }[]
      }
      pyr_unibague_reassign_assignment: {
        Args: {
          p_action: Json
          p_period_id: string
          p_revision: string
          p_run_id: string
        }
        Returns: Json
      }
      pyr_unibague_register_organization: {
        Args: {
          p_description?: string
          p_display_name?: string
          p_legal_name: string
          p_municipality_id?: string
          p_organization_type_id?: string
          p_tax_id?: string
          p_website?: string
        }
        Returns: string
      }
      pyr_unibague_review_organization: {
        Args: {
          p_decision: string
          p_notes?: string
          p_organization_id: string
        }
        Returns: undefined
      }
      pyr_unibague_save_organization_contact: {
        Args: {
          p_email?: string
          p_full_name: string
          p_id?: string
          p_is_primary?: boolean
          p_organization_id: string
          p_phone?: string
          p_position_title?: string
          p_user_id?: string
        }
        Returns: string
      }
      pyr_unibague_set_current_academic_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      pyr_unibague_set_student_preferences: {
        Args: { p_municipality_ids: string[]; p_student_id: string }
        Returns: undefined
      }
      pyr_unibague_student_assignment: {
        Args: { p_period_id: string }
        Returns: Json
      }
      pyr_unibague_unassign_assignment: {
        Args: {
          p_action: Json
          p_period_id: string
          p_revision: string
          p_run_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
