import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { createAppRoutes } from './router'
function mount(route: string, preview = false) {
  const router = createMemoryRouter(createAppRoutes(preview), { initialEntries: [route] })
  render(<RouterProvider router={router} />)
  return router
}
describe('Routes and public surfaces', () => {
  it('mounts the public home and navigates to the disabled access UI', async () => {
    mount('/')
    expect(await screen.findByRole('heading', { name: /El conocimiento/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Ingresar a la plataforma/ }))
    expect(await screen.findByRole('heading', { name: 'Bienvenido a tu espacio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
    expect(screen.getByLabelText('Contraseña')).toBeDisabled()
  })
  it('has a recovery surface with no fake email operation', async () => {
    mount('/forgot-password')
    expect(await screen.findByRole('heading', { name: 'Recupera tu acceso' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar instrucciones' })).toBeDisabled()
  })
  it('renders not found and blocks preview routes when disabled', async () => {
    mount('/dev/student')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
  it('ignores legacy localStorage authentication', async () => {
    localStorage.setItem('unibague_user', '{"role":"ADMIN"}')
    mount('/app/admin')
    expect(await screen.findByRole('heading', { name: 'Bienvenido a tu espacio' })).toBeInTheDocument()
    localStorage.removeItem('unibague_user')
  })
  it('opens each development experience without creating a session', async () => {
    mount('/dev/student', true)
    expect(await screen.findByRole('heading', { name: 'Hola, estudiante.' })).toBeInTheDocument()
    expect(screen.getByText('Datos de ejemplo. No representa una sesión ni un proceso real.')).toBeInTheDocument()
  })
})
