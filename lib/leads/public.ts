"use client";

import {logSupabaseError,publicRequest} from "@/lib/supabase/client";

export type PublicLeadInput={tenantId:string;name:string;mobile:string;whatsapp:string;telegram:string;serviceSlug?:string;selectedOptions:Record<string,string>};
type ServiceCategory={id:string};

export async function createPublicLead(input:PublicLeadInput){
 const sessionId=crypto.randomUUID();
 try{
  await publicRequest("/rest/v1/anonymous_sessions",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:sessionId,tenant_id:input.tenantId})});
  let serviceCategoryId:string|undefined;
  if(input.serviceSlug){
   const query=new URLSearchParams({select:"id",tenant_id:`eq.${input.tenantId}`,slug:`eq.${input.serviceSlug}`,enabled:"eq.true",limit:"1"});
   const categories=await publicRequest<ServiceCategory[]>(`/rest/v1/service_categories?${query}`);
   serviceCategoryId=categories[0]?.id;
  }
  await publicRequest("/rest/v1/leads",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({tenant_id:input.tenantId,name:input.name.trim(),mobile:input.mobile.trim(),whatsapp:input.whatsapp.trim()||null,telegram:input.telegram.trim()||null,session_id:sessionId,service_category_id:serviceCategoryId||null,selected_options:input.selectedOptions,status:"new"})});
 }catch(error){logSupabaseError("create public lead",error);throw error}
}
