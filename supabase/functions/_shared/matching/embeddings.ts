import { embeddingScore, positionText, studentSemanticText } from './engine.ts'
import type { Student, Position } from './engine.ts'
export type EmbeddingSettings = { baseUrl?: string; apiKey?: string; model?: string }
export type SemanticBatch = { mode: 'embeddings' | 'structured_only'; warnings: string[]; model: string | null; score: (student: Student, position: Position) => number | null }
const unavailable = (warning: string): SemanticBatch => ({ mode: 'structured_only', warnings: [warning], model: null, score: () => null })
/** Bounded batches of unique texts, never requests per pair. Vectors live only in memory. */
export async function prepareSemantic(students: Student[], positions: Position[], settings: EmbeddingSettings, request: typeof fetch = fetch): Promise<SemanticBatch> {
  if (!settings.baseUrl || !settings.apiKey || !settings.model) return unavailable('SEMANTIC_SETTINGS_MISSING')
  try {
    const base = new URL(settings.baseUrl)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Invalid embedding endpoint')
    const texts = [...new Set([...students.map(studentSemanticText), ...positions.map(positionText)].filter(text => text.trim()))]
    if (!texts.length) return unavailable('SEMANTIC_TEXTS_EMPTY')
    // Oversized texts fail closed rather than silently truncating professional evidence.
    if (texts.some(text => text.length > 20000)) return unavailable('SEMANTIC_TEXT_TOO_LONG')
    const vectors = new Map<string, number[]>()
    let dimensions: number | undefined
    const deadline = Date.now() + 40000
    for (let start = 0; start < texts.length; start += 32) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('Embedding budget exceeded')
      const inputs = texts.slice(start, start + 32)
      const response = await request(base.href.replace(/\/$/, '') + '/embeddings', {
        method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.model, input: inputs, encoding_format: 'float' }), signal: AbortSignal.timeout(Math.min(20000, remaining)),
      })
      if (!response.ok) throw new Error('Embedding provider failure')
      const payload: unknown = await response.json()
      if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data) || payload.data.length !== inputs.length) throw new Error('Invalid embeddings')
      const seen = new Set<number>()
      for (const item of payload.data) {
        if (!item || typeof item !== 'object' || !Number.isInteger(item.index) || item.index < 0 || item.index >= inputs.length || seen.has(item.index) || !Array.isArray(item.embedding) || !item.embedding.length || item.embedding.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('Invalid embedding')
        dimensions ??= item.embedding.length
        if (dimensions !== item.embedding.length || embeddingScore(item.embedding, item.embedding) === null) throw new Error('Invalid dimensions/norm')
        seen.add(item.index); vectors.set(inputs[item.index]!, item.embedding)
      }
    }
    return { mode: 'embeddings', warnings: [], model: settings.model, score: (student, position) => {
      const a = vectors.get(studentSemanticText(student)); const b = vectors.get(positionText(position))
      return a && b ? embeddingScore(a, b) : null
    } }
  } catch { return unavailable('SEMANTIC_PROVIDER_FAILED') }
}
