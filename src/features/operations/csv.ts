import type { ExportKind, ExportRow } from './services'

const columns: Record<ExportKind, readonly (readonly [string, string])[]> = {
  assignments: [['student', 'Estudiante'], ['organization', 'Organización'], ['project', 'Proyecto'], ['position', 'Plaza'], ['program', 'Programa académico'], ['advisor', 'Asesor individual vigente'], ['group', 'Grupo vigente'], ['status', 'Estado de asignación'], ['is_active', 'Vigente']],
  positions: [['organization', 'Organización'], ['project', 'Proyecto'], ['position', 'Plaza'], ['capacity', 'Capacidad'], ['occupied', 'Ocupación confirmada'], ['is_active', 'Plaza activa'], ['project_status', 'Estado del proyecto']],
}
export function csvCell(value: ExportRow[string] | undefined) {
  let text = value === null || value === undefined ? '' : String(value)
  // Excel may discard whitespace/control characters before evaluating a formula.
  const first = [...text].find(char => char.charCodeAt(0) > 32 && !/\s/u.test(char)) ?? ''
  if (['=', '+', '-', '@'].includes(first) || ['\t', '\r', '\n'].includes(text.charAt(0))) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
export function operationalCsv(kind: ExportKind, rows: ExportRow[]) {
  const fields = columns[kind]
  return '\ufeff' + [fields.map(([, label]) => csvCell(label)).join(';'), ...rows.map(row => fields.map(([key]) => csvCell(row[key])).join(';'))].join('\r\n') + '\r\n'
}
export function downloadCsv(kind: ExportKind, period: string, rows: ExportRow[]) {
  const url = URL.createObjectURL(new Blob([operationalCsv(kind, rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = `paz-region-${kind}-${period}.csv`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
