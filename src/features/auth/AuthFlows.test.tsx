import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import AuthPage from './AuthPage'
import ResetPassword from './ResetPassword'
import SelectRole from './SelectRole'
import AuthCallback from './AuthCallback'
import { Logout } from './Logout'
import { AuthContext } from './auth-context'
import type { AuthState } from './auth-context'
import { RequireRole } from './RequireRole'
import * as service from './services/auth'
vi.mock('../../lib/supabase/config', () => ({ supabaseConfiguration: { status: 'ready' } }))
vi.mock('./services/auth', async importOriginal => ({ ...await importOriginal<typeof service>(), signIn: vi.fn(), recoverPassword: vi.fn(), updatePassword: vi.fn(), signOut: vi.fn(), completeCallback: vi.fn() }))
const session = { user: { id: 'student', user_metadata: { role: 'ADMIN' } } } as unknown as Session
const anon: AuthState = { status: 'anonymous', session: null, roles: [] }
function mount(ui: React.ReactNode, state = anon, path = '/test') {
  render(<AuthContext value={state}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/test" element={ui} /><Route path="/auth/callback" element={ui} />
    <Route path="/login" element={<h1>Login destination</h1>} />
    <Route path="/reset-password" element={<h1>Reset destination</h1>} />
    <Route path="/unauthorized" element={<h1>Denied destination</h1>} />
    <Route path="/app/student" element={<h1>Student destination</h1>} />
    <Route path="/app/admin" element={<h1>Admin destination</h1>} />
    <Route path="/select-role" element={<h1>Select destination</h1>} />
  </Routes></MemoryRouter></AuthContext>)
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
describe('real Auth forms', () => {
  it('submits credentials once, exposes loading and safe errors', async () => {
    let reject: (error: Error) => void = () => {}
    vi.mocked(service.signIn).mockImplementation(() => new Promise((_, fail) => { reject = fail }))
    mount(<AuthPage />)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'me@example.org')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(service.signIn).toHaveBeenCalledWith('me@example.org', 'password123')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
    reject(new Error('secret internal diagnostic'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tus credenciales')
    expect(screen.queryByText('secret internal diagnostic')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled())
  })
  it('sends recovery and gives a response that does not enumerate accounts', async () => {
    vi.mocked(service.recoverPassword).mockResolvedValue()
    mount(<AuthPage recovery />)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'me@example.org')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))
    expect(service.recoverPassword).toHaveBeenCalledWith('me@example.org')
    expect(await screen.findByRole('status')).toHaveTextContent('Si la cuenta permite recuperación')
  })
  it('handles a recovery failure', async () => {
    vi.mocked(service.recoverPassword).mockRejectedValue(new Error('network'))
    mount(<AuthPage recovery />)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'me@example.org')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta nuevamente')
  })
  it.each([ [[], 'Denied destination'], [['STUDENT'], 'Student destination'], [['STUDENT', 'ADMIN'], 'Select destination'] ] as const)('routes login from trusted roles %j', async (roles, destination) => {
    mount(<AuthPage />, { status: 'authenticated', session, roles })
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument()
  })
  it('offers only verified role choices without persisting selection', async () => {
    mount(<SelectRole />, { status: 'authenticated', session, roles: ['STUDENT', 'ADMIN'] })
    expect(screen.queryByRole('link', { name: 'Organización' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Estudiante' }))
    expect(screen.getByRole('heading', { name: 'Student destination' })).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
  })
  it('reset requires a recovery session', () => {
    mount(<ResetPassword />, { status: 'authenticated', session, roles: ['ADMIN'] })
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })
  it('checks confirmation and updates a recovery password, then logs out', async () => {
    vi.mocked(service.updatePassword).mockResolvedValue(); vi.mocked(service.signOut).mockResolvedValue()
    mount(<ResetPassword />, { status: 'authenticated', session, roles: [], recovery: true })
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'new-password')
    await userEvent.type(screen.getByLabelText('Confirma la contraseña'), 'other-password')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(service.updatePassword).not.toHaveBeenCalled()
    await userEvent.clear(screen.getByLabelText('Confirma la contraseña'))
    await userEvent.type(screen.getByLabelText('Confirma la contraseña'), 'new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(service.updatePassword).toHaveBeenCalledWith('new-password')
    expect(service.signOut).toHaveBeenCalled()
  })
  it('shows password update errors safely', async () => {
    vi.mocked(service.updatePassword).mockRejectedValue(new Error('secret'))
    mount(<ResetPassword />, { status: 'authenticated', session, roles: [], recovery: true })
    for (const label of ['Nueva contraseña', 'Confirma la contraseña']) await userEvent.type(screen.getByLabelText(label), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar')
  })
  it('callback ignores open-redirect parameters and uses recovery event', async () => {
    vi.mocked(service.completeCallback).mockResolvedValue(true)
    mount(<AuthCallback />, anon, '/auth/callback?code=valid&next=https://evil.example')
    expect(await screen.findByRole('heading', { name: 'Reset destination' })).toBeInTheDocument()
  })
  it('callback shows invalid link without credentials in the error', async () => {
    vi.mocked(service.completeCallback).mockRejectedValue(new Error('secret'))
    mount(<AuthCallback />, anon, '/auth/callback?error=invalid')
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido')
  })
  it('logout awaits the real service and navigates to login', async () => {
    vi.mocked(service.signOut).mockResolvedValue()
    mount(<Logout />)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Login destination' })).toBeInTheDocument()
    expect(service.signOut).toHaveBeenCalledOnce()
  })
  it('logout failure leaves a retryable error', async () => {
    vi.mocked(service.signOut).mockRejectedValue(new Error('network'))
    mount(<Logout />)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cerrar sesión')
  })
  it('guard ignores localStorage and editable user metadata roles', () => {
    localStorage.setItem('role', 'ADMIN')
    mount(<RequireRole role="ADMIN" />, { status: 'authenticated', session, roles: ['STUDENT'] })
    expect(screen.getByRole('heading', { name: 'Denied destination' })).toBeInTheDocument()
  })
  it('guard fails closed while roles cannot be verified', () => {
    mount(<RequireRole role="ADMIN" />, { status: 'error', session, roles: [] })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos verificar tu sesión')
  })
})
