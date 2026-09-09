-- Persist demo public simulations without exposing any customer rows to anon.
-- A random session UUID is the write-scoping capability shared by the flow.

grant insert (id, tenant_id, session_id, category_id, path, selections)
on table public.user_choices to anon;
grant insert (id, tenant_id, session_id, choice_id, input_path, status, metadata)
on table public.image_generations to anon;
grant insert on table storage.objects to anon;

create or replace function public.is_valid_demo_public_choice(
  requested_tenant_id uuid, requested_session_id uuid, requested_category_id uuid
) returns boolean
language sql security definer set search_path = public stable
as $$
  select requested_tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    and exists (
      select 1 from public.anonymous_sessions s
      where s.id = requested_session_id and s.tenant_id = requested_tenant_id
    )
    and (requested_category_id is null or exists (
      select 1 from public.service_categories c
      where c.id = requested_category_id and c.tenant_id = requested_tenant_id and c.enabled
    ))
$$;

create or replace function public.is_valid_demo_public_generation(
  requested_tenant_id uuid, requested_session_id uuid, requested_choice_id uuid,
  requested_input_path text
) returns boolean
language sql security definer set search_path = public stable
as $$
  select requested_tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    and requested_input_path like requested_tenant_id::text || '/' || requested_session_id::text || '/input/%'
    and exists (
      select 1 from public.user_choices c
      where c.id = requested_choice_id and c.session_id = requested_session_id
        and c.tenant_id = requested_tenant_id
    )
$$;

create or replace function public.is_valid_demo_simulation_object(object_name text)
returns boolean
language sql security definer set search_path = public, storage stable
as $$
  select (storage.foldername(object_name))[1] = '00000000-0000-0000-0000-000000000001'
    and (storage.foldername(object_name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (storage.foldername(object_name))[3] = 'input'
    and array_length(storage.foldername(object_name), 1) = 3
    and exists (
      select 1 from public.anonymous_sessions s
      where s.id::text = (storage.foldername(object_name))[2]
        and s.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
$$;

revoke all on function public.is_valid_demo_public_choice(uuid, uuid, uuid) from public;
revoke all on function public.is_valid_demo_public_generation(uuid, uuid, uuid, text) from public;
revoke all on function public.is_valid_demo_simulation_object(text) from public;
grant execute on function public.is_valid_demo_public_choice(uuid, uuid, uuid) to anon;
grant execute on function public.is_valid_demo_public_generation(uuid, uuid, uuid, text) to anon;
grant execute on function public.is_valid_demo_simulation_object(text) to anon;

create policy "anon creates demo choices" on public.user_choices
for insert to anon
with check (
  path in ('self', 'consult')
  and public.is_valid_demo_public_choice(tenant_id, session_id, category_id)
);

create policy "anon creates demo generations" on public.image_generations
for insert to anon
with check (
  status = 'completed'
  and output_path is null
  and public.is_valid_demo_public_generation(tenant_id, session_id, choice_id, input_path)
);

create policy "anon uploads demo simulation inputs" on storage.objects
for insert to anon
with check (
  bucket_id = 'customer-simulations'
  and public.is_valid_demo_simulation_object(name)
);

alter table public.anonymous_sessions enable row level security;
alter table public.user_choices enable row level security;
alter table public.image_generations enable row level security;
