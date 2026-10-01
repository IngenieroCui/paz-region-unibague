import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminPreview from './AdminPreview'
it('filters the sample attention queue and shows an accessible empty result', async () => {
  render(<MemoryRouter><AdminPreview /></MemoryRouter>)
  await userEvent.selectOptions(screen.getByLabelText('Tipo de elemento'), 'Proyecto')
  expect(screen.getByRole('status')).toHaveTextContent('1 de 3')
  expect(screen.queryByText('Organización de ejemplo A')).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Buscar en los ejemplos'), 'sin coincidencias')
  expect(screen.getByRole('heading', { name: 'No hay coincidencias' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('0 de 3')
})
