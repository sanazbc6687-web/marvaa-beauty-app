import { NextResponse } from "next/server";
import { resolvePublicTenant, PublicTenantError } from "@/lib/public/tenant";
import { issueSessionProof } from "@/lib/public/session-proof";
import { getServiceProviders } from "@/lib/sano/providers";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const body = await request.json().catch(() => ({})) as { slug?: string };
    const tenant = resolvePublicTenant(request, body.slug);
    const sessionId = crypto.randomUUID();
    await getServiceProviders().database.request({ path: "/rest/v1/anonymous_sessions", init: { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: sessionId, tenant_id: tenant.id }) } });
    return NextResponse.json({ tenant, sessionId, sessionProof: issueSessionProof(tenant.id, sessionId) });
  } catch (error) {
    const status = error instanceof PublicTenantError ? error.status : 503;
    return NextResponse.json({ error: status === 404 ? "UNKNOWN_PUBLIC_TENANT" : "PUBLIC_SESSION_UNAVAILABLE" }, { status });
  }
}
