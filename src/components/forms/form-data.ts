export function text(form: FormData, key: string) { return String(form.get(key) ?? '').trim() }
