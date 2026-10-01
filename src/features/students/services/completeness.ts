import type { StudentData } from './students'
export function studentCompleteness(data: StudentData) {
  const student = data.student
  const sections = [
    { label: 'Identidad y programa', path: 'profile', complete: Boolean(data.profile?.display_name?.trim() && student?.student_code && student.academic_program_id && student.current_semester) },
    { label: 'Presentación profesional', path: 'profile', complete: Boolean(student?.bio?.trim() && student.desired_work_description?.trim()) },
    { label: 'Municipios de origen y actual', path: 'profile', complete: Boolean(student?.origin_municipality_id && student.current_municipality_id) },
    { label: 'Habilidades e intereses', path: 'skills', complete: data.studentSkills.length > 0 && data.interests.length > 0 },
    { label: 'Preferencias territoriales', path: 'preferences', complete: data.preferences.length > 0 },
    { label: 'CV / Hoja de vida', path: 'documents', complete: data.documents.some(doc => doc.category_code === 'CV' && doc.status === 'uploaded') },
  ]
  return { sections, percent: Math.round(sections.filter(section => section.complete).length / sections.length * 100) }
}
