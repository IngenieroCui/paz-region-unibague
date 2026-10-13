import type { AssignmentSnapshot, Proposal, ProposalRow } from '../assignments/types'

type Edge = { to: number; reverse: number; capacity: number; cost: number; row?: ProposalRow }
/** Binary heap ordered by (distance, node id); stable graph construction settles exact ties. */
class Heap {
  values: [number, number][] = []
  less(a: [number, number], b: [number, number]) { return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) }
  push(value: [number, number]) {
    const a = this.values; a.push(value); let i = a.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(value, a[p]!)) break; a[i] = a[p]!; i = p }
    a[i] = value
  }
  pop() {
    const a = this.values; const first = a[0]; const last = a.pop()
    if (!a.length || !last) return first
    let i = 0
    while (i * 2 + 1 < a.length) {
      let c = i * 2 + 1
      if (c + 1 < a.length && this.less(a[c + 1]!, a[c]!)) c++
      if (!this.less(a[c]!, last)) break
      a[i] = a[c]!; i = c
    }
    a[i] = last; return first
  }
}
const order = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/** Successive shortest augmenting paths, reduced costs + Dijkstra.
 * Exhaust flow first (maximum cardinality), minimize 10000-score in cents second.
 * P5 stores scores at two decimals. No Supabase dependency, input mutation, or greedy choice.
 * O(F E log V), O(V+E). Identifier order breaks equal-cost paths deterministically.
 */
export function solveAssignments(input: AssignmentSnapshot, excludedCandidateIds: readonly string[] = []): Proposal {
  const run = input.run
  if (!run || run.status !== 'completed' || run.periodId !== input.periodId) throw new Error('Selecciona una ejecución completada del mismo periodo.')
  if (run.threshold === null || !Number.isFinite(run.threshold) || run.threshold < 0 || run.threshold > 100) throw new Error('La ejecución no tiene un umbral histórico válido.')
  const students = [...input.students].sort(order)
  const positions = [...input.positions].sort(order)
  const studentMap = new Map(students.map(s => [s.id, s])); const positionMap = new Map(positions.map(p => [p.id, p]))
  if (studentMap.size !== students.length || positionMap.size !== positions.length) throw new Error('Identificadores duplicados en el pool.')
  const occupied: Record<string, number> = {}; const available: Record<string, number> = {}
  const assigned = new Set<string>()
  for (const a of input.existing) if (a.active && a.periodId === input.periodId) { assigned.add(a.studentId); occupied[a.positionId] = (occupied[a.positionId] ?? 0) + 1 }
  for (const p of positions) {
    if (!Number.isSafeInteger(p.capacity) || p.capacity < 0) throw new Error('Capacidad inválida.')
    if ((occupied[p.id] ?? 0) > p.capacity) throw new Error('La ocupación existente excede la capacidad. Requiere revisión administrativa.')
    available[p.id] = p.periodId === input.periodId && p.active && p.approved && p.validated ? p.capacity - (occupied[p.id] ?? 0) : 0
  }
  const free = students.filter(s => s.periodId === input.periodId && s.active && s.eligible && !assigned.has(s.id))
  const freeIds = new Set(free.map(s => s.id)); const excluded = new Set(excludedCandidateIds)
  const reasons = new Map(free.map(s => [s.id, new Set<string>()]))
  const candidates = [...input.candidates].sort(order).filter(c => {
    if (!freeIds.has(c.studentId)) return false
    const why = reasons.get(c.studentId)!
    const p = positionMap.get(c.positionId)
    let reason = ''
    if (c.runId !== run.id) reason = 'Candidato de otra ejecución'
    else if (!c.eligible || !Array.isArray(c.blockers) || c.blockers.length) reason = 'Candidato bloqueado'
    else if (c.currentEligible !== true) reason = 'Restricciones actuales de programa o habilidades'
    else if (c.score === null || !Number.isFinite(c.score) || c.score < 0 || c.score > 100 || Math.abs(c.score * 100 - Math.round(c.score * 100)) > 1e-7) reason = 'Score inválido'
    else if (c.score < run.threshold!) reason = 'Score debajo del umbral histórico'
    else if (!p || p.periodId !== input.periodId) reason = 'Plaza de otro periodo o inexistente'
    else if (!p.active || !p.approved || !p.validated || p.capacity <= 0) reason = 'Plaza no habilitada para asignación'
    else if (!available[p.id]) reason = 'Sin capacidad disponible'
    else if (excluded.has(c.id)) reason = 'Excluido por administración'
    if (reason) { why.add(reason); return false }
    return true
  })
  const size = 2 + free.length + positions.length; const sink = size - 1
  const graph: Edge[][] = Array.from({ length: size }, () => [])
  const add = (from: number, to: number, capacity: number, cost: number, row?: ProposalRow) => {
    graph[from]!.push({ to, capacity, cost, reverse: graph[to]!.length, row })
    graph[to]!.push({ to: from, capacity: 0, cost: -cost, reverse: graph[from]!.length - 1 })
  }
  const studentNodes = new Map(free.map((s, i) => [s.id, i + 1])); const positionNodes = new Map(positions.map((p, i) => [p.id, free.length + i + 1]))
  for (const s of free) add(0, studentNodes.get(s.id)!, 1, 0)
  for (const p of positions) add(positionNodes.get(p.id)!, sink, available[p.id] ?? 0, 0)
  const seen = new Set<string>()
  for (const c of candidates) {
    const pair = `${c.studentId}/${c.positionId}`
    if (seen.has(pair)) throw new Error('Parejas duplicadas en la ejecución.')
    seen.add(pair)
    add(studentNodes.get(c.studentId)!, positionNodes.get(c.positionId)!, 1, 10000 - Math.round(c.score! * 100), { studentId: c.studentId, positionId: c.positionId, candidateId: c.id, score: c.score! })
  }
  const potential = Array<number>(size).fill(0)
  while (true) {
    const dist = Array<number>(size).fill(Infinity); const prevNode = Array<number>(size).fill(-1); const prevEdge = Array<number>(size).fill(-1)
    const heap = new Heap(); dist[0] = 0; heap.push([0, 0])
    while (heap.values.length) {
      const [d, u] = heap.pop()!
      if (d !== dist[u]) continue
      for (let i = 0; i < graph[u]!.length; i++) {
        const e = graph[u]![i]!
        if (!e.capacity) continue
        const next = d + e.cost + potential[u]! - potential[e.to]!
        if (next < dist[e.to]!) { dist[e.to] = next; prevNode[e.to] = u; prevEdge[e.to] = i; heap.push([next, e.to]) }
      }
    }
    if (!Number.isFinite(dist[sink])) break
    for (let i = 0; i < size; i++) if (Number.isFinite(dist[i])) potential[i]! += dist[i]!
    for (let v = sink; v !== 0; v = prevNode[v]!) { const e = graph[prevNode[v]!]![prevEdge[v]!]!; e.capacity--; graph[v]![e.reverse]!.capacity++ }
  }
  const rows = free.flatMap(s => graph[studentNodes.get(s.id)!]!.filter(e => e.row && e.capacity === 0).map(e => e.row!))
  const chosen = new Set(rows.map(r => r.studentId))
  for (const row of rows) available[row.positionId]!--
  return { rows, totalScore: Math.round(rows.reduce((n, r) => n + r.score, 0) * 100) / 100, occupied, available,
    eligibleStudents: students.filter(s => s.active && s.eligible && s.periodId === input.periodId).length,
    unassigned: free.filter(s => !chosen.has(s.id)).map(s => ({ studentId: s.id, reasons: candidates.some(c => c.studentId === s.id) ? ['Capacidad distribuida por el óptimo global'] : [...reasons.get(s.id)!].length ? [...reasons.get(s.id)!] : ['Sin candidatos en la ejecución'] })) }
}
