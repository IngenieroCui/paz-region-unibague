export const appConfig = {
  name: 'Paz y Región', institution: 'Universidad de Ibagué',
  description: 'Plataforma de gestión del programa Paz y Región.',
  demo: import.meta.env.VITE_PYR_DEMO === 'true',
  features: { rolePreview: import.meta.env.DEV, auth: true },
} as const
export const roles = ['STUDENT', 'ORGANIZATION', 'ADMIN', 'ADVISOR'] as const
export type Role = (typeof roles)[number]
export const roleLabels: Record<Role, string> = { STUDENT: 'Estudiante', ORGANIZATION: 'Organización', ADMIN: 'Universidad', ADVISOR: 'Asesor regional' }
export const rolePaths: Record<Role, string> = { STUDENT: 'student', ORGANIZATION: 'organization', ADMIN: 'admin', ADVISOR: 'advisor' }
