import { NextResponse } from "next/server";
import type { BeautyProfile, RecommendationMode as EngineMode } from "@/lib/recommendation/analysis-types";
import { recommend } from "@/lib/recommendation/recommendation-engine";
import type { RecommendationRule } from "@/lib/recommendation/recommendation-rules";
import { selectGenerationReferences } from "@/lib/references/selector";
import { buildBeautyPrompt, IDENTITY_RULES } from "@/lib/simulation/prompt-builder";
import { OpenAIBeautyImageProvider } from "@/lib/simulation/provider";
import { serverRequest, serverSignedUrl, serverUpload } from "@/lib/supabase/server";
import type { ImageAsset, RecommendationMode, StyleReference, StyleReferenceImage } from "@/lib/types";

export const runtime = "nodejs";
const FRIENDLY_ERROR = "در اجرای تغییر مشکلی پیش آمد. لطفاً دوباره تلاش کنید.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RequestBody = {
  requestId: string; sessionId: string; tenantId: string; serviceCategory: string;
  selectedOptions: Record<string, string>; selectedReferenceSlugs: string[];
  recommendationMode?: RecommendationMode; identityPreservationInstructions?: string[];
  images: { primaryImage: ImageAsset; detailImages: ImageAsset[] };
};
type CategoryRow = { id: string; slug: string; enabled: boolean };
type DbImage = { id: string; style_reference_id: string; storage_path: string; alt_fa: string | null; alt_en: string | null; is_primary: boolean; sort_order: number; active: boolean };
type DbReference = { id: string; tenant_id: string; service_category_id: string; service_option_id: string | null; title: string; slug: string; reference_type: string; description: string | null; technical_definition: string | null; visual_rules: string[]; generation_rules: string[]; prompt_fragment: string | null; negative_constraints: string[]; active: boolean; sort_order: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; style_reference_images: DbImage[] };
type DbRule = { id: string; service_category_id: string; style_reference_id: string | null; feature_key: string; operator: RecommendationRule["operator"]; comparison_value: string | null; score_adjustment: number; reason_fa: string; reason_en: string; priority: number; active: boolean; metadata: Record<string, unknown> };

export async function POST(request: Request) {
  const started = Date.now();
  let body: RequestBody | undefined;
  let generationId: string | undefined;
  try {
    body = await request.json() as RequestBody;
    validate(body);
    generationId = crypto.randomUUID();
    const context = await loadContext(body);
    const selected = chooseReferences(body, context.categories, context.references, context.rules, context.profile);
    if (!selected.references.length) throw new PublicGenerationError("NO_ACTIVE_REFERENCE", 422);
    const rules = context.rules.filter(rule => !rule.referenceId || selected.references.some(reference => reference.id === rule.referenceId));
    const prompt = buildBeautyPrompt({
      serviceCategory: selected.category.slug, selectedOptions: body.selectedOptions, detailImageCount: body.images.detailImages.length, selectedReferences: selected.references,
      referenceImagePurposes: selected.images.map(image => ({ id: image.id, referenceId: image.styleReferenceId, purpose: referencePurpose(selected.references.find(reference => reference.id === image.styleReferenceId)!) })),
      recommendationMode: engineMode(body.recommendationMode), beautyProfile: context.profile,
      recommendationResult: "recommendationResult" in selected ? selected.recommendationResult : undefined, recommendationRules: rules,
      identityPreservationInstructions: body.identityPreservationInstructions,
    });
    const choiceId = crypto.randomUUID();
    const inputBlob = dataUrlBlob(body.images.primaryImage.dataUrl);
    const inputPath = `${body.tenantId}/${body.sessionId}/input/${crypto.randomUUID()}.${extension(inputBlob.type)}`;
    const outputPath = `${body.tenantId}/${body.sessionId}/output/${generationId}.png`;
    await serverUpload("customer-simulations", inputPath, inputBlob);
    await serverRequest("/rest/v1/user_choices", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      id: choiceId, tenant_id: body.tenantId, session_id: body.sessionId, category_id: selected.category.id,
      path: body.recommendationMode ? "consult" : "self", selections: body.selectedOptions,
    }) });
    const diagnostics = metadata(body, selected, rules, started);
    await serverRequest("/rest/v1/image_generations", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      id: generationId, request_id: body.requestId, tenant_id: body.tenantId, session_id: body.sessionId, choice_id: choiceId,
      input_path: inputPath, output_path: null, provider: "openai", status: "pending", metadata: diagnostics,
    }) });
    const result = await new OpenAIBeautyImageProvider().generate({
      primaryImage: body.images.primaryImage, detailImages: body.images.detailImages,
      selectedReferenceImages: selected.images, selectedReferences: selected.references,
      recommendationMode: engineMode(body.recommendationMode), beautyProfile: context.profile,
      identityPreservationRules: [...IDENTITY_RULES, ...(body.identityPreservationInstructions ?? [])], generationPrompt: prompt,
    });
    await serverUpload("customer-simulations", outputPath, new Blob([Buffer.from(result.bytes)], { type: result.contentType }));
    const completed = { ...diagnostics, model: result.model, durationMs: Date.now() - started, success: true };
    await serverRequest(`/rest/v1/image_generations?id=eq.${generationId}`, { method: "PATCH", body: JSON.stringify({ output_path: outputPath, status: "completed", metadata: completed }) });
    log("success", body, completed);
    return NextResponse.json({ generationId, sessionId: body.sessionId, generatedImageUrl: await serverSignedUrl("customer-simulations", outputPath), status: "completed", metadata: completed, referencesUsed: selected.references.map(reference => reference.id) });
  } catch (error) {
    if (generationId) await serverRequest(`/rest/v1/image_generations?id=eq.${generationId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", output_path: null, metadata: { success: false, durationMs: Date.now() - started } }) }).catch(() => undefined);
    const status = error instanceof PublicGenerationError ? error.status : duplicate(error) ? 409 : 500;
console.error("[beauty-generation]", JSON.stringify({
  event: "failure",
  tenantId: body?.tenantId,
  service: body?.serviceCategory,
  requestId: body?.requestId,
  generationId,
  durationMs: Date.now() - started,
  errorCode: safeCode(error),
  rawError: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined
}));
    return NextResponse.json({ error: status === 409 ? "DUPLICATE_GENERATION" : "GENERATION_FAILED", message: FRIENDLY_ERROR }, { status });
  }
}

async function loadContext(body: RequestBody) {
  const session = await serverRequest<{ id: string }[]>(`/rest/v1/anonymous_sessions?select=id&tenant_id=eq.${body.tenantId}&id=eq.${body.sessionId}&limit=1`);
  if (!session.length) throw new PublicGenerationError("INVALID_SESSION", 403);
  const settings = await serverRequest<{ value: { anonymous?: number; maximum?: number; generation_enabled?: boolean } }[]>(`/rest/v1/app_settings?select=value&tenant_id=eq.${body.tenantId}&key=eq.generation_limits&limit=1`);
  if (settings[0]?.value.generation_enabled === false) throw new PublicGenerationError("GENERATION_DISABLED", 403);
  const generations = await serverRequest<{ id: string }[]>(`/rest/v1/image_generations?select=id&tenant_id=eq.${body.tenantId}&session_id=eq.${body.sessionId}&status=eq.completed`);
  const limit = settings[0]?.value.maximum ?? 3;
  if (generations.length >= limit) throw new PublicGenerationError("GENERATION_LIMIT", 429);
  const categories = await serverRequest<CategoryRow[]>(`/rest/v1/service_categories?select=id,slug,enabled&tenant_id=eq.${body.tenantId}&enabled=eq.true&order=sort_order.asc`);
  if (!categories.length) throw new PublicGenerationError("NO_ENABLED_SERVICES", 403);
  const references = await serverRequest<DbReference[]>(`/rest/v1/style_references?select=*,style_reference_images(id,style_reference_id,storage_path,alt_fa,alt_en,is_primary,sort_order,active)&tenant_id=eq.${body.tenantId}&active=eq.true&style_reference_images.active=eq.true&order=sort_order.asc`);
  const rules = mapRules(await serverRequest<DbRule[]>(`/rest/v1/recommendation_rules?select=*&tenant_id=eq.${body.tenantId}&active=eq.true&order=priority.asc`));
  const profiles = await serverRequest<{ metadata: Record<string, unknown> }[]>(`/rest/v1/beauty_profiles?select=metadata&tenant_id=eq.${body.tenantId}&session_id=eq.${body.sessionId}&order=updated_at.desc&limit=1`);
  return { categories, references: await Promise.all(references.map(mapReference)), rules, profile: (profiles[0]?.metadata?.beautyProfile ?? {}) as BeautyProfile };
}

function chooseReferences(body: RequestBody, categories: CategoryRow[], references: StyleReference[], rules: RecommendationRule[], profile: BeautyProfile) {
  if (!body.recommendationMode) {
    const category = categories.find(item => item.slug === body.serviceCategory);
    if (!category) throw new PublicGenerationError("SERVICE_DISABLED", 403);
    return { category, ...selectGenerationReferences({ tenantId: body.tenantId, serviceCategoryId: category.id, selectedReferenceSlugs: body.selectedReferenceSlugs, selectedOptionIds: Object.values(body.selectedOptions), references }) };
  }
  const candidates = references.filter(reference => categories.some(category => category.id === reference.serviceCategoryId));
  const ranked = recommend(profile, candidates.map(reference => ({ id: reference.id, serviceId: reference.serviceCategoryId })), rules, engineMode(body.recommendationMode));
  const winner = ranked[0];
  if (!winner) throw new PublicGenerationError("NO_RECOMMENDATION", 422);
  const reference = candidates.find(item => item.id === winner.candidate.id)!;
  const category = categories.find(item => item.id === reference.serviceCategoryId)!;
  const selection = selectGenerationReferences({ tenantId: body.tenantId, serviceCategoryId: category.id, selectedReferenceSlugs: [reference.slug], selectedOptionIds: [], references });
  return { category, ...selection, recommendationResult: { referenceId: reference.id, score: winner.total, reasons: winner.reasons.map(reason => reason.en) } };
}

async function mapReference(row: DbReference): Promise<StyleReference> {
  return { id: row.id, tenantId: row.tenant_id, serviceCategoryId: row.service_category_id, serviceOptionId: row.service_option_id ?? undefined,
    title: row.title, slug: row.slug, referenceType: row.reference_type, description: row.description ?? row.technical_definition ?? "",
    referenceImages: await Promise.all((row.style_reference_images ?? []).map(async image => ({ id: image.id, styleReferenceId: image.style_reference_id,
      imageUrl: await serverSignedUrl("style-references", image.storage_path), altFa: image.alt_fa ?? "", altEn: image.alt_en ?? "",
      isPrimary: image.is_primary, sortOrder: image.sort_order, active: image.active }))), primaryReferenceImage: undefined,
    visualRules: row.visual_rules ?? [], generationRules: row.generation_rules ?? [], promptFragment: row.prompt_fragment ?? row.technical_definition ?? "",
    negativeConstraints: row.negative_constraints ?? [], active: row.active, sortOrder: row.sort_order, metadata: row.metadata ?? {}, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapRules(rows: DbRule[]): RecommendationRule[] { return rows.map(row => ({ id: row.id, serviceId: row.service_category_id, referenceId: row.style_reference_id ?? undefined, featureKey: row.feature_key, operator: row.operator, comparisonValue: row.comparison_value ?? undefined, scoreAdjustment: Number(row.score_adjustment), reasonFa: row.reason_fa, reasonEn: row.reason_en, priority: row.priority, active: row.active, metadata: row.metadata })); }
function engineMode(mode?: RecommendationMode): EngineMode { return mode === "natural" ? "subtle" : mode === "bold" ? "bold" : "enhanced"; }
function referencePurpose(reference: StyleReference) { return String(reference.metadata.referencePurpose ?? reference.metadata.purpose ?? reference.referenceType); }
function dataUrlBlob(value: string) { const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value); if (!match) throw new PublicGenerationError("INVALID_IMAGE", 400); const bytes = Buffer.from(match[2], "base64"); if (bytes.length > 10 * 1024 * 1024) throw new PublicGenerationError("IMAGE_TOO_LARGE", 413); return new Blob([bytes], { type: match[1] }); }
function extension(type: string) { return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"; }
function validate(body: RequestBody) {
  if (!body) {
    throw new PublicGenerationError("NO_BODY", 400);
  }

  if (!UUID.test(body.requestId)) {
    throw new PublicGenerationError("BAD_REQUEST_ID", 400);
  }

  if (!UUID.test(body.sessionId)) {
    throw new PublicGenerationError("BAD_SESSION_ID", 400);
  }

  if (!UUID.test(body.tenantId)) {
    throw new PublicGenerationError("BAD_TENANT_ID", 400);
  }

  if (!body.images?.primaryImage) {
    throw new PublicGenerationError("NO_PRIMARY_IMAGE", 400);
  }

  if (body.images.detailImages.length > 3) {
    throw new PublicGenerationError("TOO_MANY_DETAIL_IMAGES", 400);
  }

  if (Object.keys(body.selectedOptions ?? {}).length > 20) {
    throw new PublicGenerationError("TOO_MANY_OPTIONS", 400);
  }

  dataUrlBlob(body.images.primaryImage.dataUrl);

  body.images.detailImages.forEach(image =>
    dataUrlBlob(image.dataUrl)
  );
}
function metadata(body: RequestBody, selected: ReturnType<typeof chooseReferences>, rules: RecommendationRule[], started: number) { return { provider: "openai", tenantId: body.tenantId, service: selected.category.slug, selectedOptionIds: Object.values(body.selectedOptions), recommendationMode: body.recommendationMode ? "recommendation" : "manual", recommendationIntensity: body.recommendationMode ?? null, recommendationRuleIds: rules.map(rule => rule.id), referenceIds: selected.references.map(reference => reference.id), referenceImageIds: selected.images.map(image => image.id), requestId: body.requestId, success: false, durationMs: Date.now() - started }; }
function log(event: string, body: RequestBody, details: Record<string, unknown>) { console.info("[beauty-generation]", JSON.stringify({ event, tenantId: body.tenantId, service: details.service, selectedOptionIds: details.selectedOptionIds, recommendationMode: details.recommendationMode, recommendationRuleIds: details.recommendationRuleIds, referenceIds: details.referenceIds, referenceImageIds: details.referenceImageIds, provider: "openai", success: details.success, durationMs: details.durationMs })); }
function duplicate(error: unknown) { return error instanceof Error && (error.message.includes("409") || error.message.includes("23505")); }
function safeCode(error: unknown) { if (error instanceof PublicGenerationError) return error.code; if (duplicate(error)) return "DUPLICATE_GENERATION"; return "INTERNAL_GENERATION_ERROR"; }
class PublicGenerationError extends Error { constructor(readonly code: string, readonly status: number) { super(code); } }
