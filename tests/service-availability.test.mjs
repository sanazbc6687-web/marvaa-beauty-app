import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const availability = read("lib/services/public.ts");
const publicPage = read("app/page.tsx");
const serviceManager = read("components/admin/ServiceManager.tsx");

test("public availability matches enabled database rows to canonical catalog slugs", () => {
  assert.match(availability, /rows\.filter\(row => row\.enabled\)\.map\(row => row\.slug\)/);
  assert.match(availability, /services\.filter\(service => enabledSlugs\.has\(service\.id\)\)/);
  assert.match(availability, /enabled: "eq\.true"/);
  assert.match(publicPage, /availableServices\.map/);
  assert.doesNotMatch(publicPage, /className="service-grid">\{services\.map/);
});

test("an empty or failed availability response never exposes the static catalog", () => {
  assert.match(publicPage, /catch\(\(\)=>\{if\(active\)\{setAvailableServices\(\[\]\);setAvailabilityFailed\(true\)\}\}\)/);
  assert.match(availability, /logSupabaseError\("load public service availability", error\)/);
  assert.doesNotMatch(availability, /catch[\s\S]*return services/);
});

test("disable requires confirmation while enable updates directly", () => {
  assert.match(serviceManager, /if\(!enabled&&item\.enabled\)\{setPendingDisable\(item\);return\}/);
  assert.match(serviceManager, /void patch\(item,\{enabled:true\}\)/);
  assert.match(serviceManager, /const confirmDisable=.*void patch\(item,\{enabled:false\}\)/);
  assert.match(serviceManager, /onClick=\{\(\)=>setPendingDisable\(null\)\}>انصراف/);
});

test("service toggles are soft updates and preserve related data", () => {
  assert.match(serviceManager, /method:"PATCH"/);
  assert.doesNotMatch(serviceManager, /method:"DELETE"|service_options|style_references|portfolio|history/);
  assert.match(serviceManager, /setItems\(previous\)/);
});
