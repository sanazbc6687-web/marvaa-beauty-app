"use client";

export type AuthSession={access_token:string;refresh_token:string;expires_at?:number;expires_in?:number;user:{id:string;email?:string}};
type ErrorBody={error?:string;message?:string};
export class SupabaseRequestError extends Error { code:string;status:number;path:string; constructor(path:string,status:number,body:ErrorBody){super(body.message||body.error||"REQUEST_FAILED");this.name="SupabaseRequestError";this.code=body.error||"REQUEST_FAILED";this.status=status;this.path=path} }
export const isSupabaseConfigured=true;
const sessionKey="marvaa.admin.session";
let activeTenantId:string|undefined;

async function api<T>(endpoint:string,body:unknown,token?:string):Promise<T>{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const result=await response.json().catch(()=>({})) as ErrorBody;if(!response.ok)throw new SupabaseRequestError(endpoint,response.status,result);return result as T}
export function getStoredSession():AuthSession|null{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{return null}}
function storeSession(session:AuthSession|null){if(session){if(!session.expires_at&&session.expires_in)session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;localStorage.setItem(sessionKey,JSON.stringify(session));document.cookie=`marvaa-admin-token=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax; Secure; Max-Age=${session.expires_in||3600}`}else{localStorage.removeItem(sessionKey);document.cookie="marvaa-admin-token=; Path=/; Max-Age=0"}}
let refreshPromise:Promise<AuthSession>|null=null;
async function refreshSession(session:AuthSession){if(!refreshPromise)refreshPromise=api<AuthSession>("/api/sano/auth",{action:"refresh",refreshToken:session.refresh_token}).then(next=>(storeSession(next),next)).finally(()=>{refreshPromise=null});return refreshPromise}
async function authenticated<T>(path:string,init:RequestInit={}){let session=getStoredSession();if(!session)throw new Error("AUTH_REQUIRED");if(session.expires_at&&session.expires_at*1000<=Date.now()+30_000)session=await refreshSession(session);try{return await data<T>(path,init,session.access_token)}catch(error){if(error instanceof SupabaseRequestError&&error.status===401){session=await refreshSession(session);return data<T>(path,init,session.access_token)}throw error}}
async function data<T>(path:string,init:RequestInit={},token?:string){const parsedBody=typeof init.body==="string"?JSON.parse(init.body):undefined;const headers=new Headers(init.headers);const result=await api<T>("/api/sano/data",{path,method:init.method||"GET",body:parsedBody,tenantId:tenantFrom(path,parsedBody),prefer:headers.get("Prefer")||undefined},token);if(path.startsWith("/rest/v1/salons?")&&Array.isArray(result)&&result[0]?.id)activeTenantId=result[0].id;return result}
function tenantFrom(path:string,body?:Record<string,unknown>){const query=new URL(path,"http://sano.local").searchParams.get("tenant_id");return query?.replace(/^eq\./,"")||body?.tenant_id||body?.requested_tenant_id||activeTenantId}
export function publicRequest<T>(path:string,init:RequestInit={}){return data<T>(path,init)}
export function logSupabaseError(operation:string,error:unknown){console.error(`[SANO API] ${operation} failed`,error instanceof Error?{name:error.name,message:error.message}:error)}
export async function signIn(email:string,password:string){const session=await api<AuthSession>("/api/sano/auth",{action:"signIn",email,password});storeSession(session);return session}
export async function signOut(){const session=getStoredSession();if(session)await api("/api/sano/auth",{action:"signOut"},session.access_token).catch(error=>logSupabaseError("sign out",error));storeSession(null)}
export function rest<T>(table:string,init:RequestInit={}){return authenticated<T>(`/rest/v1/${table}`,init)}
async function storage(action:string,bucket:string,key:string,file?:Blob,keys?:string[]){const session=getStoredSession();if(!session)throw new Error("AUTH_REQUIRED");const tenantId=key.split("/")[0];const form=new FormData();for(const [name,value] of Object.entries({action,bucket,key,tenantId}))form.set(name,value);if(file)form.set("file",file);if(keys)form.set("keys",JSON.stringify(keys));const response=await fetch("/api/sano/storage",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},body:form});const result=await response.json().catch(()=>({}));if(!response.ok)throw new SupabaseRequestError("/api/sano/storage",response.status,result);return result}
export async function upload(bucket:string,path:string,file:File){await storage("upload",bucket,path,file);return path}
export async function removeStorage(bucket:string,paths:string[]){if(paths.length)await storage("delete",bucket,paths[0],undefined,paths)}
export function publicStorageUrl(bucket:string,path:string){return `/api/sano/files/public/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`}
export async function signedStorageUrl(bucket:string,path:string){return (await storage("signedUrl",bucket,path) as {url:string}).url}
