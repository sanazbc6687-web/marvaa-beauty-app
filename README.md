# Marvaa Future Mirror V3

تجربه‌ی RTL و mobile-first آینه‌ی زیبایی مروا با Next.js، React، TypeScript و معماری آماده‌ی Supabase و multi-tenancy.

## اجرا
```bash
npm install
npm run dev
```
- تجربه مشتری: `/`
- ورود امن مدیریت: `/admin/login`
- اتاق کنترل محافظت‌شده: `/admin`
- کتابخانه رفرنس: `/admin/references`
- لیدها: `/admin/leads`
- گالری سالن: `/admin/portfolio`

## معماری
- `components/mirror/MirrorUI.tsx`: زبان بصری مشترک Mirror UI.
- `lib/catalog.ts`: fallback دو‌زبانه و database-ready برای دسته‌ها، تصمیم‌ها و گزینه‌ها.
- `lib/simulation/`: Prompt Builder مرجع‌محور و اتصال سرور به provider واقعی تولید تصویر.
- `lib/tenant.ts`: tenant دمو؛ در تولید براساس hostname از Supabase خوانده می‌شود.
- `supabase/migrations/002_future_mirror_v2.sql`: Reference Library، تصاویر مرجع، Portfolio مستقل و Beauty Profile.

## ویدئوی خوش‌آمد
فایل فعلی در `public/videos/marvaa-welcome.mp4` است. مسیر آن از `demoTenant.consultant.videoUrl` می‌آید؛ در نسخه متصل به Supabase، مقدار `consultant_profiles.welcome_video_url` را از پنل «برند و مشاور» تغییر دهید. پوستر نیز به همین شکل قابل جایگزینی است.

## راه‌اندازی Supabase
1. یک پروژه Supabase بسازید و migrationهای `supabase/migrations` را به‌ترتیب اجرا کنید.
2. در تنظیمات استقرار، `NEXT_PUBLIC_SUPABASE_URL` و ترجیحاً `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (یا نام قدیمی `NEXT_PUBLIC_SUPABASE_ANON_KEY`) عمومی پروژه را تنظیم کنید. هیچ service-role key یا رمز مدیریتی را در مرورگر قرار ندهید.
3. در Supabase Dashboard بخش **Authentication > Users** یک کاربر Email/Password بسازید.
4. شناسه همان کاربر را در SQL Editor با tenant دمو عضو کنید:
   `insert into tenant_users (tenant_id,user_id,role) values ('00000000-0000-0000-0000-000000000001','<AUTH_USER_UUID>','owner');`
5. با همان ایمیل در `/admin/login` وارد شوید. برای هر سالن آینده، عضویت و داده‌های همان `tenant_id` را بسازید؛ RLS دسترسی متقاطع را مسدود می‌کند.

برای افزودن تصاویر Pilot، بعد از ورود به `/admin/references` ابتدا لاین خدمات، سپس گروه و گزینه را باز کنید؛ چند فایل را هم‌زمان انتخاب کنید، تصویر Primary را با ستاره تعیین و ترتیب را با فلش‌ها تنظیم کنید. فایل‌ها در bucket خصوصی `style-references` و مسیر `{tenant_id}/{service}/{reference}/{filename}` نگهداری می‌شوند. گالری واقعی سالن از مسیر `/admin/portfolio` و bucket عمومیِ فقط-خواندنی `salon-portfolio` مدیریت می‌شود و هرگز خودکار به رفرنس AI تبدیل نمی‌شود.

## تولید واقعی تصویر
مسیر `/api/simulations/generate` فقط روی سرور اجرا می‌شود و با API ویرایش تصویر OpenAI و مدل `gpt-image-1.5` خروجی واقعی می‌سازد. این مسیر در لحظه اجرا، سرویس فعال، Beauty Profile، قوانین پیشنهاد فعال، رفرنس‌های فعال tenant و تصاویر فعال کتابخانه مدیریت را از Supabase می‌خواند؛ بنابراین تغییرات Admin بدون build یا deploy تازه در نسل بعد اعمال می‌شوند. خروجی باینری OpenAI بلافاصله در bucket خصوصی `customer-simulations` ذخیره و سپس رکورد `image_generations` تکمیل می‌شود؛ URL موقت OpenAI ذخیره نمی‌شود و شکست provider هرگز به‌عنوان نتیجه موفق ثبت نمی‌شود.

در محیط سرور استقرار (برای نمونه Environment Variables پروژه Production در Vercel) این متغیرها الزامی‌اند:

- `OPENAI_API_KEY`: کلید خصوصی OpenAI؛ هرگز نام آن را با `NEXT_PUBLIC_` شروع نکنید.
- `SUPABASE_SERVICE_ROLE_KEY`: فقط برای route سرور جهت خواندن رفرنس خصوصی و persistence اتمیک؛ هرگز در مرورگر یا متغیر `NEXT_PUBLIC_*` قرار نگیرد.
- `NEXT_PUBLIC_SUPABASE_URL` و publishable/anon key موجود همچنان برای قابلیت‌های عمومی و Admin لازم‌اند.

اگر هر متغیر خصوصی سرور وجود نداشته باشد، route با پیام عمومی امن شکست می‌خورد و هیچ نتیجه جعلی نشان نمی‌دهد. Migration `011_real_image_generation_idempotency.sql` باید پیش از انتشار کد در Supabase اجرا شود تا شناسه درخواست یکتا مانع هزینه دوباره ناشی از درخواست تکراری شود.

## اتصال Reference Library به provider
Reference Library، optionها را به تصاویر و قوانین مستقل تبدیل می‌کند. `buildBeautyPrompt()` انتخاب کاربر، Beauty Profile، نتیجه recommendation، ruleهای جاری، reference metadata، قوانین تولید، محدودیت منفی و قوانین سخت حفظ هویت را در بخش‌های جدا ترکیب می‌کند. selector قطعی فقط یک تصویر فعال و اولویت‌دار برای هر purpose مرتبط را به provider می‌دهد تا رفرنس نامرتبط هویت یا درمان را آلوده نکند.

## V3: ورودی تصویر سرویس‌محور
هر سرویس در `lib/catalog.ts` متادیتای `photoRequirements` مستقل دارد. ورودی provider به سه نقش صریح `primaryImage`، `detailImages` و `referenceImages` تقسیم شده است. ناخن از عکس دست استفاده می‌کند؛ ابرو، مژه و لب عکس کامل چهره را اصلی نگه می‌دارند و نمای نزدیک اختیاری است. provider واقعی فقط در route سرور import می‌شود و هیچ کلید خصوصی در bundle مرورگر قرار نمی‌گیرد.

## تایپوگرافی
توکن‌های معنایی قلم در CSS تعریف شده‌اند: Vazirmatn برای رابط فارسی و Manrope برای متن انگلیسی. چون فایل دارای مجوز و قابل اتکایی از Peyda در مخزن موجود نبود، عنوان‌های نمایشی از زنجیره امن `Peyda, Vazirmatn` استفاده می‌کنند و بدون شکستن build به Vazirmatn برمی‌گردند.

## استقرار CMS مدیریت
Migration جدید `004_complete_admin_content_management.sql` باید بعد از migrationهای قبلی در Supabase اجرا شود. این migration لاین‌های اولیه tenant دمو، فیلد وضعیت تصویر، ایندکس‌ها، RLS تکمیلی و bucketهای `style-references` (خصوصی) و `salon-portfolio` (خواندن عمومی، نوشتن tenant-aware) را آماده می‌کند. اگر migration با CLI اجرا نشود، باید فایل در SQL Editor به‌صورت دستی اجرا شود؛ ساخت جداگانه bucket یا policy لازم نیست.

Migration `006_admin_reference_library_privileges.sql` بعد از `005` اجرا می‌شود و privilegeهای حداقلی Admin Reference Library را اضافه می‌کند. اگر deploy به‌صورت خودکار migrationهای Supabase را push نمی‌کند، این فایل باید پیش از deploy در SQL Editor اجرا شود. RLS و بررسی عضویت `tenant_users` بدون تغییر باقی می‌مانند.

کاربر Owner موجود در Auth باید دقیقاً یک ردیف فعال در `tenant_users` با `tenant_id` سالن و role برابر `owner` داشته باشد. مسیر فایل‌ها به‌ترتیب `{tenant_id}/{service_line}/{reference_id}/{filename}` و `{tenant_id}/{service_line}/{portfolio_item_id}/{filename}` است و RLS مالکیت پوشه را با عضویت tenant کنترل می‌کند.
