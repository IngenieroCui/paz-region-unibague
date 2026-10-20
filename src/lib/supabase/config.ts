export type SupabaseConfiguration =
  | { status: 'ready'; url: string; key: string }
  | { status: 'missing' | 'invalid'; message: string }
export function readSupabaseConfiguration(url?: string, key?: string): SupabaseConfiguration {
  if (!url?.trim() || !key?.trim()) return {
    status: 'missing', message: 'Supabase no está configurado. Las vistas públicas y el preview siguen disponibles.',
  }
  try {
    const parsed = new URL(url.trim())
    const publicKey = key.trim()
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
    if (parsed.username || parsed.password) throw new Error('Credentials in URL')
    if (parsed.hostname.endsWith('.supabase.co') && parsed.hostname !== 'unxiuzkhxlzneywtnuvf.supabase.co') throw new Error('Unexpected hosted project')
    if (publicKey.startsWith('sb_secret_')) throw new Error('Private key')
    if (publicKey.split('.').length === 3) {
      const encodedPayload = publicKey.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(encodedPayload)) as { role?: unknown; ref?: unknown }
      if (payload.role !== 'anon') throw new Error('Only anon keys allowed')
      if (payload.ref && parsed.hostname.endsWith('.supabase.co') && payload.ref !== parsed.hostname.split('.')[0]) throw new Error('Key belongs to another project')
    } else if (!publicKey.startsWith('sb_publishable_')) {
      throw new Error('Unsupported public key')
    }
    return { status: 'ready', url: parsed.toString(), key: publicKey }
  } catch {
    return { status: 'invalid', message: 'Revisa la URL y la clave pública de Supabase. No se permiten claves privadas.' }
  }
}
export const supabaseConfiguration = readSupabaseConfiguration(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
