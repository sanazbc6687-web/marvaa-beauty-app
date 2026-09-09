"use client";

export type AuthSession={access_token:string;refresh_token:string;expires_at?:number;expires_in?:number;user:{id:string;email?:string}};
type SupabaseErrorBody={code?:string;message?:string;msg?:string;details?:string;hint?:string;error?:string;error_description?:string};

export class SupabaseRequestError extends Error{
 code:string;details?:string;hint?:string;status:number;path:string;
 constructor(path:string,status:number,body:SupabaseErrorBody){super(body.message||body.msg||body.error_description||body.error||"REQUEST_FAILED");this.name="SupabaseRequestError";this.code=body.code||body.error||"REQUEST_FAILED";this.details=body.details;this.hint=body.hint;this.status=status;this.path=path}
}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured=Boolean(url&&key);
const sessionKey="marvaa.admin.session";

async function rawRequest<T>(path:string,init:RequestInit={},token?:string):Promise<T>{
 if(!url||!key)throw new Error("SUPABASE_NOT_CONFIGURED");
 const response=await fetch(`${url}${path}`,{...init,headers:{apikey:key,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...init.headers}});
 const body=await response.json().catch(()=>({})) as SupabaseErrorBody;
 if(!response.ok)throw new SupabaseRequestError(path,response.status,body);
 return body as T;
}

export function publicRequest<T>(path:string,init:RequestInit={}){return rawRequest<T>(path,init)}
export async function publicUpload(bucket:string,path:string,file:Blob){await rawRequest(`/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});return path}

export function getStoredSession():AuthSession|null{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{return null}}
function storeSession(session:AuthSession|null){if(session){if(!session.expires_at&&session.expires_in)session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;localStorage.setItem(sessionKey,JSON.stringify(session));document.cookie=`marvaa-admin-token=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax; Secure; Max-Age=${session.expires_in||3600}`}else{localStorage.removeItem(sessionKey);document.cookie="marvaa-admin-token=; Path=/; Max-Age=0"}}
let refreshPromise:Promise<AuthSession>|null=null;
async function refreshSession(session:AuthSession){if(!refreshPromise)refreshPromise=rawRequest<AuthSession>("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:session.refresh_token})}).then(next=>(storeSession(next),next)).finally(()=>{refreshPromise=null});return refreshPromise}
async function authenticatedRequest<T>(path:string,init:RequestInit={}){
 let session=getStoredSession();if(!session)throw new Error("AUTH_REQUIRED");
 if(session.expires_at&&session.expires_at*1000<=Date.now()+30_000)session=await refreshSession(session);
 try{return await rawRequest<T>(path,init,session.access_token)}catch(error){if(error instanceof SupabaseRequestError&&error.status===401&&session.refresh_token){session=await refreshSession(session);return rawRequest<T>(path,init,session.access_token)}throw error}
}
export function logSupabaseError(operation:string,error:unknown){if(error instanceof SupabaseRequestError)console.error(`[Supabase] ${operation} failed`,{code:error.code,message:error.message,details:error.details,hint:error.hint,httpStatus:error.status,failingPath:error.path});else console.error(`[Supabase] ${operation} failed`,error)}
export async function signIn(email:string,password:string){const session=await rawRequest<AuthSession>("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});storeSession(session);return session}
export async function signOut(){const session=getStoredSession();if(session)await rawRequest("/auth/v1/logout",{method:"POST"},session.access_token).catch(error=>logSupabaseError("sign out",error));storeSession(null)}
export async function rest<T>(table:string,init:RequestInit={}){return authenticatedRequest<T>(`/rest/v1/${table}`,init)}
export async function upload(bucket:string,path:string,file:File){await authenticatedRequest(`/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{"Content-Type":file.type,"x-upsert":"false"},body:file});return path}
export async function removeStorage(bucket:string,paths:string[]){if(!paths.length)return;await authenticatedRequest(`/storage/v1/object/${bucket}`,{method:"DELETE",body:JSON.stringify({prefixes:paths})})}
export function publicStorageUrl(bucket:string,path:string){return `${url}/storage/v1/object/public/${bucket}/${path}`}
export async function signedStorageUrl(bucket:string,path:string){const result=await authenticatedRequest<{signedURL:string}>(`/storage/v1/object/sign/${bucket}/${path}`,{method:"POST",body:JSON.stringify({expiresIn:3600})});return `${url}/storage/v1${result.signedURL}`}
