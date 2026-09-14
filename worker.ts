import { getServiceProviders } from "./lib/sano/providers/index";
import { executeStoredGeneration } from "./lib/sano/generation/executor";
import { createGenerationProcessor } from "./lib/sano/generation/worker";
import { BullMqGenerationWorker } from "./lib/sano/generation/queue";
import { GenerationRepository } from "./lib/sano/generation/repository";

const redisUrl = process.env.SANO_REDIS_URL;
if (!redisUrl) throw new Error("SANO_REDIS_URL_NOT_CONFIGURED");
const providers = getServiceProviders();
const processor = createGenerationProcessor(new GenerationRepository(providers.database), (job, metadata) => executeStoredGeneration(providers, job, metadata));
const worker = new BullMqGenerationWorker(redisUrl, processor, Number(process.env.SANO_GENERATION_WORKER_CONCURRENCY ?? 2));
await worker.start();
const stop = async () => { await worker.close(); process.exit(0); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);
