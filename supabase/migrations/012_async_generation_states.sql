-- Additive only: retain existing records, RLS, ownership and idempotency index.
create index if not exists image_generations_worker_idx
  on public.image_generations(status, created_at)
  where status in ('queued', 'processing');
