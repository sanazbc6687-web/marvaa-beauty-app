import { NextResponse } from "next/server";
import { resolvePublicTenant } from "@/lib/public/tenant";
import { verifySessionProof } from "@/lib/public/session-proof";
import { getServiceProviders } from "@/lib/sano/providers";

export const runtime = "nodejs";
type Params = { params: Promise<{ generationId: string }> };
export async function POST(request: Request, { params }: Params) {
  try {
    const tenant = resolvePublicTenant(request);
    const body = await request.json() as { sessionId: string; sessionProof: string; action?: "view" | "delete" };
    verifySessionProof(body.sessionProof, tenant.id, body.sessionId);
    const { generationId } = await params;
    const provider = getServiceProviders();
    const rows = await provider.database.request<Array<{ input_path: string | null; output_path: string | null; permanent_storage_consent: boolean }>>({ path: `/rest/v1/image_generations?select=input_path,output_path,permanent_storage_consent&id=eq.${generationId}&tenant_id=eq.${tenant.id}&session_id=eq.${body.sessionId}&limit=1` });
    const row = rows[0];
    if (!row?.permanent_storage_consent) return NextResponse.json({ error: "SAVED_MEDIA_NOT_FOUND" }, { status: 404 });
    if (body.action === "delete") {
      const paths = [row.input_path, row.output_path].filter((path): path is string => Boolean(path));
      if (paths.length) await provider.objectStore.delete("customer-simulations", paths);
      await provider.database.request({ path: `/rest/v1/image_generations?id=eq.${generationId}&tenant_id=eq.${tenant.id}&session_id=eq.${body.sessionId}`, init: { method: "PATCH", body: JSON.stringify({ input_path: null, output_path: null, deleted_at: new Date().toISOString(), recovery_state: "media_deleted_by_authorized_request" }) } });
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json({ inputUrl: row.input_path ? await provider.objectStore.createDownloadUrl("customer-simulations", row.input_path, 300) : null, resultUrl: row.output_path ? await provider.objectStore.createDownloadUrl("customer-simulations", row.output_path, 300) : null, expiresIn: 300 });
  } catch { return NextResponse.json({ error: "MEDIA_ACCESS_DENIED" }, { status: 403 }); }
}
