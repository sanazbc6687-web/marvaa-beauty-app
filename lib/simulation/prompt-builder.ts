import type { BeautyProfile, RecommendationMode } from "../recommendation/analysis-types";
import type { StyleReference } from "../types";
import type { RecommendationRule } from "../recommendation/recommendation-rules";

export const IDENTITY_RULES = [
  "The CUSTOMER IDENTITY IMAGE is the only identity source. Produce the same customer after the selected salon service, never a different person.",
  "Preserve exact face structure, eyes, eye spacing, nose, lips, jaw, skin identity and texture, age appearance, and recognizable characteristics.",
  "Preserve body and hand anatomy and identity where visible. For nails, the primary hand image is the identity source.",
  "Never transfer a reference subject's face, skin, body, age, makeup, hair, or any characteristic outside that reference's stated purpose.",
];

const isolation: Record<string, string> = {
  "hair-color": "Change ONLY hair color, tone, and selected distribution. Preserve haircut, length, texture, face, makeup, brows, lashes, skin, clothes, lighting, framing, and background.",
  haircut: "Change ONLY haircut geometry, selected length, and layers. Preserve hair color, face, makeup, skin, clothes, framing, and background.",
  lashes: "Change ONLY eyelashes and their selected map, density, curl, and style. Preserve eye shape, iris, brows, makeup, skin, face, and background.",
  brows: "Change ONLY the selected brow treatment. Preserve face geometry, eyes, makeup, skin, hair, and background.",
  nails: "Change ONLY selected nail shape, length, color, finish, and design. Preserve the customer's hand, fingers, skin identity, anatomy, jewelry, and background.",
  makeup: "Change ONLY explicitly selected makeup areas and intensity. Preserve identity, facial geometry, hair, clothes, and background; retain realistic skin texture.",
  lips: "Change ONLY the selected lip treatment/color. Preserve lip volume and geometry, face identity, skin, makeup outside lips, and background.",
  lip: "Change ONLY the selected lip treatment/color. Preserve lip volume and geometry, face identity, skin, makeup outside lips, and background.",
  updo: "Change ONLY hairstyle arrangement as selected. Preserve hair color, face identity, makeup, skin, clothes, and background.",
};
function getVisibleChangeInstruction(
  serviceCategory: string,
  selectedOptions: Record<string, string>
) {
  const selected = Object.values(selectedOptions);

  if (serviceCategory === "makeup") {
    if (selected.includes("light")) {
  return [
    "LIGHT MAKEUP MUST BE CLEARLY VISIBLE while remaining natural and elegant.",
    "Do not return the customer's original face unchanged.",
    "Apply the selected salon reference makeup style to the customer, not generic beautification.",
    "Use the salon reference image as the primary visual guide for the makeup treatment.",
    "Match the reference image as closely as possible in makeup placement, complexion finish, eye definition, lash definition, brow refinement, blush placement, and lip tone.",
    "Create an even and refined complexion while preserving realistic skin texture.",
    "The before/after difference must be clearly noticeable at first glance while remaining professional light makeup, not heavy glam.",
    "The final image must show the exact same customer wearing the makeup style demonstrated by the salon reference image."
  ].join(" ");
}

    return "Apply the selected makeup style as a clearly visible professional makeup transformation. Do not return the original face unchanged.";
  }

  if (serviceCategory === "lashes") {
    if (selected.includes("spiky")) {
      return [
        "SPIKY LASHES MUST BE CLEARLY VISIBLE.",
        "Do not return the customer's original eyelashes unchanged.",
        "Apply professional spiky lash extensions visibly inspired by the salon reference image.",
        "Create distinct separated spike clusters, noticeable added length, lift, darker lash definition, and textured pointed lash tips.",
        "The spiky pattern must be obvious at first glance.",
        "Change eyelashes only; preserve the customer's exact eyes, eyelids, iris, brows, skin, makeup, and facial identity.",
      ].join(" ");
    }

    return "Make the selected lash transformation clearly visible while changing eyelashes only.";
  }

  return "";
}
export function buildBeautyPrompt(input: {
  serviceCategory: string;
  selectedOptions: Record<string, string>;
  detailImageCount: number;
  selectedReferences: StyleReference[];
  referenceImagePurposes: { id: string; referenceId: string; purpose: string }[];
  recommendationMode: RecommendationMode;
  beautyProfile: BeautyProfile;
  recommendationResult?: { referenceId: string; score: number; reasons: string[] };
  recommendationRules: RecommendationRule[];
  identityPreservationInstructions?: string[];
}) {
  const references = input.selectedReferences.map(reference => ({
    id: reference.id, slug: reference.slug, purpose: reference.metadata.referencePurpose ?? reference.metadata.purpose ?? reference.referenceType,
    promptFragment: reference.promptFragment, visualRules: reference.visualRules,
    generationRules: reference.generationRules, negativeConstraints: reference.negativeConstraints,
  }));
  const visibleChangeInstruction = getVisibleChangeInstruction(
  input.serviceCategory,
  input.selectedOptions
);
  return [
    "MARVAA HIGH-FIDELITY, PHOTOREALISTIC BEAUTY EDIT — follow every scoped instruction.",
    `1. CUSTOMER IDENTITY IMAGE: Input image 1 is the primary and ONLY identity source (${input.serviceCategory === "nails" ? "customer hand" : "customer face/body"}).`,
    `2. CUSTOMER DETAIL IMAGE(S): Inputs 2 through ${input.detailImageCount + 1} are customer close-ups; use only for treatment-area detail. Count: ${input.detailImageCount}.`,
    `3. STYLE REFERENCE IMAGE(S): Final inputs are salon-curated style controls, never identity sources. Scoped purposes: ${JSON.stringify(input.referenceImagePurposes)}.`,
    `4. SELECTED SERVICE: ${input.serviceCategory}. ISOLATION: ${isolation[input.serviceCategory] ?? "Change only the explicitly selected treatment area; preserve everything else pixel-consistently where possible."}`,
    `5. SELECTED OPTIONS: ${JSON.stringify(input.selectedOptions)}. Do not invent additional treatments.`,
    `5A. REQUIRED VISIBLE RESULT: ${visibleChangeInstruction || "Apply the selected treatment visibly and faithfully to its reference while preserving identity."}`,
    `6. BEAUTY PROFILE: ${JSON.stringify(input.beautyProfile)}. Use only as professional treatment context; never use it to alter identity.`,
    `7. RECOMMENDATION RESULT: ${JSON.stringify(input.recommendationResult ?? null)}. This is Marvaa's decision; do not independently choose another treatment.`,
    `8. MARVAA RULES: ${JSON.stringify(input.recommendationRules.map(rule => ({ id: rule.id, feature: rule.featureKey, operator: rule.operator, comparison: rule.comparisonValue, reason: rule.reasonEn, metadata: rule.metadata })))}.`,
    `9. REFERENCE PROMPT FRAGMENTS: ${JSON.stringify(references.map(reference => ({ id: reference.id, promptFragment: reference.promptFragment, visualRules: reference.visualRules })))}.`,
    `10. GENERATION RULES: ${JSON.stringify(references.map(reference => ({ id: reference.id, rules: reference.generationRules })))}.`,
    `11. NEGATIVE CONSTRAINTS: ${JSON.stringify(references.map(reference => ({ id: reference.id, avoid: reference.negativeConstraints })))}.`,
    "12. IDENTITY PRESERVATION RULES:",
    ...IDENTITY_RULES.map((rule, index) => `12.${index + 1} ${rule}`),
    ...(input.identityPreservationInstructions ?? []).map((rule, index) => `12.${IDENTITY_RULES.length + index + 1} ${rule}`),
    "Return one edited image only. Keep pose, crop, camera perspective, lighting, clothing, background, and all non-treatment pixels as close to the customer image as possible.",
  ].join("\n");
}
