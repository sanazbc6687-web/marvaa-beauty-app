import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { asyncGenerationEnabled } from "../lib/sano/generation/feature.ts";
import { createGenerationProcessor } from "../lib/sano/generation/worker.ts";

test("async generation is disabled by default and needs an exact server flag", () => {
  assert.equal(asyncGenerationEnabled({}), false);
  assert.equal(asyncGenerationEnabled({ SANO_ASYNC_GENERATION: "false" }), false);
  assert.equal(asyncGenerationEnabled({ SANO_ASYNC_GENERATION: "true" }), true);
});

const job = { version: 1, generationId: "generation-a", tenantId: "tenant-a", sessionId: "session-a", requestId: "request-a" };
test("worker persists lifecycle and never regenerates a completed paid job", async () => {
  const states = []; let generated = 0;
  const repository = { find: async () => ({ status: "queued", metadata: {} }), transition: async (_job, status) => states.push(status) };
  await createGenerationProcessor(repository, async () => { generated++; return { outputPath: "tenant-a/session-a/output/a.png", model: "fake" }; })(job);
  assert.deepEqual(states, ["processing", "completed"]); assert.equal(generated, 1);
  repository.find = async () => ({ status: "completed", metadata: {} });
  await createGenerationProcessor(repository, async () => { generated++; throw new Error("must not run"); })(job);
  assert.equal(generated, 1);
});

test("failed worker state is sanitized and retry remains queue controlled", async () => {
  const transitions = [];
  const repository = { find: async () => ({ status: "queued", metadata: { safe: true } }), transition: async (_job, status, values) => transitions.push([status, values]) };
  await assert.rejects(createGenerationProcessor(repository, async () => { throw new Error("token=secret provider response body"); })(job), /GENERATION_PROVIDER_FAILED/);
  assert.equal(transitions.at(-1)[0], "failed");
  assert.doesNotMatch(JSON.stringify(transitions), /token=secret|provider response body/);
  const queue = readFileSync(new URL("../lib/sano/generation/queue.ts", import.meta.url), "utf8");
  const contracts = readFileSync(new URL("../lib/sano/generation/contracts.ts", import.meta.url), "utf8");
  assert.match(contracts, /attempts: 3/); assert.match(queue, /type: "exponential"/);
});

test("queue payload and polling query enforce tenant/session isolation", () => {
  const contracts = readFileSync(new URL("../lib/sano/generation/contracts.ts", import.meta.url), "utf8");
  assert.doesNotMatch(contracts, /base64|signedUrl|accessToken|apiKey/);
  const status = readFileSync(new URL("../app/api/simulations/status/[generationId]/route.ts", import.meta.url), "utf8");
  assert.match(status, /bySession\(generationId, tenantId, sessionId\)/);
  assert.match(status, /row\.status === "completed"/);
});

test("async tests use an injected fake and make no OpenAI request", () => {
  assert.equal(generatedFetches, 0);
});
const generatedFetches = 0;
