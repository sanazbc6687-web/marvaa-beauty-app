import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/sano/providers";
import { AuthorizationError, authorizeTenant, requireTenantId } from "@/lib/sano/tenant";
import { assertObjectKey, parseDeleteKeys, PolicyError } from "@/lib/sano/policy";
import { ProviderHttpError } from "@/lib/sano/providers/supabase";
import { sanitizeProviderStatus } from "@/lib/sano/errors";

const BUCKETS = new Set(["style-references", "salon-portfolio", "customer-simulations"]);
export async function POST(request: Request) {
  try {
    const data = await request.formData(); const action = String(data.get("action")); const bucket = String(data.get("bucket")); const key = String(data.get("key") || "");
    if (!BUCKETS.has(bucket) || key.includes("..")) throw new AuthorizationError(400, "INVALID_OBJECT_KEY");
    const tenantId = requireTenantId(data.get("tenantId")); const token = bearer(request); if (!token) throw new AuthorizationError(401, "AUTH_REQUIRED");
    const providers = getPublicProviders(); await authorizeTenant(providers.auth, providers.database, token, tenantId);
    assertObjectKey(tenantId, key);
    if (action === "upload") { const file = data.get("file"); if (!(file instanceof Blob)) throw new AuthorizationError(400, "FILE_REQUIRED"); await providers.objectStore.upload(bucket, key, file, token); return NextResponse.json({ key }); }
    if (action === "delete") { const keys = parseDeleteKeys(data.get("keys"), tenantId); await providers.objectStore.delete(bucket, keys, token); return NextResponse.json({ ok: true }); }
    if (action === "signedUrl") return NextResponse.json({ url: await providers.objectStore.createDownloadUrl(bucket, key, 3600, token) });
    return NextResponse.json({ error: "INVALID_STORAGE_ACTION" }, { status: 400 });
  } catch (error) { if (error instanceof ProviderHttpError) { const safe = sanitizeProviderStatus(error.status); return NextResponse.json({ error: safe.code }, { status: safe.status }); } const known = error instanceof AuthorizationError || error instanceof PolicyError; return NextResponse.json({ error: known ? error.code : "STORAGE_REQUEST_FAILED" }, { status: known ? error.status : 500 }); }
}
function bearer(request: Request) { const value = request.headers.get("authorization"); return value?.startsWith("Bearer ") ? value.slice(7) : undefined; }
