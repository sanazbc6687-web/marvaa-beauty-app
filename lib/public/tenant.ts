import "server-only";

export type PublicTenant = { id: string; slug: string; salonName: string };
const MARVAA_ID = "00000000-0000-0000-0000-000000000001";

/** Resolve only configuration supplied by the operator. Browser tenant ids are never consulted. */
export function resolvePublicTenant(request: Request, slug?: string | null): PublicTenant {
  const host = new URL(request.url).hostname.toLowerCase().replace(/\.$/, "");
  const configured = parseTenants(process.env.PUBLIC_TENANTS_JSON);
  const match = configured.find(item => slug ? item.slug === slug : item.hosts.includes(host));
  if (match) return { id: match.id, slug: match.slug, salonName: match.salonName };
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (local && process.env.ALLOW_LOCAL_MARVAA_TENANT === "true") {
    return { id: MARVAA_ID, slug: "marvaa", salonName: "استودیو زیبایی مروا" };
  }
  throw new PublicTenantError();
}

function parseTenants(raw?: string): Array<PublicTenant & { hosts: string[] }> {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(validTenant).map(item => ({ ...item, hosts: item.hosts.map(host => host.toLowerCase()) }));
  } catch { return []; }
}
function validTenant(value: unknown): value is PublicTenant & { hosts: string[] } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && /^[0-9a-f-]{36}$/i.test(item.id) && typeof item.slug === "string" &&
    typeof item.salonName === "string" && Array.isArray(item.hosts) && item.hosts.every(host => typeof host === "string");
}
export class PublicTenantError extends Error { readonly status = 404; constructor() { super("UNKNOWN_PUBLIC_TENANT"); } }
