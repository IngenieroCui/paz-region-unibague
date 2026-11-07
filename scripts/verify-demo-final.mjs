import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { context, readManifest, rows, table, check } from './p12-context.mjs'
const m=await readManifest()
const c=await context()
try {
 const results={checked_at:new Date().toISOString(),accounts:c.clients.map(x=>({email:x.account.email,role:x.account.role,login:'PASS'})),checks:[]}
 assert.equal(m.students.length,4); assert.equal(m.organizations.length,2); assert.equal(m.projects.length,2)
 const projects=[]
 for(const id of m.projects){const p=(await rows(c.admin,'Projects',{id}))[0];assert.equal(p.status,'approved');const positions=await rows(c.admin,'ProjectPositions',{project_id:id});assert(positions.length);assert(positions.some(p=>p.is_active&&p.capacity>0));projects.push({id,name:p.name,status:p.status,positions:positions.map(p=>({id:p.id,capacity:p.capacity}))})}
 results.projects=projects
 const runs=await rows(c.admin,'MatchingRuns',{matching_configuration_id:m.configuration_id})
 const run=runs.sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];assert.equal(run.status,'completed')
 const candidates=await rows(c.admin,'MatchCandidates',{matching_run_id:run.id});assert.equal(candidates.length,run.summary.persisted_pairs)
 results.matching={id:run.id,status:run.status,summary:run.summary,candidates:candidates.map(p=>({id:p.id,student_id:p.student_id,project_position_id:p.project_position_id,total_score:p.total_score,is_eligible:p.is_eligible,blockers:p.blockers}))}
 const adminWrite=await table(c.admin,'MatchingConfigurations').update({is_active:true}).eq('id',m.configuration_id).select('id');check(adminWrite,'Operación ADMIN');assert.equal(adminWrite.data.length,1)
 results.checks.push({operation:'ADMIN configuration update',result:'PASS'})
 const student=c.byRole('STUDENT')[0]
 const denied=await student.client.functions.invoke('matching-run',{body:{academic_period_id:m.period_id,matching_configuration_id:m.configuration_id}})
 assert(denied.error);results.checks.push({operation:'STUDENT executes matching',result:'REJECTED',status:denied.error.context?.status??403})
 const forbidden=await table(student.client,'MatchingConfigurations').insert({name:'FORBIDDEN DEMO',academic_period_id:m.period_id,algorithm_version:'hybrid-v0.1',minimum_recommended_score:50,weights:{academic:40,skills:30,experience:0,interests:0,location:10,preference:20,semantic:0},rules:{requiredSkillsAreHardConstraint:true,semanticEnabled:false},is_active:true})
 assert.equal(forbidden.error?.code,'42501');results.checks.push({operation:'STUDENT administrative write',result:'REJECTED',code:forbidden.error.code})
 for(const advisor of c.byRole('ADVISOR')){const assignments=await rows(advisor.client,'AdvisorOrganizationAssignments',{is_current:true});assert(assignments.length);results.checks.push({operation:'ADVISOR reads own organization responsibilities',email:advisor.account.email,count:assignments.length,result:'PASS'})}
 for(const org of c.byRole('ORGANIZATION')){const own=await rows(org.client,'Organizations',{created_by:org.account.user_id});assert(own.length);results.checks.push({operation:'ORGANIZATION reads own data',email:org.account.email,count:own.length,result:'PASS'})}
 await writeFile('work/p12/verification-final.local.json',JSON.stringify(results,null,2))
 console.log(JSON.stringify({accounts:results.accounts,projects:results.projects,matching:{id:run.id,summary:run.summary},checks:results.checks},null,2))
} finally {await c.close()}
