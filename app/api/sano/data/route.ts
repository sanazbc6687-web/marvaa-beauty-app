import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/sano/providers";
import { AuthorizationError, authorizeTenant, requireTenantId } from "@/lib/sano/tenant";
import { ProviderHttpError } from "@/lib/sano/providers/supabase";
import { sanitizeProviderStatus } from "@/lib/sano/errors";
import { assertMethodAllowed, assertTenantScope, parseResource, PolicyError, type DataRequest } from "@/lib/sano/policy";

export async function POST(request: Request) {
  try {
    const input = await request.json() as DataRequest;
    const parsed = parseResource(input.path);
    const token = bearer(request);
    const method = assertMethodAllowed(parsed, input.method, Boolean(token));
    const providers = getPublicProviders();
    let tenantId: string;
    if (!input.tenantId && token && parsed.resource === "salons") {
      await providers.auth.authenticate(token).catch(() => { throw new AuthorizationError(401, "AUTH_REQUIRED"); });
      const result = await providers.database.request({ path: input.path, accessToken: token, init: { method } });
      return NextResponse.json(result);
    }
    tenantId = requireTenantId(input.tenantId);
    if (token) {
      await authorizeTenant(providers.auth, providers.database, token, tenantId);
    } else {
      assertTenantScope(input, tenantId, true);
    }
    assertTenantScope(input, tenantId);
    const result = await providers.database.request({ path: input.path, accessToken: token, init: { method, headers: { Prefer: input.prefer || (method === "POST" ? "return=minimal" : "return=representation") }, body: input.body === undefined ? undefined : JSON.stringify(input.body) } });
    return NextResponse.json(result ?? null);
  } catch (error) {
    if (error instanceof ProviderHttpError) { const safe = sanitizeProviderStatus(error.status); return NextResponse.json({ error: safe.code }, { status: safe.status }); }
    const status = error instanceof AuthorizationError || error instanceof PolicyError ? error.status : 500;
    const code = error instanceof AuthorizationError || error instanceof PolicyError ? error.code : "DATA_REQUEST_FAILED";
    return NextResponse.json({ error: code }, { status });
  }
}
function bearer(request: Request) { const value = request.headers.get("authorization"); return value?.startsWith("Bearer ") ? value.slice(7) : undefined; }
