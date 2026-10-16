import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
let server
try {
 let occupied=false
 try{occupied=(await fetch('http://127.0.0.1:5484',{signal:AbortSignal.timeout(500)})).ok}catch{/* free */}
 if(occupied)throw new Error('Port 5484 must be free; do not reuse a server from another checkout.')
 server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5484','--strictPort'],{stdio:'inherit',env:{...process.env,VITE_SUPABASE_URL:'https://pyr-e2e.example.test',VITE_SUPABASE_ANON_KEY:'sb_publishable_e2e_fixture'}})
 let ready=false
 for(let attempt=0;attempt<100;attempt++){
  if(server.exitCode!==null)throw new Error('P6A server exited before startup')
  try{ready=(await fetch('http://127.0.0.1:5484',{signal:AbortSignal.timeout(500)})).ok}catch{/* startup */}
  if(ready)break
  await delay(200)
 }
 if(!ready)throw new Error('P6A server did not start')
 const runner=spawn(process.execPath,[resolve('node_modules/playwright/cli.js'),'test','-c','tests/advisors/playwright.config.ts',...process.argv.slice(2)],{stdio:'inherit',env:process.env})
 const [code]=await once(runner,'exit');process.exitCode=code??1
}catch(error){console.error(error.message);process.exitCode=1}
finally{if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill();await exited}}
