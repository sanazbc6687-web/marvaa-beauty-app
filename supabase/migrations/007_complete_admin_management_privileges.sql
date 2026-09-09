-- Minimum privileges for unified customer management, portfolio, and service editing.
-- Grants pass PostgreSQL privilege checks only; RLS remains the tenant boundary.

-- Customer Management reads contact details and updates only workflow status.
grant select (
  id, tenant_id, session_id, service_category_id, name, mobile, whatsapp,
  telegram, selected_options, preferred_at, created_at, status
) on table public.leads to authenticated;
grant update (status) on table public.leads to authenticated;

grant select (
  id, tenant_id, session_id, choice_id, input_path, output_path, status,
  metadata, created_at
) on table public.image_generations to authenticated;

grant select (
  id, tenant_id, session_id, lead_id, generation_id, status, notes, created_at
) on table public.contact_requests to authenticated;
grant update (status) on table public.contact_requests to authenticated;

-- Choice rows provide the service and selection context for each generation.
grant select (id, tenant_id, category_id, selections, created_at)
on table public.user_choices to authenticated;

-- Service Manager edits only owner-facing names, visibility, and ordering.
grant select (id, tenant_id, slug, title, name_fa, name_en, enabled, sort_order)
on table public.service_categories to authenticated;
grant update (name_fa, name_en, enabled, sort_order)
on table public.service_categories to authenticated;

-- PortfolioManager list/create/edit/reorder/delete operations.
grant select (
  id, tenant_id, service_category_id, title_fa, title_en, description_fa,
  active, featured, sort_order
) on table public.portfolio_items to authenticated;
grant insert (
  tenant_id, service_category_id, title, title_fa, active, sort_order
) on table public.portfolio_items to authenticated;
grant update (title_fa, title_en, description_fa, active, featured, sort_order)
on table public.portfolio_items to authenticated;
-- PostgreSQL DELETE is relation-level; PortfolioManager genuinely deletes items.
grant delete on table public.portfolio_items to authenticated;

grant select (id, tenant_id, portfolio_item_id, storage_path, is_cover, sort_order)
on table public.portfolio_images to authenticated;
grant insert (tenant_id, portfolio_item_id, storage_path, is_cover, sort_order)
on table public.portfolio_images to authenticated;
grant update (is_cover, sort_order) on table public.portfolio_images to authenticated;
-- PostgreSQL DELETE is relation-level; PortfolioManager genuinely deletes images.
grant delete on table public.portfolio_images to authenticated;

-- Storage object endpoints require relation-level privileges. UPDATE is omitted:
-- neither PortfolioManager nor Customer Management performs an object update/upsert.
grant select, insert, delete on table storage.objects to authenticated;

-- A canonical private bucket for image_generations.input_path/output_path. Objects
-- are never public, and paths must begin with the canonical tenant UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('customer-simulations','customer-simulations',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false;

drop policy if exists "tenant members read customer simulations" on storage.objects;
create policy "tenant members read customer simulations"
on storage.objects for select to authenticated
using (
  bucket_id='customer-simulations'
  and public.is_tenant_member((storage.foldername(name))[1]::uuid)
);

-- Reassert row security only on application-owned tables. storage.objects is
-- Supabase-managed and its RLS state is intentionally never altered here.
alter table public.leads enable row level security;
alter table public.image_generations enable row level security;
alter table public.contact_requests enable row level security;
alter table public.user_choices enable row level security;
alter table public.service_categories enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.portfolio_images enable row level security;
