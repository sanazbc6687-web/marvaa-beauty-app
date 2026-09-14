import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("provider contracts cover Phase 1 integration boundaries", () => {
  const source = read("lib/sano/providers/contracts.ts");
  for (const name of ["AuthProvider", "DatabaseProvider", "ObjectStore", "AIProvider", "MessageProvider", "PaymentProvider"]) assert.match(source, new RegExp(`interface ${name}`));
  const registry = read("lib/sano/providers/index.ts");
  assert.match(registry, /SupabaseProvider/); assert.match(registry, /OpenAIBeautyImageProvider/);
});

test("browser integrations use only the SANO facade", () => {
  const client = read("lib/supabase/client.ts");
  assert.doesNotMatch(client, /NEXT_PUBLIC_SUPABASE|fetch\(`?\$\{[^}]*supabase/i);
  for (const endpoint of ["/api/sano/auth", "/api/sano/data", "/api/sano/storage"]) assert.match(client, new RegExp(endpoint));
  assert.doesNotMatch(read("middleware.ts"), /SUPABASE|\/auth\/v1\/user/);
});

test("tenant authorization rejects mismatches and provider resources are allowlisted", () => {
  const route = read("app/api/sano/data/route.ts");
  assert.match(route, /authorizeTenant/); assert.match(route, /TENANT_MISMATCH/); assert.match(route, /ADMIN_TABLES/); assert.match(route, /PUBLIC_TABLES/);
  const storage = read("app/api/sano/storage/route.ts");
  assert.match(storage, /key\.startsWith\(`\$\{tenantId\}\//); assert.match(storage, /TENANT_MISMATCH/);
});

test("simulation response contract and synchronous behavior remain compatible", () => {
  const route = read("app/api/simulations/generate/route.ts");
  for (const field of ["generationId", "sessionId", "generatedImageUrl", "status: \"completed\"", "metadata", "referencesUsed"]) assert.match(route, new RegExp(field));
  assert.match(route, /providers\.ai\.generate/); assert.match(route, /getServiceProviders/);
});
