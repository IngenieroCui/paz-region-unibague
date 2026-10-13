import { check, client, FeatureError } from '../../lib/supabase/feature-helpers'

/** Only internal app destinations; legacy/external/encoded redirect URLs stay inert. */
export function notificationPath(path: string | null): string | null {
  return path && /^\/app\/(student|organization|advisor|admin)(\/[a-zA-Z0-9-]+)*(\?period=[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})?$/.test(path) ? path : null
}
export async function listNotifications(userId: string, page: number, unread: boolean) {
  const db = await client()
  let query = db.from('PYRUnibague_Notifications').select('*', { count: 'exact' }).eq('user_id', userId)
  if (unread) query = query.is('read_at', null)
  const result = await query.order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24)
  check(result.error); return { rows: result.data ?? [], count: result.count ?? 0 }
}
export async function markNotificationRead(id: string) {
  const db = await client(), result = await db.rpc('pyr_unibague_mark_notification_read', { notification_id: id })
  check(result.error)
  if (result.data !== true) throw new FeatureError('La notificación ya no está disponible para tu cuenta.', '42501')
}
