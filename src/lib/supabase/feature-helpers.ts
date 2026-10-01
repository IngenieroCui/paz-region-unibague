import { getSupabase } from './client'
import type { Database } from './database.types'
export type TableName = keyof Database['public']['Tables']
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row']
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update']
export class FeatureError extends Error {
  readonly code: string
  constructor(message: string, code = 'request') { super(message); this.name = 'FeatureError'; this.code = code }
}
export function check(error: { code?: string; message: string } | null) {
  if (error) throw new FeatureError(error.code === '23505' ? 'Este dato ya está registrado. Revisa los duplicados.' : error.code === '42501' ? 'No tienes permiso para esta operación.' : 'No se pudo completar la operación. Reintenta.', error.code)
}
export function errorMessage(error: unknown) { return error instanceof FeatureError ? error.message : 'No se pudo completar la operación. Revisa tu conexión y reintenta.' }
export async function client() {
  const value = await getSupabase()
  if (!value) throw new FeatureError('Configura Supabase para acceder a tus datos.')
  return value
}
export function nullable(value: string) { return value.trim() || null }
export async function allPages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>) {
  const rows: T[] = []
  for (let offset = 0; ; offset += 1000) {
    const result = await query(offset, offset + 999); check(result.error)
    rows.push(...(result.data ?? []))
    if (!result.data || result.data.length < 1000) return rows
  }
}
export function validUrl(value: string) {
  if (!value.trim()) return true
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
