import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/sano/providers";
import { AuthorizationError, authorizeTenant, requireTenantId } from "@/lib/sano/tenant";

const BUCKETS = new Set(["style-references", "salon-portfolio", "customer-simulations"]);
export async function POST(request: Request) {
  try {
    const data = await request.formData(); const action = String(data.get("action")); const bucket = String(data.get("bucket")); const key = String(data.get("key") || "");
    if (!BUCKETS.has(bucket) || key.includes("..")) throw new AuthorizationError(400, "INVALID_OBJECT_KEY");
    const tenantId = requireTenantId(data.get("tenantId")); const token = bearer(request); if (!token) throw new AuthorizationError(401, "AUTH_REQUIRED");
    const providers = getPublicProviders(); await authorizeTenant(providers.auth, providers.database, token, tenantId);
    if (!key.startsWith(`${tenantId}/`)) throw new AuthorizationError(403, "TENANT_MISMATCH");
    if (action === "upload") { const file = data.get("file"); if (!(file instanceof Blob)) throw new AuthorizationError(400, "FILE_REQUIRED"); await providers.objectStore.upload(bucket, key, file, token); return NextResponse.json({ key }); }
    if (action === "delete") { const keys = JSON.parse(String(data.get("keys") || "[]")) as string[]; if (!keys.every(item => item.startsWith(`${tenantId}/`) && !item.includes(".."))) throw new AuthorizationError(403, "TENANT_MISMATCH"); await providers.objectStore.delete(bucket, keys, token); return NextResponse.json({ ok: true }); }
    if (action === "signedUrl") return NextResponse.json({ url: await providers.objectStore.createDownloadUrl(bucket, key, 3600, token) });
    return NextResponse.json({ error: "INVALID_STORAGE_ACTION" }, { status: 400 });
  } catch (error) { const status = error instanceof AuthorizationError ? error.status : 500; return NextResponse.json({ error: error instanceof AuthorizationError ? error.code : "STORAGE_REQUEST_FAILED" }, { status }); }
}
function bearer(request: Request) { const value = request.headers.get("authorization"); return value?.startsWith("Bearer ") ? value.slice(7) : undefined; }
