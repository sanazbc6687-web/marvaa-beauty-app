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

test("reference library grants match every table and operation used by the page", () => {
  const migration = read("supabase/migrations/006_admin_reference_library_privileges.sql");

  assert.match(migration, /grant select \(id, slug, name_fa, title, tenant_id, enabled, sort_order\)\s+on table public\.service_categories to authenticated/i);
  assert.match(migration, /grant select \([\s\S]*?\) on table public\.style_references to authenticated/i);
  assert.match(migration, /grant insert \([\s\S]*?\) on table public\.style_references to authenticated/i);
  assert.match(migration, /grant update \([\s\S]*?\) on table public\.style_references to authenticated/i);
  assert.doesNotMatch(migration, /grant delete on table public\.style_references/i);
  assert.match(migration, /grant select \([^)]*style_reference_id[^)]*\)\s+on table public\.style_reference_images to authenticated/i);
  assert.match(migration, /grant insert \([\s\S]*?\) on table public\.style_reference_images to authenticated/i);
  assert.match(migration, /grant update \([\s\S]*?\) on table public\.style_reference_images to authenticated/i);
  assert.match(migration, /grant delete on table public\.style_reference_images to authenticated/i);
  assert.match(migration, /grant select, insert, delete on table storage\.objects to authenticated/i);
  assert.doesNotMatch(migration, /grant (?:all|update)[^;]*storage\.objects/i);
});

test("reference privileges are column-scoped and do not broaden unrelated CMS tables", () => {
  const migration = read("supabase/migrations/006_admin_reference_library_privileges.sql");

  for (const table of ["service_categories", "style_references"]) {
    assert.doesNotMatch(migration, new RegExp(`grant (?:all|select|insert|update|delete) on table public\\.${table}`, "i"));
  }
  assert.doesNotMatch(migration, /public\.(?:service_options|recommendation_rules|portfolio_items|portfolio_images|leads|contact_requests)/i);
  assert.doesNotMatch(migration, /service_role/i);
  assert.doesNotMatch(migration, /disable row level security/i);
});

test("RLS and canonical tenant isolation cover database rows and private objects", () => {
  const privileges = read("supabase/migrations/006_admin_reference_library_privileges.sql");
  const membership = read("supabase/migrations/003_admin_reference_recommendations.sql");
  const policies = read("supabase/migrations/001_initial_schema.sql") + read("supabase/migrations/002_future_mirror_v2.sql");

  for (const table of ["service_categories", "style_references", "style_reference_images"]) {
    assert.match(privileges, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(policies, new RegExp(`on ${table} for all using\\(is_tenant_member\\(tenant_id\\)\\) with check\\(is_tenant_member\\(tenant_id\\)\\)`, "i"));
  }
  assert.match(membership, /function is_tenant_member\(tid uuid\)[\s\S]*from tenant_users[\s\S]*user_id=auth\.uid\(\)[\s\S]*active/i);
  assert.doesNotMatch(privileges, /alter table storage\.objects enable row level security/i);
  assert.match(membership, /bucket_id='style-references' and is_tenant_member\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/i);
});

test("image upload, metadata updates, reorder, replace, and delete stay tenant scoped", () => {
  const manager = read("components/admin/ReferenceManager.tsx");

  assert.match(manager, /const path=`\$\{tenant\}\/\$\{line\}\/\$\{item\.id\}\//);
  assert.match(manager, /upload\("style-references",path,file\)/);
  assert.match(manager, /style_reference_images\?style_reference_id=eq\.\$\{item\.id\}/);
  assert.match(manager, /style_reference_images\?id=eq\.\$\{image\.id\}[\s\S]*JSON\.stringify\(value\)/);
  assert.match(manager, /sort_order:other\.sort_order/);
  assert.match(manager, /storage_path:path,image_url:path,public_url_or_signed_path:path/);
  assert.match(manager, /removeStorage\("style-references",\[image\.storage_path\]\)/);
  assert.match(manager, /style_reference_images\?id=eq\.\$\{image\.id\}[\s\S]*method:"DELETE"/);
});


const adminMigration = read("supabase/migrations/007_complete_admin_management_privileges.sql");
const publicLeadMigration = read("supabase/migrations/008_allow_demo_public_lead_insert.sql");

test("public lead creation is insert-only and restricted to the demo tenant", () => {
  assert.match(publicLeadMigration, /grant insert \([\s\S]*?tenant_id[\s\S]*?status[\s\S]*?\) on table public\.leads to anon/i);
  assert.doesNotMatch(publicLeadMigration, /grant (?:select|update|delete|all)[^;]*public\.leads/i);
  assert.match(publicLeadMigration, /on public\.leads\s+for insert to anon/i);
  assert.match(publicLeadMigration, /status = 'new'/i);
  assert.match(publicLeadMigration, /00000000-0000-0000-0000-000000000001/i);
  assert.match(publicLeadMigration, /is_valid_demo_public_lead_context\(tenant_id, session_id, service_category_id\)/i);
  assert.doesNotMatch(publicLeadMigration, /service_role|disable row level security/i);
});

test("customer tables retain canonical tenant isolation and minimum grants", () => {
  const policies = read("supabase/migrations/004_complete_admin_content_management.sql") + read("supabase/migrations/001_initial_schema.sql");
  for (const table of ["leads", "image_generations", "contact_requests"]) {
    assert.match(adminMigration, new RegExp(`grant select \\([\\s\\S]*?\\) on table public\\.${table} to authenticated`, "i"));
    assert.match(adminMigration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(policies, new RegExp(`(?:members|tenant members) manage (?:leads|generations|requests)\\"? on ${table}[\\s\\S]*is_tenant_member\\(tenant_id\\)`, "i"));
  }
  assert.match(adminMigration, /grant update \(status\) on table public\.leads to authenticated/i);
  assert.doesNotMatch(adminMigration, /grant (?:all|insert|delete) on table public\.(?:leads|image_generations|contact_requests)/i);
});

test("portfolio grants and policies cover every operation without crossing tenants", () => {
  const policies = read("supabase/migrations/002_future_mirror_v2.sql") + read("supabase/migrations/003_admin_reference_recommendations.sql");
  for (const table of ["portfolio_items", "portfolio_images"]) {
    for (const operation of ["select", "insert", "update"]) assert.match(adminMigration, new RegExp(`grant ${operation} \\([\\s\\S]*?\\)\\s*on table public\\.${table} to authenticated`, "i"));
    assert.match(adminMigration, new RegExp(`grant delete on table public\\.${table} to authenticated`, "i"));
    assert.match(policies, new RegExp(`members manage portfolio(?: images)?\\" on ${table} for all using\\(is_tenant_member\\(tenant_id\\)\\)`, "i"));
  }
  assert.match(policies, /bucket_id='salon-portfolio' and is_tenant_member\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/i);
});

test("service editing is column-limited and tenant scoped", () => {
  const policies = read("supabase/migrations/001_initial_schema.sql");
  assert.match(adminMigration, /grant update \(name_fa, name_en, enabled, sort_order\)\s*on table public\.service_categories to authenticated/i);
  assert.doesNotMatch(adminMigration, /grant (?:all|insert|delete) on table public\.service_categories/i);
  assert.match(policies, /members manage categories" on service_categories for all using\(is_tenant_member\(tenant_id\)\)/i);
});

test("new admin migration keeps storage and roles safe", () => {
  assert.doesNotMatch(adminMigration, /service_role/i);
  assert.doesNotMatch(adminMigration, /disable row level security/i);
  assert.doesNotMatch(adminMigration, /alter table storage\.objects enable row level security/i);
  assert.doesNotMatch(adminMigration, /grant all/i);
  assert.match(adminMigration, /'customer-simulations','customer-simulations',false/i);
  assert.match(adminMigration, /bucket_id='customer-simulations'[\s\S]*is_tenant_member\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/i);
});

test("reference library implementation and grants remain unchanged", () => {
  const manager = read("components/admin/ReferenceManager.tsx");
  const grants = read("supabase/migrations/006_admin_reference_library_privileges.sql");
  assert.match(manager, /signedStorageUrl\("style-references",i\.storage_path\)/);
  assert.match(manager, /upload\("style-references",path,file\)/);
  assert.match(grants, /grant select, insert, delete on table storage\.objects to authenticated/i);
  assert.doesNotMatch(adminMigration, /style_references|style_reference_images/);
});
