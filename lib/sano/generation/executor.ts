import "server-only";
import type { BeautyImageRequest } from "../../simulation/provider";
import type { ImageAsset, StyleReference, StyleReferenceImage } from "../../types";
import type { ReturnTypeOfServiceProviders } from "./types";
import type { GenerationJob } from "./contracts";

type Work = {
  prompt: string; primaryPath: string; detailPaths: string[]; primary: Omit<ImageAsset, "dataUrl">;
  details: Omit<ImageAsset, "dataUrl">[]; referenceIds: string[]; references: Omit<StyleReference, "referenceImages" | "primaryReferenceImage">[];
  recommendationMode: BeautyImageRequest["recommendationMode"]; beautyProfile: BeautyImageRequest["beautyProfile"]; identityRules: string[];
};

export async function executeStoredGeneration(providers: ReturnTypeOfServiceProviders, job: GenerationJob, metadata: Record<string, unknown>) {
  const work = metadata.asyncWork as Work | undefined;
  if (!work) throw new Error("GENERATION_WORK_MISSING");
  const asset = async (value: Omit<ImageAsset, "dataUrl">, path: string): Promise<ImageAsset> => ({ ...value, dataUrl: await dataUrl(await providers.objectStore.download("customer-simulations", path)) });
  const rows = await providers.database.request<{ id: string; style_reference_id: string; storage_path: string; alt_fa: string | null; alt_en: string | null; is_primary: boolean; sort_order: number; active: boolean }[]>({
    path: `/rest/v1/style_reference_images?select=id,style_reference_id,storage_path,alt_fa,alt_en,is_primary,sort_order,active&id=in.(${work.referenceIds.join(",")})&active=eq.true`,
  });
  const selectedReferenceImages: StyleReferenceImage[] = await Promise.all(rows.map(async row => ({ id: row.id, styleReferenceId: row.style_reference_id, imageUrl: await dataUrl(await providers.objectStore.download("style-references", row.storage_path)), altFa: row.alt_fa ?? "", altEn: row.alt_en ?? "", isPrimary: row.is_primary, sortOrder: row.sort_order, active: row.active })));
  const selectedReferences = work.references.map(reference => ({ ...reference, referenceImages: selectedReferenceImages.filter(image => image.styleReferenceId === reference.id) })) as StyleReference[];
  const result = await providers.ai.generate({ primaryImage: await asset(work.primary, work.primaryPath), detailImages: await Promise.all(work.details.map((item, index) => asset(item, work.detailPaths[index]))), selectedReferenceImages, selectedReferences, recommendationMode: work.recommendationMode, beautyProfile: work.beautyProfile, identityPreservationRules: work.identityRules, generationPrompt: work.prompt });
  const outputPath = `${job.tenantId}/${job.sessionId}/output/${job.generationId}.png`;
  await providers.objectStore.upload("customer-simulations", outputPath, new Blob([Buffer.from(result.bytes)], { type: result.contentType }));
  return { outputPath, model: result.model };
}

async function dataUrl(blob: Blob) { return `data:${blob.type || "image/png"};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`; }
