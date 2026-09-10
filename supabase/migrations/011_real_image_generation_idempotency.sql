-- Idempotency for paid server-side image generation. RLS remains enabled and no
-- public privileges are broadened; the server writes with its private service role.
alter table public.image_generations
  add column if not exists request_id uuid;

create unique index if not exists image_generations_session_request_uidx
  on public.image_generations(tenant_id, session_id, request_id)
  where request_id is not null;

create index if not exists image_generations_customer_history_idx
  on public.image_generations(tenant_id, session_id, created_at desc);

alter table public.image_generations enable row level security;
