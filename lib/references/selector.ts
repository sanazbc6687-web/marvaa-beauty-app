import type { StyleReference, StyleReferenceImage } from "../types";

export type ReferenceSelection = { references: StyleReference[]; images: StyleReferenceImage[] };

/** Select current active, tenant/service-scoped records and at most one intentional image per purpose. */
export function selectGenerationReferences(input: {
  tenantId: string; serviceCategoryId: string; selectedReferenceSlugs: string[];
  selectedOptionIds: string[]; references: StyleReference[]; maximumImages?: number;
}): ReferenceSelection {
  const requested = new Set(input.selectedReferenceSlugs);
  const options = new Set(input.selectedOptionIds);
  const relevant = input.references.filter(reference =>
    reference.active && reference.tenantId === input.tenantId && reference.serviceCategoryId === input.serviceCategoryId &&
    (requested.has(reference.slug) || (reference.serviceOptionId ? options.has(reference.serviceOptionId) : false)),
  ).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const byPurpose = new Map<string, StyleReference>();
  for (const reference of relevant) {
    const purpose = String(reference.metadata.referencePurpose ?? reference.metadata.purpose ?? reference.referenceType ?? "other");
    if (!byPurpose.has(purpose)) byPurpose.set(purpose, reference);
  }
  const references = [...byPurpose.values()];
  const images = references.flatMap(reference => {
    const active = reference.referenceImages.filter(image => image.active !== false)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    return active.slice(0, 1);
  }).slice(0, input.maximumImages ?? 3);
  const used = new Set(images.map(image => image.styleReferenceId));
  return { references: references.filter(reference => used.has(reference.id) || reference.referenceImages.length === 0), images };
}
