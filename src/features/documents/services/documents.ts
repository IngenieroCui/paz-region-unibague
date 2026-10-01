import { check, client, FeatureError } from '../../../lib/supabase/feature-helpers'
import type { Row } from '../../../lib/supabase/feature-helpers'
import { privateDocumentUrl } from '../../../lib/supabase/storage'
export type DocumentScope = 'student' | 'organization'
export type DocumentRow = Row<'PYRUnibague_StudentDocuments'> | Row<'PYRUnibague_OrganizationDocuments'>
const buckets = { student: 'pyrunibague-student-documents', organization: 'pyrunibague-organization-documents' } as const
export const fileAccept = '.pdf,.doc,.docx,.png,.jpg,.jpeg'
export const maxFileBytes = 10 * 1024 * 1024
const fileTypes: Record<string, string[]> = { pdf: ['application/pdf'], doc: ['application/msword'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'] }
export function validateFile(file: File) {
  if (!file.size || file.size > maxFileBytes) throw new FeatureError('Elige un archivo entre 1 byte y 10 MB.')
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? ''
  if (!fileTypes[extension] || (file.type && !fileTypes[extension]?.includes(file.type))) throw new FeatureError('Usa PDF, Word, PNG o JPEG con extensión y tipo coherentes.')
  if (file.name.length > 180 || /[/\\]/.test(file.name) || [...file.name].some(character => character.charCodeAt(0) < 32) || ['.', '..'].includes(file.name)) throw new FeatureError('El nombre del archivo no es válido.')
}
export class OrphanUploadError extends FeatureError {
  readonly scope: DocumentScope
  readonly objectPath: string
  constructor(scope: DocumentScope, objectPath: string) { super('La metadata no se guardó y no se pudo retirar el archivo. Usa “Limpiar archivo pendiente” antes de volver a subir.', 'orphan'); this.scope = scope; this.objectPath = objectPath }
}
export async function cleanupUpload(scope: DocumentScope, objectPath: string) {
  const db = await client()
  const recorded = await db.from(scope === 'student' ? 'PYRUnibague_StudentDocuments' : 'PYRUnibague_OrganizationDocuments').select('id').eq('object_path', objectPath).maybeSingle()
  check(recorded.error)
  // A failed HTTP response can hide a committed insert. Never remove a recorded object.
  if (!recorded.data) check((await db.storage.from(buckets[scope]).remove([objectPath])).error)
}
export async function uploadDocument(scope: DocumentScope, ownerId: string, userId: string, file: File, category: string, onStage?: (stage: string) => void) {
  validateFile(file)
  if (!category.trim() || category.trim().length > 80) throw new FeatureError('Escribe una categoría de hasta 80 caracteres.')
  const db = await client(); const id = crypto.randomUUID()
  const mimeType = file.type || fileTypes[file.name.split('.').at(-1)?.toLowerCase() ?? '']?.[0]
  const fileName = file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `${ownerId}/${id}/${fileName}`
  onStage?.('Subiendo archivo…')
  const upload = await db.storage.from(buckets[scope]).upload(objectPath, file, { upsert: false, contentType: mimeType, cacheControl: '0' })
  check(upload.error)
  onStage?.('Guardando información del documento…')
  const metadata = { id, category_code: category.trim(), file_name: fileName, bucket_id: buckets[scope], object_path: objectPath, mime_type: mimeType || null, size_bytes: file.size, status: 'uploaded', uploaded_by: userId }
  const result = scope === 'student' ? await db.from('PYRUnibague_StudentDocuments').insert({ ...metadata, student_id: ownerId }) : await db.from('PYRUnibague_OrganizationDocuments').insert({ ...metadata, organization_id: ownerId })
  if (result.error) {
    const recorded = await db.from(scope === 'student' ? 'PYRUnibague_StudentDocuments' : 'PYRUnibague_OrganizationDocuments').select('id').eq('id', id).maybeSingle()
    if (recorded.data) return
    if (recorded.error) throw new OrphanUploadError(scope, objectPath)
    const cleanup = await db.storage.from(buckets[scope]).remove([objectPath])
    if (cleanup.error) throw new OrphanUploadError(scope, objectPath)
    throw new FeatureError('No se guardó la información; el archivo subido se retiró. Puedes reintentar.', 'metadata')
  }
}
export async function deleteDocument(scope: DocumentScope, ownerId: string, document: DocumentRow) {
  const db = await client()
  // Delete binary first. Retain metadata on failure; retrying a missing object is safe.
  const remove = await db.storage.from(buckets[scope]).remove([document.object_path]); check(remove.error)
  const result = scope === 'student' ? await db.from('PYRUnibague_StudentDocuments').delete().eq('id', document.id).eq('student_id', ownerId).select('id').single() : await db.from('PYRUnibague_OrganizationDocuments').delete().eq('id', document.id).eq('organization_id', ownerId).select('id').single()
  if (result.error) throw new FeatureError('El archivo se retiró, pero su registro sigue visible. Reintenta la eliminación para completar la limpieza.', 'partial-delete')
}
export function documentUrl(scope: DocumentScope, document: DocumentRow, download = false) { return privateDocumentUrl(buckets[scope], document.object_path, download ? document.file_name : undefined) }
