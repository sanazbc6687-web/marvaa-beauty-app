"use client";

import {logSupabaseError, publicRequest} from "@/lib/supabase/client";

const storageKey = "marvaa.public.session";
let pendingSession: Promise<string> | undefined;

export function getOrCreatePublicSession(tenantId:string):Promise<string>{
 if(typeof window==="undefined")return Promise.reject(new Error("PUBLIC_SESSION_REQUIRES_BROWSER"));
 const stored=sessionStorage.getItem(storageKey);
 if(stored){try{const value=JSON.parse(stored) as {tenantId:string;sessionId:string};if(value.tenantId===tenantId&&value.sessionId)return Promise.resolve(value.sessionId)}catch{sessionStorage.removeItem(storageKey)}}
 if(!pendingSession)pendingSession=createSession(tenantId).finally(()=>{pendingSession=undefined});
 return pendingSession;
}

async function createSession(tenantId:string){
 const sessionId=crypto.randomUUID();
 try{
  await publicRequest("/rest/v1/anonymous_sessions",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:sessionId,tenant_id:tenantId})});
  sessionStorage.setItem(storageKey,JSON.stringify({tenantId,sessionId}));
  return sessionId;
 }catch(error){logSupabaseError("create public simulation session",error);throw error}
}
