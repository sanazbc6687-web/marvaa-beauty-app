import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/sano/providers";
import { AuthorizationError, authorizeTenant, requireTenantId } from "@/lib/sano/tenant";
import { ProviderHttpError } from "@/lib/sano/providers/supabase";

const PUBLIC_TABLES = new Set(["service_categories", "portfolio_items", "anonymous_sessions", "leads"]);
const ADMIN_TABLES = new Set(["salons", "service_categories", "service_options", "leads", "image_generations", "style_references", "style_reference_images", "portfolio_items", "portfolio_images", "contact_requests", "user_choices", "app_settings"]);
type Body = { path: string; method?: string; body?: unknown; tenantId?: string; prefer?: string };

export async function POST(request: Request) {
  try {
    const input = await request.json() as Body;
    const parsed = parsePath(input.path);
    const token = bearer(request);
    const providers = getPublicProviders();
    let tenantId: string;
    if (!input.tenantId && token && parsed.resource === "salons") {
      await providers.auth.authenticate(token).catch(() => { throw new AuthorizationError(401, "AUTH_REQUIRED"); });
      const result = await providers.database.request({ path: input.path, accessToken: token, init: { method: input.method || "GET" } });
      return NextResponse.json(result);
    }
    tenantId = requireTenantId(input.tenantId);
    if (token) {
      if (!ADMIN_TABLES.has(parsed.resource)) throw new AuthorizationError(403, "RESOURCE_DENIED");
      await authorizeTenant(providers.auth, providers.database, token, tenantId);
    } else {
      const method = input.method || "GET";
      const allowed = parsed.rpc === "like_demo_public_generation" ? method === "POST" : PUBLIC_TABLES.has(parsed.resource) && ((["service_categories", "portfolio_items"].includes(parsed.resource) && method === "GET") || (["anonymous_sessions", "leads"].includes(parsed.resource) && method === "POST"));
      if (!allowed) throw new AuthorizationError(401, "AUTH_REQUIRED");
      const record = input.body && typeof input.body === "object" ? input.body as Record<string, unknown> : undefined;
      const hasTenantScope = new URL(input.path, "http://sano.local").searchParams.has("tenant_id") || record?.tenant_id !== undefined || record?.requested_tenant_id !== undefined;
      if (!hasTenantScope) throw new AuthorizationError(400, "TENANT_SCOPE_REQUIRED");
    }
    enforceTenant(input, tenantId);
    const result = await providers.database.request({ path: input.path, accessToken: token, init: { method: input.method || "GET", headers: { Prefer: input.prefer || (input.method === "POST" ? "return=minimal" : "return=representation") }, body: input.body === undefined ? undefined : JSON.stringify(input.body) } });
    return NextResponse.json(result ?? null);
  } catch (error) {
    const status = error instanceof AuthorizationError || error instanceof ProviderHttpError ? error.status : 500;
    const code = error instanceof AuthorizationError || error instanceof ProviderHttpError ? error.code : "DATA_REQUEST_FAILED";
    return NextResponse.json({ error: code }, { status });
  }
}
function parsePath(path: string) { const match = /^\/rest\/v1\/(?:rpc\/([a-z_]+)|([a-z_]+))(?:\?|$)/.exec(path); if (!match) throw new AuthorizationError(400, "INVALID_RESOURCE"); return { rpc: match[1], resource: match[2] || "" }; }
function bearer(request: Request) { const value = request.headers.get("authorization"); return value?.startsWith("Bearer ") ? value.slice(7) : undefined; }
function enforceTenant(input: Body, tenantId: string) {
  const queryTenant = new URL(input.path, "http://sano.local").searchParams.get("tenant_id");
  if (queryTenant && queryTenant !== `eq.${tenantId}`) throw new AuthorizationError(403, "TENANT_MISMATCH");
  if (input.body && typeof input.body === "object") {
    const record = input.body as Record<string, unknown>;
    const bodyTenant = record.tenant_id ?? record.requested_tenant_id;
    if (bodyTenant !== undefined && bodyTenant !== tenantId) throw new AuthorizationError(403, "TENANT_MISMATCH");
  }
}
