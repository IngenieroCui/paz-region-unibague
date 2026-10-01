import { useId } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
type Field = { label: string; hint?: string; error?: string }
function FieldText({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return <>{hint && <span id={id + '-hint'} className="field-hint">{hint}</span>}
    {error && <span id={id + '-error'} className="field-error" role="alert">{error}</span>}</>
}
function descriptions(id: string, hint?: string, error?: string) {
  return [hint ? id + '-hint' : '', error ? id + '-error' : ''].filter(Boolean).join(' ') || undefined
}
export function Input({ label, hint, error, id: providedId, ...props }: Field & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  return <div className="field"><label htmlFor={id}>{label}</label>
    <input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={descriptions(id, hint, error)} />
    <FieldText id={id} hint={hint} error={error} /></div>
}
export function Textarea({ label, hint, error, id: providedId, ...props }: Field & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  return <div className="field"><label htmlFor={id}>{label}</label>
    <textarea {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={descriptions(id, hint, error)} />
    <FieldText id={id} hint={hint} error={error} /></div>
}
export function Select({ label, hint, error, id: providedId, children, ...props }: Field & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  return <div className="field"><label htmlFor={id}>{label}</label>
    <select {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={descriptions(id, hint, error)}>{children}</select>
    <FieldText id={id} hint={hint} error={error} /></div>
}
export function Checkbox({ label, id: providedId, ...props }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  return <label className="checkbox" htmlFor={id}><input {...props} id={id} type="checkbox" />{label}</label>
}
export function SearchInput(props: Omit<Field & InputHTMLAttributes<HTMLInputElement>, 'type'>) { return <Input {...props} type="search" /> }
