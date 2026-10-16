import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccessSelection from './AccessSelection'
import OrganizationRegistration from './OrganizationRegistration'
import AuthPage from './AuthPage'
vi.mock('./services/access', async original => ({ ...await original<object>(), registrationAvailable: async () => false, googleAvailable: async () => false }))
it('offers two independent access routes', () => {
  render(<MemoryRouter><AccessSelection /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /Acceso universitario/ })).toHaveAttribute('href','/login/institucional')
  expect(screen.getByRole('link', { name: /Acceso de organizaciones/ })).toHaveAttribute('href','/login/organizaciones')
})
it('keeps registration closed without collecting credentials or creating accounts', async () => {
  render(<MemoryRouter><OrganizationRegistration /></MemoryRouter>)
  expect(await screen.findByText('Registro público pendiente de activación')).toBeInTheDocument()
  expect(screen.getByLabelText('Correo de contacto')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Solicitar cuenta y confirmar correo' })).toBeDisabled()
})
it('does not require institutional email for organization login', () => {
  render(<MemoryRouter><AuthPage audience="organization" /></MemoryRouter>)
  expect(screen.getByLabelText('Correo electrónico')).not.toHaveAttribute('pattern')
  expect(screen.getByRole('link', { name: 'Registrar mi organización' })).toHaveAttribute('href','/registro/organizacion')
})
it('presents Google as pending and retains the authorized password form', () => {
  render(<MemoryRouter><AuthPage audience="institutional" /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Continuar con mi cuenta Unibagué' })).toBeDisabled()
  expect(screen.getByText('Acceso transitorio autorizado')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Registrar/ })).not.toBeInTheDocument()
})
