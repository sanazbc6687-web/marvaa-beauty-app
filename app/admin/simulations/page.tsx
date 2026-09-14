"use client";
import { useEffect, useState } from "react";
import { getContext } from "@/lib/admin/data";
import { getStoredSession } from "@/lib/supabase/client";

type SavedSimulation={id:string;created_at:string;status:string;hasInput:boolean;hasResult:boolean;deleted_at:string|null;retention_expires_at:string|null;user_choices:{selections:Record<string,string>;path:string}|null};
export default function SavedSimulationsPage(){
 const [tenantId,setTenantId]=useState(""),[items,setItems]=useState<SavedSimulation[]>([]),[urls,setUrls]=useState<Record<string,{inputUrl:string|null;resultUrl:string|null}>>({}),[error,setError]=useState("");
 useEffect(()=>{getContext().then(({tenantId:id})=>{setTenantId(id);return call<{items:SavedSimulation[]}>("list",id)}).then(result=>setItems(result.items)).catch(()=>setError("دریافت تاریخچه تصاویر ممکن نشد."))},[]);
 async function view(id:string){try{const value=await call<{inputUrl:string|null;resultUrl:string|null}>("view",tenantId,id);setUrls(old=>({...old,[id]:value}))}catch{setError("دسترسی به تصاویر ممکن نشد.")}}
 async function remove(id:string){if(!confirm("تصاویر این شبیه‌سازی حذف شوند؟ اطلاعات انتخاب و تاریخچه باقی می‌ماند."))return;try{await call("delete",tenantId,id);setUrls(old=>{const next={...old};delete next[id];return next});setItems(old=>old.map(item=>item.id===id?{...item,hasInput:false,hasResult:false,deleted_at:new Date().toISOString()}:item))}catch{setError("حذف تصاویر انجام نشد.")}}
 return <section className="admin-panel"><h1>تصاویر ذخیره‌شده مشتریان</h1><p>فقط تصاویر دارای رضایت ذخیره‌سازی نمایش داده می‌شوند. پیوندها پنج دقیقه اعتبار دارند.</p>{error&&<div className="form-error">{error}</div>}{items.map(item=><article key={item.id} className="admin-panel"><b>{new Date(item.created_at).toLocaleString("fa-IR")}</b><pre>{JSON.stringify(item.user_choices?.selections??{},null,2)}</pre>{urls[item.id]&&<div>{urls[item.id].inputUrl&&<img src={urls[item.id].inputUrl!} alt="عکس اصلی مشتری"/>}{urls[item.id].resultUrl&&<img src={urls[item.id].resultUrl!} alt="نتیجه شبیه‌سازی"/>}</div>}<button onClick={()=>view(item.id)} disabled={!item.hasInput&&!item.hasResult}>مشاهده امن</button><button onClick={()=>remove(item.id)} disabled={!item.hasInput&&!item.hasResult}>حذف تصاویر</button></article>)}</section>;
}
async function call<T=unknown>(action:"list"|"view"|"delete",tenantId:string,generationId?:string):Promise<T>{const token=getStoredSession()?.access_token;if(!token)throw new Error("AUTH_REQUIRED");const response=await fetch("/api/admin/simulations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,tenantId,generationId})});if(!response.ok)throw new Error("ADMIN_MEDIA_FAILED");return response.json() as Promise<T>}
