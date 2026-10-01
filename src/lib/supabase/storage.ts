import { getSupabase } from './client'
export type PrivateDocumentBucket = 'pyrunibague-student-documents' | 'pyrunibague-organization-documents'
export async function privateDocumentUrl(bucket: PrivateDocumentBucket, objectPath: string, downloadName?: string) {
  const client = await getSupabase()
  if (!client) throw new Error('Storage unavailable')
  // RLS validates the requesting identity; the resulting bearer URL expires in 60 seconds.
  const { data, error } = await (downloadName ? client.storage.from(bucket).createSignedUrl(objectPath, 60, { download: downloadName }) : client.storage.from(bucket).createSignedUrl(objectPath, 60))
  if (error) throw new Error('Document unavailable')
  return data.signedUrl
}
