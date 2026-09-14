import "server-only";
import type { DatabaseProvider } from "../providers/contracts";
import type { GenerationJob, GenerationJobStatus } from "./contracts";

export type GenerationRow = { id: string; tenant_id: string; session_id: string; request_id: string; status: GenerationJobStatus; input_path: string; output_path: string | null; metadata: Record<string, unknown> };

export class GenerationRepository {
  constructor(private readonly database: DatabaseProvider) {}
  async find(job: GenerationJob) {
    const rows = await this.database.request<GenerationRow[]>({ path: `/rest/v1/image_generations?select=*&id=eq.${job.generationId}&tenant_id=eq.${job.tenantId}&session_id=eq.${job.sessionId}&request_id=eq.${job.requestId}&limit=1` });
    return rows[0];
  }
  async bySession(generationId: string, tenantId: string, sessionId: string) {
    const rows = await this.database.request<GenerationRow[]>({ path: `/rest/v1/image_generations?select=id,tenant_id,session_id,request_id,status,input_path,output_path,metadata&id=eq.${generationId}&tenant_id=eq.${tenantId}&session_id=eq.${sessionId}&limit=1` });
    return rows[0];
  }
  async transition(job: GenerationJob, status: GenerationJobStatus, values: Record<string, unknown> = {}) {
    await this.database.request({ path: `/rest/v1/image_generations?id=eq.${job.generationId}&tenant_id=eq.${job.tenantId}&session_id=eq.${job.sessionId}`, init: { method: "PATCH", body: JSON.stringify({ status, ...values }) } });
  }
}
