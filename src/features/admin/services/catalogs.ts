import { check, client, FeatureError, nullable } from '../../../lib/supabase/feature-helpers'
import type { Json } from '../../../lib/supabase/database.types'
import { parseJson, text } from './admin'
export const catalogNames={AcademicPeriods:'Periodos académicos',AcademicPrograms:'Programas académicos',Municipalities:'Municipios',OrganizationTypes:'Tipos de organización',Skills:'Habilidades',SystemConfigurations:'Configuraciones del sistema',FeatureFlags:'Feature flags'} as const
export type Catalog=keyof typeof catalogNames
export type CatalogRow={id:string;label:string;fields:Record<string,Json>}
export type FieldSpec={key:string;label:string;type?:'text'|'date'|'checkbox'|'textarea'|'json';required?:boolean}
export const catalogFields:Record<Catalog,FieldSpec[]>={
  AcademicPeriods:[{key:'code',label:'Código',required:true},{key:'name',label:'Nombre',required:true},{key:'starts_on',label:'Inicio',type:'date'},{key:'ends_on',label:'Fin',type:'date'},{key:'status',label:'Estado',required:true}],
  AcademicPrograms:[{key:'code',label:'Código',required:true},{key:'name',label:'Nombre',required:true},{key:'faculty_name',label:'Facultad'},{key:'active',label:'Activo',type:'checkbox'}],
  Municipalities:[{key:'country_code',label:'Código de país',required:true},{key:'department_code',label:'Código de departamento',required:true},{key:'department_name',label:'Departamento',required:true},{key:'municipality_code',label:'Código de municipio',required:true},{key:'municipality_name',label:'Municipio',required:true},{key:'active',label:'Activo',type:'checkbox'}],
  OrganizationTypes:[{key:'code',label:'Código',required:true},{key:'name',label:'Nombre',required:true},{key:'description',label:'Descripción',type:'textarea'},{key:'active',label:'Activo',type:'checkbox'}],
  Skills:[{key:'name',label:'Nombre',required:true},{key:'category',label:'Categoría'},{key:'aliases',label:'Alias (uno por línea)',type:'textarea'},{key:'active',label:'Activo',type:'checkbox'}],
  SystemConfigurations:[{key:'key',label:'Clave',required:true},{key:'value',label:'Valor JSON',type:'json',required:true},{key:'description',label:'Descripción',type:'textarea'},{key:'is_public',label:'Público',type:'checkbox'}],
  FeatureFlags:[{key:'key',label:'Clave',required:true},{key:'enabled',label:'Habilitado',type:'checkbox'},{key:'description',label:'Descripción',type:'textarea'},{key:'is_public',label:'Público',type:'checkbox'}],
}
export async function listCatalog(catalog:Catalog,page:number,search:string){
  const db=await client();const table=`PYRUnibague_${catalog}` as const
  const field=catalog==='Municipalities'?'municipality_name':['SystemConfigurations','FeatureFlags'].includes(catalog)?'key':'name'
  let query=db.from(table).select('*',{count:'exact'}).order(field).order(catalog==='SystemConfigurations'||catalog==='FeatureFlags'?'key':'id')
  const safe=search.replace(/[%_*(),.\\]/g,' ').trim();if(safe)query=query.ilike(field,'%'+safe+'%')
  const result=await query.range(page*25,page*25+24);check(result.error)
  return {rows:(result.data??[]).map(row=>{const fields=row as unknown as Record<string,Json>;return {id:String(fields.id??fields.key),label:String(fields[field]),fields}}),count:result.count??0}
}
export async function saveCatalog(catalog:Catalog,id:string|null,form:FormData,actor:string){
  const db=await client()
  switch(catalog){
    case 'AcademicPeriods':{const edit={code:text(form,'code'),name:text(form,'name'),starts_on:nullable(text(form,'starts_on')),ends_on:nullable(text(form,'ends_on')),status:text(form,'status')};check((id?await db.from('PYRUnibague_AcademicPeriods').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_AcademicPeriods').insert({...edit,is_current:false})).error);break}
    case 'AcademicPrograms':{const edit={code:text(form,'code'),name:text(form,'name'),faculty_name:nullable(text(form,'faculty_name')),active:form.has('active')};check((id?await db.from('PYRUnibague_AcademicPrograms').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_AcademicPrograms').insert(edit)).error);break}
    case 'Municipalities':{const edit={country_code:text(form,'country_code'),department_code:text(form,'department_code'),department_name:text(form,'department_name'),municipality_code:text(form,'municipality_code'),municipality_name:text(form,'municipality_name'),active:form.has('active')};check((id?await db.from('PYRUnibague_Municipalities').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_Municipalities').insert(edit)).error);break}
    case 'OrganizationTypes':{const edit={code:text(form,'code'),name:text(form,'name'),description:nullable(text(form,'description')),active:form.has('active')};check((id?await db.from('PYRUnibague_OrganizationTypes').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_OrganizationTypes').insert(edit)).error);break}
    case 'Skills':{const edit={name:text(form,'name'),category:nullable(text(form,'category')),aliases:text(form,'aliases').split(/\r?\n/).map(value=>value.trim()).filter(Boolean),active:form.has('active')};check((id?await db.from('PYRUnibague_Skills').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_Skills').insert(edit)).error);break}
    case 'SystemConfigurations':{const edit={value:parseJson(text(form,'value')),description:nullable(text(form,'description')),is_public:form.has('is_public'),updated_by:actor};check((id?await db.from('PYRUnibague_SystemConfigurations').update(edit).eq('key',id).select('key').single():await db.from('PYRUnibague_SystemConfigurations').insert({...edit,key:text(form,'key')})).error);break}
    case 'FeatureFlags':{const edit={enabled:form.has('enabled'),description:nullable(text(form,'description')),is_public:form.has('is_public'),updated_by:actor};check((id?await db.from('PYRUnibague_FeatureFlags').update(edit).eq('key',id).select('key').single():await db.from('PYRUnibague_FeatureFlags').insert({...edit,key:text(form,'key')})).error);break}
  }
}
export async function deactivateCatalog(catalog:Catalog,id:string){const db=await client();if(catalog==='AcademicPrograms'||catalog==='Municipalities'||catalog==='OrganizationTypes'||catalog==='Skills'){check((await db.from(`PYRUnibague_${catalog}`).update({active:false}).eq('id',id).select('id').single()).error)}}
export async function deleteConfiguration(catalog:'SystemConfigurations'|'FeatureFlags',id:string){const db=await client();check((await db.from(`PYRUnibague_${catalog}`).delete().eq('key',id).select('key').single()).error)}
export async function setCurrentPeriod(id:string){const db=await client();check((await db.rpc('pyr_unibague_set_current_academic_period',{p_period_id:id})).error)}
export async function deleteUnusedPeriod(id:string){const db=await client();const result=await db.from('PYRUnibague_AcademicPeriods').delete().eq('id',id).eq('is_current',false).select('id').single();if(result.error&&['23503','23001'].includes(result.error.code))throw new FeatureError('El periodo tiene referencias históricas. Consérvalo y actualiza su estado.');check(result.error)}
