import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024})
const privateValues=[]
for(const path of ['.env','.env.local']) {
  try { for(const [name,value] of Object.entries(parseEnv(await readFile(path,'utf8')))) if(/SECRET|PASSWORD|TOKEN|SERVICE_ROLE/.test(name)&&value.length>12)privateValues.push(value) }
  catch(error){if(error.code!=='ENOENT')throw error}
}
try { const ledger=JSON.parse(await readFile('work/p11/cuentas-test.local.json','utf8'));for(const account of ledger.accounts)if(account.password)privateValues.push(account.password) }
catch(error){if(error.code!=='ENOENT')throw error}
const paths=git('ls-files').toString().trim().split('\n')
const forbidden=/(^|\/)(work|node_modules|admin\.env)(\/|$)|(^|\/)\.env(?:$|\.(?!example$)[^/]+$)|\.local\.json$|\.log$/i
const findings=paths.filter(path=>forbidden.test(path)).map(path=>({path,reason:'private tracked path'}))
const pattern=/sb_secret_[a-zA-Z0-9_-]{15,}|sbp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
const objects=new Map()
for(const line of git('ls-files','--stage').toString().trim().split('\n')){const match=line.match(/^\d+ ([0-9a-f]+) \d\t(.+)$/);if(match)objects.set(match[1],match[2])}
for(const line of git('rev-list','--objects','origin/dev..HEAD').toString().trim().split('\n')){const[oid,...path]=line.split(' ');if(oid)objects.set(oid,path.join(' '))}
let blobs=0
for(const[oid,path]of objects){if(git('cat-file','-t',oid).toString().trim()!=='blob')continue;blobs++;const bytes=git('cat-file','blob',oid);if(pattern.test(bytes.toString('utf8'))||privateValues.some(value=>bytes.includes(Buffer.from(value))))findings.push({path,oid,reason:'possible secret'});if(forbidden.test(path))findings.push({path,oid,reason:'private path in new history'})}
console.log(JSON.stringify({tracked:paths.length,blobs_scanned:blobs,findings},null,2));if(findings.length)process.exitCode=1
