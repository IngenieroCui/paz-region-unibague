import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByText(/Capacidad ofertada: 2\./)).toBeVisible()
    expect(screen.getByText('Programas compatibles: Sistemas, Electrónica')).toBeVisible()
  })
  it('shows integrated people by relational IDs', () => {
    render(<InstitutionalSheetView data={{ ...data, people: { availability: 'available', advisors: [{ id: 'a', displayName: 'Asesor de prueba' }], interlocutors: [{ id: 'i', displayName: 'Interlocutor de prueba' }] } }}/>)
    expect(screen.getByText('Asesor de prueba')).toBeVisible()
    expect(screen.getByText('Interlocutor de prueba')).toBeVisible()
    expect(screen.queryByText(/pendientes de integración/)).not.toBeInTheDocument()
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
