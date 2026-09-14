# SANO Platform — Liara Infrastructure Feasibility Audit

## خلاصه مدیریتی

**نتیجه نهایی: Hybrid architecture is recommended — Go مشروط.**

Liara برای اجرای بخش عمده زیرساخت SANO شامل Frontend، API، PostgreSQL، Object Storage، Redis، Worker، DNS و دامنه مناسب است. بااین‌حال Liara به‌تنهایی جایگزین کامل Supabase نیست و قابلیت‌های Auth، Storage Authorization، Realtime، Edge Functions و APIهای BaaS باید به‌صورت سرویس مستقل پیاده‌سازی یا در دوره گذار روی Supabase نگهداری شوند. AI/Image Generation، پیامک ایرانی، درگاه پرداخت، مانیتورینگ مستقل و نسخه پشتیبان خارج از سایت نیز وابستگی‌های خارجی ضروری‌اند.

این ارزیابی کل اکوسیستم SANO را پوشش می‌دهد:

- SANO Core
- SANO Beauty / Marvaa
- SANO Fitness
- CRM مشترک
- Verticalهای آینده

این سند صرفاً Repository Audit و گزارش امکان‌سنجی است؛ در جریان تهیه آن هیچ کد، Migration یا تنظیم سرویس Liara/Supabase تغییر نکرده است.

---

## ۱. وضعیت فعلی Repository

### Frontend

- Next.js 15، React 19، TypeScript و Node.js 22
- تجربه عمومی مشتری و صفحات Admin
- مسیرهای مدیریت Leads، Portfolio، References، Services و Settings
- Middleware برای محافظت از `/admin`
- RTL و mobile-first
- Build و Start استاندارد Next.js و مناسب PaaS مبتنی بر Node یا Docker

### Backend/API

- Backend مستقل وجود ندارد و API فعلی داخل Next.js Route Handler قرار دارد.
- مسیر `/api/simulations/generate` با Node.js runtime اجرا می‌شود.
- API، context و قوانین را از Supabase می‌خواند، تصویر ورودی را ذخیره می‌کند، OpenAI را فراخوانی می‌کند، خروجی را ذخیره و signed URL تولید می‌کند.
- پردازش AI هم‌اکنون synchronous و داخل چرخه یک HTTP request است.

### PostgreSQL و داده‌ها

مدل فعلی شامل موارد زیر است:

- salon/tenant و عضویت کاربران
- consultant profile
- service categories و options
- anonymous sessions
- leads، consultations و contact requests
- user choices و image generations
- app settings
- style references، portfolio و beauty profiles
- recommendation rules

مدل داده tenant-aware است و بیشتر جدول‌ها `tenant_id` دارند، اما بخشی از public flow به UUID ثابت tenant دمو وابسته است و برای multi-tenancy عمومی SANO باید بازطراحی شود.

### Supabase Auth

- ورود Email/Password، refresh token، logout و اعتبارسنجی user مستقیماً از Supabase Auth انجام می‌شود.
- session در `localStorage` قرار می‌گیرد و access token از JavaScript در cookie غیر-HttpOnly نوشته می‌شود.
- برای Production باید server-managed session، cookie امن HttpOnly، token rotation، MFA و audit session جایگزین شود.

### Supabase Storage

سه گروه فایل اصلی وجود دارد:

1. `style-references` خصوصی
2. `salon-portfolio` عمومی برای خواندن
3. `customer-simulations` خصوصی برای تصاویر ورودی و خروجی مشتری

کد فعلی به upload/delete/public URL/signed URL و policyهای `storage.objects` در Supabase وابسته است. Object Storage لیارا می‌تواند فایل‌ها را نگهداری کند، اما Storage API و authorization سطح شیء باید در SANO API بازسازی شود.

### RLS

- RLS ستون اصلی tenant isolation فعلی است.
- policyها به `auth.uid()`، نقش‌های `anon` و `authenticated` و جداول Supabase متکی‌اند.
- PostgreSQL استاندارد RLS را پشتیبانی می‌کند، ولی در مهاجرت باید claims از API با `SET LOCAL` یا مکانیزم معادل به transaction دیتابیس تزریق شود.
- application role نباید `BYPASSRLS` یا مالک جداول باشد.

### Realtime و Edge Functions

- در Repository فعلی استفاده عملی از Supabase Realtime یا Edge Functions دیده نشد.
- برای آینده می‌توان Realtime را با SSE/WebSocket، PostgreSQL outbox و Redis پیاده‌سازی کرد.
- نیازهای Edge Function فعلی با API، Worker و Scheduler پوشش داده می‌شوند؛ edge geographically distributed نباید بدون تأیید Liara فرض شود.

### Background Jobs

- queue و worker مستقل فعلاً وجود ندارد.
- AI generation، دریافت referenceها، upload و persistence همگی داخل یک request انجام می‌شوند.
- idempotency key دیتابیسی برای generation وجود دارد و پایه مناسبی برای queue است.
- قبل از scale باید stateهای `queued`، `processing`، `completed`، `failed`، retry و dead-letter اضافه شوند.

### Image Generation

- provider فعلی مستقیماً به OpenAI Images API وابسته است.
- model و provider configuration در implementation قرار دارند.
- Liara سرویس AI/Image Generation نیست؛ provider خارجی ضروری است.
- AI باید پشت abstraction چند-provider، quota، cost ledger، circuit breaker و policy حفظ حریم خصوصی قرار گیرد.

### CRM، Admin و Analytics

- CRM فعلی در سطح Lead و statusهای ساده، contact request، انتخاب‌ها و liked generation است.
- Admin فعلی بیشتر CMS و Lead Manager است تا CRM کامل SANO.
- event warehouse، BI، tracing و analytics domain مستقل وجود ندارند.

### Environment Variables فعلی

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `LIARA_API_TOKEN` در GitHub Actions

Secretهای production نباید با `NEXT_PUBLIC_` منتشر شوند و باید برای staging/production جدا و قابل rotation باشند.

---

## ۲. Capability Matrix

راهنما:

- **Direct:** مستقیماً توسط زیرساخت Liara
- **Build:** با کدنویسی یا کانتینر روی Liara
- **External:** نیازمند provider خارجی
- **Risk:** نیازمند تأیید محدودیت، SLA یا طراحی تکمیلی
- **Outside:** بهتر است نسخه یا provider مستقلی خارج از Liara داشته باشد

| قابلیت | وضعیت | تصمیم پیشنهادی |
|---|---|---|
| Next.js Frontend | Direct | PaaS Node یا Docker |
| SANO API | Direct / Build | application مستقل Node.js |
| PostgreSQL | Direct | Managed PostgreSQL؛ تأیید HA/PITR الزامی |
| Supabase Auth equivalent | Build / External | Keycloak، Zitadel یا Auth managed مبتنی بر OIDC |
| PostgreSQL RLS | Build روی Direct DB | حفظ با transaction-scoped claims |
| PostgREST/API | Build | SANO API domain-specific؛ PostgREST فقط برای گذار |
| Object Storage | Direct | adapter سازگار با S3 |
| Storage authorization | Build | API + file metadata + presigned URL |
| Realtime | Build | SSE/WebSocket + Redis/outbox |
| Edge Functions | Build / Risk | API، Worker یا Scheduler؛ edge واقعی تأیید شود |
| Background Jobs | Build | Redis + BullMQ یا PostgreSQL queue |
| Worker | Direct / Build | application/container مستقل |
| Cron/Scheduler | Build / Risk | scheduler قابل‌اعتماد یا worker scheduler |
| Image Generation | External | abstraction چند-provider |
| فایل‌ها و تصاویر مشتریان | Direct + Build + Risk | private bucket، retention و audit |
| Shared CRM | Build | ماژول مستقل در SANO Core |
| Admin | Direct / Build | frontend مشترک با RBAC |
| Operational Analytics | Build | events، outbox و read models |
| BI/Warehouse | External / Build | جدا از OLTP در مقیاس بالا |
| Multi-tenancy | Build | tenant ID، RLS، RBAC و quota |
| Owner/Manager/Staff/Customer | Build | IAM و membership مرکزی |
| SANO Beauty | Build | vertical مستقل روی Core |
| SANO Fitness | Build | vertical مستقل روی Core |
| Future Verticals | Build | modular monolith ابتدا |
| Campaign | Build + External | orchestration داخلی، delivery خارجی |
| Referral | Build | attribution ledger و anti-fraud |
| Messaging داخلی | Build | conversation/message service |
| SMS | External | provider ایرانی با adapter و failover |
| Email | Direct / External | provider تراکنشی برای deliverability |
| Payment | External | درگاه ایرانی و verification سمت سرور |
| Custom Domains | Direct + Build | DNS/TLS + ownership verification و mapping |
| Redis/Cache | Direct | queue، cache و rate limiting |
| Search | Build | PostgreSQL FTS ابتدا |
| AI Agents | Build + External | runtime روی Worker؛ model خارجی |
| Reports | Build | read replica یا warehouse در scale |
| Logs | Direct + Outside | لاگ Liara به‌علاوه sink مستقل |
| Metrics/APM | External / Risk | OpenTelemetry و سرویس مستقل |
| Database Backup | Direct + Outside | managed backup به‌علاوه off-site export |
| Object Backup | Build + Outside | copy به provider دوم |
| Disaster Recovery | Build + Outside | runbook و restore drill |
| Autoscaling | Direct / Risk | load test و تأیید quota/plan |
| Private Network | Direct / Risk | دسترسی خصوصی API/Worker/DB/Redis |
| VPS/Docker | Direct | فقط برای workloadهای unsupported |
| Secrets | Direct پایه / Risk | rotation، audit و least privilege |
| Rate Limiting | Build | Redis-backed و per tenant/user/IP |
| Audit Log | Build | append-only و tenant-aware |

---

## ۳. معماری پیشنهادی

### رویکرد کلان

در مرحله فعلی **Modular Monolith + Dedicated Workers** بهتر از شروع با microserviceهای متعدد است.

```text
Internet
  │
  ├── DNS / TLS / CDN / WAF
  │       │
  │       ├── SANO Web (Next.js on Liara)
  │       └── SANO API (Node.js on Liara)
  │                    │
  │                    ├── Auth / IAM
  │                    ├── Tenant / RBAC
  │                    ├── Shared CRM
  │                    ├── Campaign / Referral
  │                    ├── Messaging / Payment orchestration
  │                    ├── Beauty Module
  │                    ├── Fitness Module
  │                    └── Future Vertical Modules
  │
  └── Data Layer
          ├── PostgreSQL
          ├── Redis
          ├── Object Storage
          └── Outbox / Job Queue
                     │
                     └── Workers
                           ├── AI/Image provider
                           ├── SMS/Email
                           ├── Payment reconciliation
                           ├── Analytics rollups
                           └── Media cleanup/scanning
```

### SANO Core

Core باید مالک این مفاهیم باشد:

- tenants/organizations و locations
- identities، users و sessions
- memberships، roles و permissions
- staff و customer profiles
- contacts، consent و preferences
- custom domains
- subscriptions و entitlements
- audit log
- file metadata
- jobs، events و webhooks
- feature flags و localization

جدول `salons` نباید هسته کل پلتفرم بماند. مدل عمومی‌تر `tenants`، `tenant_verticals`، `business_locations` و `memberships` برای Beauty، Fitness و verticalهای آینده مناسب‌تر است.

### Shared Authentication

- OIDC/OAuth2 مرکزی
- یک identity با امکان عضویت در چند tenant
- نقش مختص هر tenant
- access token کوتاه‌عمر و refresh rotation
- HttpOnly session cookie برای Web
- MFA برای Owner/Admin
- session revocation، recovery و login audit
- جداسازی identity از staff/customer domain profile

### Tenant Isolation

در فاز اول shared database/shared schema مناسب است:

- `tenant_id NOT NULL` در تمام داده‌های tenant-scoped
- composite unique keys
- RLS و authorization در API
- object key و Redis key tenant-prefixed
- job payload شامل tenant ID
- rate limit، quota و cost attribution per tenant

برای مشتریان Enterprise در آینده باید امکان schema/database/bucket اختصاصی بدون تغییر domain model وجود داشته باشد.

### Shared CRM

CRM باید مستقل از vertical باشد و شامل contact، lead، pipeline، interaction، note، task، appointment، tag، segment، consent، campaign membership و referral attribution شود. Beauty و Fitness فقط extensionهای خود را اضافه کنند.

### Beauty و Fitness

- Beauty شامل consultations، beauty profiles، references، recommendations، portfolio و simulations است.
- Fitness شامل assessments، goals، measurements، plans، sessions/classes، attendance، coach assignment و progress records خواهد بود.
- هیچ جدول Core نباید با مفهوم salon یا beauty hard-code شود.

### API Layer

- OpenAPI و API versioning
- validation ورودی
- tenant resolution مرکزی
- RBAC/ABAC
- idempotency
- rate limiting
- request/trace ID
- structured logs
- webhook signature verification
- عدم دسترسی مستقیم مرورگر به دیتابیس
- presigned URL flow برای فایل‌ها

### Storage Layer

یک interface مستقل از provider ایجاد شود:

```text
ObjectStore
  - createUploadUrl
  - createDownloadUrl
  - head
  - copy
  - delete
```

کلید پیشنهادی object:

```text
tenants/{tenantId}/{domain}/{entityId}/{fileId}/{variant}
```

metadata شامل tenant، uploader، classification، MIME، size، checksum، bucket/key، retention، consent، scan status و deleted timestamp در PostgreSQL نگهداری شود.

### Background Processing

حداقل queueهای مستقل:

- `ai-image`
- `notifications`
- `payments`
- `campaigns`
- `media-processing`
- `analytics`
- `maintenance`

هر job باید idempotency key، tenant ID، trace ID، retry policy، timeout، maximum attempts، dead-letter state و cost attribution داشته باشد.

### AI Provider Abstraction

```text
AI Gateway
  ├── ImageProvider
  ├── TextProvider
  ├── EmbeddingProvider
  ├── ModerationProvider
  └── AgentToolProvider
```

Gateway باید routing، fallback، circuit breaker، quota، budget، usage ledger، prompt/model version، PII policy و provider outage handling را پوشش دهد.

---

## ۴. اجزای تخمینی زیرساخت

### Production اولیه

| Component | تعداد اولیه | کاربرد |
|---|---:|---|
| Web Application | 1 | Next.js frontend/SSR |
| API Application | 1 | SANO Core API |
| Worker Application | 1–2 | AI، notification و cleanup |
| PostgreSQL | 1 managed instance | source of truth |
| Redis | 1 managed instance | queue، cache و rate limit |
| Object Storage | حداقل 3 bucket منطقی | public، private customer و internal/reference |
| Email | 1 account/service | پیام‌های تراکنشی |
| DNS/Domains | حداقل 1 zone | SANO و custom domains |
| Private Network | 1 | API/Worker/DB/Redis |
| Monitoring/Logging | 1 stack | metrics، logs و traces |
| Off-site Backup | 1 مقصد مستقل | DB و Object Storage |
| Scheduler | 1 | recurring jobs |

### Staging

- Web و API مستقل از Production
- Worker کوچک یا مشترک با API فقط در ابتدای توسعه
- PostgreSQL، Redis، bucket و secret کاملاً جدا
- sandbox جدا برای AI، SMS و Payment

### در مقیاس بالاتر

- چند replica از Web/API
- Worker poolهای جدا برای AI، Campaign و Notification
- connection pooler و read replica PostgreSQL
- analytics warehouse
- message broker قوی‌تر در صورت عبور از ظرفیت Redis
- CDN/media proxy
- Auth cluster و hot standby/DR خارج از provider

VPS/Docker فقط برای سرویس‌هایی مانند Keycloak/Zitadel، NATS/RabbitMQ، malware scanner یا OpenTelemetry Collector توصیه می‌شود. سرویس stateful حیاتی نباید بدون replication روی یک VPS منفرد قرار گیرد.

---

## ۵. Supabase Replacement Requirements

| قابلیت Supabase | جایگزین لازم |
|---|---|
| Auth | OIDC provider، MFA، recovery و refresh rotation |
| `auth.users` | identity store و provider-subject mapping |
| `auth.uid()` | transaction claims یا authorization در API |
| PostgREST | SANO API یا PostgREST self-hosted در دوره گذار |
| `anon/authenticated` roles | DB roles و application claims جدید |
| service role | service accountهای محدود و جدا |
| Storage API | S3 adapter و API داخلی |
| `storage.buckets/objects` | bucket IaC و file metadata در DB |
| Storage policies | authorization در API و presigning |
| Signed URLs | S3-compatible presigned URLs |
| Realtime | SSE/WebSocket + outbox + Redis |
| Edge Functions | API/Worker/Scheduler |
| Dashboard | admin tooling، migration tooling و observability |
| Migrations | SQL migration pipeline با CI/CD |
| Backup | managed backup + off-site copy + restore test |
| Secrets | environment secrets، rotation و audit |

### راهبرد جایگزینی

حذف فوری Supabase توصیه نمی‌شود. ابتدا direct access مرورگر پشت SANO API قرار گیرد، سپس Storage و Jobها منتقل شوند، بعد PostgreSQL و در آخر Auth مهاجرت کند. این ترتیب blast radius و ریسک downtime را کاهش می‌دهد.

---

## ۶. وابستگی‌های خارجی ضروری

### AI/Image

- OpenAI یا provider جایگزین
- ترجیحاً provider دوم برای failover
- بررسی connectivity، شرایط استفاده و محدودیت جغرافیایی
- consent، retention و minimization داده
- budget و cost cap per tenant

### SMS ایرانی

Adapter قابل‌تعویض برای providerهایی مانند Kavenegar، FarazSMS یا SMS.ir با delivery webhook، idempotency، template، rate limit و provider failover.

### Payment

درگاه ایرانی مانند Zarinpal، IDPay، NextPay یا PSP مستقیم. callback تنها پس از verification server-to-server معتبر باشد و payment ledger، reconciliation و refund داخل Core نگهداری شوند.

### Email

Liara Email می‌تواند گزینه اولیه باشد، اما برای deliverability و failover، abstraction میان Liara/SMTP/provider تراکنشی توصیه می‌شود.

### Monitoring و Off-site Backup

- error tracking مستقل
- OpenTelemetry
- uptime monitor خارج از Liara
- backup دیتابیس در provider/account مستقل
- replication/copy برای Object Storage
- alert channel خارج از failure domain اصلی

---

## ۷. ریسک‌ها

### بحرانی

1. **Liara جایگزین drop-in برای Supabase نیست:** Auth، REST، Storage Policies و Realtime باید بازسازی شوند.
2. **تصاویر حساس مشتری:** consent، retention، encryption، private access، audit و حذف خودکار ضروری است.
3. **AI synchronous:** خطر timeout، retry ناخواسته، مصرف حافظه و هزینه تکراری دارد.
4. **service-role وسیع:** باید با service account محدود و authorization در API جایگزین شود.
5. **policyهای demo hard-coded:** برای SANO multi-tenant مناسب نیستند.
6. **session غیر-HttpOnly:** در برابر XSS دفاع کافی ندارد.
7. **DR اثبات‌نشده:** backup داخل همان provider معادل disaster recovery نیست.
8. **ریسک دسترسی AI:** connectivity یا شرایط provider ممکن است تغییر کند.

### بالا

- نبود WAF و rate limiting در Repository
- نبود queue و dead-letter handling
- نبود malware/media scanning
- نبود audit log append-only
- نبود analytics event model
- نبود tenant quota و cost attribution
- نبود custom-domain ownership verification
- نبود Infrastructure as Code
- workflow فعلی فقط application را deploy می‌کند و migration pipeline ندارد
- جزئیات SLA، autoscaling، PITR، connection limits و private networking باید با پلن Liara تأیید شوند

### یافته کیفیت فعلی

در زمان audit، ۳۳ تست موفق و یک تست مربوط به Image Provider ناموفق بود؛ تست انتظار `input_fidelity=high` داشت ولی implementation فعلی آن را تنظیم نمی‌کند. این مسئله مانع feasibility زیرساختی نیست، اما مانع اعلام آمادگی کامل Image Generation فعلی برای Production است.

---

## ۸. Vendor Lock-in و قابلیت خروج

### Application

- image استاندارد OCI/Docker
- stateless API
- health/readiness endpoints
- graceful shutdown
- configuration از environment
- build artifact یکسان برای Liara و provider دوم

### Database

- PostgreSQL استاندارد
- SQL migrations versioned
- پرهیز از extension اختصاصی provider
- dump/restore و portability tests
- عدم hard-code کردن credentials/hostname

### Storage

- S3-compatible adapter
- ذخیره `bucket + key` به‌جای URL دائمی
- checksum و export manifest
- bulk copy و dual-write موقت برای مهاجرت

### Auth

- OIDC استاندارد
- شناسه داخلی مستقل از provider
- mapping برای external subject
- user export و برنامه password/session migration

### Queue و Observability

- interface مستقل queue و versioned job payload
- OpenTelemetry و structured JSON logs
- امکان انتقال Redis/BullMQ به broker دیگر

### Infrastructure as Code

- Docker Compose برای محیط مرجع
- Terraform/OpenTofu در محدوده APIهای قابل‌پشتیبانی
- runbook استقرار provider دوم
- backup/restore automation

با این اصول، lock-in Liara عمدتاً به deployment و سرویس‌های managed محدود می‌شود و data/application portability حفظ خواهد شد.

---

## ۹. Migration Order

### فاز ۰ — پیش‌نیازها

1. تعیین RPO/RTO
2. طبقه‌بندی داده و retention policy
3. تأیید SLA و محدودیت پلن Liara
4. load test و ظرفیت‌سنجی
5. تأیید outbound access به AI/SMS/Payment
6. incident response و privacy policy

### فاز ۱ — SANO API Façade

1. حذف direct browser access به Supabase REST/Storage
2. ساخت SANO API
3. تعریف AuthProvider، ObjectStore، AIProvider، MessageProvider و PaymentProvider
4. حفظ Supabase به‌عنوان backend موقت

### فاز ۲ — Queue و Worker

1. Redis و job schema
2. Worker مستقل
3. انتقال Image Generation
4. retry، idempotency و DLQ
5. polling/SSE و media cleanup

### فاز ۳ — Storage

1. ایجاد bucketهای مقصد
2. file metadata و authorization
3. dual-write موقت
4. copy و checksum verification
5. مهاجرت signed URL
6. توقف Supabase Storage پس از rollback window

### فاز ۴ — PostgreSQL

1. provision و migration dry-run
2. حذف وابستگی‌های `auth.*` و `storage.*`
3. تعریف DB roles و RLS context
4. dump/CDC یا maintenance window
5. validation و cutover
6. rollback window

### فاز ۵ — Authentication

1. استقرار OIDC provider
2. identity mapping
3. invitation، reset و MFA
4. session migration یا forced re-login
5. توقف Supabase Auth

### فاز ۶ — Core و Verticalها

1. مدل عمومی tenant/business
2. SANO Core و Shared CRM
3. Beauty extension
4. Fitness extension
5. Campaign، Referral و Messaging
6. entitlement و billing

### فاز ۷ — DR و Scale

1. off-site backup
2. restore drill
3. load/failure testing
4. horizontal scaling
5. provider-exit drill
6. rollback مستند

---

## ۱۰. شروط Go-Live

- [ ] SLA، HA، PITR و quotaهای Liara کتبی تأیید شده باشند.
- [ ] API و Worker از Web جدا شده باشند.
- [ ] Image Generation asynchronous باشد.
- [ ] RLS مقصد تست منفی cross-tenant داشته باشد.
- [ ] Auth از HttpOnly secure session استفاده کند.
- [ ] تصاویر مشتری private و دارای retention خودکار باشند.
- [ ] off-site backup و restore test موجود باشد.
- [ ] monitoring خارج از provider فعال باشد.
- [ ] AI/SMS/Payment adapter و webhook verification وجود داشته باشد.
- [ ] staging و production secretهای جدا داشته باشند.
- [ ] custom-domain ownership verification اجرا شود.
- [ ] peak load و campaign/AI concurrency تست شود.
- [ ] تست ناموفق فعلی Image Generation رفع شود.
- [ ] migration rollback plan آزمایش شود.

---

## ۱۱. Final Go/No-Go Recommendation

### انتخاب نهایی: **Hybrid architecture is recommended**

**Go برای میزبانی روی Liara:**

- SANO Web و Admin
- SANO API
- PostgreSQL
- Redis
- Workerها
- Object Storage
- DNS و custom-domain routing
- SANO Core، CRM، Beauty و Fitness application modules

**Go مشروط به تأیید پلن/SLA:**

- Auth self-hosted
- Realtime
- Scheduler
- Private Network
- Autoscaling
- HA/PITR دیتابیس
- ایمیل پرتعداد

**خارج از Liara یا با نسخه مستقل:**

- AI/Image provider
- SMS provider
- Payment gateway
- external monitoring
- off-site backup
- ترجیحاً Email failover

**Full Liara-only توصیه نمی‌شود**؛ زیرا failure domain واحد ایجاد می‌کند، Liara جایگزین کامل Supabase BaaS نیست، AI/SMS/Payment ذاتاً خارجی‌اند و backup داخل همان provider، DR کامل محسوب نمی‌شود.

بنابراین **Go مشروط برای معماری Hybrid** صادر می‌شود و **No-Go برای مهاجرت یک‌مرحله‌ای یا معماری کاملاً Liara-only**.
