import { NextResponse } from "next/server";
import { getServiceProviders } from "@/lib/sano/providers";
import { assessReadiness } from "@/lib/public/readiness";
import { findPublicTenant, isLocalHostname, parsePublicTenants } from "@/lib/public/tenant-config";

export const runtime = "nodejs";
export async function GET(request: Request) {
  let schema = false, bucketExists = false, bucketPrivate = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) try {
    const provider = getServiceProviders();
    await provider.database.request({ path: "/rest/v1/rpc/marvaa_phase1_capabilities", init: { method: "POST", body: "{}" } }); schema = true;
    const buckets = await provider.database.request<Array<{ id: string; public: boolean }>>({ path: "/storage/v1/bucket" });
    const bucket = buckets.find(item => item.id === "customer-simulations");
    bucketExists = Boolean(bucket); bucketPrivate = bucket?.public === false;
  } catch { /* readiness output remains sanitized */ }
  const tenants=parsePublicTenants(process.env.PUBLIC_TENANTS_JSON);
  const hostname=new URL(request.url).hostname;
  const result = assessReadiness({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
    signingSecret: process.env.PUBLIC_SESSION_SIGNING_SECRET, openAi: process.env.OPENAI_API_KEY, tenantConfigValid:Boolean(tenants),
    hostnameMapped:Boolean(isLocalHostname(hostname)||(tenants&&findPublicTenant(tenants,hostname))), schema, bucketExists, bucketPrivate });
  return NextResponse.json(result, { status: result.ready ? 200 : 503 });
}
