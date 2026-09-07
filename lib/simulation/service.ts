import { buildSimulationPrompt, IDENTITY_RULES } from "./prompt-builder";
export type SimulationInput = { userImage: string; serviceCategory: string; selections: Record<string,string>; consultationRecommendations?: string[]; identityPreservationInstructions?: string };
export type SimulationResult = { generatedImageUrl: string; status: "completed"|"failed"; metadata: { provider: "mock"; prompt: string; createdAt: string } };
export async function generateBeautySimulation(input: SimulationInput): Promise<SimulationResult> {
  await new Promise(resolve => setTimeout(resolve, 2400));
  return { generatedImageUrl: input.userImage, status:"completed", metadata:{ provider:"mock", prompt:buildSimulationPrompt({category:input.serviceCategory,selections:input.selections,recommendations:input.consultationRecommendations}) + (input.identityPreservationInstructions || IDENTITY_RULES), createdAt:new Date().toISOString() } };
}
