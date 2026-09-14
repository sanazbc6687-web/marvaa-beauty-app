import type { GenerationJob } from "./contracts";
import type { GenerationRepository } from "./repository";

export type GenerateStoredImage = (job: GenerationJob, metadata: Record<string, unknown>) => Promise<{ outputPath: string; model: string }>;

export function createGenerationProcessor(repository: GenerationRepository, generate: GenerateStoredImage) {
  return async (job: GenerationJob) => {
    const row = await repository.find(job);
    if (!row) throw new Error("GENERATION_JOB_NOT_FOUND");
    // BullMQ may deliver at least once. A completed record is the paid-operation lock.
    if (row.status === "completed") return;
    await repository.transition(job, "processing", { metadata: { ...row.metadata, processingStartedAt: new Date().toISOString() } });
    try {
      const result = await generate(job, row.metadata);
      await repository.transition(job, "completed", { output_path: result.outputPath, metadata: { ...row.metadata, model: result.model, success: true } });
      console.info("SANO_GENERATION_JOB_COMPLETED", { event: "completed", tenantId: job.tenantId, generationId: job.generationId });
    } catch {
      await repository.transition(job, "failed", { output_path: null, metadata: { ...row.metadata, success: false, errorCode: "GENERATION_PROVIDER_FAILED" } });
      console.warn("SANO_GENERATION_JOB_RETRY", { event: "failed", tenantId: job.tenantId, generationId: job.generationId });
      throw new Error("GENERATION_PROVIDER_FAILED");
    }
  };
}
