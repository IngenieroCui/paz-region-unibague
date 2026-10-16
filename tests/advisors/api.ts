// Isolated browser fixtures. SQL tests, not these HTTP mocks, exercise RLS.
import type { Page } from '@playwright/test'
type Row=Record<string,unknown>
export const id=(n:number)=>'77000000-0000-0000-0000-'+String(n).padStart(12,'0')
export async function advisorApi(page:Page,roles:string[]=['ADMIN'],options:{readOnly?:boolean;empty?:boolean}={}){
 const uid=roles.includes('ADVISOR')?id(2):roles.includes('ADMIN')?id(1):roles.includes('ORGANIZATION')?id(6):id(4)
 const now='2026-10-13T12:00:00Z',tables:Record<string,Row[]>={}
 const names=['StaffProfiles','UserProfiles','Roles','UserRoles','AcademicPeriods','Organizations','OrganizationMembers','OrganizationTypes','OrganizationDocuments','OrganizationReviews','Students','StudentExperiences','StudentSkills','StudentInterests','StudentLocationPreferences','StudentDocuments','AcademicPrograms','Municipalities','StudentPeriodParticipations','AdvisorOrganizationAssignments','AdvisorStudentAssignments','StudentSpecialCases','Assignments','Projects','ProjectInterlocutors','OrganizationContacts']
 for(const name of names)tables['PYRUnibague_'+name]=[]
 const table=(name:string)=>tables['PYRUnibague_'+name]!
 table('UserProfiles').push(...[[1,'Admin'],[2,'Asesor A'],[3,'Asesor B'],[4,'Estudiante A'],[5,'Estudiante B'],[6,'Organización']].map(([n,name])=>({user_id:id(Number(n)),display_name:name,institutional_email:'test@example.test',created_at:now})))
 table('Roles').push(...['ADMIN','ADVISOR','STUDENT','ORGANIZATION'].map(code=>({id:code,code})))
 table('UserRoles').push({user_id:id(2),role_id:'ADVISOR'},{user_id:id(3),role_id:'ADVISOR'})
 table('StaffProfiles').push(...[2,3].map((n)=>({id:id(n+100),user_id:id(n),staff_code:'A'+n,phone:null,academic_unit:'Unidad',status:'active',created_at:now,updated_at:now})))
 table('AcademicPeriods').push({id:id(301),name:'Periodo P6A',code:'P6A',is_current:true,status:'active',created_at:now},{id:id(302),name:'Otro periodo',code:'OTHER',is_current:false,status:'active',created_at:now})
 table('Organizations').push({id:id(201),legal_name:'Organización A',display_name:null,description:'Descripción A',organization_type_id:null,municipality_id:null,status:'approved',website:null,tax_id:null,verified_at:null,verified_by:null,created_by:uid},{id:id(202),legal_name:'Organización B',display_name:null,description:'Descripción B',status:'approved'})
 table('OrganizationMembers').push({id:'member',organization_id:id(201),user_id:id(6),status:'active',can_manage:!options.readOnly})
 table('Students').push(...[4,5].map(n=>({id:id(n+400),user_id:id(n),student_code:'ST'+n,current_semester:6,academic_program_id:null,bio:'Presentación profesional '+(n===4?'A':'B')})))
 table('StudentPeriodParticipations').push(...[4,5].map(n=>({id:id(n+500),student_id:id(n+400),academic_period_id:id(301),status:'active',eligible_for_matching:true,arl_provider_name:null,profile_completed_at:null,created_at:now,updated_at:now})))
 table('AdvisorOrganizationAssignments').push(...[2,3].map(n=>({id:id(n+1100),advisor_id:id(n+100),organization_id:id(n+199),academic_period_id:id(301),starts_on:'2026-10-01',ends_on:null,is_current:true,assigned_by:id(1),created_at:now,updated_at:now})))
 table('AdvisorStudentAssignments').push(...[2,3].map(n=>({id:id(n+1200),advisor_id:id(n+100),participation_id:id(n+502),starts_on:'2026-10-01',ends_on:null,is_current:true,reason:null,source_assignment_id:null,created_at:now,updated_at:now})))
 table('Projects').push(...[2,3].map(n=>({id:id(n+600),organization_id:id(n+199),academic_period_id:id(301),name:'Proyecto '+(n===2?'A':'B'),summary:'Resumen',description:'Descripción',modality:'Presencial'})))
 table('OrganizationContacts').push({id:id(701),organization_id:id(201),full_name:'Contacto inicial',position_title:'Representante',email:'contact@example.test',phone:null,user_id:null,is_primary:true,created_at:now,updated_at:now})
 if(options.empty){table('AdvisorOrganizationAssignments').length=0;table('AdvisorStudentAssignments').length=0}
 const calls:{path:string;method:string;body:Row}[]=[];let failing=''
 await page.route('https://pyr-e2e.example.test/**',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),name=url.pathname.split('/').at(-1)??''
  let body:Row={};try{body=request.postDataJSON() as Row??{}}catch{/* none */}
  calls.push({path:url.pathname,method,body})
  const user={id:uid,email:'test@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{role:'ADMIN'}}
  if(name==='token'){const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');return route.fulfill({json:{access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user}})}
  if(name==='user')return route.fulfill({json:user})
  if(name==='logout')return route.fulfill({json:{}})
  if(name==='pyr_unibague_current_roles')return route.fulfill({json:roles})
  if(failing===name){failing='';return route.fulfill({status:403,json:{code:'42501',message:'Denied test operation'}})}
  if(name==='pyr_unibague_advisor_workspace'){
   if(!roles.includes('ADVISOR'))return route.fulfill({status:403,json:{code:'42501',message:'ADVISOR required'}})
   const staff=table('StaffProfiles').find(row=>row.user_id===uid)
   const orgIds=table('AdvisorOrganizationAssignments').filter(row=>row.advisor_id===staff?.id&&row.is_current&&row.academic_period_id===body.p_academic_period_id).map(row=>row.organization_id)
   const partIds=table('AdvisorStudentAssignments').filter(row=>row.advisor_id===staff?.id&&row.is_current).map(row=>row.participation_id)
   const contact=(row:Row)=>({id:row.id,full_name:row.full_name,position_title:row.position_title,email:row.email,phone:row.phone,is_primary:row.is_primary})
   return route.fulfill({json:{organizations:table('Organizations').filter(row=>orgIds.includes(row.id)).map(row=>({id:row.id,name:row.legal_name,description:row.description,starts_on:'2026-10-01',contacts:table('OrganizationContacts').filter(c=>c.organization_id===row.id).map(contact)})),students:table('StudentPeriodParticipations').filter(row=>partIds.includes(row.id)&&row.academic_period_id===body.p_academic_period_id).map(row=>{const s=table('Students').find(s=>s.id===row.student_id)!;return {participation_id:row.id,name:table('UserProfiles').find(u=>u.user_id===s.user_id)?.display_name,program:'Programa académico',semester:6,bio:s.bio,desired_work_description:'Trabajo profesional',starts_on:'2026-10-01',experiences:[],skills:[],interests:[]}}),projects:table('Projects').filter(row=>orgIds.includes(row.organization_id)&&row.academic_period_id===body.p_academic_period_id).map(row=>({...row,organization_name:table('Organizations').find(o=>o.id===row.organization_id)?.legal_name,municipality:null,interlocutors:[]}))}})
  }
  if(name==='pyr_unibague_change_organization_advisor'||name==='pyr_unibague_change_student_advisor'){
   if(!roles.includes('ADMIN'))return route.fulfill({status:403,json:{code:'42501',message:'ADMIN required'}})
   const isOrg=name.includes('organization'),rows=table(isOrg?'AdvisorOrganizationAssignments':'AdvisorStudentAssignments')
   const current=rows.find(row=>row.is_current&&(isOrg?row.organization_id===body.p_organization_id&&row.academic_period_id===body.p_academic_period_id:row.participation_id===body.p_participation_id))
   if(current){current.is_current=false;current.ends_on=body.p_starts_on}
   let created:Row|undefined
   if(body.p_advisor_id){created={id:crypto.randomUUID(),advisor_id:body.p_advisor_id,starts_on:body.p_starts_on,ends_on:null,is_current:true,created_at:now,updated_at:now,...(isOrg?{organization_id:body.p_organization_id,academic_period_id:body.p_academic_period_id,assigned_by:uid}:{participation_id:body.p_participation_id,reason:body.p_reason,source_assignment_id:body.p_source_assignment_id})};rows.push(created)}
   return route.fulfill({json:created?.id??null})
  }
  if(name==='pyr_unibague_save_organization_contact'){
   if(!roles.includes('ADMIN')&&(!roles.includes('ORGANIZATION')||options.readOnly||body.p_organization_id!==id(201)))return route.fulfill({status:403,json:{code:'42501',message:'Manager required'}})
   const rows=table('OrganizationContacts')
   if(body.p_is_primary)rows.filter(row=>row.organization_id===body.p_organization_id).forEach(row=>row.is_primary=false)
   let row=rows.find(row=>row.id===body.p_id)
   if(!row){row={id:crypto.randomUUID(),organization_id:body.p_organization_id,created_at:now,updated_at:now};rows.push(row)}
   Object.assign(row,{full_name:body.p_full_name,position_title:body.p_position_title,email:body.p_email,phone:body.p_phone,user_id:body.p_user_id,is_primary:body.p_is_primary})
   return route.fulfill({json:row.id})
  }
  if(tables[name]){
   const matches=(row:Row)=>[...url.searchParams].every(([key,value])=>value.startsWith('eq.')?String(row[key])===value.slice(3):true)
   let rows=tables[name]!.filter(matches)
   if(method==='POST'){const row={id:crypto.randomUUID(),...body,reviewed_by:uid,created_at:now,updated_at:now};tables[name]!.push(row);rows=[row]}
   if(method==='PATCH')rows.forEach(row=>Object.assign(row,body))
   if(method==='DELETE')tables[name]=tables[name]!.filter(row=>!matches(row))
   const count=rows.length,offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000)
   rows=rows.slice(offset,offset+limit)
   const single=request.headers().accept?.includes('application/vnd.pgrst.object+json')
   if(single&&!rows.length)return route.fulfill({status:406,json:{code:'PGRST116',message:'No row'}})
   return route.fulfill({json:single?rows[0]:rows,headers:{'content-range':`0-${Math.max(0,count-1)}/${count}`,'access-control-expose-headers':'content-range'}})
  }
  return route.fulfill({status:400,json:{message:'Unknown P6A fixture endpoint'}})
 })
 return {table,calls,failNext:(name:string)=>{failing=name}}
}
export async function login(page:Page){await page.goto('/login/institucional');await page.getByLabel('Correo electrónico').fill('test@example.test');await page.getByLabel('Contraseña',{exact:true}).fill('password123');await page.getByRole('button',{name:'Ingresar',exact:true}).click()}
