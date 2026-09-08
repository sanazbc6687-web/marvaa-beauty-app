"use client";

export type AuthSession={access_token:string;refresh_token:string;expires_at?:number;user:{id:string;email?:string}};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured=Boolean(url&&key);
const sessionKey="marvaa.admin.session";

async function request<T>(path:string,init:RequestInit={},token?:string):Promise<T>{
 if(!url||!key) throw new Error("SUPABASE_NOT_CONFIGURED");
 const response=await fetch(`${url}${path}`,{...init,headers:{apikey:key,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...init.headers}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(body.msg||body.message||body.error_description||"REQUEST_FAILED");
 return body as T;
}
export function getStoredSession():AuthSession|null{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{return null}}
function storeSession(session:AuthSession|null){if(session){localStorage.setItem(sessionKey,JSON.stringify(session));document.cookie=`marvaa-admin-token=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax; Secure; Max-Age=3600`}else{localStorage.removeItem(sessionKey);document.cookie="marvaa-admin-token=; Path=/; Max-Age=0"}}
export async function signIn(email:string,password:string){const session=await request<AuthSession>("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});storeSession(session);return session}
export async function signOut(){const session=getStoredSession();if(session)await request("/auth/v1/logout",{method:"POST"},session.access_token).catch(()=>undefined);storeSession(null)}
export async function rest<T>(table:string,init:RequestInit={}){const session=getStoredSession();if(!session)throw new Error("AUTH_REQUIRED");return request<T>(`/rest/v1/${table}`,init,session.access_token)}
export async function upload(bucket:string,path:string,file:File){const session=getStoredSession();if(!url||!key||!session)throw new Error("AUTH_REQUIRED");const response=await fetch(`${url}/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type,"x-upsert":"false"},body:file});if(!response.ok)throw new Error("UPLOAD_FAILED");return path}

