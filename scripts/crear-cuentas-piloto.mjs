/**
 * Cuentas ficticias de prueba PYR para una base de desarrollo autorizada.
 * Ejecutar SOLO desde la raíz del worktree P8 con Node >=22 y npm ci.
 * No modifica Auth en modo vista previa. No mostrar tokens ni claves en consola.
 */
import { randomBytes } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const PROJECT_REF = 'flrdqhemgbrdclgeynpk'
const URL = `https://${PROJECT_REF}.supabase.co`
const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const CHECK = args.has('--check-collisions')
const CONFIRM = args.has('--confirmo-correos-ficticios')
const USERS = [
  { first:'Pyrprueba', last:'Estudiante', suffix:'', role:'STUDENT' },
  { first:'Pyrprueba', last:'Estudiante', suffix:'2', role:'STUDENT' },
  { first:'Pyrprueba', last:'Estudiante', suffix:'3', role:'STUDENT' },
  { first:'Pyrprueba', last:'Estudiante', suffix:'4', role:'STUDENT' },
  { first:'Pyrprueba', last:'Administrador', suffix:'', role:'ADMIN' },
  { first:'Pyrprueba', last:'Asesor', suffix:'', role:'ADVISOR' },
  { first:'Pyrprueba', last:'Asesor', suffix:'2', role:'ADVISOR' },
  { first:'Pyrprueba', last:'Entidad', suffix:'', role:'ORGANIZATION' },
  { first:'Pyrprueba', last:'Entidad', suffix:'2', role:'ORGANIZATION' },
].map(user => ({
 ...user,
 email: `${user.first.toLowerCase()}.${user.last.toLowerCase()}${user.suffix}@${user.role === 'STUDENT' ? 'estudiantesunibague.edu.co' : 'unibague.edu.co'}`,
 display_name: `${user.first} ${user.last}${user.suffix ? ' ' + user.suffix : ''} (TEST)`
}))

const outputDir = resolve('work/p9')
const outputPath = join(outputDir, 'cuentas-institucionales.local.json')

function loadEnv(text) {
  const values={}
  for(const line of text.split(/\r?\n/)) {
    const match=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if(!match)continue
    let value=match[2]
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1)
    values[match[1]]=value
  }
  return values
}

async function localAccessToken() {
  if(process.env.SUPABASE_ACCESS_TOKEN)return process.env.SUPABASE_ACCESS_TOKEN
  const envFile=process.env.PYR_ADMIN_ENV_FILE || 'work/p8/admin.env'
  try {
    const env=loadEnv(await readFile(resolve(envFile),'utf8'))
    return env.SUPABASE_ACCESS_TOKEN
  } catch {return undefined}
}

function newPassword() {
  // 48+ caracteres, no claves compartidas entre usuarios.
  return `PyR!${randomBytes(36).toString('base64url')}7x`
}

async function main(){
  console.log('Cuentas ficticias propuestas (NO corresponden a buzones reales verificados):')
  for(const u of USERS)console.log(`${u.role.padEnd(13)} ${u.email}`)
  if(!APPLY && !CHECK) {
    console.log('\nVISTA PREVIA. No se ha creado ningún usuario.')
    console.log('Aplicación: node scripts/crear-cuentas-piloto.mjs --apply --confirmo-correos-ficticios')
    return
  }
  if(APPLY && !CONFIRM)throw Error('Para ejecutar, confirma explícitamente que son direcciones ficticias de prueba y que no se enviarán invitaciones ni correos.')
  const token=await localAccessToken()
  if(!token)throw Error('Falta SUPABASE_ACCESS_TOKEN en work/p8/admin.env o en variable de entorno. No lo pegues en el chat.')
  const keysReq=await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys?reveal=true`,{
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},
    signal:AbortSignal.timeout(20000)
  })
  if(!keysReq.ok)throw Error(`No se pudieron consultar credenciales administrativas (${keysReq.status}); verifica permisos del PAT.`)
  const keysBody=await keysReq.json()
  const keys=Array.isArray(keysBody) ? keysBody : keysBody.keys || []
  const keyInfo=keys.find(k=>k.type==='secret'&&k.api_key)||keys.find(k=>k.name==='service_role'&&k.api_key)
  if(!keyInfo)throw Error('No se encontró una clave secret/service_role en Management API. Consultar Settings > API Keys; no crear claves nuevas automáticamente.')
  const { createClient } = await import('@supabase/supabase-js')
  const client=createClient(URL,keyInfo.api_key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  })
  const {data:roles,error:rolesError}=await client.from('PYRUnibague_Roles').select('id,code')
  if(rolesError)throw Error(`No se pudo consultar catálogo Roles: ${rolesError.message}`)
  const roleIds=new Map((roles||[]).map(r=>[r.code,r.id]))
  for(const u of USERS)if(!roleIds.get(u.role))throw Error(`El rol ${u.role} no existe en el catálogo persistido`)
  // Salida exclusiva local ignorada por Git; nunca exponer por consola.
  await mkdir(outputDir,{recursive:true,mode:0o700})
  let ledger={project_ref:PROJECT_REF,warning:'SOLO TEST. Eliminar antes de producción o impedir recuperación por correo en cuentas ficticias.',accounts:[]}
  try {ledger=JSON.parse(await readFile(outputPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
  if(ledger.project_ref!==PROJECT_REF)throw Error('El archivo de credenciales local corresponde a otro proyecto.')
  const recorded=new Set(ledger.accounts.map(a=>a.email))
  const existing=[]
  let page=1
  while(true){
    const {data,error}=await client.auth.admin.listUsers({page,perPage:1000})
    if(error)throw Error(`No se pudo consultar usuarios de Auth: ${error.message}`)
    existing.push(...(data.users||[]))
    if(!data.users||data.users.length<1000)break
    page++
    if(page>10)throw Error('Demasiadas páginas de usuarios para comprobar duplicados')
  }
  const emailMap=new Map(existing.map(x=>[x.email?.toLowerCase(),x]))
  const collisions=USERS.filter(u=>emailMap.has(u.email) && !ledger.accounts.some(a=>a.email===u.email && a.user_id===emailMap.get(u.email).id))
  if(collisions.length)throw Error(`Colisiones con cuentas ajenas al registro local: ${collisions.map(u=>u.email).join(', ')}. No se modifica ninguna cuenta.`)
  if(CHECK && !APPLY) {
    for(const u of USERS)console.log(`${emailMap.has(u.email)?'TEST PROPIO':'DISPONIBLE'} ${u.email}`)
    console.log('Comprobación completada, sin cambios en Auth ni permisos.')
    return
  }
  let incomplete=0
  for(const u of USERS){
    if(emailMap.has(u.email)){
      console.log(`EXISTE   ${u.email} — no se modifica contraseña ni permisos de cuentas preexistentes.`)
      continue
    }
    if(recorded.has(u.email)){
      console.log(`REGISTRO ${u.email} — verificar manualmente; no duplicar.`)
      continue
    }
    const password=newPassword()
    const {data,error}=await client.auth.admin.createUser({
      email:u.email,password,email_confirm:true,
      user_metadata:{display_name:u.display_name,pyr_test_account:true},
    })
    if(error||!data?.user?.id){console.log(`ERROR Auth ${u.email}: ${error?.message||'no se devolvió ID'}`);incomplete++;continue}
    const userId=data.user.id
    // Registrar localmente ANTES de operaciones posteriores, para conservar credenciales si algo falla.
    ledger.accounts.push({email:u.email,password,role:u.role,user_id:userId,display_name:u.display_name,created_at:new Date().toISOString()})
    await writeFile(outputPath,JSON.stringify(ledger,null,2),{mode:0o600,flag:'w'})
    const {error:profileError}=await client.from('PYRUnibague_UserProfiles').upsert({
      user_id:userId,display_name:u.display_name,institutional_email:u.email
    },{onConflict:'user_id'})
    const {error:roleError}=await client.from('PYRUnibague_UserRoles').insert({user_id:userId,role_id:roleIds.get(u.role)})
    let staffError
    if(!profileError && !roleError && u.role==='ADVISOR') {
      const result=await client.from('PYRUnibague_StaffProfiles').insert({user_id:userId,staff_code:`TEST-P9-ADVISOR${u.suffix||'1'}`,academic_unit:'TEST · Paz y Región',status:'active'})
      staffError=result.error
    }
    if(profileError||roleError||staffError){
      incomplete++
      console.log(`PARCIAL  ${u.email}: Auth creado; verificar perfil/rol en el panel de administración antes de entrar.`)
      continue
    }
    console.log(`CREADO   ${u.email} (${u.role})`)
  }
  console.log(`\nCredenciales locales: ${outputPath}`)
  console.log('No compartir este archivo, ni subirlo a Git o a la conversación. Cambiar/eliminar estas cuentas antes del lanzamiento.')
  if(incomplete)throw Error(`${incomplete} cuentas incompletas; revisar el registro local antes de repetir. No se modifican automáticamente usuarios existentes.`)
}
main().catch(e=>{console.error('Error:',e.message);process.exitCode=1})
