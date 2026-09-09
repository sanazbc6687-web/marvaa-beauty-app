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
- `lib/simulation/`: Prompt Builder مرجع‌محور و provider کاملاً Mock.
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

## بخش‌های Mock / fallback
تولید تصویر و تحلیل Beauty Profile همچنان Mock هستند و هیچ API پولی فراخوانی نمی‌شود. بدون متغیرهای Supabase، تجربه مشتری و build کامل با catalog محلی کار می‌کنند و صفحه ورود پیام تنظیمات نشان می‌دهد؛ ورود، آمار Admin و ذخیره دائمی عمداً ممکن نیست. پنل تولید هیچ داده جعلی نمایش نمی‌دهد.

## اتصال provider واقعی در آینده
Reference Library ابتدا optionها را به تصاویر و قوانین مستقل تبدیل می‌کند. سپس `buildBeautyPrompt()` انتخاب کاربر، reference metadata و قوانین حفظ هویت را ترکیب می‌کند. provider واقعی باید پشت یک route امن سرور قرار بگیرد؛ کلید API فقط سرور باشد و تنها implementation سرویس generation جایگزین شود.

## V3: ورودی تصویر سرویس‌محور
هر سرویس در `lib/catalog.ts` متادیتای `photoRequirements` مستقل دارد. ورودی provider به سه نقش صریح `primaryImage`، `detailImages` و `referenceImages` تقسیم شده است. ناخن از عکس دست استفاده می‌کند؛ ابرو، مژه و لب عکس کامل چهره را اصلی نگه می‌دارند و نمای نزدیک اختیاری است. provider همچنان کاملاً Mock است و هیچ API یا کلید پولی به پروژه اضافه نشده است.

## تایپوگرافی
توکن‌های معنایی قلم در CSS تعریف شده‌اند: Vazirmatn برای رابط فارسی و Manrope برای متن انگلیسی. چون فایل دارای مجوز و قابل اتکایی از Peyda در مخزن موجود نبود، عنوان‌های نمایشی از زنجیره امن `Peyda, Vazirmatn` استفاده می‌کنند و بدون شکستن build به Vazirmatn برمی‌گردند.

## استقرار CMS مدیریت
Migration جدید `004_complete_admin_content_management.sql` باید بعد از migrationهای قبلی در Supabase اجرا شود. این migration لاین‌های اولیه tenant دمو، فیلد وضعیت تصویر، ایندکس‌ها، RLS تکمیلی و bucketهای `style-references` (خصوصی) و `salon-portfolio` (خواندن عمومی، نوشتن tenant-aware) را آماده می‌کند. اگر migration با CLI اجرا نشود، باید فایل در SQL Editor به‌صورت دستی اجرا شود؛ ساخت جداگانه bucket یا policy لازم نیست.

Migration `006_admin_reference_library_privileges.sql` بعد از `005` اجرا می‌شود و privilegeهای حداقلی Admin Reference Library را اضافه می‌کند. اگر deploy به‌صورت خودکار migrationهای Supabase را push نمی‌کند، این فایل باید پیش از deploy در SQL Editor اجرا شود. RLS و بررسی عضویت `tenant_users` بدون تغییر باقی می‌مانند.

کاربر Owner موجود در Auth باید دقیقاً یک ردیف فعال در `tenant_users` با `tenant_id` سالن و role برابر `owner` داشته باشد. مسیر فایل‌ها به‌ترتیب `{tenant_id}/{service_line}/{reference_id}/{filename}` و `{tenant_id}/{service_line}/{portfolio_item_id}/{filename}` است و RLS مالکیت پوشه را با عضویت tenant کنترل می‌کند.
