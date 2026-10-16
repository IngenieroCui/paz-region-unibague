import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstitutionalSheetView } from './InstitutionalSheet'
import type { InstitutionalSheetData } from './services/institutional'

const data: InstitutionalSheetData = {
  project: {
    id: 'project', organization_id: 'organization', academic_period_id: 'period', name: 'Continuidad de software', summary: null, description: null,
    municipality_id: 'municipality', zone_type: 'rural', modality: null, status: 'approved', created_by: null, created_at: '2026-10-13T12:00:00Z', updated_at: '2026-10-13T12:00:00Z',
    PYRUnibague_Organizations: { legal_name: 'Institución de prueba', website: null },
    PYRUnibague_AcademicPeriods: { name: '2026B', code: '2026B' },
    PYRUnibague_Municipalities: { municipality_name: 'Espinal', department_name: 'Tolima' },
  },
  positions: [{ id: 'position', project_id: 'project', title: 'Desarrollo', description: null, capacity: 2, status: 'approved', is_active: true, created_at: '', updated_at: '' }],
  programs: [{ project_position_id: 'position', PYRUnibague_AcademicPrograms: { name: 'Sistemas' } }, { project_position_id: 'position', PYRUnibague_AcademicPrograms: { name: 'Electrónica' } }],
  people: { availability: 'not_integrated', advisors: [], interlocutors: [] },
}
describe('P6B institutional sheet', () => {
  it('shows relational identities and geography without inventing missing people', () => {
    render(<InstitutionalSheetView data={data}/>)
    expect(screen.getByText('Institución de prueba')).toBeVisible()
    expect(screen.getByText('Espinal, Tolima')).toBeVisible()
    expect(screen.getByText('Rural')).toBeVisible()
    expect(screen.getByText('Asesor e interlocutor pendientes de integración institucional.')).toBeVisible()
    expect(screen.queryByText(/Juan Naveros|Francisco Javier|SENA/)).not.toBeInTheDocument()
  })
  it('does not multiply capacity by compatible programs', () => {
    render(<InstitutionalSheetView data={data}/>)
    expect(screen.getByText(/Capacidad ofertada activa: 2\./)).toBeVisible()
    expect(screen.getByText('Programas compatibles: Sistemas, Electrónica')).toBeVisible()
  })
  it('shows integrated people by relational IDs', () => {
    render(<InstitutionalSheetView data={{ ...data, people: { availability: 'available', advisors: [{ id: 'a', displayName: 'Asesor de prueba' }], interlocutors: [{ id: 'i', displayName: 'Interlocutor de prueba' }] } }}/>)
    expect(screen.getByText('Asesor de prueba')).toBeVisible()
    expect(screen.getByText('Interlocutor de prueba')).toBeVisible()
    expect(screen.queryByText(/pendientes de integración/)).not.toBeInTheDocument()
  })
  it('uses the singular for a single seat and excludes all inactive offers', () => {
    render(<InstitutionalSheetView data={{ ...data, positions: [{ ...data.positions[0]!, capacity: 1, is_active: false, status: 'inactive' }] }}/>)
    expect(screen.getByText(/Capacidad ofertada activa: 0\. Capacidad total registrada: 1\./)).toBeVisible()
    expect(screen.getByText('1 cupo · Inactiva · Inactiva')).toBeVisible()
    expect(screen.queryByText(/1 cupos/)).not.toBeInTheDocument()
  })
  it('separates active offers and current team members from inactive positions and historical departures', () => {
    const team: NonNullable<InstitutionalSheetData['team']> = {
      groups: [{ id: 'g', project_id: 'project', name: 'Equipo Prueba', status: 'active', started_on: null, created_at: '', updated_at: '' }],
      members: [
        { id: 'm1', group_id: 'g', assignment_id: 'a1', joined_on: null, left_on: null, status: 'active', created_at: '', updated_at: '' },
        { id: 'm2', group_id: 'g', assignment_id: 'a2', joined_on: null, left_on: '2026-10-13', status: 'inactive', created_at: '', updated_at: '' },
      ],
      assignments: [
        { id: 'a1', student_id: 's1', display_name: 'Estudiante vigente', program_name: 'Sistemas', position_title: 'Desarrollo', is_active: true, status: 'confirmed', unassigned_at: null },
        { id: 'a2', student_id: 's2', display_name: 'Estudiante retirado', program_name: 'Sistemas', position_title: 'Desarrollo', is_active: false, status: 'unassigned', unassigned_at: '2026-10-13' },
      ],
    }
    render(<InstitutionalSheetView data={{ ...data, team, positions: [data.positions[0]!, { ...data.positions[0]!, id: 'inactive', capacity: 3, is_active: false, status: 'closed' }] }}/>)
    expect(screen.getByText(/Capacidad ofertada activa: 2\. Capacidad total registrada: 5\./)).toBeVisible()
    expect(screen.getByText(/3 cupos · Cerrada · Inactiva/)).toBeVisible()
    const current = screen.getByRole('region', { name: 'Integrantes vigentes de Equipo Prueba' })
    expect(within(current).getByText(/Estudiante vigente/)).toBeVisible()
    expect(within(current).queryByText(/Estudiante retirado/)).not.toBeInTheDocument()
    const historical = screen.getByRole('region', { name: 'Historial de integrantes retirados' })
    expect(within(historical).getByText(/Estudiante retirado/)).toBeVisible()
  })
  it('handles missing geography and empty positions and offers browser printing', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<InstitutionalSheetView data={{ ...data, positions: [], project: { ...data.project, zone_type: null, PYRUnibague_Municipalities: null } }}/>)
    expect(screen.getByText('Sin plazas registradas.')).toBeVisible()
    expect(screen.getAllByText('Sin registrar').length).toBeGreaterThanOrEqual(2)
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ficha' }))
    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })
})
