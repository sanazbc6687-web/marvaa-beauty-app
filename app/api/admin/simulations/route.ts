import { NextResponse } from "next/server";
import { getPublicProviders, getServiceProviders } from "@/lib/sano/providers";
import { authorizeTenant, requireTenantId } from "@/lib/sano/tenant";
import { generationQuery, mediaDeletionPatch, requireGenerationId, storedMediaKeys } from "@/lib/simulation/media-request";

type AdminAction = "list" | "view" | "delete";
type Row = { id: string; session_id: string; input_path: string | null; output_path: string | null; permanent_storage_consent: boolean; retention_expires_at: string | null; deleted_at: string | null; created_at: string; status: string; user_choices: { selections: Record<string,string>; path: string } | null };
export async function POST(request: Request) {
  try {
    const token = bearer(request); if (!token) return denied(401);
    const body = await request.json() as { action: unknown; tenantId: unknown; generationId?: unknown };
    const action = requireAction(body.action); const tenantId = requireTenantId(body.tenantId);
    const publicProviders = getPublicProviders();
    await authorizeTenant(publicProviders.auth, publicProviders.database, token, tenantId);
    const service = getServiceProviders();
    if (action === "list") {
      const query = new URLSearchParams({ select: "id,session_id,input_path,output_path,permanent_storage_consent,retention_expires_at,deleted_at,created_at,status,user_choices(selections,path)", tenant_id: `eq.${tenantId}`, permanent_storage_consent: "eq.true", order: "created_at.desc", limit: "100" });
      const rows = await service.database.request<Row[]>({ path: `/rest/v1/image_generations?${query}` });
      return NextResponse.json({ items: rows.map(row => ({ ...row, input_path: undefined, output_path: undefined, hasInput: Boolean(row.input_path), hasResult: Boolean(row.output_path) })) });
    }
    const generationId = requireGenerationId(body.generationId);
    const rows = await service.database.request<Array<Pick<Row,"input_path"|"output_path"|"permanent_storage_consent">>>({ path: generationQuery(generationId, tenantId) });
    const row = rows[0]; if (!row?.permanent_storage_consent) return NextResponse.json({ error: "SAVED_MEDIA_NOT_FOUND" }, { status: 404 });
    if (action === "delete") {
      const keys = storedMediaKeys(row); if (keys.length) await service.objectStore.delete("customer-simulations",keys);
      const query = new URLSearchParams({ id:`eq.${generationId}`,tenant_id:`eq.${tenantId}` });
      await service.database.request({ path:`/rest/v1/image_generations?${query}`,init:{method:"PATCH",body:JSON.stringify(mediaDeletionPatch("admin",new Date().toISOString()))} });
      return NextResponse.json({ deleted:true });
    }
    return NextResponse.json({ inputUrl:row.input_path?await service.objectStore.createDownloadUrl("customer-simulations",row.input_path,300):null,resultUrl:row.output_path?await service.objectStore.createDownloadUrl("customer-simulations",row.output_path,300):null,expiresIn:300 });
  } catch { return denied(403); }
}
function requireAction(value: unknown): AdminAction { if (value!=="list"&&value!=="view"&&value!=="delete") throw new Error("INVALID_ADMIN_ACTION"); return value; }
function bearer(request: Request) { const value=request.headers.get("authorization"); return value?.startsWith("Bearer ")?value.slice(7):undefined; }
function denied(status:number){return NextResponse.json({error:status===401?"AUTH_REQUIRED":"MEDIA_ACCESS_DENIED"},{status});}
