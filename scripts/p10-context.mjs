import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parseEnv } from 'node:util'

export { ref, url, adminClient, publicClient, check } from './supabase-admin.mjs'
import { ref, publicClient, check, environment } from './supabase-admin.mjs'
export const ledgerPath = process.env.PYR_P10_LEDGER || 'work/p11/cuentas-test.local.json'
export const ledger = JSON.parse(await readFile(ledgerPath,'utf8'))
const expected = [['estudiante','STUDENT'],['estudiante2','STUDENT'],['estudiante3','STUDENT'],['estudiante4','STUDENT'],['administrador','ADMIN'],['asesor','ADVISOR'],['asesor2','ADVISOR'],['entidad','ORGANIZATION'],['entidad2','ORGANIZATION']]
if (ledger.project_ref !== ref || ledger.accounts.length !== 9 || expected.some(([name,role])=>!ledger.accounts.some(a=>a.user_id&&a.role===role&&a.email===`pyrprueba.${name}@${role==='STUDENT'?'estudiantesunibague.edu.co':'unibague.edu.co'}`))) throw Error('Registro TEST incompatible con el proyecto actual.')
export async function management(path,body) {
 await environment()
 const file = process.env.PYR_ADMIN_ENV_FILE
 const local = file ? parseEnv(await readFile(file,'utf8')) : {}
 const token = process.env.SUPABASE_ACCESS_TOKEN || local.SUPABASE_ACCESS_TOKEN
 if(!token) throw Error('Esta operación Management/SQL requiere permisos de gestión o conexión PostgreSQL autorizada; la Secret API Key solo cubre Auth Admin y Data API.')
 const r = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)})
 if(!r.ok) throw Error(`Management ${path}: HTTP ${r.status}`)
 return r.json()
}
export async function login(account) {
 const c=await publicClient()
 const data=check(await c.auth.signInWithPassword({email:account.email,password:account.password}),'Login TEST')
 if(data.user.id!==account.user_id) throw Error('Identidad de login inesperada')
 const roles=check(await c.rpc('pyr_unibague_current_roles'),'Roles persistidos')
 if(JSON.stringify(roles)!==JSON.stringify([account.role])) throw Error('Rol persistido inesperado')
 return c
}
export async function save(name,value) {
 await mkdir('work/p10',{recursive:true})
 await writeFile(`work/p10/${name}`,JSON.stringify(value,null,2)+'\n',{mode:0o600})
}
