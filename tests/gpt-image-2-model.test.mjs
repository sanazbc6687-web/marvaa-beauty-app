import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const provider = fs.readFileSync(new URL("../lib/simulation/provider.ts", import.meta.url), "utf8");

test("production image provider uses GPT-Image-2 without reverting PR #17 architecture", () => {
  assert.match(provider, /const OPENAI_IMAGE_MODEL = "gpt-image-2"/);
  assert.match(provider, /input_fidelity", "high"/);
  assert.match(provider, /quality", "high"/);
  assert.match(provider, /output_format", "png"/);
  assert.match(provider, /\/v1\/images\/edits/);
  assert.match(provider, /bytes: Uint8Array/);
  assert.doesNotMatch(provider, /gpt-image-1\.5/);
});
