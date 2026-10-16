// Read-only preflight; never falls back to the historical Supabase project.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parseEnv } from 'node:util'
const expected='unxiuzkhxlzneywtnuvf'
const environments=[]
for(const path of ['.env','.env.local']) {
  let content
  try { content=await readFile(path,'utf8') } catch(error){if(error.code==='ENOENT')continue;throw error}
  const values=parseEnv(content)
  if(values.VITE_SUPABASE_URL && new URL(values.VITE_SUPABASE_URL).hostname!==`${expected}.supabase.co`)throw new Error(`Project mismatch in ${path}; no network request made`)
  environments.push({path,values})
}
const values=Object.assign({},...environments.map(item=>item.values))
if(!values.VITE_SUPABASE_ANON_KEY||!values.VITE_SUPABASE_URL)throw new Error('Public environment unavailable')
if(values.VITE_SUPABASE_ANON_KEY.startsWith('sb_secret_'))throw new Error('Private key in frontend configuration')
if(values.VITE_SUPABASE_ANON_KEY.split('.').length===3){const payload=JSON.parse(Buffer.from(values.VITE_SUPABASE_ANON_KEY.split('.')[1],'base64url'));if(payload.role!=='anon'||(payload.ref&&payload.ref!==expected))throw new Error('Invalid public key/project pairing')}
const response=await fetch(`https://${expected}.supabase.co/auth/v1/settings`,{headers:{apikey:values.VITE_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(10000)})
if(!response.ok)throw new Error(`Auth settings HTTP ${response.status}`)
const settings=await response.json()
const result={checked_at:new Date().toISOString(),project:expected,environment_files:environments.map(item=>item.path),http_status:response.status,google_enabled:settings.external?.google===true,email_enabled:settings.external?.email===true,signup_disabled:settings.disable_signup,mailer_autoconfirm:settings.mailer_autoconfirm,frontend_google_enabled:values.VITE_INSTITUTIONAL_GOOGLE_ENABLED==='true',frontend_registration_enabled:values.VITE_EXTERNAL_REGISTRATION_ENABLED==='true',administrative_connection:'NOT CHECKED by this public-only preflight',smtp:'NOT VERIFIED; user requested no new accounts until University provides configuration',hosted_mutations:0,accounts_created:0}
await mkdir('docs/p11',{recursive:true});await writeFile('docs/p11/environment.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
