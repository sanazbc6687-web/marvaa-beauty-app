import { NextResponse } from "next/server";
import { resolvePublicTenant } from "@/lib/public/tenant";
import { verifySessionProof } from "@/lib/public/session-proof";
import { getServiceProviders } from "@/lib/sano/providers";
import { generationQuery, mediaDeletionPatch, requireGenerationId, requireMediaAction, storedMediaKeys } from "@/lib/simulation/media-request";

export const runtime = "nodejs";
type Params = { params: Promise<{ generationId: string }> };
export async function POST(request: Request, { params }: Params) {
  try {
    const tenant = resolvePublicTenant(request);
    const body = await request.json() as { sessionId: string; sessionProof: string; action: unknown };
    verifySessionProof(body.sessionProof, tenant.id, body.sessionId);
    const generationId = requireGenerationId((await params).generationId);
    const action = requireMediaAction(body.action);
    const provider = getServiceProviders();
    const rows = await provider.database.request<Array<{ input_path: string | null; output_path: string | null; permanent_storage_consent: boolean }>>({ path: generationQuery(generationId, tenant.id, body.sessionId) });
    const row = rows[0];
    if (!row?.permanent_storage_consent) return NextResponse.json({ error: "SAVED_MEDIA_NOT_FOUND" }, { status: 404 });
    if (action === "delete") {
      const paths = storedMediaKeys(row);
      if (paths.length) await provider.objectStore.delete("customer-simulations", paths);
      const update = new URLSearchParams({ id: `eq.${generationId}`, tenant_id: `eq.${tenant.id}`, session_id: `eq.${body.sessionId}` });
      await provider.database.request({ path: `/rest/v1/image_generations?${update}`, init: { method: "PATCH", body: JSON.stringify(mediaDeletionPatch("customer",new Date().toISOString())) } });
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json({ inputUrl: row.input_path ? await provider.objectStore.createDownloadUrl("customer-simulations", row.input_path, 300) : null, resultUrl: row.output_path ? await provider.objectStore.createDownloadUrl("customer-simulations", row.output_path, 300) : null, expiresIn: 300 });
  } catch { return NextResponse.json({ error: "MEDIA_ACCESS_DENIED" }, { status: 403 }); }
}
