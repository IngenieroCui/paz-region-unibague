// Solo Auth Admin oficial. No SQL sobre contraseñas, invitaciones ni correo.
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { adminClient, ledger, ledgerPath, check, login, save } from './p10-context.mjs'
if(!process.argv.includes('--apply')) throw Error('Requiere --apply: rota exclusivamente las nueve identidades P9 conocidas.')
const admin=await adminClient(), targets=new Set(ledger.accounts.map(a=>a.user_id))
async function allUsers() {
 const users=[]
 for(let page=1;page<=100;page++) { const data=check(await admin.auth.admin.listUsers({page,perPage:1000}),'Inventario Auth');users.push(...data.users);if(data.users.length<1000)return users }
 throw Error('Inventario demasiado grande')
}
const before=await allUsers()
for(const a of ledger.accounts) {
 const u=before.find(u=>u.id===a.user_id)
 assert.ok(u?.user_metadata?.pyr_test_account===true && u.email===a.email,'Solo identidades P9 TEST')
}
const report=[]
for(const a of ledger.accounts) {
 // Persistir la nueva contraseña antes de solicitar la rotación permite reintentar
 // incluso si se corta la ejecución. El archivo previo permanece solo en work/.
 if(!a.p10_rotation_pending) {
  a.p10_rotation_pending=`PyR!${randomBytes(36).toString('base64url')}7x`
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2),{mode:0o600})
 }
 check(await admin.auth.admin.updateUserById(a.user_id,{password:a.p10_rotation_pending}),'Rotación Auth Admin')
 a.password=a.p10_rotation_pending;delete a.p10_rotation_pending;a.rotated_at=new Date().toISOString()
 await writeFile(ledgerPath,JSON.stringify(ledger,null,2),{mode:0o600})
 const c=await login(a),session=check(await c.auth.getSession(),'Sesión de verificación').session
 check(await admin.auth.admin.signOut(session.access_token,'global'),'Revocación global')
 // Verificar una nueva sesión después de revocar las anteriores.
 const verify=await login(a);await verify.auth.signOut()
 report.push({user_id:a.user_id,role:a.role,rotated:true,login:true,global_signout:true})
 console.log('PASS rotación, login y revocación:',a.role,a.user_id)
}
const after=await allUsers()
const outsiders=users=>users.filter(u=>!targets.has(u.id)).map(u=>({id:u.id,email:u.email,updated_at:u.updated_at,app_metadata:u.app_metadata,user_metadata:u.user_metadata})).sort((a,b)=>a.id.localeCompare(b.id))
assert.ok(JSON.stringify(outsiders(after))===JSON.stringify(outsiders(before)),'Las identidades ajenas deben permanecer sin modificaciones')
await save('rotation-results.json',{accounts:report,unrelated_users_unchanged:true,unrelated_user_count:outsiders(after).length,note:'Revocados refresh tokens; los JWT ya emitidos pueden durar hasta su expiración.'})
