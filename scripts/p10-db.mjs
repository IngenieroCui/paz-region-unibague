import { readFile } from 'node:fs/promises'
import { management, ref } from './p10-context.mjs'
export async function connect() {
 if(!process.env.PYR_PG_MODULE||!process.env.PYR_PG_CA_FILE)throw Error('Configura driver PostgreSQL y CA locales, sin credenciales en argumentos.')
 const module=await import(process.env.PYR_PG_MODULE),Client=module.Client??module.default.Client
 const pools=await management('/config/database/pooler'),role=await management('/cli/login-role',{read_only:false})
 const db=new Client({host:pools[0].db_host,port:5432,database:pools[0].db_name,user:`${role.role}.${ref}`,password:role.password,ssl:{rejectUnauthorized:true,ca:await readFile(process.env.PYR_PG_CA_FILE,'utf8')},connectionTimeoutMillis:20000})
 await db.connect();await db.query('set role postgres')
 return db
}
