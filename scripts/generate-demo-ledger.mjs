import { mkdir, writeFile, access } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
try { await access('work/p12/cuentas-test.local.json'); process.exit(0) } catch (error) { if (error.code !== 'ENOENT') throw error }
const users = [
  ['estudiante','STUDENT','estudiantesunibague.edu.co'], ['estudiante2','STUDENT','estudiantesunibague.edu.co'], ['estudiante3','STUDENT','estudiantesunibague.edu.co'], ['estudiante4','STUDENT','estudiantesunibague.edu.co'],
  ['asesor','ADVISOR','unibague.edu.co'], ['asesor2','ADVISOR','unibague.edu.co'], ['entidad','ORGANIZATION','unibague.edu.co'], ['entidad2','ORGANIZATION','unibague.edu.co'], ['administrador','ADMIN','unibague.edu.co'],
].map(([name, role, domain]) => ({ name, role, email: `pyrdemo.${name}@${domain}`, display_name: `Pyrdemo ${name} (TEST)`, user_id: randomUUID(), password: `PyR!${randomBytes(36).toString('base64url')}7x` }))
await mkdir('work/p12', { recursive: true })
await writeFile('work/p12/cuentas-test.local.json', JSON.stringify({ version: 1, project_ref: 'irykykwhvattrduuqxhj', generated_at: new Date().toISOString(), accounts: users }, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
