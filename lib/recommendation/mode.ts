import type { RecommendationMode } from "../types";

export type PersistedRecommendationMode = Exclude<RecommendationMode, "medium">;

/** Keep the existing persisted value while accepting the new customer-facing term. */
export function normalizeRecommendationMode(mode?: RecommendationMode): PersistedRecommendationMode | undefined {
  return mode === "medium" ? "signature" : mode;
}
