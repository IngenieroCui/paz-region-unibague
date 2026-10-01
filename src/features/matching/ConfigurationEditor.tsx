import { useCallback, useState } from 'react'
import { Editor } from '../../components/forms/Editor'
import { Input, Select, Checkbox } from '../../components/ui/Fields'
import { Button } from '../../components/ui/Button'
import { Alert, ErrorState } from '../../components/feedback/States'
import type { Row } from '../../lib/supabase/feature-helpers'
import { ALGORITHM_VERSION, COMPONENTS, validateConfiguration } from '../../../supabase/functions/_shared/matching/engine'
import { configurationUsed, saveConfiguration, updateConfigurationMetadata } from './services'
import type { ConfigRow, ConfigDraft, Configuration } from './services'
import { useMatchingResource } from './useMatchingResource'
const suggestion: Configuration = { algorithm_version: ALGORITHM_VERSION, minimum_recommended_score: 70, weights: { academic: 25, skills: 20, experience: 10, interests: 10, location: 10, preference: 10, semantic: 15 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false } }
export function ConfigurationEditor({ selected, periods, onSaved }: { selected: ConfigRow | null; periods: Row<'PYRUnibague_AcademicPeriods'>[]; onSaved: () => void }) {
  const [duplicate, setDuplicate] = useState(false)
  const loadUsed = useCallback(() => selected ? configurationUsed(selected.id) : Promise.resolve(false), [selected])
  const usage = useMatchingResource(loadUsed)
  const [draft, setDraft] = useState<ConfigDraft>(() => {
    let source = suggestion
    if (selected) { try { source = validateConfiguration(selected) } catch { /* Suggestion is explicitly presented below. */ } }
    return { ...source, weights: { ...source.weights }, rules: { ...source.rules }, name: selected?.name ?? '', academic_period_id: selected?.academic_period_id ?? null, is_active: selected?.is_active ?? false }
  })
  const total = COMPONENTS.reduce((sum, key) => sum + draft.weights[key], 0)
  const locked = Boolean(selected && !duplicate && (usage.loading || usage.error || usage.data !== false))
  const weightsValid = COMPONENTS.every(key => Number.isFinite(draft.weights[key]) && draft.weights[key] >= 0) && Math.abs(total - 100) < 1e-9
  if (usage.error) return <ErrorState title={usage.error} onRetry={usage.reload} />
  return <div className="module-stack">
    <h3>{duplicate ? 'Duplicar configuración' : selected ? 'Editar configuración' : 'Nueva configuración'}</h3>
    {!selected && <Alert title="Plantilla UX sugerida">Estos pesos y el umbral 70 son una sugerencia editable, no una regla institucional ni datos precargados. El modo semántico requiere activación explícita.</Alert>}
    {selected && <Button variant="secondary" onClick={() => { setDuplicate(true); setDraft(value => ({ ...value, name: `${selected.name} (copia)`.slice(0, 160), is_active: false })) }}>Duplicar configuración</Button>}
    {locked && <Alert title="Configuración histórica protegida">Puedes gestionar nombre y estado activo. Para cambiar pesos, umbral, reglas o periodo, duplica la configuración.</Alert>}
    <Editor label={duplicate ? 'Crear copia' : selected ? 'Guardar configuración' : 'Crear configuración'} onSave={async () => {
      if (locked && selected) await updateConfigurationMetadata(selected.id, draft.name, draft.is_active)
      else await saveConfiguration(draft, duplicate ? undefined : selected?.id)
      onSaved()
    }}>
      <Input label="Nombre de configuración" required maxLength={160} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <Checkbox label="Configuración activa" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />
      <fieldset disabled={locked}><legend>Significado del cálculo · {ALGORITHM_VERSION}</legend>
        <Select label="Periodo de la configuración" value={draft.academic_period_id ?? ''} onChange={e => setDraft({ ...draft, academic_period_id: e.target.value || null })}><option value="">Reutilizable entre periodos</option>{periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Input label="Umbral de recomendación" type="number" min={0} max={100} step="any" required value={draft.minimum_recommended_score} onChange={e => setDraft({ ...draft, minimum_recommended_score: e.target.valueAsNumber })} />
        <div className="form-grid">{COMPONENTS.map(key => <Input key={key} label={`Peso ${key} (%)`} type="number" min={0} max={100} step="0.0001" required value={Number.isNaN(draft.weights[key]) ? '' : draft.weights[key]} onChange={e => setDraft({ ...draft, weights: { ...draft.weights, [key]: e.target.valueAsNumber } })} />)}</div>
        <p role="status">Suma de pesos: {Number.isFinite(total) ? Number(total.toFixed(4)) : 'incompleta'} / 100</p>
        {!weightsValid && <Alert tone="error" title="Los pesos deben ser no negativos y sumar exactamente 100" />}
        <Checkbox label="Habilidades requeridas como filtro duro" checked={draft.rules.requiredSkillsAreHardConstraint} onChange={e => setDraft({ ...draft, rules: { ...draft.rules, requiredSkillsAreHardConstraint: e.target.checked } })} />
        <Checkbox label="Habilitar embeddings de información profesional" checked={draft.rules.semanticEnabled} onChange={e => setDraft({ ...draft, rules: { ...draft.rules, semanticEnabled: e.target.checked } })} />
      </fieldset>
    </Editor>
  </div>
}
