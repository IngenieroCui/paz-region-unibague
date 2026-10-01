import { useCallback, useEffect, useState } from 'react'
import { useResource } from './useResource'
export function usePaged<D extends {rows:unknown[];count:number}>(loader:(page:number,search:string)=>Promise<D>) {
 const[page,setPage]=useState(0),[search,setSearch]=useState(''),[query,setQuery]=useState('')
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setPage(0)},250);return()=>clearTimeout(timer)},[search])
 const resource=useResource(useCallback(()=>loader(page,query),[loader,page,query]))
 useEffect(()=>{if(!resource.loading&&resource.data){const last=Math.max(0,Math.ceil(resource.data.count/25)-1);if(page>last)queueMicrotask(()=>setPage(last))}},[resource.loading,resource.data,page])
 return {...resource,page,setPage,search,setSearch}
}
