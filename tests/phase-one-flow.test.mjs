import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const modeSource = read("lib/recommendation/mode.ts");
const service = read("lib/simulation/service.ts");

function loadModeModule() {
  const javascript = ts.transpileModule(modeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("exports", javascript)(exports);
  return exports;
}

test("medium is customer-facing while signature remains the persisted compatibility value", () => {
  const { normalizeRecommendationMode } = loadModeModule();
  assert.equal(normalizeRecommendationMode("medium"), "signature");
  assert.equal(normalizeRecommendationMode("signature"), "signature");
  assert.equal(normalizeRecommendationMode("natural"), "natural");
  assert.equal(normalizeRecommendationMode("bold"), "bold");
  assert.match(page, /id:"medium",nameFa:"متوسط",nameEn:"Medium"/);
  assert.match(service, /recommendationMode: normalizeRecommendationMode\(input\.recommendationMode\)/);
});

test("welcome opens the three required customer paths without fabricated offers", () => {
  assert.match(page, /onClick=\{\(\)=>go\("main"\)\}>بزن بریم/);
  assert.match(page, /نسخه جدید خودم را ببینم/);
  assert.match(page, /نمونه‌کارهای سالن را ببینم/);
  assert.match(page, /پیشنهادها و هدایا/);
  assert.match(page, /onClick=\{\(\)=>go\("paths"\)\}/);
  assert.match(page, /onClick=\{\(\)=>go\("portfolio"\)\}/);
  assert.match(page, /onClick=\{\(\)=>go\("offers"\)\}/);
  assert.match(page, /فعلاً پیشنهادی فعال نیست/);
  assert.match(page, /<Offers back=\{back\}/);
});

test("Marvaa path selects intensity before requesting a face image", () => {
  assert.match(page, /setJourney\("recommend"\);go\("recommend"\)/);
  assert.match(page, /setMode\(r\.id\);primaryImages\.face\?create\(\{\},r\.id\):go\("requirement"\)/);
  assert.match(page, /journey==="recommend"\?services\.find\(s=>s\.photoRequirements\.primaryType==="face"\)/);
  assert.match(page, /if\(journey==="recommend"\)createWithPrimary\(asset,\{\},mode\)/);
});

test("self-style path collects all options before the service-specific image", () => {
  assert.match(page, /setJourney\("self"\);go\("services"\)/);
  assert.match(page, /const chooseService=.*go\("wizard"\)/);
  assert.match(page, /else if\(!primaryImages\[service!\.photoRequirements\.primaryType\]\)go\("requirement"\)/);
  assert.match(page, /requirement\.primaryType==="hand"/);
  assert.match(page, /createWithPrimary\(asset,answers\)/);
});

test("browser and in-app back actions share history without returning to loading", () => {
  assert.match(page, /window\.history\.pushState\(\{marvaaStep:s\}/);
  assert.match(page, /window\.history\.back\(\)/);
  assert.match(page, /window\.addEventListener\("popstate",pop\)/);
  assert.match(page, /while\(previous==="loading"\)previous=next\.pop\(\)/);
});
