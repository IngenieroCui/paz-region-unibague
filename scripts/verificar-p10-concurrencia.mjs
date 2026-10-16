// Dos sesiones PostgreSQL reales, exclusivamente UUID P9/P10 ya existentes.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { connect } from './p10-db.mjs'
import { ledger, login, check, save } from './p10-context.mjs'
const f=JSON.parse(await readFile('work/p10/fixtures.json','utf8'))
const owner=ledger.accounts.find(a=>a.role==='ADMIN'),api=await login(owner)
const observer=await connect(),a=await connect(),b=await connect(),report=[]
async function begin(db) {await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.user_id]);await db.query("set local statement_timeout='15s'")}
try {
 await begin(a);await begin(b)
 const revision=(await a.query('select public.pyr_unibague_assignment_snapshot($1,null) as state',[f.period.id])).rows[0].state.revision
 const action={student_id:f.students[2].id,position_id:f.positions.find(p=>p.project_id===f.projects[0].id&&p.title.includes('Sistemas')).id,source:'MANUAL',allow_unscored:true,reason_code:'COORDINATION_REQUEST',reason_text:'TEST P10 · Concurrencia real, restaurar escenario final.'}
 const query='select public.pyr_unibague_confirm_assignment($1,null,$2,$3::jsonb)'
 await a.query(query,[f.period.id,revision,action])
 const pid=(await b.query('select pg_backend_pid() as pid')).rows[0].pid
 const pending=b.query(query,[f.period.id,revision,{...action,position_id:f.positions.find(p=>p.project_id===f.projects[1].id).id}]).then(()=> 'UNEXPECTED_SUCCESS',e=>e.code)
 let locked=false
 for(let i=0;i<80;i++){if((await observer.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){locked=true;break}await delay(50)}
 assert.equal(locked,true);await a.query('commit');assert.equal(await pending,'P0001');await b.query('rollback')
 const checkRows=(await observer.query('select count(*)::int as count from public."PYRUnibague_Assignments" where student_id=$1 and academic_period_id=$2 and is_active',[f.students[2].id,f.period.id])).rows
 assert.equal(checkRows[0].count,1)
 assert.equal((await observer.query('select count(*)::int as count from (select pp.id from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_Assignments" x on x.project_position_id=pp.id and x.is_active where x.academic_period_id=$1 group by pp.id,pp.capacity having count(*)>pp.capacity) excess',[f.period.id])).rows[0].count,0)
 report.push({label:'Dos confirmaciones reales serializadas; propuesta obsoleta rechazada; unicidad y cupos conservados',status:'PASS'})
 console.log('PASS concurrencia real de asignaciones')
} finally {
 await Promise.allSettled([a.query('rollback'),b.query('rollback')])
 // Restaurar E3 sin asignación, incluso ante un fallo de la segunda sesión.
 const prior=check(await api.from('PYRUnibague_Assignments').select('id').eq('student_id',f.students[2].id).eq('academic_period_id',f.period.id).eq('is_active',true),'Restauración TEST')
 if(prior.length) {
  const state=check(await api.rpc('pyr_unibague_assignment_snapshot',{p_period_id:f.period.id,p_run_id:null}),'Snapshot de restauración')
  check(await api.rpc('pyr_unibague_unassign_assignment',{p_period_id:f.period.id,p_run_id:null,p_revision:state.revision,p_action:{student_id:f.students[2].id,assignment_id:prior[0].id,reason_code:'COORDINATION_REQUEST',reason_text:'TEST P10 · Restaurar estudiante elegible sin asignación.'}}),'Restaurar E3')
 }
 check(await api.rpc('pyr_unibague_change_student_advisor',{p_participation_id:f.participations[2].id,p_advisor_id:f.staff[1].id}),'Restaurar asesor E3')
 await api.auth.signOut({scope:'local'});await Promise.allSettled([observer.end(),a.end(),b.end()]);await save('concurrency-results.json',report)
}
