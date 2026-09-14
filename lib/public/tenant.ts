import "server-only";
import { findPublicTenant, isLocalHostname, parsePublicTenants } from "./tenant-config";

export type PublicTenant = { id: string; slug: string; salonName: string };
const MARVAA_ID = "00000000-0000-0000-0000-000000000001";

/** Resolve only configuration supplied by the operator. Browser tenant ids are never consulted. */
export function resolvePublicTenant(request: Request, slug?: string | null): PublicTenant {
  const host = new URL(request.url).hostname;
  const configured = parsePublicTenants(process.env.PUBLIC_TENANTS_JSON) ?? [];
  // A slug can only narrow an already-authorized host; it can never override it.
  const match = findPublicTenant(configured, host, slug);
  if (match) return { id: match.id, slug: match.slug, salonName: match.salonName };
  const local = isLocalHostname(host);
  if (local && process.env.ALLOW_LOCAL_MARVAA_TENANT === "true") {
    return { id: MARVAA_ID, slug: "marvaa", salonName: "استودیو زیبایی مروا" };
  }
  throw new PublicTenantError();
}

export class PublicTenantError extends Error { readonly status = 404; constructor() { super("UNKNOWN_PUBLIC_TENANT"); } }
