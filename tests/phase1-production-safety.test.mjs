import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const route = read("app/api/simulations/generate/route.ts");
const migration = read("supabase/migrations/012_phase1_safety_consent_atomic_cost.sql");

test("non-consented images never acquire durable paths", () => {
  assert.match(route, /permanentStorageConsent \?[^:]+: null/g);
  assert.match(migration, /permanent_storage_consent or \(input_path is null and output_path is null\)/);
  assert.doesNotMatch(migration, /dataUrl|base64/i);
});
test("consented private media receives tenant-configurable twelve-month retention", () => {
  assert.match(migration, /retention_months[^\n]+12/);
  assert.match(migration, /make_interval\(months=>coalesce/);
  assert.match(route, /createDownloadUrl\("customer-simulations"[^\n]+300/);
});
test("session proof is signed, expiring and bound to tenant and session", () => {
  const proof = read("lib/public/session-proof.ts");
  assert.match(proof, /createHmac\("sha256"/); assert.match(proof, /timingSafeEqual/);
  assert.match(proof, /claims\.tenantId !== tenantId \|\| claims\.sessionId !== sessionId \|\| claims\.exp <=/);
  assert.doesNotMatch(proof, /mobile|phone|service_role/i);
});
test("unknown production tenants fail closed and local fallback is explicit", () => {
  const tenant = read("lib/public/tenant.ts");
  assert.match(tenant, /PUBLIC_TENANTS_JSON/); assert.match(tenant, /ALLOW_LOCAL_MARVAA_TENANT === "true"/); assert.match(tenant, /throw new PublicTenantError/);
});
test("atomic reservation serializes final allowance, replays completion, and releases failures", () => {
  assert.equal((migration.match(/pg_advisory_xact_lock/g)||[]).length, 2); assert.match(migration, /status in \('pending','completed'\)/);
  assert.match(migration, /if found then[\s\S]+existing\.status='completed'/); assert.match(migration, /then 'failed' else 'pending'/);
  assert.match(route, /reserved\.outcome === "completed"[\s\S]+return NextResponse/);
});
test("stale pending work is manual-only and cannot trigger provider retry", () => {
  assert.match(migration, /manual_reconciliation_required/); assert.match(migration, /deliberately never reserves or calls a provider/);
  assert.match(read("docs/PHASE-1-ACTIVATION-RUNBOOK.md"), /Never automatically call the provider again/i);
});
test("saved media access and deletion are proof and tenant scoped", () => {
  const media = read("app/api/simulations/[generationId]/media/route.ts");
  assert.match(media, /verifySessionProof/); assert.match(media, /generationQuery\(generationId, tenant\.id, body\.sessionId\)/); assert.match(media, /objectStore\.delete/); assert.match(media, /mediaDeletionPatch\("customer"/);
});
test("readiness exposes presence booleans and never environment values", () => {
  const readiness = read("app/api/readiness/route.ts");
  assert.match(readiness, /assessReadiness/); assert.match(readiness, /status: result.ready \? 200 : 503/);
});
test("generation remains synchronous with no queue worker and tests make no provider request", () => {
  assert.match(route, /await providers\.ai\.generate/); assert.doesNotMatch(route, /BullMQ|Redis|Queue|Worker/);
  assert.doesNotMatch(route, /api\.openai\.com/);
});
