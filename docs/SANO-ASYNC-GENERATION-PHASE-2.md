# SANO async image generation — Phase 2 runbook

## Current safety posture

`SANO_ASYNC_GENERATION` defaults to disabled (only the exact value `true` enables it). The existing synchronous endpoint and UI response remain unchanged while disabled. Supabase remains the database and private object store, and OpenAI remains the image provider. Queue messages contain only `generationId`, `tenantId`, `sessionId`, `requestId`, and a schema version; customer bytes and provider credentials never enter Redis.

## Future Liara resources (do not provision during this phase)

1. Create a managed **Liara Redis** service in the same region/private network as the applications.
2. Add the worker runtime packages to the deployed artifact (`npm install bullmq server-only` and `npm install --save-dev tsx`) when registry access is available. They are intentionally deferred here because the current build registry rejects BullMQ; the Web build and tests do not require Redis.
3. Create a separate **Node.js worker application** from this repository and the same commit as Web. Its start command is `npx tsx worker.ts` (or compile `worker.ts` with a production TypeScript worker build and run the resulting JavaScript).
4. Keep the existing Web deployment command and automatic `main` workflow unchanged. Do not run the worker in the Web process.

### Environment variable names

Web and worker share `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. Web additionally has `SANO_ASYNC_GENERATION`. Worker and Web have `SANO_REDIS_URL`; Worker may set `SANO_GENERATION_WORKER_CONCURRENCY`. The existing browser publishable key variables remain unchanged. Never paste values into source, build logs, or Redis payloads.

## Safe activation

1. Apply `012_async_generation_states.sql` to staging, then deploy Web and Worker from the same commit.
2. Leave `SANO_ASYNC_GENERATION=false`; verify the synchronous smoke path and worker connectivity without making an OpenAI request.
3. Set `SANO_ASYNC_GENERATION=true` in staging only. Submit one approved test job, poll `/api/simulations/status/{generationId}?tenantId=…&sessionId=…`, and verify `queued → processing → completed` plus a five-minute signed URL.
4. Confirm tenant/session negative tests, idempotent request IDs, queue depth, failure alerts, cost controls, and image retention. Repeat the controlled rollout in production only after explicit approval: start Worker first, then enable Web.

## Rollback

Set `SANO_ASYNC_GENERATION=false` on Web and redeploy/restart Web. This immediately restores the synchronous contract for new requests. Allow already queued work to drain, or pause the Worker; do not delete Redis jobs or generation/database rows. The additive index may remain. Investigate failed jobs by safe identifiers only and never replay a completed generation.
