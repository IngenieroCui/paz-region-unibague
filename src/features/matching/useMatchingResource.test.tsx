import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useMatchingResource } from './useMatchingResource'

it('hides the previous period during the render before effects run', async () => {
  const first = vi.fn(async () => 'old period')
  const second = vi.fn(() => new Promise<string>(() => {}))
  const frames: { data: string | null; loading: boolean }[] = []
  const view = renderHook(({ loader }) => {
    const value = useMatchingResource(loader)
    frames.push({ data: value.data, loading: value.loading })
    return value
  }, { initialProps: { loader: first as () => Promise<string> } })
  await waitFor(() => expect(view.result.current.data).toBe('old period'))
  frames.length = 0
  view.rerender({ loader: second })
  expect(frames.every(frame => frame.data === null && frame.loading)).toBe(true)
})

it('discards late responses and clears data immediately when disabled', async () => {
  let finish: (value: string) => void = () => {}
  const pending = () => new Promise<string>(resolve => { finish = resolve })
  const view = renderHook(({ enabled }) => useMatchingResource(pending, enabled), { initialProps: { enabled: true } })
  view.rerender({ enabled: false })
  await act(async () => finish('stale'))
  expect(view.result.current).toMatchObject({ data: null, loading: false, error: '' })
})
