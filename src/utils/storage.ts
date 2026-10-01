// Preferences only; never an authentication or authorization source.
export function readPreference(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
export function writePreference(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* Storage can be disabled. */ }
}
