// Escanea blobs staged e historial nuevo. Imprime rutas/IDs, nunca coincidencias.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024})
const secrets=[]
for(const path of ['work/p9/cuentas-institucionales.local.json',process.env.PYR_P8_FIXTURES].filter(Boolean)) {
 const data=JSON.parse(await readFile(path,'utf8'));for(const u of data.accounts??data.users??[])if(u.password)secrets.push(u.password)
}
if(process.env.PYR_ADMIN_ENV_FILE)for(const [key,value] of Object.entries(parseEnv(await readFile(process.env.PYR_ADMIN_ENV_FILE,'utf8'))))if(/TOKEN|PASSWORD|SECRET|SERVICE/.test(key)&&value.length>15)secrets.push(value)
const paths=git('ls-files').toString().trim().split('\n')
const forbidden=/(^|\/)(work|node_modules|\.env\.local|admin\.env)(\/|$)|\.local\.json$|\.log$/i
const findings=paths.filter(p=>forbidden.test(p)).map(path=>({path,reason:'ruta privada versionada'}))
const objects=new Map()
for(const line of git('rev-list','--objects','origin/dev..HEAD').toString().trim().split('\n')) {const [oid,...path]=line.split(' ');if(oid)objects.set(oid,path.join(' '))}
for(const line of git('ls-files','--stage').toString().trim().split('\n')){const m=line.match(/^\d+ ([0-9a-f]+) \d\t(.+)$/);if(m)objects.set(m[1],m[2])}
const pattern=/sb_secret_[a-zA-Z0-9_-]{15,}|sbp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
let blobs=0
for(const [oid,path] of objects) {
 if(git('cat-file','-t',oid).toString().trim()!=='blob')continue
 blobs++;const bytes=git('cat-file','blob',oid),text=bytes.toString('utf8')
 if(secrets.some(secret=>bytes.includes(Buffer.from(secret)))||pattern.test(text))findings.push({oid,path,reason:'posible secreto en blob'})
 if(forbidden.test(path))findings.push({oid,path,reason:'ruta privada en historial nuevo'})
}
console.log(JSON.stringify({tracked:paths.length,blobs_scanned:blobs,findings},null,2))
if(findings.length)process.exitCode=1
