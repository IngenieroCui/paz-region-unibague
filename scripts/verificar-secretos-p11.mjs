import { execFileSync } from 'node:child_process'
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024})
const paths=git('ls-files').toString().trim().split('\n')
const forbidden=/(^|\/)(work|node_modules|\.env|\.env\.local|admin\.env)(\/|$)|\.local\.json$|\.log$/i
const findings=paths.filter(path=>forbidden.test(path)).map(path=>({path,reason:'private tracked path'}))
const pattern=/sb_secret_[a-zA-Z0-9_-]{15,}|sbp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
const objects=new Map()
for(const line of git('ls-files','--stage').toString().trim().split('\n')){const match=line.match(/^\d+ ([0-9a-f]+) \d\t(.+)$/);if(match)objects.set(match[1],match[2])}
for(const line of git('rev-list','--objects','origin/dev..HEAD').toString().trim().split('\n')){const[oid,...path]=line.split(' ');if(oid)objects.set(oid,path.join(' '))}
let blobs=0
for(const[oid,path]of objects){if(git('cat-file','-t',oid).toString().trim()!=='blob')continue;blobs++;if(pattern.test(git('cat-file','blob',oid).toString('utf8')))findings.push({path,oid,reason:'possible secret'});if(forbidden.test(path))findings.push({path,oid,reason:'private path in new history'})}
console.log(JSON.stringify({tracked:paths.length,blobs_scanned:blobs,findings},null,2));if(findings.length)process.exitCode=1
