export type DataRequest = { path: string; method?: string; body?: unknown; tenantId?: string; prefer?: string };
export type ParsedResource = { rpc?: string; resource: string };

const METHODS: Readonly<Record<string, readonly string[]>> = {
  salons: ["GET"], service_categories: ["GET", "PATCH"], service_options: ["GET"],
  leads: ["GET", "POST", "PATCH"], image_generations: ["GET"],
  style_references: ["GET", "POST", "PATCH"], style_reference_images: ["POST", "PATCH", "DELETE"],
  portfolio_items: ["GET", "POST", "PATCH", "DELETE"], portfolio_images: ["POST", "PATCH", "DELETE"],
  contact_requests: ["GET", "PATCH"], user_choices: ["GET"], app_settings: ["GET"],
};
const PUBLIC_METHODS: Readonly<Record<string, readonly string[]>> = {
  service_categories: ["GET"], portfolio_items: ["GET"], anonymous_sessions: ["POST"], leads: ["POST"],
};

export class PolicyError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string) { super(code); this.status=status; this.code=code; } }
export function parseResource(path: unknown): ParsedResource {
  if (typeof path !== "string") throw new PolicyError(400, "INVALID_RESOURCE");
  const match = /^\/rest\/v1\/(?:rpc\/([a-z_]+)|([a-z_]+))(?:\?|$)/.exec(path);
  if (!match) throw new PolicyError(400, "INVALID_RESOURCE");
  return { rpc: match[1], resource: match[2] || "" };
}
export function assertMethodAllowed(parsed: ParsedResource, method: unknown, authenticated: boolean) {
  const normalized = typeof method === "string" ? method.toUpperCase() : "GET";
  const allowed = parsed.rpc === "like_demo_public_generation" ? ["POST"] : authenticated ? METHODS[parsed.resource] : PUBLIC_METHODS[parsed.resource];
  if (!allowed?.includes(normalized)) throw new PolicyError(authenticated ? 405 : 401, authenticated ? "METHOD_NOT_ALLOWED" : "PUBLIC_OPERATION_DENIED");
  return normalized;
}
export function assertTenantScope(input: DataRequest, tenantId: string, publicRequest = false) {
  const queryTenant = new URL(input.path, "http://sano.local").searchParams.get("tenant_id");
  const record = input.body && typeof input.body === "object" && !Array.isArray(input.body) ? input.body as Record<string, unknown> : undefined;
  const bodyTenant = record?.tenant_id ?? record?.requested_tenant_id;
  if (publicRequest && !queryTenant && bodyTenant === undefined) throw new PolicyError(400, "TENANT_SCOPE_REQUIRED");
  if ((queryTenant && queryTenant !== `eq.${tenantId}`) || (bodyTenant !== undefined && bodyTenant !== tenantId)) throw new PolicyError(403, "TENANT_MISMATCH");
}
export function assertObjectKey(tenantId: string, key: unknown) {
  if (typeof key !== "string" || !key.startsWith(`${tenantId}/`) || key.includes("..")) throw new PolicyError(403, "TENANT_MISMATCH");
  return key;
}
export function parseDeleteKeys(value: unknown, tenantId: string): string[] {
  let parsed: unknown; try { parsed = JSON.parse(String(value)); } catch { throw new PolicyError(400, "MALFORMED_DELETE_INPUT"); }
  if (!Array.isArray(parsed) || !parsed.length || !parsed.every(key => typeof key === "string")) throw new PolicyError(400, "MALFORMED_DELETE_INPUT");
  return parsed.map(key => assertObjectKey(tenantId, key));
}
