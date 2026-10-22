import { useCallback } from 'react'
import { useResource } from '../../components/forms/useResource'
import { Alert, ErrorState } from '../../components/feedback/States'
import { Card } from '../../components/ui/Card'
import { check, client } from '../../lib/supabase/feature-helpers'

async function requirements() {
  const db = await client()
  const { data, error } = await db.from('PYRUnibague_SystemConfigurations').select('value').eq('key','organization_document_requirements').eq('is_public',true).maybeSingle()
  check(error)
  const value = data?.value
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 240) : []
}
export function DocumentRequirements() {
  const resource = useResource(useCallback(() => requirements(), []))
  if (resource.error) return <ErrorState title="No pudimos consultar las indicaciones documentales" onRetry={() => void resource.reload()} />
  return resource.data?.length ? <Card><h2>Indicaciones de coordinación</h2><ul>{resource.data.map(item => <li key={item}>{item}</li>)}</ul></Card> : <Alert title="Requisitos institucionales pendientes">Puedes cargar documentos por categoría. Coordinación establecerá los requisitos definitivos y revisará los soportes de tu solicitud.</Alert>
}
