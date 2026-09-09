-- Public visitors may create a contact lead for the bundled demo tenant only.
-- RLS remains enabled and no lead read/update/delete privilege is granted to anon.
grant insert (id, tenant_id) on table public.anonymous_sessions to anon;
grant select (id, slug, tenant_id, enabled) on table public.service_categories to anon;
grant insert (
  tenant_id, name, mobile, whatsapp, telegram, session_id,
  service_category_id, selected_options, status
) on table public.leads to anon;

create or replace function public.is_valid_demo_public_lead_context(
  requested_tenant_id uuid,
  requested_session_id uuid,
  requested_service_category_id uuid
) returns boolean
language sql security definer set search_path = public stable
as $$
  select
    requested_tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    and exists (
      select 1 from public.anonymous_sessions session
      where session.id = requested_session_id and session.tenant_id = requested_tenant_id
    )
    and (
      requested_service_category_id is null
      or exists (
        select 1 from public.service_categories category
        where category.id = requested_service_category_id
          and category.tenant_id = requested_tenant_id and category.enabled
      )
    )
$$;

revoke all on function public.is_valid_demo_public_lead_context(uuid, uuid, uuid) from public;
grant execute on function public.is_valid_demo_public_lead_context(uuid, uuid, uuid) to anon;

create policy "anon creates demo sessions" on public.anonymous_sessions
for insert to anon
with check (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

create policy "anon creates demo leads" on public.leads
for insert to anon
with check (
  status = 'new'
  and nullif(btrim(name), '') is not null
  and nullif(btrim(mobile), '') is not null
  and public.is_valid_demo_public_lead_context(tenant_id, session_id, service_category_id)
);

alter table public.anonymous_sessions enable row level security;
alter table public.leads enable row level security;
