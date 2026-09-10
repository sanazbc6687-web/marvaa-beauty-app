import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const provider=readFileSync(new URL("../lib/simulation/provider.ts",import.meta.url),"utf8");

test("OpenAI image edits use the current GPT Image model and documented parameters",()=>{
 assert.match(provider,/OPENAI_IMAGE_MODEL="gpt-image-2"/);
 assert.doesNotMatch(provider,/gpt-image-1\.5/);
 assert.match(provider,/https:\/\/api\.openai\.com\/v1\/images\/edits/);
 assert.match(provider,/form\.set\("input_fidelity","high"\)/);
 assert.match(provider,/form\.set\("quality","high"\)/);
 assert.match(provider,/form\.set\("output_format","png"\)/);
});

test("OpenAI image edits preserve input ordering and parse base64 image output",()=>{
 const primary=provider.indexOf('form.append("image[]",dataUrlToFile(input.primaryImage.dataUrl');
 const details=provider.indexOf('input.detailImages.forEach');
 const references=provider.indexOf('input.selectedReferenceImages.entries()');
 assert.ok(primary>=0&&primary<details&&details<references);
 assert.match(provider,/payload\.data\?\.\[0\]\?\.b64_json/);
 assert.match(provider,/`data:image\/png;base64,\$\{base64\}`/);
});

test("the OpenAI API key is constructor-injected rather than exposed to the client",()=>{
 assert.match(provider,/constructor\(private readonly apiKey:string/);
 assert.doesNotMatch(provider,/NEXT_PUBLIC_OPENAI_API_KEY/);
});
