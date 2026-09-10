"use client";

import { services } from "@/lib/catalog";
import { logSupabaseError, publicRequest } from "@/lib/supabase/client";
import type { Service } from "@/lib/types";

type PublicServiceCategory = { slug: string; enabled: boolean };

export function matchEnabledServices(rows: PublicServiceCategory[]): Service[] {
  const enabledSlugs = new Set(rows.filter(row => row.enabled).map(row => row.slug));
  return services.filter(service => enabledSlugs.has(service.id));
}

export async function getEnabledPublicServices(tenantId: string): Promise<Service[]> {
  const query = new URLSearchParams({
    select: "slug,enabled",
    tenant_id: `eq.${tenantId}`,
    enabled: "eq.true",
  });

  try {
    const rows = await publicRequest<PublicServiceCategory[]>(`/rest/v1/service_categories?${query}`);
    return matchEnabledServices(rows);
  } catch (error) {
    logSupabaseError("load public service availability", error);
    throw error;
  }
}
