import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectGenerationReferences } from "../lib/references/selector.ts";
import { buildBeautyPrompt } from "../lib/simulation/prompt-builder.ts";

const image = (id, referenceId, overrides = {}) => ({ id, styleReferenceId: referenceId, imageUrl: `https://signed/${id}`, altFa: "", altEn: "", isPrimary: false, sortOrder: 1, active: true, ...overrides });
const reference = (id, tenantId, serviceCategoryId, overrides = {}) => ({
  id, tenantId, serviceCategoryId, title: id, slug: id, referenceType: "color", description: "", referenceImages: [image(`${id}-image`, id)],
  visualRules: ["controlled tone"], generationRules: ["change treatment only"], promptFragment: "current admin fragment",
  negativeConstraints: ["no identity transfer"], active: true, sortOrder: 1, metadata: { purpose: "color" }, createdAt: "", updatedAt: "", ...overrides,
});

test("selector enforces tenant, service, active state, requested option and deterministic primary image", () => {
  const refs = [
    reference("icy", "tenant-a", "hair"),
    reference("inactive", "tenant-a", "hair", { active: false }),
    reference("other-tenant", "tenant-b", "hair"),
    reference("other-service", "tenant-a", "nails"),
    reference("option-ref", "tenant-a", "hair", { slug: "different", serviceOptionId: "option-1", referenceType: "technique", metadata: { purpose: "technique" }, referenceImages: [image("later", "option-ref", { sortOrder: 2 }), image("primary", "option-ref", { isPrimary: true, sortOrder: 9 })] }),
  ];
  const selected = selectGenerationReferences({ tenantId: "tenant-a", serviceCategoryId: "hair", selectedReferenceSlugs: ["icy", "inactive", "other-tenant", "other-service"], selectedOptionIds: ["option-1"], references: refs });
  assert.deepEqual(selected.references.map(item => item.id), ["icy", "option-ref"]);
  assert.deepEqual(selected.images.map(item => item.id), ["icy-image", "primary"]);
});

test("selector sends only the first reference for each scoped purpose", () => {
  const selected = selectGenerationReferences({ tenantId: "t", serviceCategoryId: "nails", selectedReferenceSlugs: ["red", "pink", "almond"], selectedOptionIds: [], references: [
    reference("red", "t", "nails", { metadata: { purpose: "color" }, sortOrder: 1 }),
    reference("pink", "t", "nails", { metadata: { purpose: "color" }, sortOrder: 2 }),
    reference("almond", "t", "nails", { referenceType: "shape", metadata: { purpose: "shape" }, sortOrder: 3 }),
  ] });
  assert.deepEqual(selected.references.map(item => item.id), ["red", "almond"]);
});

test("prompt separates identity, profile, recommendation rules, live fragments, negative constraints, and service isolation", () => {
  const ref = reference("icy", "t", "hair");
  const prompt = buildBeautyPrompt({ serviceCategory: "hair-color", selectedOptions: { tone: "icy" }, detailImageCount: 1, selectedReferences: [ref], referenceImagePurposes: [{ id: "img", referenceId: "icy", purpose: "color" }], recommendationMode: "enhanced", beautyProfile: { skinUndertone: { value: "cool", confidence: .9 } }, recommendationResult: { referenceId: "icy", score: 88, reasons: ["cool harmony"] }, recommendationRules: [{ id: "rule-live", serviceId: "hair", referenceId: "icy", featureKey: "skinUndertone", operator: "equals", comparisonValue: "cool", scoreAdjustment: 9, reasonFa: "", reasonEn: "current admin rule", priority: 1, active: true }], identityPreservationInstructions: ["preserve customer age"] });
  for (const value of ["CUSTOMER IDENTITY IMAGE", "CUSTOMER DETAIL IMAGE(S)", "STYLE REFERENCE IMAGE(S)", "BEAUTY PROFILE", "RECOMMENDATION RESULT", "rule-live", "current admin fragment", "NEGATIVE CONSTRAINTS", "no identity transfer", "Change ONLY hair color", "only identity source", "preserve customer age"]) assert.match(prompt, new RegExp(value.replace(/[()]/g, "\\$&"), "i"));
});

test("server route has provider failure state, no fake fallback, idempotency, limits and disabled-service protection", async () => {
  const route = await readFile(new URL("../app/api/simulations/generate/route.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(route, /status: "failed", output_path: null/);
  assert.doesNotMatch(route, /mockOutput|imageUrl:\s*body\.images\.primaryImage\.dataUrl/);
  assert.match(route, /request_id: body\.requestId/);
  assert.match(route, /generation_enabled === false/);
  assert.match(route, /if \(!category\).*SERVICE_DISABLED/);
  assert.match(route, /providers\.ai\.generate/);
  assert.match(client, /generationPending\.current/);
  assert.match(client, /currentGeneration\?\.generatedImageUrl/);
});

test("persistence records provider, recommendation mode, rules, references and images", async () => {
  const route = await readFile(new URL("../app/api/simulations/generate/route.ts", import.meta.url), "utf8");
  for (const field of ["provider", "selectedOptionIds", "recommendationMode", "recommendationRuleIds", "referenceIds", "referenceImageIds", "durationMs"]) assert.match(route, new RegExp(field));
  assert.match(route, /providers\.objectStore\.upload\("customer-simulations", outputPath/);
  assert.match(route, /status: "completed"/);
});
