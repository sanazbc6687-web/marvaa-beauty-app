export type GenerationLimitSettings=Record<string,unknown>;
/** Mirrors PostgreSQL jsonb `existing || normalized`: canonical keys win; extensions survive. */
export function mergeGenerationLimitSettings(existing:GenerationLimitSettings,normalized:GenerationLimitSettings){return {...existing,...normalized};}
