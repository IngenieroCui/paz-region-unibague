import { afterEach, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallPWA } from './InstallPWA'
afterEach(() => localStorage.removeItem('pyr:pwa-dismissed:v1'))
function promptEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  return Object.assign(event, { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'dismissed' }) })
}
it('respects dismissal even when the browser sends a later install event', async () => {
  render(<InstallPWA />)
  act(() => { window.dispatchEvent(promptEvent()) })
  expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Posponer instalación' }))
  act(() => { window.dispatchEvent(promptEvent()) })
  expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()
})
it('does not display install advice for a standalone app', () => {
  vi.mocked(window.matchMedia).mockReturnValueOnce({ matches: true } as MediaQueryList)
  render(<InstallPWA />)
  act(() => { window.dispatchEvent(promptEvent()) })
  expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()
})
