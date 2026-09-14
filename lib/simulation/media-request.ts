const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MediaAction = "view" | "delete";
export function requireGenerationId(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) throw new MediaRequestError("INVALID_GENERATION_ID"); return value; }
export function requireMediaAction(value: unknown): MediaAction { if (value !== "view" && value !== "delete") throw new MediaRequestError("INVALID_MEDIA_ACTION"); return value; }
export function generationQuery(generationId: string, tenantId: string, sessionId?: string) {
  const params = new URLSearchParams({ select: "session_id,input_path,output_path,permanent_storage_consent", id: `eq.${generationId}`, tenant_id: `eq.${tenantId}`, limit: "1" });
  if (sessionId) params.set("session_id", `eq.${sessionId}`);
  return `/rest/v1/image_generations?${params}`;
}
export function storedMediaKeys(row: { input_path: string | null; output_path: string | null }) { return [row.input_path,row.output_path].filter((key):key is string=>Boolean(key)); }
export function requireOwnedMediaKeys(row: { input_path: string | null; output_path: string | null }, tenantId: string, sessionId: string) {
  const prefix=`${tenantId}/${sessionId}/`;
  const keys=storedMediaKeys(row);
  if(keys.some(key=>!key.startsWith(prefix)||key.includes("..")||key.includes("\\"))) throw new MediaRequestError("CORRUPTED_MEDIA_PATH");
  return keys;
}
export function mediaDeletionPatch(actor: "admin" | "customer", deletedAt: string) { return {input_path:null,output_path:null,deleted_at:deletedAt,recovery_state:actor==="admin"?"media_deleted_by_admin":"media_deleted_by_authorized_request"} as const; }
export class MediaRequestError extends Error { readonly status = 400; }
