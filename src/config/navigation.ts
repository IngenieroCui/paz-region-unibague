import { Building2, FileText, FolderOpen, House, ListChecks, Settings2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './app'
export interface NavItem { label: string; path: string; icon: LucideIcon }
export const navigation: Record<Role, NavItem[]> = {
  STUDENT: [
    { label: 'Mi espacio', path: '', icon: House }, { label: 'Mi perfil', path: 'profile', icon: Users },
    { label: 'Mi proceso', path: 'process', icon: ListChecks }, { label: 'Documentos', path: 'documents', icon: FileText },
  ],
  ORGANIZATION: [
    { label: 'Mi espacio', path: '', icon: House }, { label: 'Organización', path: 'profile', icon: Building2 },
    { label: 'Proyectos', path: 'projects', icon: FolderOpen }, { label: 'Solicitudes', path: 'requests', icon: ListChecks },
  ],
  ADMIN: [
    { label: 'Resumen', path: '', icon: House }, { label: 'Estudiantes', path: 'students', icon: Users },
    { label: 'Organizaciones', path: 'organizations', icon: Building2 }, { label: 'Proyectos y plazas', path: 'projects', icon: FolderOpen },
    { label: 'Asignaciones', path: 'assignments', icon: ListChecks }, { label: 'Configuración', path: 'settings', icon: Settings2 },
  ],
}

// Preserve P1 development previews; production integrates P3/P4 surfaces.
export const productionNavigation: Record<Role, NavItem[]> = {
  ...navigation,
  STUDENT: [{ label: 'Inicio', path: '', icon: House }, { label: 'Mi perfil', path: 'profile', icon: Users }, { label: 'Experiencia', path: 'experience', icon: FolderOpen }, { label: 'Habilidades e intereses', path: 'skills', icon: ListChecks }, { label: 'Preferencias', path: 'preferences', icon: Settings2 }, { label: 'Documentos', path: 'documents', icon: FileText }],
  ORGANIZATION: [{ label: 'Inicio', path: '', icon: House }, { label: 'Perfil', path: 'profile', icon: Building2 }, { label: 'Proyectos', path: 'projects', icon: FolderOpen }, { label: 'Documentación', path: 'documents', icon: FileText }, { label: 'Revisión y estado', path: 'reviews', icon: ListChecks }],
  ADMIN: [{ label: 'Resumen', path: '', icon: House }, { label: 'Estudiantes', path: 'students', icon: Users }, { label: 'Organizaciones', path: 'organizations', icon: Building2 }, { label: 'Proyectos y plazas', path: 'projects', icon: FolderOpen }, { label: 'Usuarios y roles', path: 'users', icon: Users }, { label: 'Matching', path: 'matching', icon: ListChecks }, { label: 'Asignaciones', path: 'assignments', icon: ListChecks }, { label: 'Configuración', path: 'settings', icon: Settings2 }, { label: 'Auditoría', path: 'audit', icon: FileText }],
}
