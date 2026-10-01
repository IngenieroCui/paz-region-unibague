import type { Page } from '@playwright/test'
type Row=Record<string,unknown>
export async function p4Api(page:Page,role:'ADMIN'|'ORGANIZATION'='ADMIN',options:{readOnly?:boolean;count?:number;emptyCatalogs?:boolean}={}){
 const now='2026-10-01T12:00:00Z',uid='04000000-0000-0000-0000-00000000000'+(role==='ADMIN'?'1':'2'),oid='44000000-0000-0000-0000-000000000001',sid='84000000-0000-0000-0000-000000000001',pid='14000000-0000-0000-0000-000000000001',projectId='54000000-0000-0000-0000-000000000001'
 const tables:Record<string,Row[]>={};const names=['UserProfiles','Roles','UserRoles','AcademicPeriods','AcademicPrograms','Municipalities','OrganizationTypes','Skills','Students','StudentExperiences','StudentSkills','StudentInterests','StudentLocationPreferences','StudentDocuments','StudentPeriodParticipations','Organizations','OrganizationMembers','OrganizationDocuments','OrganizationReviews','Projects','ProjectPositions','ProjectPositionPrograms','ProjectPositionSkills','ProjectRequirements','SystemConfigurations','FeatureFlags','AuditLogs']
 names.forEach(name=>tables['PYRUnibague_'+name]=[])
 const table=(name:string)=>tables['PYRUnibague_'+name]!
 table('UserProfiles').push({user_id:uid,display_name:'Cuenta P4',institutional_email:'p4@example.test',created_at:now,updated_at:now},{user_id:'04000000-0000-0000-0000-000000000005',display_name:'Estudiante P4',institutional_email:'student@example.test',created_at:now,updated_at:now})
 table('Roles').push(...['ADMIN','ORGANIZATION','STUDENT'].map(code=>({id:code.toLowerCase(),code,name:code})))
 table('UserRoles').push({id:'role-a',user_id:uid,role_id:role.toLowerCase()})
 table('AcademicPeriods').push({id:pid,code:'2026B',name:'Periodo P4',status:'configured',is_current:true,starts_on:'2026-07-01',ends_on:'2026-12-01',created_at:now,updated_at:now})
 if(!options.emptyCatalogs){table('AcademicPrograms').push({id:'program',code:'P4',name:'Programa P4',active:true});table('Municipalities').push({id:'municipality',municipality_name:'Municipio P4',department_name:'Departamento P4',active:true});table('Skills').push({id:'skill',name:'Habilidad P4',active:true});table('OrganizationTypes').push({id:'type',code:'P4',name:'Tipo P4',active:true})}
 table('Organizations').push({id:oid,legal_name:'Organización P4',organization_type_id:'type',municipality_id:'municipality',status:'pending_review',verified_at:null,verified_by:null,created_at:now,updated_at:now})
 table('OrganizationMembers').push({id:'member',organization_id:oid,user_id:uid,membership_role:'manager',status:'active',can_manage:!options.readOnly,is_primary_contact:true})
 table('Students').push({id:sid,user_id:'04000000-0000-0000-0000-000000000005',student_code:'P4-S',academic_program_id:'program',current_semester:6,bio:'Presentación P4',desired_work_description:'Trabajo territorial',profile_links:{},is_active:true,created_at:now,updated_at:now})
 table('StudentPeriodParticipations').push({id:'participation',student_id:sid,academic_period_id:pid,status:'pending',eligible_for_matching:false,profile_completed_at:null,created_at:now,updated_at:now})
 table('Projects').push({id:projectId,organization_id:oid,academic_period_id:pid,name:'Proyecto P4',summary:'Resumen',description:'Descripción',municipality_id:'municipality',modality:'Presencial',status:role==='ADMIN'?'submitted':'draft',created_by:uid,created_at:now,updated_at:now})
 table('ProjectPositions').push({id:'position',project_id:projectId,title:'Plaza P4',capacity:2,status:'draft',is_active:true,created_at:now,updated_at:now})
 table('AuditLogs').push({id:'audit',actor_user_id:uid,action:'UPDATE',entity_table:'PYRUnibague_Projects',entity_id:projectId,changed_fields:['status'],created_at:now})
 for(let index=1;index<(options.count??1);index++)table('Projects').push({...table('Projects')[0],id:'project-'+index,name:'Proyecto volumen '+index})
 const calls:{path:string;method:string;body:Row;query:string}[]=[];let fail=''
 await page.route('https://pyr-e2e.example.test/**',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();let body:Row={};try{body=request.postDataJSON() as Row??{}}catch{/* binary */}
  calls.push({path:url.pathname,method,body,query:url.search})
  const user={id:uid,email:'p4@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}
  if(url.pathname.endsWith('/pyr_unibague_current_roles'))return route.fulfill({json:[role]})
  if(url.pathname.endsWith('/token')){const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.');return route.fulfill({json:{access_token:token,refresh_token:'test',expires_in:3600,token_type:'bearer',user}})}
  if(url.pathname.endsWith('/user'))return route.fulfill({json:user})
  if(url.pathname.endsWith('/logout'))return route.fulfill({json:{}})
  const name=url.pathname.split('/').at(-1)??''
  if(fail===name){fail='';return route.fulfill({status:400,json:{code:'TEST',message:'Isolated failure'}})}
  if(url.pathname.includes('/rpc/')){
   if(name==='pyr_unibague_project_totals')return route.fulfill({json:(body.p_project_ids as string[]).map(id=>({project_id:id,total_capacity:table('ProjectPositions').filter(row=>row.project_id===id).reduce((sum,row)=>sum+Number(row.capacity),0)}))})
   if(name==='pyr_unibague_admin_dashboard')return route.fulfill({json:{period:table('AcademicPeriods').find(row=>row.is_current)??null,students:table('Students').length,participating:table('StudentPeriodParticipations').length,eligible:table('StudentPeriodParticipations').filter(row=>row.eligible_for_matching).length,organizations:table('Organizations').length,pendingOrganizations:table('Organizations').filter(row=>row.status==='pending_review').length,projects:table('Projects').length,pendingProjects:table('Projects').filter(row=>row.status==='submitted').length,positions:table('ProjectPositions').length,capacity:table('ProjectPositions').reduce((sum,row)=>sum+Number(row.capacity),0),programs:table('AcademicPrograms').length,municipalities:table('Municipalities').length,types:table('OrganizationTypes').length,skills:table('Skills').length}})
   if(name==='pyr_unibague_admin_students'){
    let rows=table('Students').map(row=>({...row,...Object.fromEntries(['display_name','institutional_email'].map(key=>[key,table('UserProfiles').find(profile=>profile.user_id===row.user_id)?.[key]]))}))
    if(body.p_search)rows=rows.filter(row=>JSON.stringify(row).toLowerCase().includes(String(body.p_search).toLowerCase()))
    if(body.p_eligible!==null&&body.p_eligible!==undefined)rows=rows.filter(row=>table('StudentPeriodParticipations').some(part=>part.student_id===row.id&&part.eligible_for_matching===body.p_eligible))
    return route.fulfill({json:{count:rows.length,rows:rows.slice(Number(body.p_page)*25,Number(body.p_page)*25+25)}})
   }
   if(name==='pyr_unibague_review_organization'){const org=table('Organizations').find(row=>row.id===body.p_organization_id)!;Object.assign(org,{status:body.p_decision,verified_at:body.p_decision==='approved'?now:null,verified_by:body.p_decision==='approved'?uid:null});table('OrganizationReviews').push({id:crypto.randomUUID(),organization_id:org.id,decision:body.p_decision,notes:body.p_notes,reviewer_id:uid,created_at:now});return route.fulfill({json:null})}
   if(name==='pyr_unibague_set_current_academic_period'){table('AcademicPeriods').forEach(row=>row.is_current=row.id===body.p_period_id);return route.fulfill({json:null})}
  }
  if(tables[name]){
   const matches=(row:Row)=>[...url.searchParams].every(([key,value])=>value.startsWith('eq.')?String(row[key])===value.slice(3):value.startsWith('in.')?value.slice(4,-1).split(',').includes(String(row[key])):value.startsWith('ilike.')?String(row[key]??'').toLowerCase().includes(value.slice(6).replaceAll('%','').toLowerCase()):true)
   let rows=tables[name]!.filter(matches)
   if(method==='POST'){
    const conflict=url.searchParams.get('on_conflict')?.split(',');const existing=conflict?table(name.replace('PYRUnibague_','')).find(row=>conflict.every(key=>row[key]===body[key])):null
    const row=existing??{id:crypto.randomUUID(),created_at:now,updated_at:now};Object.assign(row,body);if(!existing)tables[name]!.push(row);rows=[row]
   }
   if(method==='PATCH')rows.forEach(row=>Object.assign(row,body,{updated_at:new Date().toISOString()}))
   if(method==='DELETE')tables[name]=tables[name]!.filter(row=>!matches(row))
   const count=rows.length;rows=rows.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000))
   const selection=url.searchParams.get('select')??''
   rows=rows.map(row=>{
    const result={...row}
    if(selection.includes('PYRUnibague_Organizations'))result.PYRUnibague_Organizations=table('Organizations').find(item=>item.id===row.organization_id)??null
    if(selection.includes('PYRUnibague_AcademicPeriods'))result.PYRUnibague_AcademicPeriods=table('AcademicPeriods').find(item=>item.id===row.academic_period_id)??null
    if(selection.includes('PYRUnibague_Municipalities'))result.PYRUnibague_Municipalities=table('Municipalities').find(item=>item.id===row.municipality_id)??null
    if(selection.includes('PYRUnibague_OrganizationTypes'))result.PYRUnibague_OrganizationTypes=table('OrganizationTypes').find(item=>item.id===row.organization_type_id)??null
    if(selection.includes('PYRUnibague_ProjectPositions(count)'))result.PYRUnibague_ProjectPositions=[{count:table('ProjectPositions').filter(item=>item.project_id===row.id).length}]
    if(selection.includes('PYRUnibague_OrganizationDocuments(count)'))result.PYRUnibague_OrganizationDocuments=[{count:table('OrganizationDocuments').filter(item=>item.organization_id===row.id).length}]
    return result
   })
   if(request.headers().accept?.includes('application/vnd.pgrst.object+json'))return rows.length===1?route.fulfill({json:rows[0]}):route.fulfill({status:406,json:{code:'PGRST116',message:'No row'}})
   return route.fulfill({json:rows,headers:{'content-range':`0-${Math.max(0,count-1)}/${count}`,'access-control-expose-headers':'content-range'}})
  }
  return route.fulfill({status:400,json:{message:'Unrecognized P4 endpoint'}})
 })
 return {table,tables,calls,uid,oid,sid,pid,projectId,failNext:(name:string)=>{fail=name}}
}
