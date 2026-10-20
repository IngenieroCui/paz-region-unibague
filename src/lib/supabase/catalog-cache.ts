// Memory only, bounded lifetime and owner scope. Never stores sessions or private records.
const entries = new Map<string, { expires: number; promise: Promise<unknown> }>()
export function clearCatalogCache() { entries.clear() }
export function catalog<T>(owner: string, name: string, loader: () => Promise<T>): Promise<T> {
  const key = owner + ':' + name
  const cached = entries.get(key)
  if (cached && cached.expires > Date.now()) return cached.promise as Promise<T>
  const entry = { expires: Date.now() + 5 * 60_000, promise: loader() }
  entries.set(key, entry)
  void entry.promise.catch(() => { if (entries.get(key) === entry) entries.delete(key) })
  // Keep a bounded cache even when users switch accounts without a full page reload.
  if (entries.size > 24) entries.delete(entries.keys().next().value!)
  return entry.promise
}
