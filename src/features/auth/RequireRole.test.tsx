import type { Session } from '@supabase/supabase-js'
import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from './auth-context'
import { RequireRole } from './RequireRole'
it('denies authenticated users until trusted roles are supplied', () => {
  const session = { user: { id: 'example' } } as Session
  render(<AuthContext value={{ status: 'authenticated', session, roles: [] }}><MemoryRouter initialEntries={['/secure']}>
    <Routes><Route element={<RequireRole role="ADMIN" />}><Route path="/secure" element={<h1>Private</h1>} /></Route>
      <Route path="/unauthorized" element={<h1>No permission</h1>} /></Routes>
  </MemoryRouter></AuthContext>)
  expect(screen.getByRole('heading', { name: 'No permission' })).toBeInTheDocument()
  expect(screen.queryByText('Private')).not.toBeInTheDocument()
})

it('opens a workspace for a verified role', () => {
  const session = { user: { id: 'example' } } as Session
  render(<AuthContext value={{ status: 'authenticated', session, roles: ['STUDENT', 'ADMIN'] }}><MemoryRouter initialEntries={['/secure']}>
    <Routes><Route element={<RequireRole role="ADMIN" />}><Route path="/secure" element={<h1>Verified workspace</h1>} /></Route></Routes>
  </MemoryRouter></AuthContext>)
  expect(screen.getByRole('heading', { name: 'Verified workspace' })).toBeInTheDocument()
})
