# SANO API Façade — Phase 1

## Boundary and provider decisions

The browser now reaches Supabase Auth, REST, and Storage only through `/api/sano/*`. The existing browser module remains as a compatibility shim so Marvaa routes and UI do not change. Supabase remains the active `AuthProvider`, `DatabaseProvider`, and `ObjectStore`; OpenAI remains the active `AIProvider`. `MessageProvider` and `PaymentProvider` are contracts only in this phase.

Provider selection is centralized in `lib/sano/providers/index.ts`. Public-key providers serve the façade while the service-role provider is constructed only for server-side simulation work. No secret is returned to or logged for the browser.

## Tenant and authorization model

The data façade accepts only allowlisted resources. Authenticated operations validate the bearer token and confirm access to the requested salon through existing Supabase RLS before forwarding a request. Public operations are limited to the existing public-flow tables/RPC and reject a mismatch between the declared tenant, query filter, and request payload. Storage is authenticated, bucket-allowlisted, and requires tenant-prefixed object keys.

This is a transition boundary, not a replacement for Supabase Auth or RLS. Existing sessions and database/storage policies remain authoritative.

## Direct-access inventory

Before this phase, direct calls existed in `lib/supabase/client.ts` and `lib/portfolio/public.ts` and were consumed by admin authentication, middleware, admin managers, public services, portfolio, sessions, leads, favorites, REST operations, uploads, deletes, public URLs, and signed URLs. The generation route separately used the service role for database and storage and directly instantiated OpenAI. These call sites now cross provider or façade boundaries without changing the Marvaa page URLs.

## Deferred limitations

- Server-managed HttpOnly sessions and replacement of Supabase Auth are later migration work.
- The API remains in Next.js and image generation remains synchronous until the queue/worker phase.
- Supabase RLS and schemas remain unchanged; no data migration or destructive migration is included.
- Message and payment implementations, Redis, queues, workers, CRM, Campaign, Beauty/Fitness features, and new Liara services are deliberately excluded.
