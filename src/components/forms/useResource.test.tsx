import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useResource } from './useResource'
import { FeatureError } from '../../lib/supabase/feature-helpers'
describe('Feature resources', () => {
  it('loads asynchronously and recovers from a request error on retry', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new FeatureError('Reintenta')).mockResolvedValueOnce({ name: 'Perfil' })
    const { result } = renderHook(() => useResource(loader))
    await waitFor(() => expect(result.current.error).toBe('Reintenta'))
    await act(async () => { await result.current.reload() })
    expect(result.current.data).toEqual({ name: 'Perfil' }); expect(result.current.error).toBe(''); expect(result.current.loading).toBe(false)
  })
  it('discards a slow response after the owner or selected organization changes', async () => {
    let resolveFirst: (value: string) => void = () => {}
    const first = vi.fn(() => new Promise<string>(resolve => { resolveFirst = resolve }))
    const second = vi.fn(async () => 'new owner')
    const { result, rerender } = renderHook(({ loader }) => useResource(loader), { initialProps: { loader: first as () => Promise<string> } })
    await waitFor(() => expect(first).toHaveBeenCalledOnce())
    rerender({ loader: second }); await waitFor(() => expect(result.current.data).toBe('new owner'))
    await act(async () => { resolveFirst('old owner') })
    expect(result.current.data).toBe('new owner')
  })
})
