// Schema-synchronized fallback, NOT CLI-generated. Regenerate with Supabase CLI.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = { public: { Tables: {
  PYRUnibague_StaffProfiles: {
    Row: {
      id: string
      user_id: string
      staff_code: string | null
      phone: string | null
      academic_unit: string | null
      status: string
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      staff_code?: string | null
      phone?: string | null
      academic_unit?: string | null
      status: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      staff_code?: string | null
      phone?: string | null
      academic_unit?: string | null
      status?: string
      created_at?: string
      updated_at?: string
    }
    Relationships: [

    ]
  }
  PYRUnibague_OrganizationContacts: {
    Row: {
      id: string
      organization_id: string
      user_id: string | null
      full_name: string
      position_title: string | null
      email: string | null
      phone: string | null
      is_primary: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      organization_id: string
      user_id?: string | null
      full_name: string
      position_title?: string | null
      email?: string | null
      phone?: string | null
      is_primary?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      organization_id?: string
      user_id?: string | null
      full_name?: string
      position_title?: string | null
      email?: string | null
      phone?: string | null
      is_primary?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_OrganizationContacts_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_AdvisorOrganizationAssignments: {
    Row: {
      id: string
      advisor_id: string
      organization_id: string
      academic_period_id: string
      starts_on: string
      ends_on: string | null
      is_current: boolean
      assigned_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      advisor_id: string
      organization_id: string
      academic_period_id: string
      starts_on: string
      ends_on?: string | null
      is_current?: boolean
      assigned_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      advisor_id?: string
      organization_id?: string
      academic_period_id?: string
      starts_on?: string
      ends_on?: string | null
      is_current?: boolean
      assigned_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_AdvisorOrganizationAssignments_advisor_id"; columns: ["advisor_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_StaffProfiles"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_AdvisorOrganizationAssignments_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_AdvisorOrganizationAssignments_academic_period_id"; columns: ["academic_period_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPeriods"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_AdvisorStudentAssignments: {
    Row: {
      id: string
      advisor_id: string
      participation_id: string
      starts_on: string
      ends_on: string | null
      is_current: boolean
      reason: string | null
      source_assignment_id: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      advisor_id: string
      participation_id: string
      starts_on: string
      ends_on?: string | null
      is_current?: boolean
      reason?: string | null
      source_assignment_id?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      advisor_id?: string
      participation_id?: string
      starts_on?: string
      ends_on?: string | null
      is_current?: boolean
      reason?: string | null
      source_assignment_id?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_AdvisorStudentAssignments_advisor_id"; columns: ["advisor_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_StaffProfiles"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_AdvisorStudentAssignments_participation_id"; columns: ["participation_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_StudentPeriodParticipations"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_AdvisorStudentAssignments_source_assignment_id"; columns: ["source_assignment_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Assignments"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentSpecialCases: {
    Row: {
      id: string
      participation_id: string
      case_type_code: string
      requested_municipality_id: string | null
      status: string
      reviewed_by: string | null
      decision_notes: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      participation_id: string
      case_type_code: string
      requested_municipality_id?: string | null
      status: string
      reviewed_by?: string | null
      decision_notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      participation_id?: string
      case_type_code?: string
      requested_municipality_id?: string | null
      status?: string
      reviewed_by?: string | null
      decision_notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_StudentSpecialCases_participation_id"; columns: ["participation_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_StudentPeriodParticipations"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_StudentSpecialCases_requested_municipality_id"; columns: ["requested_municipality_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Municipalities"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectTechnicalTeachers: {
    Row: {
      id: string
      project_id: string
      teacher_id: string
      responsibility: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_id: string
      teacher_id: string
      responsibility?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_id?: string
      teacher_id?: string
      responsibility?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_ProjectTechnicalTeachers_project_id"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Projects"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_ProjectTechnicalTeachers_teacher_id"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_StaffProfiles"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectInterlocutors: {
    Row: {
      id: string
      project_id: string
      organization_contact_id: string
      is_primary_for_project: boolean
      notes: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_id: string
      organization_contact_id: string
      is_primary_for_project?: boolean
      notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_id?: string
      organization_contact_id?: string
      is_primary_for_project?: boolean
      notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_ProjectInterlocutors_project_id"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Projects"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_ProjectInterlocutors_organization_contact_id"; columns: ["organization_contact_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_OrganizationContacts"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectParticipatingOrganizations: {
    Row: {
      id: string
      project_id: string
      organization_id: string
      participation_note: string | null
      created_at: string
    }
    Insert: {
      id?: string
      project_id: string
      organization_id: string
      participation_note?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      project_id?: string
      organization_id?: string
      participation_note?: string | null
      created_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_p6a_ProjectParticipatingOrganizations_project_id"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Projects"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_p6a_ProjectParticipatingOrganizations_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_UserProfiles: {
    Row: {
      user_id: string
      display_name: string | null
      institutional_email: string | null
      avatar_path: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      user_id: string
      display_name?: string | null
      institutional_email?: string | null
      avatar_path?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      user_id?: string
      display_name?: string | null
      institutional_email?: string | null
      avatar_path?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_Roles: {
    Row: {
      id: string
      code: string
      name: string
      description: string | null
      is_system: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      code: string
      name: string
      description?: string | null
      is_system?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      code?: string
      name?: string
      description?: string | null
      is_system?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_UserRoles: {
    Row: {
      id: string
      user_id: string
      role_id: string
      assigned_by: string | null
      created_at: string
    }
    Insert: {
      id?: string
      user_id: string
      role_id: string
      assigned_by?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      role_id?: string
      assigned_by?: string | null
      created_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_UserRoles_role_id"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Roles"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_AcademicPeriods: {
    Row: {
      id: string
      code: string
      name: string
      starts_on: string | null
      ends_on: string | null
      status: string
      is_current: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      code: string
      name: string
      starts_on?: string | null
      ends_on?: string | null
      status: string
      is_current?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      code?: string
      name?: string
      starts_on?: string | null
      ends_on?: string | null
      status?: string
      is_current?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_AcademicPrograms: {
    Row: {
      id: string
      code: string
      name: string
      faculty_name: string | null
      active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      code: string
      name: string
      faculty_name?: string | null
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      code?: string
      name?: string
      faculty_name?: string | null
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_Municipalities: {
    Row: {
      id: string
      country_code: string
      department_code: string
      department_name: string
      municipality_code: string
      municipality_name: string
      active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      country_code?: string
      department_code: string
      department_name: string
      municipality_code: string
      municipality_name: string
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      country_code?: string
      department_code?: string
      department_name?: string
      municipality_code?: string
      municipality_name?: string
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_OrganizationTypes: {
    Row: {
      id: string
      code: string
      name: string
      description: string | null
      active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      code: string
      name: string
      description?: string | null
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      code?: string
      name?: string
      description?: string | null
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_Skills: {
    Row: {
      id: string
      name: string
      category: string | null
      aliases: string[]
      active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      name: string
      category?: string | null
      aliases?: string[]
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      name?: string
      category?: string | null
      aliases?: string[]
      active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_SystemConfigurations: {
    Row: {
      key: string
      value: Json
      description: string | null
      is_public: boolean
      updated_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      key: string
      value: Json
      description?: string | null
      is_public?: boolean
      updated_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      key?: string
      value?: Json
      description?: string | null
      is_public?: boolean
      updated_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_FeatureFlags: {
    Row: {
      key: string
      enabled: boolean
      description: string | null
      is_public: boolean
      updated_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      key: string
      enabled?: boolean
      description?: string | null
      is_public?: boolean
      updated_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      key?: string
      enabled?: boolean
      description?: string | null
      is_public?: boolean
      updated_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_Students: {
    Row: {
      id: string
      user_id: string
      student_code: string | null
      academic_program_id: string | null
      current_semester: number | null
      bio: string | null
      desired_work_description: string | null
      origin_municipality_id: string | null
      current_municipality_id: string | null
      profile_links: Json
      is_active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      student_code?: string | null
      academic_program_id?: string | null
      current_semester?: number | null
      bio?: string | null
      desired_work_description?: string | null
      origin_municipality_id?: string | null
      current_municipality_id?: string | null
      profile_links?: Json
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      student_code?: string | null
      academic_program_id?: string | null
      current_semester?: number | null
      bio?: string | null
      desired_work_description?: string | null
      origin_municipality_id?: string | null
      current_municipality_id?: string | null
      profile_links?: Json
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_Students_academic_program_id"; columns: ["academic_program_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPrograms"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Students_origin_municipality_id"; columns: ["origin_municipality_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Municipalities"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Students_current_municipality_id"; columns: ["current_municipality_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Municipalities"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentPeriodParticipations: {
    Row: {
      id: string
      student_id: string
      academic_period_id: string
      status: string
      eligible_for_matching: boolean
      profile_completed_at: string | null
      arl_provider_name: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      student_id: string
      academic_period_id: string
      status: string
      eligible_for_matching?: boolean
      profile_completed_at?: string | null
      arl_provider_name?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      student_id?: string
      academic_period_id?: string
      status?: string
      eligible_for_matching?: boolean
      profile_completed_at?: string | null
      arl_provider_name?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_StudentPeriodParticipations_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_StudentPeriodParticipations_academic_period_id"; columns: ["academic_period_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPeriods"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentExperiences: {
    Row: {
      id: string
      student_id: string
      title: string
      organization_name: string | null
      description: string | null
      started_on: string | null
      ended_on: string | null
      is_current: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      student_id: string
      title: string
      organization_name?: string | null
      description?: string | null
      started_on?: string | null
      ended_on?: string | null
      is_current?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      student_id?: string
      title?: string
      organization_name?: string | null
      description?: string | null
      started_on?: string | null
      ended_on?: string | null
      is_current?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_StudentExperiences_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentSkills: {
    Row: {
      id: string
      student_id: string
      skill_id: string
      evidence_text: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      student_id: string
      skill_id: string
      evidence_text?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      student_id?: string
      skill_id?: string
      evidence_text?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_StudentSkills_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_StudentSkills_skill_id"; columns: ["skill_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Skills"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentInterests: {
    Row: {
      id: string
      student_id: string
      label: string
      description: string | null
      sort_order: number
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      student_id: string
      label: string
      description?: string | null
      sort_order?: number
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      student_id?: string
      label?: string
      description?: string | null
      sort_order?: number
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_StudentInterests_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentLocationPreferences: {
    Row: {
      id: string
      student_id: string
      municipality_id: string
      preference_order: number
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      student_id: string
      municipality_id: string
      preference_order: number
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      student_id?: string
      municipality_id?: string
      preference_order?: number
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_StudentLocationPreferences_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_StudentLocationPreferences_municipality_id"; columns: ["municipality_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Municipalities"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_StudentDocuments: {
    Row: {
      id: string
      student_id: string
      category_code: string
      file_name: string
      bucket_id: string
      object_path: string
      mime_type: string | null
      size_bytes: number | null
      status: string
      uploaded_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      student_id: string
      category_code: string
      file_name: string
      bucket_id: string
      object_path: string
      mime_type?: string | null
      size_bytes?: number | null
      status: string
      uploaded_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      student_id?: string
      category_code?: string
      file_name?: string
      bucket_id?: string
      object_path?: string
      mime_type?: string | null
      size_bytes?: number | null
      status?: string
      uploaded_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_StudentDocuments_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_Organizations: {
    Row: {
      id: string
      organization_type_id: string | null
      legal_name: string
      display_name: string | null
      tax_id: string | null
      description: string | null
      website: string | null
      municipality_id: string | null
      status: string
      created_by: string | null
      verified_at: string | null
      verified_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      organization_type_id?: string | null
      legal_name: string
      display_name?: string | null
      tax_id?: string | null
      description?: string | null
      website?: string | null
      municipality_id?: string | null
      status: string
      created_by?: string | null
      verified_at?: string | null
      verified_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      organization_type_id?: string | null
      legal_name?: string
      display_name?: string | null
      tax_id?: string | null
      description?: string | null
      website?: string | null
      municipality_id?: string | null
      status?: string
      created_by?: string | null
      verified_at?: string | null
      verified_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_Organizations_organization_type_id"; columns: ["organization_type_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_OrganizationTypes"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Organizations_municipality_id"; columns: ["municipality_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Municipalities"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_OrganizationMembers: {
    Row: {
      id: string
      organization_id: string
      user_id: string
      membership_role: string
      can_manage: boolean
      is_primary_contact: boolean
      status: string
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      organization_id: string
      user_id: string
      membership_role: string
      can_manage?: boolean
      is_primary_contact?: boolean
      status: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      organization_id?: string
      user_id?: string
      membership_role?: string
      can_manage?: boolean
      is_primary_contact?: boolean
      status?: string
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_OrganizationMembers_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_OrganizationDocuments: {
    Row: {
      id: string
      organization_id: string
      category_code: string
      file_name: string
      bucket_id: string
      object_path: string
      mime_type: string | null
      size_bytes: number | null
      status: string
      uploaded_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      organization_id: string
      category_code: string
      file_name: string
      bucket_id: string
      object_path: string
      mime_type?: string | null
      size_bytes?: number | null
      status: string
      uploaded_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      organization_id?: string
      category_code?: string
      file_name?: string
      bucket_id?: string
      object_path?: string
      mime_type?: string | null
      size_bytes?: number | null
      status?: string
      uploaded_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_OrganizationDocuments_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_OrganizationReviews: {
    Row: {
      id: string
      organization_id: string
      reviewer_id: string | null
      decision: string
      notes: string | null
      created_at: string
    }
    Insert: {
      id?: string
      organization_id: string
      reviewer_id?: string | null
      decision: string
      notes?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      organization_id?: string
      reviewer_id?: string | null
      decision?: string
      notes?: string | null
      created_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_OrganizationReviews_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_Projects: {
    Row: {
      id: string
      organization_id: string
      academic_period_id: string
      name: string
      summary: string | null
      description: string | null
      municipality_id: string | null
      modality: string | null
      status: string
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      organization_id: string
      academic_period_id: string
      name: string
      summary?: string | null
      description?: string | null
      municipality_id?: string | null
      modality?: string | null
      status: string
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      organization_id?: string
      academic_period_id?: string
      name?: string
      summary?: string | null
      description?: string | null
      municipality_id?: string | null
      modality?: string | null
      status?: string
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_Projects_organization_id"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Organizations"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Projects_academic_period_id"; columns: ["academic_period_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPeriods"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Projects_municipality_id"; columns: ["municipality_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Municipalities"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectPositions: {
    Row: {
      id: string
      project_id: string
      title: string
      description: string | null
      capacity: number
      status: string
      is_active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_id: string
      title: string
      description?: string | null
      capacity: number
      status: string
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_id?: string
      title?: string
      description?: string | null
      capacity?: number
      status?: string
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_ProjectPositions_project_id"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Projects"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectPositionPrograms: {
    Row: {
      id: string
      project_position_id: string
      academic_program_id: string
      is_required: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_position_id: string
      academic_program_id: string
      is_required?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_position_id?: string
      academic_program_id?: string
      is_required?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_ProjectPositionPrograms_project_position_id"; columns: ["project_position_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_ProjectPositions"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_ProjectPositionPrograms_academic_program_id"; columns: ["academic_program_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPrograms"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectRequirements: {
    Row: {
      id: string
      project_position_id: string
      label: string
      description: string | null
      is_mandatory: boolean
      sort_order: number
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_position_id: string
      label: string
      description?: string | null
      is_mandatory?: boolean
      sort_order?: number
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_position_id?: string
      label?: string
      description?: string | null
      is_mandatory?: boolean
      sort_order?: number
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_ProjectRequirements_project_position_id"; columns: ["project_position_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_ProjectPositions"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_ProjectPositionSkills: {
    Row: {
      id: string
      project_position_id: string
      skill_id: string
      is_required: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_position_id: string
      skill_id: string
      is_required?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_position_id?: string
      skill_id?: string
      is_required?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_ProjectPositionSkills_project_position_id"; columns: ["project_position_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_ProjectPositions"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_ProjectPositionSkills_skill_id"; columns: ["skill_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Skills"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_MatchingConfigurations: {
    Row: {
      id: string
      academic_period_id: string | null
      name: string
      algorithm_version: string
      minimum_recommended_score: number | null
      weights: Json
      rules: Json
      is_active: boolean
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      academic_period_id?: string | null
      name: string
      algorithm_version: string
      minimum_recommended_score?: number | null
      weights?: Json
      rules?: Json
      is_active?: boolean
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      academic_period_id?: string | null
      name?: string
      algorithm_version?: string
      minimum_recommended_score?: number | null
      weights?: Json
      rules?: Json
      is_active?: boolean
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_MatchingConfigurations_academic_period_id"; columns: ["academic_period_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPeriods"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_MatchingRuns: {
    Row: {
      id: string
      academic_period_id: string
      matching_configuration_id: string
      status: string
      started_by: string | null
      started_at: string | null
      completed_at: string | null
      summary: Json
      created_at: string
    }
    Insert: {
      id?: string
      academic_period_id: string
      matching_configuration_id: string
      status: string
      started_by?: string | null
      started_at?: string | null
      completed_at?: string | null
      summary?: Json
      created_at?: string
    }
    Update: {
      id?: string
      academic_period_id?: string
      matching_configuration_id?: string
      status?: string
      started_by?: string | null
      started_at?: string | null
      completed_at?: string | null
      summary?: Json
      created_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_MatchingRuns_academic_period_id"; columns: ["academic_period_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPeriods"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_MatchingRuns_matching_configuration_id"; columns: ["matching_configuration_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_MatchingConfigurations"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_MatchCandidates: {
    Row: {
      id: string
      matching_run_id: string
      student_id: string
      project_position_id: string
      is_eligible: boolean
      total_score: number | null
      component_scores: Json
      blockers: Json
      recommendations: Json
      explanation: string | null
      created_at: string
    }
    Insert: {
      id?: string
      matching_run_id: string
      student_id: string
      project_position_id: string
      is_eligible: boolean
      total_score?: number | null
      component_scores?: Json
      blockers?: Json
      recommendations?: Json
      explanation?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      matching_run_id?: string
      student_id?: string
      project_position_id?: string
      is_eligible?: boolean
      total_score?: number | null
      component_scores?: Json
      blockers?: Json
      recommendations?: Json
      explanation?: string | null
      created_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_MatchCandidates_matching_run_id"; columns: ["matching_run_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_MatchingRuns"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_MatchCandidates_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_MatchCandidates_project_position_id"; columns: ["project_position_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_ProjectPositions"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_Assignments: {
    Row: {
      id: string
      academic_period_id: string
      student_id: string
      project_position_id: string
      match_candidate_id: string | null
      status: string
      source: string
      is_active: boolean
      assigned_by: string | null
      assigned_at: string
      unassigned_at: string | null
      notes: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      academic_period_id: string
      student_id: string
      project_position_id: string
      match_candidate_id?: string | null
      status: string
      source: string
      is_active?: boolean
      assigned_by?: string | null
      assigned_at?: string
      unassigned_at?: string | null
      notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      academic_period_id?: string
      student_id?: string
      project_position_id?: string
      match_candidate_id?: string | null
      status?: string
      source?: string
      is_active?: boolean
      assigned_by?: string | null
      assigned_at?: string
      unassigned_at?: string | null
      notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_Assignments_academic_period_id"; columns: ["academic_period_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_AcademicPeriods"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Assignments_student_id"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Students"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Assignments_project_position_id"; columns: ["project_position_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_ProjectPositions"; referencedColumns: ["id"] },
      { foreignKeyName: "pyr_fk_Assignments_match_candidate_id"; columns: ["match_candidate_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_MatchCandidates"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_AssignmentEvents: {
    Row: {
      id: string
      assignment_id: string
      event_type: string
      actor_user_id: string | null
      reason_code: string | null
      reason_text: string | null
      metadata: Json
      created_at: string
    }
    Insert: {
      id?: string
      assignment_id: string
      event_type: string
      actor_user_id?: string | null
      reason_code?: string | null
      reason_text?: string | null
      metadata?: Json
      created_at?: string
    }
    Update: {
      id?: string
      assignment_id?: string
      event_type?: string
      actor_user_id?: string | null
      reason_code?: string | null
      reason_text?: string | null
      metadata?: Json
      created_at?: string
    }
    Relationships: [
      { foreignKeyName: "pyr_fk_AssignmentEvents_assignment_id"; columns: ["assignment_id"]; isOneToOne: false; referencedRelation: "PYRUnibague_Assignments"; referencedColumns: ["id"] },
    ]
  }
  PYRUnibague_Notifications: {
    Row: {
      id: string
      user_id: string
      type_code: string
      title: string
      body: string | null
      link_path: string | null
      read_at: string | null
      created_at: string
    }
    Insert: {
      id?: string
      user_id: string
      type_code: string
      title: string
      body?: string | null
      link_path?: string | null
      read_at?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      type_code?: string
      title?: string
      body?: string | null
      link_path?: string | null
      read_at?: string | null
      created_at?: string
    }
    Relationships: [
    ]
  }
  PYRUnibague_AuditLogs: {
    Row: {
      id: string
      actor_user_id: string | null
      action: string
      entity_table: string
      entity_id: string | null
      changed_fields: string[]
      context: Json
      created_at: string
    }
    Insert: {
      id?: string
      actor_user_id?: string | null
      action: string
      entity_table: string
      entity_id?: string | null
      changed_fields?: string[]
      context?: Json
      created_at?: string
    }
    Update: {
      id?: string
      actor_user_id?: string | null
      action?: string
      entity_table?: string
      entity_id?: string | null
      changed_fields?: string[]
      context?: Json
      created_at?: string
    }
    Relationships: [
    ]
  }
}; Views: { [_ in never]: never }; Functions: {
pyr_unibague_change_organization_advisor: { Args: { p_organization_id: string; p_academic_period_id: string; p_advisor_id: string | null; p_starts_on?: string }; Returns: string | null }
pyr_unibague_change_student_advisor: { Args: { p_participation_id: string; p_advisor_id: string | null; p_starts_on?: string; p_reason?: string | null; p_source_assignment_id?: string | null }; Returns: string | null }
pyr_unibague_save_organization_contact: { Args: { p_organization_id: string; p_full_name: string; p_id?: string | null; p_position_title?: string | null; p_email?: string | null; p_phone?: string | null; p_user_id?: string | null; p_is_primary?: boolean }; Returns: string }
pyr_unibague_advisor_workspace: { Args: { p_academic_period_id: string }; Returns: Json }
pyr_unibague_review_organization: { Args: { p_organization_id: string; p_decision: string; p_notes?: string | null }; Returns: undefined }
pyr_unibague_set_current_academic_period: { Args: { p_period_id: string }; Returns: undefined }
pyr_unibague_admin_dashboard: { Args: Record<string, never>; Returns: Json }
pyr_unibague_admin_students: { Args: { p_search?: string; p_program?: string | null; p_period?: string | null; p_eligible?: boolean | null; p_active?: boolean | null; p_status?: string | null; p_semester?: number | null; p_page?: number }; Returns: Json }
pyr_unibague_project_totals: { Args: { p_project_ids: string[] }; Returns: { project_id: string; total_capacity: number }[] }
pyr_unibague_current_roles: { Args: Record<string, never>; Returns: string[] }
pyr_unibague_has_role: { Args: { role_code: string }; Returns: boolean }
pyr_unibague_is_student_owner: { Args: { student_id: string }; Returns: boolean }
pyr_unibague_is_org_member: { Args: { organization_id: string }; Returns: boolean }
pyr_unibague_can_manage_org: { Args: { organization_id: string }; Returns: boolean }
pyr_unibague_mark_notification_read: { Args: { notification_id: string }; Returns: boolean }
pyr_unibague_register_organization: { Args: { p_legal_name: string; p_display_name?: string | null; p_tax_id?: string | null; p_description?: string | null; p_website?: string | null; p_organization_type_id?: string | null; p_municipality_id?: string | null }; Returns: string }
pyr_unibague_set_student_preferences: { Args: { p_student_id: string; p_municipality_ids: string[] }; Returns: undefined }
pyr_unibague_order_student_interests: { Args: { p_student_id: string; p_ids: string[] }; Returns: undefined }
}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } }
