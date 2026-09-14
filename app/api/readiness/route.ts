import { NextResponse } from "next/server";
import { getServiceProviders } from "@/lib/sano/providers";

export const runtime = "nodejs";
export async function GET() {
  const env = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    sessionSigning: Boolean(process.env.PUBLIC_SESSION_SIGNING_SECRET), tenants: Boolean(process.env.PUBLIC_TENANTS_JSON), openAi: Boolean(process.env.OPENAI_API_KEY),
  };
  let schema = false, customerBucket = false;
  if (env.supabaseUrl && env.serviceRole) try {
    const provider = getServiceProviders();
    await provider.database.request({ path: "/rest/v1/rpc/marvaa_phase1_capabilities", init: { method: "POST", body: "{}" } }); schema = true;
    const buckets = await provider.database.request<Array<{ id: string }>>({ path: "/storage/v1/bucket" });
    customerBucket = buckets.some(bucket => bucket.id === "customer-simulations");
  } catch { /* readiness is intentionally boolean-only */ }
  return NextResponse.json({ ready: Object.values(env).every(Boolean) && schema && customerBucket, env, capabilities: { schema, customerBucket } });
}
