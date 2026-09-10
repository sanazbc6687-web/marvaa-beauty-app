-- Enforce canonical Iranian mobile numbers for all future lead writes.
-- NOT VALID avoids making deployment depend on any historical rows; PostgreSQL still
-- enforces the constraint for every new or updated row.
alter table public.leads
  add constraint leads_mobile_iranian_format
  check (mobile ~ '^09[0-9]{9}$') not valid;
-- A session UUID is the public visitor's write capability. This narrowly-scoped RPC
-- can only mark an existing generation in that same demo session as liked. It neither
-- exposes rows nor grants anon general UPDATE access.
create or replace function public.like_demo_public_generation(
  requested_tenant_id uuid,
  requested_session_id uuid,
  requested_generation_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if requested_tenant_id <> '00000000-0000-0000-0000-000000000001'::uuid
     or not exists (
       select 1 from public.anonymous_sessions session
       where session.id = requested_session_id
         and session.tenant_id = requested_tenant_id
     ) then
    return false;
  end if;

  update public.image_generations
     set metadata = jsonb_set(
       jsonb_set(coalesce(metadata, '{}'::jsonb), '{liked}', 'true'::jsonb, true),
       '{likedAt}', to_jsonb(now()), true
     )
   where id = requested_generation_id
     and tenant_id = requested_tenant_id
     and session_id = requested_session_id
     and not (coalesce(metadata, '{}'::jsonb) @> '{"liked": true}'::jsonb);

  return found or exists (
    select 1 from public.image_generations generation
    where generation.id = requested_generation_id
      and generation.tenant_id = requested_tenant_id
      and generation.session_id = requested_session_id
      and coalesce(generation.metadata, '{}'::jsonb) @> '{"liked": true}'::jsonb
  );
end
$$;

revoke all on function public.like_demo_public_generation(uuid, uuid, uuid) from public;
grant execute on function public.like_demo_public_generation(uuid, uuid, uuid) to anon;

alter table public.leads enable row level security;
alter table public.image_generations enable row level security;
