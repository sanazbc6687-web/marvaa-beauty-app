# Phase 1 activation, retention, and recovery runbook

## Before activation (Supabase)

1. Review and apply `012_phase1_safety_consent_atomic_cost.sql` in staging, then production. Do not apply it from an application deploy.
2. Confirm `customer-simulations` exists and remains private. Confirm the service role alone can execute the four new functions and `anon`/`authenticated` cannot.
3. Exercise reservation concurrency, RLS negative tests, signed URL expiry, and deletion in staging. Existing image rows are not rewritten; the new path constraint is `NOT VALID` for that reason.
4. Set `PUBLIC_SESSION_SIGNING_SECRET` to a new random value of at least 32 bytes and set `PUBLIC_TENANTS_JSON` to approved UUID/slug/hostname mappings. Marvaa's current Liara hostname must be in its `hosts` list. Never prefix either variable with `NEXT_PUBLIC_`.
5. Set `ALLOW_LOCAL_MARVAA_TENANT=true` only for local development. It must be absent/false in Liara production.
6. Deploy, call `/api/readiness`, and verify booleans only. Do not paste secrets into tickets or logs.

Example shape (identifiers/hosts are operational values, not copied from browser input):
`[{"id":"<tenant uuid>","slug":"marvaa","salonName":"Marvaa","hosts":["<current Liara host>"]}]`

## Retention cleanup contract (future scheduler; not implemented here)

A future privileged scheduled task may select consented rows where `retention_expires_at < now()` and `deleted_at is null`, delete only their non-null `input_path`/`output_path` keys from the private `customer-simulations` bucket, then null both paths and stamp `deleted_at`. It must preserve `user_choices`, `image_generations`, selections, consent, timestamps, and sanitized audit/recovery metadata. Deletion must be idempotent, tenant-scoped, batch-limited, and must never log object URLs or image bytes.

## Manual stale reconciliation

Find pending rows whose `reservation_expires_at` has passed. An operator must first reconcile provider billing/status using the provider request audit outside customer-visible logs. Call `mark_stale_generation_for_reconciliation(id)` to record review. **Never automatically call the provider again.** After determining no paid operation succeeded, explicitly mark the old row failed; the customer must submit a new request id. If it succeeded, securely recover/store the output only when consent permits, then mark the original row completed.

## Rollback

Roll back the application first. The migration is additive: leave columns, indexes, settings, and historical rows in place. Revoke new function execution if necessary; do not drop data. Restore the prior Liara release and prior environment mapping together. Rotating the signing secret invalidates all public sessions and is the emergency token rollback. Bucket or database deletion is never part of rollback.
