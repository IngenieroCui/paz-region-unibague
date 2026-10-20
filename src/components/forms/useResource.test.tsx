import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useResource } from './useResource'
import { FeatureError } from '../../lib/supabase/feature-helpers'
describe('Feature resources', () => {
  it('hides the old owner immediately even before a slow new request finishes', async () => {
    const first=vi.fn(async()=>({owner:'one'}))
    const second=vi.fn(()=>new Promise<{owner:string}>(()=>{}))
    const {result,rerender}=renderHook(({loader})=>useResource(loader),{initialProps:{loader:first}})
    await waitFor(()=>expect(result.current.data?.owner).toBe('one'))
    rerender({loader:second})
    expect(result.current.data).toBeNull();expect(result.current.loading).toBe(true)
  })
  it('keeps valid content during a slow refresh and after its failure', async () => {
    let reject: (error: Error) => void = () => {}
    const loader=vi.fn().mockResolvedValueOnce('valid').mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail}))
    const {result}=renderHook(()=>useResource(loader))
    await waitFor(()=>expect(result.current.data).toBe('valid'))
    let flight: Promise<void> = Promise.resolve()
    act(()=>{flight=result.current.reload()})
    expect(result.current.data).toBe('valid');expect(result.current.refreshing).toBe(true)
    await act(async()=>{reject(new FeatureError('Actualización pendiente'));await flight})
    expect(result.current.data).toBe('valid');expect(result.current.error).toBe('Actualización pendiente')
  })
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
