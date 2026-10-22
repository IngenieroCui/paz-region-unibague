// Real Edge + hosted Supabase. Only aggregate timings, route names and byte counts are saved.
import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
const label = process.argv[2] || 'after'
const base = process.env.PYR_TEST_BASE_URL || 'http://127.0.0.1:5881'
const ledger = JSON.parse(await readFile('work/p11/cuentas-test.local.json', 'utf8'))
if (ledger.project_ref !== 'unxiuzkhxlzneywtnuvf') throw Error('Unexpected TEST project')
const out = `work/p11-1/${label}`
await mkdir(out, { recursive: true })
const child = process.env.PYR_TEST_BASE_URL ? null : spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5881', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const results = []
let browser
try {
  for (let i=0; i<100; i++) { try { if ((await fetch(base)).ok) break } catch {} await delay(200) }
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const role of ['STUDENT','ORGANIZATION','ADVISOR','ADMIN']) {
    if(process.env.PYR_MEASURE_ROLE && process.env.PYR_MEASURE_ROLE!==role) continue
    const account = ledger.accounts.find(a => a.role === role)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    let requests = [], current = null
    page.on('requestfinished', async request => {
      const url = new URL(request.url())
      if (url.hostname !== 'unxiuzkhxlzneywtnuvf.supabase.co' || !current) return
      const bucket = current
      const timing = request.timing(), sizes = await request.sizes().catch(() => ({}))
      bucket.push({ kind: url.pathname.includes('/auth/') ? 'auth' : url.pathname.split('/').at(-1), ms: Math.round(timing.responseEnd), bytes: sizes.responseBodySize ?? 0 })
    })
    await page.goto(base + (role === 'ORGANIZATION' ? '/login/organizaciones' : '/login/institucional'))
    await page.getByLabel('Correo electrónico', {exact:true}).fill(account.email)
    await page.getByLabel('Contraseña', {exact:true}).fill(account.password)
    current = requests
    const loginStart = performance.now()
    await page.getByRole('button', {name:'Ingresar', exact:true}).click()
    await page.waitForURL(/\/app\//)
    await page.waitForFunction(() => document.querySelector('main h2') && !document.querySelector('main .skeleton'))
    const loginUsefulMs = Math.round(performance.now() - loginStart)
    await page.waitForLoadState('networkidle')
    const route = '/app/' + role.toLowerCase()
    results.push({ role, operation:'login-to-useful', ms:loginUsefulMs, requests })
    for (let sample=0; sample<5; sample++) {
      requests = []; current = requests
      const start = performance.now()
      await page.goto(base + route)
      await page.waitForFunction(() => document.querySelector('main h2') && !document.querySelector('main .skeleton'))
      const usefulMs = Math.round(performance.now()-start)
      await page.waitForLoadState('networkidle')
      const resources = await page.evaluate(() => performance.getEntriesByType('resource').reduce((sum,e) => sum+(e.transferSize||0),0))
      results.push({ role, operation:sample===0?'cold-document':'warm-document', sample, ms:usefulMs, transferBytes:resources, requests })
    }
    const section=role==='ADMIN'?'settings':'profile'
    const homeHeading=await page.locator('main h1').innerText()
    const profileHeading=role==='ADMIN'?'Configuración y catálogos':role==='ORGANIZATION'?'Perfil de organización':'Mi perfil'
    for(const [operation,target] of [['spa-profile',route+'/'+section],['spa-home',route]]) {
      requests=[];current=requests
      const start=performance.now()
      await page.locator(`.desktop-sidebar a[href="${target}"]`).click()
      await page.waitForURL(url=>url.pathname===target)
      await expect(page.getByRole('heading',{level:1,name:operation==='spa-home'?homeHeading:profileHeading,exact:true})).toBeVisible()
      await page.waitForFunction(()=>document.querySelector('main h1')&&!document.querySelector('main .skeleton')&&!document.querySelector('main .loading-state'))
      const ms=Math.round(performance.now()-start)
      await page.waitForLoadState('networkidle')
      results.push({role,operation,ms,requests})
    }
    current = null
    for (const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:960})
      expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.screenshot({path:`${out}/${role}-${width}.png`,fullPage:true})
    }
    // Verify the existing skip link before changing its CSS.
    await page.goto(base+route); await page.waitForLoadState('networkidle')
    const skip = page.getByRole('link',{name:'Saltar al contenido',exact:true})
    expect((await skip.boundingBox()).y).toBeLessThan(0)
    await page.keyboard.press('Tab'); await expect(skip).toBeFocused()
    expect((await skip.boundingBox()).y).toBeGreaterThanOrEqual(0)
    await page.keyboard.press('Enter'); await expect(page.locator('#main')).toBeFocused()
    await ctx.close()
  }
} finally {
  await writeFile(`${out}/measurements.json`,JSON.stringify({label,base,browser:'Edge, headless, 1440x960, no throttling, SW blocked',results},null,2))
  await browser?.close()
  if (child && child.exitCode===null) { const done=once(child,'exit');child.kill();await done }
}
console.log(JSON.stringify(results.map(r=>({role:r.role,operation:r.operation,ms:r.ms,requests:r.requests.length,bytes:r.requests.reduce((sum,x)=>sum+x.bytes,0)}))))
