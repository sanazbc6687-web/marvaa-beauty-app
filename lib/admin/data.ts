"use client";
import { rest } from "@/lib/supabase/client";
export type Membership={tenant_id:string;role:"owner"|"manager"|"staff"};
export type Category={id:string;slug:string;name_fa:string|null;title:string};
export async function getContext(){const memberships=await rest<Membership[]>("tenant_users?select=tenant_id,role&active=eq.true&limit=1");if(!memberships[0])throw new Error("TENANT_MEMBERSHIP_REQUIRED");const categories=await rest<Category[]>(`service_categories?select=id,slug,name_fa,title&tenant_id=eq.${memberships[0].tenant_id}&enabled=eq.true&order=sort_order.asc`);return{tenantId:memberships[0].tenant_id,role:memberships[0].role,categories}}
export const returning={Prefer:"return=representation"};
export function safeFileName(name:string){const extension=name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";return `${crypto.randomUUID()}.${extension}`}
