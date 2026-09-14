import "server-only";
import type { GenerationJob, GenerationWorker, JobQueue, QueueOptions } from "./contracts";
import { GENERATION_QUEUE, GENERATION_RETRY } from "./contracts";

type BullQueue = { add(name: string, data: GenerationJob, options: Record<string, unknown>): Promise<unknown>; close(): Promise<void> };
type BullWorker = { close(): Promise<void>; on(event: string, listener: (...args: unknown[]) => void): void };
type BullModule = {
  Queue: new (name: string, options: { connection: { url: string } }) => BullQueue;
  Worker: new (name: string, processor: (job: { data: GenerationJob }) => Promise<void>, options: { connection: { url: string }; concurrency: number }) => BullWorker;
};

// Kept optional so builds and the default synchronous path never need Redis or BullMQ.
async function loadBull(): Promise<BullModule> {
  const packageName = "bullmq";
  try { return await import(/* webpackIgnore: true */ packageName) as unknown as BullModule; }
  catch { throw new Error("ASYNC_QUEUE_DRIVER_NOT_INSTALLED"); }
}

export class BullMqGenerationQueue implements JobQueue {
  private queue?: BullQueue;
  constructor(private readonly redisUrl: string) {}
  private async getQueue() { return this.queue ??= new (await loadBull()).Queue(GENERATION_QUEUE, { connection: { url: this.redisUrl } }); }
  async enqueue(job: GenerationJob, options: Partial<QueueOptions> = {}) {
    const policy = { ...GENERATION_RETRY, ...options };
    await (await this.getQueue()).add("generate", job, {
      jobId: `${job.tenantId}:${job.sessionId}:${job.requestId}`,
      attempts: policy.attempts,
      backoff: { type: "exponential", delay: policy.backoffMs },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
  async close() { if (this.queue) await this.queue.close(); }
}

export class BullMqGenerationWorker implements GenerationWorker {
  private worker?: BullWorker;
  constructor(private readonly redisUrl: string, private readonly process: (job: GenerationJob) => Promise<void>, private readonly concurrency = 2) {}
  async start() {
    if (this.worker) return;
    const { Worker } = await loadBull();
    this.worker = new Worker(GENERATION_QUEUE, job => this.process(job.data), { connection: { url: this.redisUrl }, concurrency: this.concurrency });
    this.worker.on("failed", (...args) => console.warn("SANO_GENERATION_JOB_FAILED", { event: "job_failed", hasJob: Boolean(args[0]) }));
  }
  async close() { if (this.worker) await this.worker.close(); }
}

export function createGenerationQueue() {
  const redisUrl = process.env.SANO_REDIS_URL;
  if (!redisUrl) throw new Error("SANO_REDIS_URL_NOT_CONFIGURED");
  return new BullMqGenerationQueue(redisUrl);
}
