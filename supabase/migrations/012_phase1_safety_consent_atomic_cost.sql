-- Phase 1: consent-aware retention and server-only atomic cost reservations.
-- Additive/idempotent; apply only after review. Existing rows remain unchanged.
alter table public.image_generations add column if not exists permanent_storage_consent boolean not null default false;
alter table public.image_generations add column if not exists retention_expires_at timestamptz;
alter table public.image_generations add column if not exists reservation_expires_at timestamptz;
alter table public.image_generations add column if not exists recovery_state text;
alter table public.image_generations add column if not exists deleted_at timestamptz;

create index if not exists image_generations_entitlement_idx
  on public.image_generations(tenant_id, session_id, status, created_at);
alter table public.image_generations drop constraint if exists image_generations_consent_paths_check;
alter table public.image_generations add constraint image_generations_consent_paths_check check
  (permanent_storage_consent or (input_path is null and output_path is null)) not valid;

insert into public.app_settings(tenant_id,key,value)
values ('00000000-0000-0000-0000-000000000001','generation_limits',
  '{"generation_enabled":true,"anonymous_allowance":1,"verified_contact_extra_allowance":2,"absolute_maximum":3,"daily_ceiling":20,"retention_months":12}'::jsonb)
on conflict (tenant_id,key) do update set value =
  jsonb_build_object(
    'generation_enabled',coalesce(app_settings.value->'generation_enabled','true'::jsonb),
    'anonymous_allowance',coalesce(app_settings.value->'anonymous_allowance',app_settings.value->'anonymous','1'::jsonb),
    'verified_contact_extra_allowance',coalesce(app_settings.value->'verified_contact_extra_allowance',app_settings.value->'extra_after_lead','2'::jsonb),
    'absolute_maximum',coalesce(app_settings.value->'absolute_maximum',app_settings.value->'maximum','3'::jsonb),
    'daily_ceiling',coalesce(app_settings.value->'daily_ceiling','20'::jsonb),
    'retention_months',coalesce(app_settings.value->'retention_months','12'::jsonb));

create or replace function public.reserve_image_generation(requested_tenant_id uuid, requested_session_id uuid, requested_request_id uuid, requested_consent boolean)
returns table(outcome text, generation_id uuid, output_path text)
language plpgsql security definer set search_path = public as $$
declare existing public.image_generations%rowtype; cfg jsonb; used int; allowed int; verified boolean; new_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended(requested_tenant_id::text || ':' || requested_session_id::text, 0));
  -- A second, tenant-wide lock makes the daily ceiling atomic across sessions.
  perform pg_advisory_xact_lock(hashtextextended('tenant-daily:' || requested_tenant_id::text || ':' || current_date::text, 0));
  if not exists(select 1 from anonymous_sessions where id=requested_session_id and tenant_id=requested_tenant_id) then raise exception 'INVALID_SESSION'; end if;
  select * into existing from image_generations where tenant_id=requested_tenant_id and session_id=requested_session_id and request_id=requested_request_id;
  if found then return query select case when existing.status='completed' then 'completed' else 'in_progress' end, existing.id, existing.output_path; return; end if;
  select value into cfg from app_settings where tenant_id=requested_tenant_id and key='generation_limits';
  if coalesce((cfg->>'generation_enabled')::boolean,true)=false then return query select 'disabled',null::uuid,null::text; return; end if;
  select exists(select 1 from leads where tenant_id=requested_tenant_id and session_id=requested_session_id) into verified;
  allowed := least(coalesce((cfg->>'absolute_maximum')::int,3), coalesce((cfg->>'anonymous_allowance')::int,1) + case when verified then coalesce((cfg->>'verified_contact_extra_allowance')::int,2) else 0 end);
  select count(*) into used from image_generations where tenant_id=requested_tenant_id and session_id=requested_session_id and status in ('pending','completed');
  if used >= allowed then return query select 'limit',null::uuid,null::text; return; end if;
  if (select count(*) from image_generations where tenant_id=requested_tenant_id and created_at >= date_trunc('day',now()) and status in ('pending','completed')) >= coalesce((cfg->>'daily_ceiling')::int,20) then return query select 'limit',null::uuid,null::text; return; end if;
  insert into image_generations(id,tenant_id,session_id,request_id,provider,status,permanent_storage_consent,retention_expires_at,reservation_expires_at,metadata)
  values(new_id,requested_tenant_id,requested_session_id,requested_request_id,'openai','pending',requested_consent,case when requested_consent then now()+make_interval(months=>coalesce((cfg->>'retention_months')::int,12)) end,now()+interval '15 minutes','{}');
  return query select 'reserved',new_id,null::text;
end $$;

drop function if exists public.fail_image_generation_reservation(uuid,text);
create or replace function public.fail_image_generation_reservation(requested_generation_id uuid, failure_code text, requested_recovery_state text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if requested_recovery_state not in ('safe_to_retry','manual_reconciliation_required') then raise exception 'INVALID_RECOVERY_STATE'; end if;
  update image_generations set status=case when requested_recovery_state='safe_to_retry' then 'failed' else 'pending' end,
    output_path=null, recovery_state=requested_recovery_state,
    metadata=jsonb_build_object('failure_code',left(regexp_replace(failure_code,'[^A-Z0-9_]','','g'),64))
  where id=requested_generation_id and status='pending'; return found;
end $$;

-- Marks stale work for human review. It deliberately never reserves or calls a provider.
create or replace function public.mark_stale_generation_for_reconciliation(requested_generation_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin update image_generations set recovery_state='manual_reconciliation_required' where id=requested_generation_id and status='pending' and reservation_expires_at < now(); return found; end $$;

create or replace function public.marvaa_phase1_capabilities() returns jsonb language sql security definer set search_path=public as $$ select '{"atomic_reservation":true,"consent_retention":true,"manual_reconciliation":true}'::jsonb $$;
revoke all on function public.reserve_image_generation(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.fail_image_generation_reservation(uuid,text,text) from public,anon,authenticated;
revoke all on function public.mark_stale_generation_for_reconciliation(uuid) from public,anon,authenticated;
revoke all on function public.marvaa_phase1_capabilities() from public,anon,authenticated;
grant execute on function public.reserve_image_generation(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.fail_image_generation_reservation(uuid,text,text) to service_role;
grant execute on function public.mark_stale_generation_for_reconciliation(uuid) to service_role;
grant execute on function public.marvaa_phase1_capabilities() to service_role;
