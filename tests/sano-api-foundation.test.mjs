import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertMethodAllowed, assertObjectKey, assertTenantScope, parseDeleteKeys, parseResource } from "../lib/sano/policy.ts";
import { sanitizeProviderStatus } from "../lib/sano/errors.ts";
import { authorizeTenant, AuthorizationError } from "../lib/sano/tenant.ts";
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

const tenantA = "00000000-0000-0000-0000-000000000001";
const tenantB = "00000000-0000-0000-0000-000000000002";
const codeOf = action => { try { action(); } catch (error) { return error; } assert.fail("expected policy rejection"); };

test("cross-tenant query and payloads are rejected behaviorally", () => {
  assert.equal(codeOf(() => assertTenantScope({ path: `/rest/v1/leads?tenant_id=eq.${tenantB}`, tenantId: tenantA }, tenantA)).code, "TENANT_MISMATCH");
  assert.equal(codeOf(() => assertTenantScope({ path: "/rest/v1/leads", body: { tenant_id: tenantB }, tenantId: tenantA }, tenantA)).code, "TENANT_MISMATCH");
});

test("authenticated tenant authorization requires a visible tenant membership", async () => {
  const auth = { authenticate: async token => token === "valid" ? { userId: "user-1" } : Promise.reject(new Error("bad token")) };
  const visibleDb = { request: async () => [{ id: tenantA }] };
  assert.equal((await authorizeTenant(auth, visibleDb, "valid", tenantA)).userId, "user-1");
  await assert.rejects(() => authorizeTenant(auth, { request: async () => [] }, "valid", tenantA), error => error instanceof AuthorizationError && error.code === "TENANT_ACCESS_DENIED");
  await assert.rejects(() => authorizeTenant(auth, visibleDb, "invalid", tenantA), error => error instanceof AuthorizationError && error.code === "AUTH_REQUIRED");
});

test("public resources and methods are restricted and unsupported admin methods fail", () => {
  assert.equal(assertMethodAllowed(parseResource("/rest/v1/service_categories?select=id"), "GET", false), "GET");
  assert.equal(assertMethodAllowed(parseResource("/rest/v1/leads"), "POST", false), "POST");
  assert.equal(codeOf(() => assertMethodAllowed(parseResource("/rest/v1/leads"), "GET", false)).code, "PUBLIC_OPERATION_DENIED");
  assert.equal(codeOf(() => assertMethodAllowed(parseResource("/rest/v1/recommendation_rules"), "GET", true)).code, "METHOD_NOT_ALLOWED");
  assert.equal(codeOf(() => assertMethodAllowed(parseResource("/rest/v1/leads"), "PUT", true)).status, 405);
});

test("storage enforces tenant prefixes and rejects malformed delete input", () => {
  assert.equal(assertObjectKey(tenantA, `${tenantA}/hair/file.png`), `${tenantA}/hair/file.png`);
  assert.equal(codeOf(() => assertObjectKey(tenantA, `${tenantB}/hair/file.png`)).code, "TENANT_MISMATCH");
  for (const malformed of ["not-json", "{}", "[]", '[1]']) assert.equal(codeOf(() => parseDeleteKeys(malformed, tenantA)).code, "MALFORMED_DELETE_INPUT");
  assert.deepEqual(parseDeleteKeys(JSON.stringify([`${tenantA}/hair/file.png`]), tenantA), [`${tenantA}/hair/file.png`]);
});

test("provider errors are mapped to stable codes without raw messages", () => {
  for (const [status, expected] of [[400,"UPSTREAM_REQUEST_REJECTED"],[401,"UPSTREAM_UNAUTHORIZED"],[403,"UPSTREAM_FORBIDDEN"],[409,"UPSTREAM_CONFLICT"],[500,"UPSTREAM_UNAVAILABLE"]]) {
    const safe = sanitizeProviderStatus(status); assert.equal(safe.code, expected); assert.doesNotMatch(JSON.stringify(safe), /Supabase secret detail|https?:|signed/i);
  }
});

test("simulation response contract and synchronous behavior remain compatible", () => {
  const route = read("app/api/simulations/generate/route.ts");
  for (const field of ["generationId", "sessionId", "generatedImageUrl", "status: \"completed\"", "metadata", "referencesUsed"]) assert.match(route, new RegExp(field));
  assert.match(route, /providers\.ai\.generate/); assert.match(route, /getServiceProviders/);
});
