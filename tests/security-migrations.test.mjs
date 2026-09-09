import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("tenant resolution grants only the salon id and remains membership scoped", () => {
  const migration = read("supabase/migrations/005_allow_authenticated_tenant_resolution.sql");

  assert.match(migration, /grant select \(id\) on table public\.salons to authenticated/i);
  assert.doesNotMatch(migration, /grant select on (?:table )?public\.salons/i);
  assert.match(migration, /to authenticated\s+using \(public\.is_tenant_member\(id\)\)/i);
  assert.doesNotMatch(migration, /disable row level security/i);
});

test("reference loading and private upload stay tenant-prefixed", () => {
  const manager = read("components/admin/ReferenceManager.tsx");
  const adminData = read("lib/admin/data.ts");
  const referenceMigration = read("supabase/migrations/003_admin_reference_recommendations.sql");

  assert.match(adminData, /salons\?select=id&limit=1/);
  assert.match(manager, /style_references\?select=/);
  assert.match(manager, /const path=`\$\{tenant\}\//);
  assert.match(manager, /upload\("style-references",path,file\)/);
  assert.match(referenceMigration, /'style-references','style-references',false/);
  assert.match(referenceMigration, /is_tenant_member\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/);
});

test("the pilot migration contains the ten existing style references", () => {
  const migration = read("supabase/migrations/003_admin_reference_recommendations.sql");
  const seedValues = migration.split("x(service_slug,slug,name_fa,name_en,reference_type)")[0].split("(values").at(-1);
  const seededSlugs = [...seedValues.matchAll(/\('[^']+','([^']+)','[^']+','[^']+','[^']+'\)/g)]
    .map(match => match[1]);

  assert.deepEqual(seededSlugs, [
    "balayage", "spiky-lashes", "graduated-bob", "light-makeup", "microblading",
    "lip-shading", "almond-nails", "half-up", "icy-hair", "red-nails",
  ]);
});
