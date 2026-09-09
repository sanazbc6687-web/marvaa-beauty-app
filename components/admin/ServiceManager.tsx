"use client";
import {useEffect,useState} from "react";
import {getContext} from "@/lib/admin/data";
import {logSupabaseError,rest} from "@/lib/supabase/client";

type ServiceCategory={id:string;name_fa:string|null;name_en:string|null;title:string;enabled:boolean;sort_order:number};

export function ServiceManager(){
 const [items,setItems]=useState<ServiceCategory[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState("");
 async function load(){try{setBusy(true);setError("");const {tenantId}=await getContext();setItems(await rest<ServiceCategory[]>(`service_categories?select=id,name_fa,name_en,title,enabled,sort_order&tenant_id=eq.${tenantId}&order=sort_order.asc`))}catch(e){logSupabaseError("load admin services",e);setError("دریافت خدمات ممکن نشد. اتصال و دسترسی Supabase را بررسی کنید.")}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 async function patch(item:ServiceCategory,value:Partial<ServiceCategory>){const previous=items;setItems(rows=>rows.map(row=>row.id===item.id?{...row,...value}:row).sort((a,b)=>a.sort_order-b.sort_order));try{await rest(`service_categories?id=eq.${item.id}`,{method:"PATCH",body:JSON.stringify(value)})}catch(e){setItems(previous);logSupabaseError(`update service category ${item.id}`,e);setError("ذخیره تغییرات خدمت ممکن نشد.")}}
 return <section className="admin-panel service-manager">{busy&&<div className="admin-notice">در حال دریافت خدمات…</div>}{error&&<div className="form-error" role="alert">{error}</div>}<div className="service-editor-list">{items.map(item=><article key={item.id}><div className="form-grid"><Field label="نام فارسی" value={item.name_fa||item.title} save={name_fa=>patch(item,{name_fa})}/><Field label="نام انگلیسی" value={item.name_en||""} save={name_en=>patch(item,{name_en})}/><label>ترتیب نمایش<input type="number" value={item.sort_order} onChange={e=>patch(item,{sort_order:Number(e.target.value)})}/></label><label className="switch">فعال <input type="checkbox" checked={item.enabled} onChange={e=>patch(item,{enabled:e.target.checked})}/></label></div></article>)}</div>{!busy&&!error&&!items.length&&<div className="empty-state">خدمتی برای این سالن ثبت نشده است.</div>}</section>
}
function Field({label,value,save}:{label:string;value:string;save:(value:string)=>void}){const [draft,setDraft]=useState(value);useEffect(()=>setDraft(value),[value]);return <label>{label}<input value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>draft!==value&&save(draft.trim())}/></label>}
