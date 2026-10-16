import { solveAssignments } from './solveAssignments'
import type { AssignmentSnapshot } from '../assignments/types'
self.onmessage = (event: MessageEvent<{ snapshot: AssignmentSnapshot; excluded: string[] }>) => {
  try { self.postMessage({ proposal: solveAssignments(event.data.snapshot, event.data.excluded) }) }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo calcular la propuesta.' }) }
}
