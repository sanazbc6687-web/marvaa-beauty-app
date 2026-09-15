export type ConfiguredPublicTenant = { id: string; slug: string; salonName: string; hosts: string[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePublicTenants(raw?: string): ConfiguredPublicTenant[] | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || !value.length || !value.every(validTenant)) return null;
    return value.map(item => ({ ...item, hosts: [...new Set(item.hosts.map(normalizeHost))] }));
  } catch { return null; }
}

export function findPublicTenant(tenants: ConfiguredPublicTenant[], hostname: string, slug?: string | null) {
  const hostMatches = tenants.filter(item => item.hosts.includes(normalizeHost(hostname)));
  return hostMatches.find(item => !slug || item.slug === slug);
}

export function isLocalHostname(hostname: string) { return ["localhost", "127.0.0.1", "::1"].includes(normalizeHost(hostname)); }
export function isReadinessHostnameMapped(tenants:ConfiguredPublicTenant[]|null,hostname:string,allowLocal:boolean){return (isLocalHostname(hostname)&&allowLocal)||Boolean(tenants&&findPublicTenant(tenants,hostname));}
function normalizeHost(host: string) { return host.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, ""); }
function validTenant(value: unknown): value is ConfiguredPublicTenant {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && UUID.test(item.id) && typeof item.slug === "string" && /^[a-z0-9-]{1,64}$/.test(item.slug) &&
    typeof item.salonName === "string" && item.salonName.length > 0 && item.salonName.length <= 160 && Array.isArray(item.hosts) &&
    item.hosts.length > 0 && item.hosts.every(host => typeof host === "string" && host.length > 0 && host.length <= 253);
}
