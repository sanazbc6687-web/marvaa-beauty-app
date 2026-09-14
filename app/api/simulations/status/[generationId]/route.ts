import { NextResponse } from "next/server";
import { getServiceProviders } from "@/lib/sano/providers";
import { GenerationRepository } from "@/lib/sano/generation/repository";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await context.params;
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? "";
  const sessionId = url.searchParams.get("sessionId") ?? "";
  if (![generationId, tenantId, sessionId].every(value => UUID.test(value))) return NextResponse.json({ error: "INVALID_STATUS_REQUEST" }, { status: 400 });
  const providers = getServiceProviders();
  const row = await new GenerationRepository(providers.database).bySession(generationId, tenantId, sessionId);
  if (!row) return NextResponse.json({ error: "GENERATION_NOT_FOUND" }, { status: 404 });
  const generatedImageUrl = row.status === "completed" && row.output_path ? await providers.objectStore.createDownloadUrl("customer-simulations", row.output_path, 300) : undefined;
  return NextResponse.json({ generationId: row.id, sessionId, status: row.status, ...(generatedImageUrl ? { generatedImageUrl } : {}) });
}
