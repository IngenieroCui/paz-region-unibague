// Explicitly authorized P11.1 TEST rotation. Never prints credentials or writes them to Git.
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { adminClient, publicClient, ref, check } from './supabase-admin.mjs'
if (!process.argv.includes('--apply')) throw Error('Use --apply to rotate the nine authorized TEST accounts')
const path=process.env.PYR_TEST_LEDGER || 'work/p11/cuentas-test.local.json'
const ledger=JSON.parse(await readFile(path,'utf8'))
assert.equal(ledger.project_ref,ref);assert.equal(ledger.accounts.length,9)
assert.equal(new Set(ledger.accounts.map(a=>a.user_id)).size,9)
const admin=await adminClient()
// Validate every target before any mutation. No broad account enumeration.
for(const account of ledger.accounts) {
 assert.match(account.email,/^pyrprueba\.(?:estudiante[2-4]?@estudiantesunibague\.edu\.co|(?:administrador|asesor2?|entidad2?)@unibague\.edu\.co)$/)
 const {user}=check(await admin.auth.admin.getUserById(account.user_id),'Verify TEST identity')
 assert.equal(user.email,account.email);assert.equal(user.user_metadata?.pyr_test_account,true)
}
for(const account of ledger.accounts) {
 account.p11_1_pending_password ||= 'PyR!'+randomBytes(36).toString('base64url')+'7x'
 await writeFile(path,JSON.stringify(ledger,null,2),{mode:0o600})
 check(await admin.auth.admin.updateUserById(account.user_id,{password:account.p11_1_pending_password}),'Rotate TEST password')
 account.password=account.p11_1_pending_password;delete account.p11_1_pending_password
 account.rotated_at=new Date().toISOString()
 await writeFile(path,JSON.stringify(ledger,null,2),{mode:0o600})
 const api=await publicClient()
 const session=check(await api.auth.signInWithPassword({email:account.email,password:account.password}),'Verify new login').session
 check(await admin.auth.admin.signOut(session.access_token,'global'),'Revoke TEST refresh sessions')
 await api.auth.signOut()
 console.log('PASS TEST rotation and global session revocation:',account.role)
}
