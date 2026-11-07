import { readFile } from 'node:fs/promises'
import { publicClient } from './supabase-admin.mjs'
const ledger = JSON.parse(await readFile(process.env.PYR_P12_LEDGER || 'work/p12/cuentas-test.local.json', 'utf8'))
const manifest = JSON.parse(await readFile('work/p12/manifest.local.json', 'utf8'))
const student = ledger.accounts.find(a => a.role === 'STUDENT')
const client = await publicClient()
const login = await client.auth.signInWithPassword({ email: student.email, password: student.password })
if (login.error) throw new Error('Student login failed')
const matching = await client.functions.invoke('matching-run', { body: { academic_period_id: manifest.period_id, matching_configuration_id: manifest.configuration_id } })
const forbiddenInsert = await client.from('PYRUnibague_MatchingConfigurations').insert({ name: 'FORBIDDEN DEMO', academic_period_id: manifest.period_id, algorithm_version: 'hybrid-v0.1', minimum_recommended_score: 50, weights: { academic: 40, skills: 30, experience: 0, interests: 0, location: 10, preference: 20, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false }, is_active: true })
if (!matching.error || !forbiddenInsert.error) throw new Error('Unauthorized operation was accepted')
console.log(JSON.stringify({ role: 'STUDENT', matching_rejected: true, matching_status: matching.error.context?.status ?? 403, admin_write_rejected: true, admin_write_code: forbiddenInsert.error.code ?? 'RLS' }))
await client.auth.signOut()
