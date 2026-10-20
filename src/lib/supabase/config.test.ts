import { describe, expect, it } from 'vitest'
import { readSupabaseConfiguration } from './config'
describe('Supabase public configuration', () => {
  it('rejects an anon JWT belonging to a different hosted project', () => {
    const token = 'header.' + btoa(JSON.stringify({ role: 'anon', ref: 'another-project' })) + '.signature'
    expect(readSupabaseConfiguration('https://unxiuzkhxlzneywtnuvf.supabase.co', token).status).toBe('invalid')
  })
  it('allows the UI to start without credentials', () => {
    expect(readSupabaseConfiguration().status).toBe('missing')
  })
  it('rejects private and malformed configuration', () => {
    expect(readSupabaseConfiguration('https://example.supabase.co', 'sb_secret_test').status).toBe('invalid')
    expect(readSupabaseConfiguration('not a URL', 'sb_publishable_test').status).toBe('invalid')
    expect(readSupabaseConfiguration('https://user:secret@example.supabase.co', 'sb_publishable_test').status).toBe('invalid')
    const token = 'header.' + btoa(JSON.stringify({ role: 'service_role' })) + '.signature'
    expect(readSupabaseConfiguration('https://example.supabase.co', token).status).toBe('invalid')
  })
  it('accepts a public publishable or legacy anon key without network requests', () => {
    expect(readSupabaseConfiguration('https://unxiuzkhxlzneywtnuvf.supabase.co', 'sb_publishable_test').status).toBe('ready')
    const token = 'header.' + btoa(JSON.stringify({ role: 'anon' })) + '.signature'
    expect(readSupabaseConfiguration('https://unxiuzkhxlzneywtnuvf.supabase.co', token).status).toBe('ready')
  })
  it('normalizes public keys and supports base64url JWT payloads', () => {
    const payload = btoa(JSON.stringify({ role: 'anon', marker: 'ÿÿÿ' })).replace(/\+/g, '-').replace(/\//g, '_')
    expect(readSupabaseConfiguration(' https://unxiuzkhxlzneywtnuvf.supabase.co ', 'header.' + payload + '.signature').status).toBe('ready')
    const result = readSupabaseConfiguration('https://unxiuzkhxlzneywtnuvf.supabase.co', ' sb_publishable_test ')
    expect(result.status === 'ready' && result.key).toBe('sb_publishable_test')
  })
  it('rejects another hosted project even when its publishable key is syntactically valid', () => {
    expect(readSupabaseConfiguration('https://another-project.supabase.co', 'sb_publishable_test').status).toBe('invalid')
  })
})
