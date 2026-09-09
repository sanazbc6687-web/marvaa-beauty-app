-- Let authenticated tenant members use the complete Admin Reference Library.
--
-- Grants only pass PostgreSQL's privilege check. Every row remains subject to
-- the existing RLS policies, which call is_tenant_member() and therefore use
-- the canonical tenant_users membership table.

-- getContext() reads these columns and filters/orders by the final three.
grant select (id, slug, name_fa, title, tenant_id, enabled, sort_order)
on table public.service_categories to authenticated;

-- The reference list/editor reads these columns. New references are created by
-- the editor, while edits are restricted to the fields it currently exposes.
grant select (
  id, tenant_id, service_category_id, reference_type, name_fa, name_en,
  technical_definition, visual_rules, generation_rules, negative_constraints,
  active, sort_order
) on table public.style_references to authenticated;
grant insert (
  tenant_id, service_category_id, title, slug, name_fa, name_en, reference_type
) on table public.style_references to authenticated;
grant update (
  active, name_fa, name_en, technical_definition, visual_rules,
  generation_rules, negative_constraints
) on table public.style_references to authenticated;

-- Image records are loaded through the embedded relationship, created after a
-- successful upload, edited for primary/active/order/replace, and deleted by
-- the image manager. PostgreSQL has no column-level DELETE privilege.
grant select (id, tenant_id, style_reference_id, storage_path, is_primary, sort_order, active)
on table public.style_reference_images to authenticated;
grant insert (
  tenant_id, style_reference_id, image_url, storage_path,
  public_url_or_signed_path, is_primary, sort_order, active
) on table public.style_reference_images to authenticated;
grant update (
  storage_path, image_url, public_url_or_signed_path, is_primary, sort_order, active
) on table public.style_reference_images to authenticated;
grant delete on table public.style_reference_images to authenticated;

-- Supabase Storage requires relation-level privileges for its object API.
-- This page signs/downloads, inserts, and deletes objects; it never performs an
-- object UPDATE/upsert, so UPDATE is deliberately not granted here. Existing
-- bucket policies continue to restrict all access to style-references and to a
-- first path segment belonging to a canonical tenant member.
grant select, insert, delete on table storage.objects to authenticated;

-- Be explicit that this privilege repair must never turn RLS off.
alter table public.service_categories enable row level security;
alter table public.style_references enable row level security;
alter table public.style_reference_images enable row level security;
