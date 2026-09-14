export type GenerationJobStatus = "queued" | "processing" | "completed" | "failed";

/** The queue payload is deliberately a set of opaque identifiers only. */
export type GenerationJob = {
  version: 1;
  generationId: string;
  tenantId: string;
  sessionId: string;
  requestId: string;
};

export type QueueOptions = { attempts: number; backoffMs: number };

export interface JobQueue {
  enqueue(job: GenerationJob, options?: Partial<QueueOptions>): Promise<void>;
  close(): Promise<void>;
}

export interface GenerationWorker {
  start(): Promise<void>;
  close(): Promise<void>;
}

export const GENERATION_QUEUE = "sano-image-generation";
export const GENERATION_RETRY = { attempts: 3, backoffMs: 2_000 } as const;
