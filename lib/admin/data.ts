"use client";
import {rest} from "@/lib/supabase/client";
export type Category={id:string;slug:string;name_fa:string|null;name_en:string|null;title:string};
export async function getContext(){
 // tenant_users has a self-referencing owner policy. Resolve only rows exposed by
 // salons RLS; is_tenant_member() still checks canonical tenant_users securely.
 const tenants=await rest<{id:string}[]>("salons?select=id&limit=1");
 if(!tenants[0])throw new Error("TENANT_MEMBERSHIP_REQUIRED");
 const tenantId=tenants[0].id;
 const categories=await rest<Category[]>(`service_categories?select=id,slug,name_fa,name_en,title&tenant_id=eq.${tenantId}&enabled=eq.true&order=sort_order.asc`);
 return{tenantId,categories};
}
export const returning={Prefer:"return=representation"};
export function safeFileName(name:string){const extension=name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";return `${crypto.randomUUID()}.${extension}`}
