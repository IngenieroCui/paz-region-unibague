import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'
import { Input } from './Fields'
import { Progress } from './Progress'
describe('UI contract', () => {
  it('prevents repeated actions during loading', async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Guardar</Button>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
  it('links input labels, help and errors', () => {
    render(<Input label="Nombre" hint="Nombre visible" error="Campo requerido" />)
    const input = screen.getByLabelText('Nombre')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Nombre visible Campo requerido')
  })
  it('keeps progress values in range', () => {
    render(<Progress value={150} label="Perfil" />)
    expect(screen.getByRole('progressbar', { name: 'Perfil' })).toHaveAttribute('value', '100')
  })
})
