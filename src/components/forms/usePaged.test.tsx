import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallback } from 'react'
import { usePaged } from './usePaged'

const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0) }) }
describe('Paged resources', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('keeps immediate navigation after the initial debounce and on whitespace-only edits', async () => {
    const loader = vi.fn(async () => ({ rows: ['row'], count: 100 }))
    const { result } = renderHook(() => usePaged(loader)); await flush()
    act(() => result.current.setPage(2)); await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(result.current.page).toBe(2)
    act(() => result.current.setSearch('   '))
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(result.current.page).toBe(2)
    expect(loader).toHaveBeenLastCalledWith(2, '')
  })
  it('debounces actual search changes, cancels intermediate searches and resets page once', async () => {
    const loader = vi.fn(async () => ({ rows: [], count: 100 }))
    const { result } = renderHook(() => usePaged(loader)); await flush()
    act(() => result.current.setPage(1)); await flush()
    act(() => result.current.setSearch('a'))
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    act(() => result.current.setSearch(' ab '))
    await act(async () => { await vi.advanceTimersByTimeAsync(249) })
    expect(result.current.page).toBe(1)
    expect(loader).not.toHaveBeenCalledWith(0, 'a')
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.page).toBe(0); expect(loader).toHaveBeenLastCalledWith(0, 'ab')
    act(() => result.current.setPage(2)); await flush()
    act(() => result.current.setSearch('ab'))
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(result.current.page).toBe(2)
    await act(async () => { await result.current.reload() })
    expect(loader).toHaveBeenLastCalledWith(2, 'ab')
  })
  it('honors external filters and page reset without replaying the initial debounce', async () => {
    const loader = vi.fn(async (_page: number, _search: string, filter: string) => ({ rows: [filter], count: 100 }))
    const { result, rerender } = renderHook(({ filter }) => usePaged(useCallback((page, search) => loader(page, search, filter), [filter])), { initialProps: { filter: 'active' } })
    await flush(); act(() => result.current.setPage(1)); await flush()
    rerender({ filter: 'closed' }); act(() => result.current.setPage(0)); await flush()
    expect(result.current.data?.rows).toEqual(['closed']); expect(loader).toHaveBeenLastCalledWith(0, '', 'closed')
  })
  it('discards obsolete data, errors and counts after a search or reload', async () => {
    let resolveOld: (v: { rows: string[]; count: number }) => void = () => {}
    let rejectOld: (v: Error) => void = () => {}
    const loader = vi.fn((page: number, query: string) => !query ? new Promise<{ rows: string[]; count: number }>((resolve, reject) => { resolveOld = resolve; rejectOld = reject }) : Promise.resolve({ rows: [query + page], count: 100 }))
    const { result } = renderHook(() => usePaged(loader)); await flush()
    act(() => result.current.setSearch('new'))
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    act(() => result.current.setPage(2)); await flush()
    await act(async () => { resolveOld({ rows: ['obsolete'], count: 0 }) })
    expect(result.current.data?.rows).toEqual(['new2']); expect(result.current.page).toBe(2)
    await act(async () => { rejectOld(new Error('obsolete')); await result.current.reload() })
    expect(result.current.error).toBe(''); expect(result.current.data?.rows).toEqual(['new2'])
  })
  it('discards an obsolete rejection after a newer reload succeeds', async () => {
    let rejectFirst: (error: Error) => void = () => {}
    const loader = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject })).mockResolvedValue({ rows: ['new'], count: 100 })
    const { result } = renderHook(() => usePaged(loader)); await flush()
    await act(async () => { await result.current.reload() })
    await act(async () => { rejectFirst(new Error('obsolete request failed')) })
    expect(result.current.data?.rows).toEqual(['new']); expect(result.current.error).toBe(''); expect(result.current.loading).toBe(false)
  })
})
