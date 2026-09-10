"use client";

import type { GenerationImageInputs, RecommendationMode } from "../types";
import { getOrCreatePublicSession } from "./public-session";
import { logSupabaseError, publicRequest } from "../supabase/client";

export type SimulationInput = {
  images: GenerationImageInputs; tenantId: string; serviceCategory: string;
  selectedOptions: Record<string, string>; selectedReferences: string[];
  recommendationMode?: RecommendationMode; identityPreservationInstructions?: string[];
};
export type SimulationResult = {
  generationId: string; sessionId: string; generatedImageUrl: string; status: "completed";
  metadata: { provider: "openai"; model: string; tenantId: string; createdAt?: string; [key: string]: unknown };
  referencesUsed: string[];
};

export class SimulationGenerationError extends Error {
  constructor(readonly code: string, readonly customerMessage: string) { super(code); }
}

export async function generateBeautySimulation(input: SimulationInput, requestId = crypto.randomUUID()): Promise<SimulationResult> {
  // The server route owns customer-simulations input/output storage and generation persistence.
  const sessionId = await getOrCreatePublicSession(input.tenantId);
  const response = await fetch("/api/simulations/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    ...input, requestId, sessionId, selectedReferenceSlugs: input.selectedReferences,
    images: { primaryImage: input.images.primaryImage, detailImages: input.images.detailImages },
  }) });
  const result = await response.json().catch(() => ({})) as SimulationResult & { error?: string; message?: string };
  if (!response.ok) throw new SimulationGenerationError(result.error ?? "GENERATION_FAILED", result.message ?? "در اجرای تغییر مشکلی پیش آمد. لطفاً دوباره تلاش کنید.");
  return result;
}

export async function favoriteBeautySimulation(tenantId: string, sessionId: string, generationId: string) {
  try {
    const liked = await publicRequest<boolean>("/rest/v1/rpc/like_demo_public_generation", { method: "POST", body: JSON.stringify({requested_tenant_id:tenantId,requested_session_id:sessionId,requested_generation_id:generationId}) });
    if (!liked) throw new Error("FAVORITE_NOT_ALLOWED");
  } catch (error) { logSupabaseError("favorite public image generation", error); throw error; }
}
