import { useId, useState } from 'react'
import { useUnsavedChanges } from '../../components/forms/unsaved-context'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Fields'
import { Alert, EmptyState } from '../../components/feedback/States'
import { ConfirmDialog } from '../../components/forms/Editor'
import { errorMessage } from '../../lib/supabase/feature-helpers'
import { cleanupUpload, deleteDocument, documentUrl, fileAccept, OrphanUploadError, uploadDocument, validateFile } from './services/documents'
import type { DocumentRow, DocumentScope } from './services/documents'
export function DocumentsPanel({ scope, ownerId, userId, documents, canManage = true, reload }: { scope: DocumentScope; ownerId: string; userId: string; documents: DocumentRow[]; canManage?: boolean; reload: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState(scope === 'student' ? 'CV' : '')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orphan, setOrphan] = useState<OrphanUploadError | null>(null)
  const [removing, setRemoving] = useState<DocumentRow | null>(null)
  useUnsavedChanges(useId(), Boolean(file) || busy || Boolean(orphan))
  async function open(document: DocumentRow, download: boolean) {
    // Open synchronously to preserve user activation, then request a fresh URL.
    const tab = download ? null : window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    setError(''); setBusy(true)
    try {
      const url = await documentUrl(scope, document, download)
      if (download) {
        const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.file_name; anchor.target = '_blank'; anchor.rel = 'noopener'; anchor.click()
      } else if (tab) tab.location.replace(url)
      else throw new Error('popup')
    } catch (cause) { tab?.close(); setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <div className="module-stack">{canManage ? <Card><h2>Subir documento</h2><p>PDF, Word, PNG o JPEG · hasta 10 MB. Los archivos son privados.</p>
    <form className="module-form" onSubmit={async event => {
      event.preventDefault(); if (!file || busy || orphan) return
      const form = event.currentTarget; setBusy(true); setError(''); setSuccess('')
      try { await uploadDocument(scope, ownerId, userId, file, category, setStage); setSuccess('Documento guardado'); setFile(null); form.reset(); await reload() }
      catch (cause) { if (cause instanceof OrphanUploadError) setOrphan(cause); setError(errorMessage(cause)) }
      finally { setBusy(false); setStage('') }
    }}>
      {scope === 'student' ? <Select label="Categoría" value={category} onChange={event => setCategory(event.target.value)}><option value="CV">CV / Hoja de vida</option><option value="OTHER">Otro documento</option></Select> : <Input label="Categoría" required maxLength={80} value={category} onChange={event => setCategory(event.target.value)} hint="Describe el documento. No se han definido documentos obligatorios." />}
      <Input label="Archivo" type="file" accept={fileAccept} required disabled={busy || Boolean(orphan)} onChange={event => {
        const selected = event.target.files?.[0] ?? null; setError(''); setFile(null)
        if (selected) try { validateFile(selected); setFile(selected) } catch (cause) { setError(errorMessage(cause)); event.target.value = '' }
      }} />
      <Button type="submit" loading={busy} disabled={!file || Boolean(orphan)}>Subir documento</Button>
      {stage && <p role="status">{stage}</p>}
    </form></Card> : <Alert title="Solo lectura">La gestión documental requiere permiso de administración de esta organización.</Alert>}
    {error && <Alert tone="error" title={error} />}{success && <Alert tone="success" title={success} />}
    {orphan && <Button disabled={busy} onClick={async () => { setBusy(true); try { await cleanupUpload(orphan.scope, orphan.objectPath); setOrphan(null); setError(''); setSuccess('Archivo pendiente revisado'); await reload() } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) } }}>Limpiar archivo pendiente</Button>}
    <Card><h2>Mis documentos</h2>{documents.length === 0 ? <EmptyState title="No hay documentos">Los documentos que subas aparecerán aquí.</EmptyState> : <ul className="module-list">{documents.map(doc => <li key={doc.id}>
      <div><h3>{doc.file_name}</h3><p>{doc.category_code === 'CV' ? 'CV / Hoja de vida' : doc.category_code} · {doc.size_bytes === null ? 'Tamaño sin registrar' : `${Math.ceil(doc.size_bytes / 1024)} KB`}</p><small>{new Date(doc.created_at).toLocaleDateString('es-CO')}</small></div>
      {canManage && <div className="module-actions"><Button variant="secondary" disabled={busy} onClick={() => void open(doc, false)}>Abrir</Button><Button variant="secondary" disabled={busy} onClick={() => void open(doc, true)}>Descargar</Button><Button variant="ghost" disabled={busy} onClick={() => setRemoving(doc)}>Eliminar</Button></div>}
    </li>)}</ul>}</Card>
    <ConfirmDialog open={Boolean(removing)} title="Eliminar documento" onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) { await deleteDocument(scope, ownerId, removing); setSuccess('Documento eliminado'); await reload() } }}>Se eliminará el archivo y su información. Esta acción no se puede deshacer.</ConfirmDialog>
  </div>
}
