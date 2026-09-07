export const IDENTITY_RULES = "Preserve the subject's identity exactly: face shape, eyes, nose, lips, skin texture and all recognizable features. Modify only the selected beauty-service area. Preserve camera angle, expression and lighting.";
export function buildSimulationPrompt(input: { category: string; selections: Record<string,string>; recommendations?: string[] }) {
  const details = Object.entries(input.selections).map(([key,value]) => `${key}: ${value}`).join(", ");
  const hairRule = input.category === "hair-color" ? "Preserve exact hair length. Render each requested undertone distinctly and keep original lighting." : "";
  return `${IDENTITY_RULES} Service: ${input.category}. Requested details: ${details}. ${hairRule} Recommendations: ${(input.recommendations || []).join(", ")}.`;
}
