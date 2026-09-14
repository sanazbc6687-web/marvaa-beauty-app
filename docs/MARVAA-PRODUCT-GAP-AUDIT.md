# MARVAA Product Completion Gap Audit

**Audit date:** 2026-09-14
**Repository:** `marvaa-beauty-app`
**Audited source:** commit `a5ba1e6` (the supplied checkout's current source-of-truth commit; no local or remote `main` ref was configured)
**Purpose:** audit only; no application code, migration, Supabase, Liara, OpenAI, or deployment change was made.

## Executive conclusion

The repository is a **functional prototype, not yet a production candidate**. It has a polished mobile-first RTL shell, a complete static service taxonomy, a synchronous real OpenAI image-edit call path, useful reference/portfolio/service admin screens, tenant-aware database policies, and a SANO façade. However, the approved recommendation journey is not actually implemented: it asks only for desired intensity, does not collect or persist a Beauty Profile, and consequently ranks references from an empty profile. The self-selection journey also has no review/edit summary.

The most serious production blockers are:

1. **Photo-consent contradiction:** the UI says permanent storage is optional, but generation always uploads the primary image and persists its path; the checkbox is never sent or enforced.
2. **Cost controls are incomplete and race-prone:** the server enforces only `maximum`, not the approved anonymous-versus-contact unlock, and concurrent requests can pass the count check before either completes. There is no queue/worker implementation in this audited tree (PR #26 is intentionally not treated as merged).
3. **White-label/multi-tenant runtime is not complete:** all public traffic uses one hard-coded demo tenant and static branding/catalog. Admin brand/settings inputs do not save.
4. **The “consultation” path is a mislabeled lead unlock:** it does not create a `contact_requests` record, collect consultation notes/time, or provide salon contact actions.
5. **Reference semantics are incomplete:** the schema and manager can hold types and multiple images, but runtime selection collapses to one image per purpose and catalog option-to-database reference linkage relies on slugs rather than a managed canonical mapping.

Static checks pass, but this does **not** verify a deployed Supabase schema, RLS behavior against a live project, storage lifecycle, Liara secrets, media playback, or any paid image generation.

## Rating method

| Rating | Meaning in this audit |
|---|---|
| **Implemented** | The implementation and its reachable call path satisfy the requirement in the repository. |
| **Partially implemented** | A meaningful reachable subset exists, but required behavior or production hardening is absent. |
| **Missing** | No meaningful reachable implementation exists. |
| **Broken** | An implementation exists but its current call path contradicts the requirement or cannot deliver the represented behavior. |
| **Unverified** | Repository evidence exists, but the requirement depends on external configuration/runtime state that was deliberately not inspected or invoked. |

A filename, schema declaration, or regex test alone was not treated as proof. Each rating below follows the UI/client/server/provider/database call path as applicable.

---

## 1. Customer journey audit

| Requirement | Rating | Repository evidence and finding |
|---|---|---|
| Welcome video with poster, mute/unmute, skip and fallback | **Implemented** | The reachable welcome state renders a `<video>` with tenant poster/source, toggles `muted`, exposes skip, advances on end, and replaces failed video with a fallback (`app/page.tsx:37`). The demo asset paths exist in `lib/tenant.ts:6` and the repository contains both referenced public assets. The `videoEnabled` setting is defined but ignored, so disabling video is not supported; that defect is captured under admin branding. |
| Initial intent question | **Implemented** | After welcome, the main state asks what the customer wants and offers Future Mirror, portfolio, or offers (`app/page.tsx:39`). |
| Service selection | **Implemented** | The self path loads enabled service slugs through the public SANO/Supabase path and only renders returned catalog matches (`app/page.tsx:42`; `lib/services/public.ts:16-29`). Failure is fail-closed rather than exposing the static list. |
| “Recommend for me” and “I choose myself” paths | **Partially implemented** | Two path buttons set `journey` and route separately (`app/page.tsx:40`). The self path is functional, but the recommendation path is only an intensity picker and image upload—not an actual consultation (see Beauty Profile and recommendation findings). |
| One-question-at-a-time consultation | **Missing** | The recommendation path shows one intensity screen and immediately requests/generates from a face image (`app/page.tsx:41`; `app/page.tsx:23-26`). No consultation-question model or answer loop exists. The one-decision-at-a-time UI belongs only to self-selection (`app/page.tsx:45`). |
| Self-selection wizard | **Implemented** | Service choice resets state, each option advances one decision at a time, and completion proceeds to required photo/detail/generation (`app/page.tsx:22-24`; `app/page.tsx:45`). |
| Selection summary and editing | **Missing** | `selectOption` transitions directly to photo/detail/generation after the final answer (`app/page.tsx:23`); no summary/review step exists in the `Step` union (`app/page.tsx:13`) and no edit control is rendered. |
| Service-specific photo requirements | **Implemented** | Catalog requirements distinguish face/hand primary images, guidance, identity rules, and optional brow/eye/lip closeups (`lib/catalog.ts:14-18`). The reachable UI uses the selected service requirement, requests hand for nails, keeps face as the primary for face services, and offers an optional detail step (`app/page.tsx:19`; `app/page.tsx:43-44`). |
| Secure photo upload | **Broken** | Input MIME/size is validated server-side and customer storage uses a private bucket path (`app/api/simulations/generate/route.ts:49-50,132-153`; `supabase/migrations/007_complete_admin_management_privileges.sql:56-68`). However, the browser sends base64 in JSON (`lib/simulation/service.ts:25-31`), the route always permanently uploads the primary input (`app/api/simulations/generate/route.ts:49-56`), and neither the consent checkbox nor `permanent_storage_consent` is transmitted. The UI promise that unchecked photos are only used for the experience (`app/page.tsx:55`) is therefore false. No expiry/deletion lifecycle is implemented. |
| AI generation | **Partially implemented** | The reachable server route synchronously loads context, builds a prompt, invokes the provider, uploads the result, and persists completion (`app/api/simulations/generate/route.ts:35-68`). The provider calls OpenAI image edits with `gpt-image-2` (`lib/simulation/provider.ts:24-59`). It remains unverified against live dependencies, and synchronous execution has no worker/retry/recovery path. |
| Result display and comparison | **Implemented** | A result state displays before/after images with a draggable clipping slider and explicit labels (`app/page.tsx:48`; `app/page.tsx:57`). Failed generation returns to a prior step with an error rather than rendering a fake result (`app/page.tsx:24`). |
| Generation limits | **Broken** | The UI opens a lead modal after the demo anonymous allowance (`app/page.tsx:48,57`), while the server reads settings but enforces only `maximum` by counting completed rows (`app/api/simulations/generate/route.ts:89-93`). It does not enforce anonymous allowance or contact unlock, does not verify a lead, ignores `extraAfterLead`, and a count-then-generate race can exceed the maximum. The UI's `generationCount` resets on reload. |
| Human consultation/contact request | **Broken** | “Consultation with Marvaa” opens the same lead form (`app/page.tsx:57-59`), and submission only inserts `leads` (`lib/leads/public.ts:11-23`). It never inserts `contact_requests`, never associates a generation, and offers no preferred time, notes, or direct contact action, even though admin reads `contact_requests` (`components/admin/LeadManager.tsx:16-23`). |

## 2. Supported services and taxonomy audit

The public taxonomy is code-owned in `servicesData`; the database controls only whether a known slug is visible. This means the approved set is represented, but taxonomy labels/options cannot be fully managed per tenant without a deploy (`lib/catalog.ts:17-26`; `lib/services/public.ts:9-13`).

| Requirement | Rating | Repository evidence and finding |
|---|---|---|
| Hair color and techniques | **Implemented** | `hair-color` separates technique from shade and provides technique plus cool/warm/fantasy/natural groups (`lib/catalog.ts:11-12,18`). |
| Haircuts | **Implemented** | `haircut` includes grouped bob, layer, pixie, and bangs options (`lib/catalog.ts:19`). |
| Brows | **Implemented** | `brows` includes microblading, nano, powder, ombré, and combo choices, with optional closeup (`lib/catalog.ts:21`). |
| Lashes | **Implemented** | `lashes` includes six styles and optional eye closeup (`lib/catalog.ts:20`). |
| Nails with separate shape and color | **Implemented** | `nails` has sequential `shape` and `nail-color` decisions and uses a hand image (`lib/catalog.ts:16,23`). |
| Hairstyles/updos | **Implemented** | `updo` provides open, closed/updo, and half-up choices (`lib/catalog.ts:25`). |
| Makeup | **Implemented** | `makeup` provides light, medium, and full-glam intensity (`lib/catalog.ts:24`). |
| Lip shading | **Implemented** | `lips` provides Lip Blush and optional lips closeup (`lib/catalog.ts:22`). |

**Taxonomy caveat:** Admin service editing changes database names/order/enabled state (`components/admin/ServiceManager.tsx:6-18`), but the customer renders names, decisions, and ordering from the static catalog after matching only enabled slugs (`lib/services/public.ts:9-13`). Thus admin name/order edits are not reflected publicly.

## 3. Recommendation and simulation quality audit

| Requirement | Rating | Repository evidence and finding |
|---|---|---|
| Beauty Profile | **Broken** | A `BeautyProfile` type/schema and server lookup exist (`lib/types.ts:20`; `app/api/simulations/generate/route.ts:98-99`), but no customer call path creates or updates a profile. The decorative passport hard-codes “learning,” “balanced,” and one favorite (`app/page.tsx:58`) rather than reading profile data. Recommendation therefore commonly receives `{}`. |
| Recommendation rules | **Partially implemented** | The engine supports typed operators, priority, mode multipliers, deterministic scoring, and rule reasons (`lib/recommendation/recommendation-engine.ts:1-29`; `lib/recommendation/recommendation-rules.ts:1-28`; `lib/recommendation/scoring.ts:1-26`). The route loads active tenant rules and uses them (`app/api/simulations/generate/route.ts:35-45,97`), but there is no admin management UI for rules and no consultation-derived feature values to match. |
| Reference Library | **Partially implemented** | Admin can create/edit/activate references, manage advanced text fields, and upload/order/activate/replace/delete images (`components/admin/ReferenceManager.tsx:10-27`). Runtime loads tenant/category-active records and private signed images (`app/api/simulations/generate/route.ts:94-99,117-125`). Missing validation, transactional replacement, rule management, canonical option mapping, and deployment verification prevent a production rating. |
| Primary and alternate reference images | **Partially implemented** | Admin supports multiple images and selecting a primary (`components/admin/ReferenceManager.tsx:24-27`). Runtime sorts primary first but intentionally takes only `active.slice(0, 1)` per purpose (`lib/references/selector.ts:20-27`), so alternate images are stored/manageable but never supplied to generation. |
| Separate technique/color/shape references | **Partially implemented** | `reference_type` supports technique/color/shape and the admin groups by it (`components/admin/ReferenceManager.tsx:5-6,17-18`); runtime deduplicates by metadata purpose/type (`lib/references/selector.ts:17-27`). Yet purpose is free-form metadata/type, new admin references default to `other`, and the editor cannot change reference type or purpose (`components/admin/ReferenceManager.tsx:12,25-27`). Correct separation therefore depends on pre-seeded/manual database data. |
| Prompt builder | **Implemented** | The builder produces distinct identity, target, customer profile, recommendation, reference, generation rule, negative-constraint, and detail-image sections (`lib/simulation/prompt-builder.ts:17-68`). The route supplies live selected references/rules/profile (`app/api/simulations/generate/route.ts:38-45`). |
| Identity preservation | **Partially implemented** | Global hard constraints and service-specific rules are included in the prompt (`lib/simulation/prompt-builder.ts:5-15,24-29`; `app/api/simulations/generate/route.ts:59-64`), and provider requests high input fidelity (`lib/simulation/provider.ts:42-48`). There is no automated or human quality gate, face-similarity measurement, retry policy, or rejection of identity-drifting output. |
| GPT-Image-2 integration | **Implemented** | The server-only provider sets `OPENAI_IMAGE_MODEL = "gpt-image-2"` and calls `POST /v1/images/edits` (`lib/simulation/provider.ts:24-59`). This is code-path evidence only; no paid call was made during the audit. |
| No fake generation fallback | **Implemented** | Missing configuration, reference download failure, OpenAI failure, or absent image bytes throws (`lib/simulation/provider.ts:35-38,51-73`), and the API returns a failure response (`app/api/simulations/generate/route.ts:69-82`). No mock provider is wired into `getServiceProviders` (`lib/sano/providers/index.ts:13-16`). The admin settings label claiming “Mock · active” is stale (`app/admin/settings/page.tsx:1`). |

## 4. Salon administration audit

| Requirement | Rating | Repository evidence and finding |
|---|---|---|
| Enable/disable services reflected in public app | **Implemented** | Admin PATCHes enabled state with rollback/error behavior (`components/admin/ServiceManager.tsx:7-17`); customer fetches enabled rows through SANO and intersects them with known slugs (`lib/services/public.ts:9-29`). Names/order remain static, as noted above. |
| Consultant branding, welcome video and poster | **Broken** | The settings page renders uncontrolled values from `demoTenant` but has no state, submit handler, data load, upload, or mutation (`app/admin/settings/page.tsx:1`). Public welcome and CSS theme also read only the hard-coded tenant (`app/page.tsx:29,37`; `lib/tenant.ts:3-9`). |
| Reference management | **Partially implemented** | CRUD-like reference/image controls exist and call the SANO façade (`components/admin/ReferenceManager.tsx:10-27`). Reference deletion is absent, type/purpose and option association cannot be edited, errors from `patch` are not handled/rolled back, and runtime alternates are unused. |
| Salon portfolio management | **Partially implemented** | Admin supports items, multi-image upload, edits, active/featured state, cover, ordering and deletion (`components/admin/PortfolioManager.tsx:5-17`). Public reads active items and cover-first image (`lib/portfolio/public.ts:6-11`). Live RLS/storage behavior and destructive partial-failure consistency are unverified. |
| Leads and consultation requests | **Partially implemented** | Admin groups leads, choices, generations and contact requests and permits status updates (`components/admin/LeadManager.tsx:16-31`). Public lead creation works in code (`lib/leads/public.ts:11-23`), but public consultation-request creation is missing, so the request section has no reachable producer. |
| Generation settings and limits | **Missing** | Admin settings has no generation limit fields or persistence and incorrectly displays a fixed mock-provider value (`app/admin/settings/page.tsx:1`). The SANO allowlist exposes `app_settings` as GET-only (`lib/sano/policy.ts:5-10`). |
| Tenant-specific data management | **Partially implemented** | Admin resolves one RLS-visible salon and scopes category/data requests to it (`lib/admin/data.ts:3-12`); SANO authenticates and checks salon visibility before forwarding tenant-scoped calls (`app/api/sano/data/route.ts:9-31`; `lib/sano/tenant.ts:7-13`). There is no tenant selector/provisioning UI, and “first visible salon” is ambiguous for multi-salon users. |

## 5. Platform requirements audit

| Requirement | Rating | Repository evidence and finding |
|---|---|---|
| Mobile-first RTL Future Mirror design | **Implemented** | Root layout sets Persian and RTL (`app/layout.tsx:11-18`); global styles define the dark mirror visual system and mobile breakpoints (`app/globals.css:1-33,264-280`). The UI uses shared mirror primitives (`components/mirror/MirrorUI.tsx:4-11`). Device/browser visual behavior remains part of manual smoke testing. |
| White-label and multi-tenant readiness | **Broken** | Types and tables are tenant-aware, but the public UI always uses `demoTenant`, applies its theme, and submits its fixed UUID (`app/page.tsx:7,24,27-29`; `lib/tenant.ts:3-9`). The comment that hostname resolution “can replace” the fallback confirms it is not implemented (`lib/tenant.ts:3`). |
| Tenant isolation | **Partially implemented** | The façade validates UUIDs, query/body tenant consistency, membership-visible salons, and storage key prefixes (`lib/sano/tenant.ts:7-13`; `lib/sano/policy.ts:24-38`). Migrations enable RLS and tenant membership policies (for example `supabase/migrations/007_complete_admin_management_privileges.sql:62-77`). However, the generation endpoint accepts unauthenticated caller-supplied tenant/session IDs, uses the service-role provider, and proves only that the session exists for that tenant (`app/api/simulations/generate/route.ts:87-99`); session IDs reside in browser storage and are bearer-like. Live cross-tenant/RLS verification was not performed. |
| SANO API façade | **Partially implemented** | Browser data/auth/storage uses `/api/sano/*`, policy allowlists and provider contracts (`lib/supabase/client.ts:9-27`; `app/api/sano/data/route.ts:9-31`; `lib/sano/policy.ts:4-22`). The simulation endpoint bypasses the public façade internally via service-role provider calls, and SANO has only a Supabase implementation—not provider-independent production proof. |
| Liara deployment | **Unverified** | A workflow targets pushes to `main`, installs Liara CLI, and deploys port 3000 using `LIARA_API_TOKEN` (`.github/workflows/liara.yaml:1-32`). No Liara project, secret, health check, migration gate, deployment result, rollback, or runtime was inspected or changed. |
| Supabase dependencies | **Unverified** | Runtime requires Supabase URL, public key, and service-role key through providers (`lib/sano/providers/index.ts:4-16`). The repo deliberately has no Supabase SDK dependency and uses REST/storage HTTP. Actual project availability, policies, buckets, extensions, and configuration were not inspected. |
| Required migrations and environment variables | **Partially implemented** | Eleven ordered SQL files exist and README names the public keys, service key, and OpenAI key (`README.md:27-33,40-50`). Provider code confirms those names (`lib/sano/providers/index.ts:4-16`; `lib/simulation/provider.ts:24-33`). There is no `.env.example`, schema/version check, automated migration deployment/verification, retention configuration, or documented Liara token in the runtime-variable list. Whether migrations 001–011 are applied is unverified. |

---

## Prioritized gap list

### P0 — production blockers

1. **Honor photo consent and implement retention/deletion semantics.** Stop claiming session-only use while always persisting the input; explicitly carry consent, record it, minimize storage, and delete non-consented input/output on a defined schedule.
2. **Make cost limits authoritative and atomic.** Enforce generation enabled, anonymous allowance, lead/contact unlock, and absolute maximum server-side in one atomic reservation operation; add request status/recovery without importing the unmerged PR #26.
3. **Complete the real recommendation consultation.** Capture one answer at a time, derive/persist a Beauty Profile, present a recommendation summary, and generate only after informed confirmation.
4. **Complete tenant resolution and branding.** Resolve public tenant from an approved host/slug server-side, load tenant configuration, reject unknown tenants, and remove the fixed demo tenant from production paths.
5. **Create a genuine consultation request.** Persist `contact_requests` linked to tenant/session/lead/generation with explicit consent and useful contact context.
6. **Establish a verified deployment contract.** Add environment/schema readiness checks, confirm migrations 001–011 and private buckets in a non-production environment, then validate Liara without making OpenAI calls.

### P1 — required for credible salon operations and quality

1. Add a selection review/edit step for both journeys.
2. Make branding/welcome video/poster/contact and generation limits editable and persisted.
3. Add recommendation-rule management and validation.
4. Complete reference taxonomy: editable purpose/type, canonical service-option association, primary plus explicit alternates, and generation selection policy.
5. Add image quality/identity safeguards, output rejection, useful customer errors, and operational observability.
6. Resolve multi-salon admin ambiguity with explicit tenant selection or a documented one-membership constraint.
7. Add validation and atomic/compensating behavior to reference and portfolio file mutations.
8. Align public taxonomy names/order with tenant-managed values or explicitly scope admin to enablement only.

### P2 — hardening and product polish

1. Replace the hard-coded decorative Beauty Passport with real profile/favorite data or remove it.
2. Respect `consultant.videoEnabled` and add reduced-motion/accessibility/device validation.
3. Add empty/error handling for portfolio loading rather than silently converting all failures to an empty gallery.
4. Add admin rule/search/filter/audit affordances and clearer localized statuses.
5. Add health/readiness endpoints, deployment smoke automation, rollback documentation, and operational dashboards.
6. Eliminate Node module-type warnings and restore a supported lint command/toolchain.

## Customer-facing risks

- Customers may believe an unchecked consent box prevents permanent storage when their source image is actually uploaded and retained.
- “Marvaa recommends” may return arbitrary/default-ranked styles because no customer attributes are collected into the Beauty Profile.
- Customers cannot review or correct selections before a paid generation.
- A refresh resets the UI counter, while the server applies a different limit, producing confusing unlock/error behavior.
- “Consultation” may capture contact details without creating a trackable consultation request, so follow-up can be missed.
- Public branding, contact information, and catalog labels may be wrong for any tenant other than the demo salon.
- Synchronous generation can time out at the platform boundary after cost is incurred, leaving a pending/failed experience with no customer recovery.
- Failed portfolio fetches appear as “no portfolio,” hiding outages.

## Admin-facing risks

- Settings appear editable but silently save nothing.
- Admin can change service labels/order and be told changes are saved, but the public app still renders static catalog values/order.
- There is no UI to manage recommendation rules or generation limits.
- Alternate reference images consume management effort/storage but are not used by generation.
- Multiple salon memberships resolve to the first RLS-visible row, which may expose the wrong working context to the admin (within their authorized memberships).
- Multi-step upload/database operations can leave orphan files or partial records after failure.
- Contact-request dashboards may remain empty even when customers click the consultation action.
- No deployment/schema readiness signal tells an admin why a feature fails when migrations or buckets are absent.

## Security and cost-control gaps

1. **Consent and lifecycle:** no consent field reaches generation; all primary inputs persist; no cleanup job or retention policy is present.
2. **Rate limiting:** no IP/device/session rate limiter, CAPTCHA/abuse control, tenant budget, daily ceiling, provider-spend circuit breaker, or payload request-size limit before JSON decoding.
3. **Atomic limits:** completed-row counting does not reserve capacity and ignores pending jobs, enabling concurrent overspend.
4. **Unlock authorization:** lead completion is a client boolean; the server does not validate lead/contact status for expanded allowance.
5. **Session possession:** anonymous UUID in local storage is the only effective generation-session credential; there is no signed/expiring session capability checked by the generation route.
6. **Service-role blast radius:** generation uses service-role access after application-level checks; any validation defect bypasses RLS. Queries interpolate UUIDs/slugs and should remain strictly validated/encoded.
7. **File validation:** MIME is inferred from a data URL and size is capped, but magic bytes, dimensions, decompression limits, malware/content moderation, and EXIF stripping are absent.
8. **Operational recovery:** synchronous pending rows can remain unresolved after process termination; there is no reconciler, cancellation, or idempotent completed-result replay.
9. **Admin tokens:** access and refresh tokens are stored in `localStorage`; the access token is also copied to a JS-created cookie, increasing XSS exposure (`lib/supabase/client.ts:8-13`). The cookie cannot be HttpOnly because client JavaScript creates it.
10. **Public portfolio:** portfolio files are intentionally public; admins need explicit disclosure that uploaded customer work becomes world-readable.

## Outdated documentation and inconsistent model/config references

1. README says the provider uses **`gpt-image-1.5`**, while runtime and tests use **`gpt-image-2`** (`README.md:38`; `lib/simulation/provider.ts:24-25`).
2. Admin settings says **“Mock · active”**, while production provider wiring is OpenAI and there is no fake fallback (`app/admin/settings/page.tsx:1`; `lib/sano/providers/index.ts:13-16`).
3. README says consultant video/poster can be changed from the panel, but the panel has no persistence (`README.md:25`; `app/admin/settings/page.tsx:1`).
4. README says tenant resolution will be hostname-based “in production,” but no resolver exists and public code uses the demo tenant (`README.md:17`; `lib/tenant.ts:3-9`).
5. README uses Vercel as its environment-variable example despite Liara being the approved deployment target (`README.md:42`); the repository does have a Liara workflow (`.github/workflows/liara.yaml:1-32`).
6. Initial seed settings use `with_contact`, later runtime types expect `maximum`/`generation_enabled`, and demo config uses `anonymous`/`extraAfterLead`/`maximum` (`supabase/migrations/001_initial_schema.sql:34`; `app/api/simulations/generate/route.ts:89-93`; `lib/tenant.ts:8`). A canonical settings schema and migration/backfill are needed.
7. README describes architecture as “ready” for multi-tenancy, which overstates the hard-coded public tenant and non-persistent branding (`README.md:3,17`; `app/page.tsx:7,24,27-29`).
8. Tests named around “phase one” and “real generation” are primarily source/contract checks; passing them should not be represented as live product verification (`tests/phase-one-flow.test.mjs:1-15`; `tests/real-generation.test.mjs:1-20`).

---

## Maximum three implementation phases

### Phase 1 — Safety, tenancy, and cost-control foundation (P0)

**Exact scope**

- Define and implement a server-resolved public tenant contract (approved hostname/slug mapping), tenant config loader, unknown-tenant behavior, and explicit admin tenant context.
- Define photo consent and retention states; transmit consent; persist the correct flag; avoid durable input retention when consent is absent or implement short-lived encrypted storage with automatic deletion.
- Implement an atomic server-side generation entitlement/reservation covering enabled state, anonymous allowance, verified lead/contact unlock, maximum, pending/completed accounting, request idempotency, and per-tenant budget/rate controls.
- Add signed/expiring public-session proof and request/payload/image validation.
- Add failure reconciliation for synchronous jobs **without** reusing or resurrecting PR #26.
- Add environment/schema/bucket readiness diagnostics and deployment documentation for Liara/Supabase.

**Acceptance criteria**

- An unknown host cannot fall back to the demo tenant; two fixture tenants receive distinct branding, services, and data.
- Cross-tenant tenant/session/object combinations are rejected in integration tests.
- With consent unchecked, no durable customer input remains past the documented short retention window; with consent checked, the DB flag and lifecycle match the disclosure.
- Parallel requests cannot exceed any configured limit; reload/new tabs cannot bypass it; a verified lead/contact unlock changes only the correct session/tenant allowance.
- Duplicate request IDs never create two paid calls, and a prior completed request returns/reuses its result rather than charging again.
- Missing env/schema/bucket configuration fails readiness with safe diagnostics before customers reach generation.
- No test in this phase calls OpenAI; provider is dependency-injected with a non-image-producing test double.

**Dependencies**

- Product/legal decision on consent wording and retention windows.
- Canonical tenant hostname/slug registry.
- Canonical generation-settings schema and budget values.
- A disposable Supabase staging project and Liara staging app (configuration work occurs only after explicit approval outside this audit).

**Exclusions**

- No queue/worker from PR #26.
- No visual redesign, new service taxonomy, promotion engine, or model-quality tuning.
- No Netlify.

### Phase 2 — Complete customer journeys and recommendation quality (P0/P1)

**Exact scope**

- Build the approved one-question-at-a-time consultation and persist its answers into a versioned Beauty Profile.
- Run recommendation rules against real profile features; present primary and alternate recommendations with reasons and confidence-safe wording.
- Add review/summary/edit for recommendation and self-selection before photo upload/generation.
- Complete canonical reference association and purpose semantics for technique/color/shape, with an explicit primary/alternate image policy.
- Turn consultation CTA into a real `contact_requests` flow linked to session, lead, generation, chosen service/options, notes and preferred contact channel/time.
- Replace or remove the fake Beauty Passport values.
- Add identity/quality validation and safe retry/reject behavior using test doubles and curated fixtures.

**Acceptance criteria**

- Each consultation screen asks exactly one approved question; back/edit preserves answers; completion stores a versioned tenant/session profile.
- A fixed profile/rule/reference fixture produces deterministic primary and alternate recommendations with traceable rule reasons.
- Both paths show an accurate review screen; editing any answer returns to review without losing unrelated answers.
- Generation cannot start until required photos, selection confirmation, and disclosure state are valid.
- Technique/color/shape references selected in fixtures are independently traceable in prompt metadata; inactive/wrong-tenant references are never selected.
- “Consultation” creates exactly one idempotent admin-visible request linked to the relevant lead/session/result.
- Quality failures never display as successful results and never silently substitute fake images.

**Dependencies**

- Approved consultation questionnaire and Beauty Profile feature dictionary.
- Salon-approved recommendation rules, reference taxonomy, curated licensed reference set, and identity-quality thresholds.
- Phase 1 tenancy, session, consent, and entitlement contracts.

**Exclusions**

- No appointment calendar, payment, CRM automation, or autonomous beauty/medical advice.
- No paid OpenAI calls in CI or manual smoke tests.

### Phase 3 — Production admin, operations, and release verification (P1/P2)

**Exact scope**

- Persist consultant/salon branding, theme, welcome video/poster/contact settings and generation settings through tenant-scoped SANO endpoints.
- Add recommendation-rule management and finish reference management (type/purpose/option mapping, validation, deletion, alternate behavior).
- Align tenant-managed public service names/order with admin behavior.
- Harden reference/portfolio mutations with validation, progress, rollback/cleanup, file constraints and auditability.
- Add observability, readiness/health checks, retention/reconciliation monitoring, accessibility/device checks, and Liara runbook/rollback.
- Correct README/model/provider/deployment/settings documentation and add a non-secret `.env.example`.

**Acceptance criteria**

- Every admin setting survives refresh and changes only that tenant's public experience without rebuild.
- Admin can manage limits/rules/reference purpose safely; invalid or incomplete configurations cannot be activated.
- File-operation failure tests leave no orphan object/row and provide actionable UI errors.
- Two-tenant end-to-end staging tests prove isolation for services, branding, references, portfolio, leads, requests, generations and storage.
- Liara staging passes readiness, build, migration-version, no-paid-generation smoke, and rollback drill; production release remains a separate explicit approval.
- Documentation exactly matches `gpt-image-2`, Liara, canonical setting keys, migrations, and required environment variable names.

**Dependencies**

- Phases 1 and 2 complete.
- Approved brand asset constraints and admin roles.
- Staging Supabase/Liara access, monitoring destination, retention owner, and incident/rollback owner.

**Exclusions**

- No Netlify, merge, production data migration execution, production deploy, paid generation, or unsupported provider migration.

---

## Manual smoke-test checklist (no OpenAI call and no paid image)

### Preconditions

- Use local or isolated staging configuration only.
- Ensure `OPENAI_API_KEY` is absent or replace the AI provider through an approved test-only injection; do **not** submit the final generation action.
- Use synthetic, non-personal test images.
- Do not apply migrations during this checklist; first verify the target already reports the expected migration/version readiness.

### Public experience

- [ ] At a narrow mobile viewport (e.g. 390×844), `/` is RTL, readable, keyboard navigable, and has no horizontal overflow.
- [ ] Welcome video shows its poster before playback; mute/unmute changes audio state; skip reveals the CTA; a deliberately invalid local video URL displays the fallback without blocking entry.
- [ ] Browser Back and in-app Back return to the previous meaningful step and never return to loading.
- [ ] Initial intent shows Future Mirror, portfolio, and honest empty offers.
- [ ] “I choose myself” fetches only enabled services; a controlled fetch failure shows an error and does not expose static fallback services.
- [ ] Walk every service through its questions without selecting a real image: hair color technique then shade; haircut; brows; lashes; nail shape then color; updo; makeup; lip shading.
- [ ] Verify nails requests a whole-hand photo; face services request a full face; brows/lashes/lips offer the correct optional closeup and allow Skip.
- [ ] Verify the recommendation path asks intensity and reaches face-photo instructions; record as a known gap if the approved consultation questions are still absent.
- [ ] Select a synthetic image only if the page can be stopped before submit; verify preview/navigation behavior without initiating generation.
- [ ] Verify there is no selection summary/edit screen in the audited build (known gap), rather than treating direct generation as a pass.
- [ ] Verify portfolio filters and cover images using pre-existing fixture data; disconnect data and confirm the current silent-empty behavior is recorded as a known risk.
- [ ] Open the lead form; verify required fields and Persian/Arabic digit normalization; invalid Iranian mobile numbers remain rejected. Do not submit against production.
- [ ] Confirm all displayed privacy/consent wording against observed network/storage behavior in the test environment; the audited version must be failed because unchecked consent is not transmitted.

### Admin experience

- [ ] Unauthenticated `/admin` redirects to `/admin/login`; invalid/expired session returns to login; logout clears the session.
- [ ] A fixture admin sees only their tenant; repeat with a second fixture tenant and attempt copied row/object IDs from the other tenant.
- [ ] Toggle a fixture service and confirm its public visibility changes after refetch; restore the original value.
- [ ] Edit a service label/order and confirm the audited public app does **not** reflect it (known inconsistency).
- [ ] Inspect settings, edit a field, navigate away/back, and confirm the audited version does not persist (known blocker).
- [ ] With existing fixture assets, verify reference primary/order/active controls and signed-image expiry behavior; do not upload personal content.
- [ ] Verify reference type/purpose/rule management is unavailable in the audited UI (known gaps).
- [ ] With disposable fixtures only, verify portfolio active/cover/order/filter behavior and public visibility; clean up via the existing UI only.
- [ ] Verify a pre-seeded lead appears with associated choices/generations and statuses can be changed.
- [ ] Click the public consultation CTA in an isolated fixture flow and confirm no `contact_requests` record is created in the audited version (known blocker).

### Safe API/security/cost checks

- [ ] Call only readiness/config endpoints and mocked-provider test endpoints; never call `/api/simulations/generate` with a configured OpenAI key.
- [ ] Confirm unsupported SANO resources/methods return safe 4xx errors and do not relay raw provider bodies.
- [ ] Confirm malformed tenant UUIDs, mismatched query/body tenant IDs, and cross-tenant storage keys are rejected.
- [ ] Confirm public access cannot read private `style-references` or `customer-simulations` objects; public portfolio objects are intentionally readable.
- [ ] With a local fake AI provider, exercise missing reference, disabled service, maximum reached, duplicate request, provider failure and timeout paths; assert zero external OpenAI requests.
- [ ] Run two parallel fake-provider requests at the last allowance and record the audited count-then-act race as a failure until Phase 1 is complete.
- [ ] Confirm logs contain request/generation/tenant identifiers but no image payload, secret, bearer token, signed URL, phone number, or raw provider response.

## Checks performed for this audit

- `npm test` — passed 42 source/behavior tests; emitted Node module-type warnings. These tests do not prove live external services.
- `npm run typecheck` — passed.
- `npm run build` — passed; Next.js skipped linting by configuration (`next.config.ts:3-7`).
- `npm run lint` — could not run because ESLint is not installed; this is an existing toolchain limitation, not an audit-report failure.
- `git diff --check` — passed.
- `git status --short --branch`, `git log -5 --oneline --decorate`, repository file enumeration, and direct source/migration inspection — used to establish the audited tree and evidence.
- No OpenAI request, network deployment, Supabase mutation, migration, secret inspection, image generation, Netlify operation, or PR #26 code was used.
