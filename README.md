# Marvaa Future Mirror V2

تجربه‌ی RTL و mobile-first آینه‌ی زیبایی مروا با Next.js، React، TypeScript و معماری آماده‌ی Supabase و multi-tenancy.

## اجرا
```bash
npm install
npm run dev
```
- تجربه مشتری: `/`
- اتاق کنترل: `/admin`

## معماری
- `components/mirror/MirrorUI.tsx`: زبان بصری مشترک Mirror UI.
- `lib/catalog.ts`: fallback دو‌زبانه و database-ready برای دسته‌ها، تصمیم‌ها و گزینه‌ها.
- `lib/simulation/`: Prompt Builder مرجع‌محور و provider کاملاً Mock.
- `lib/tenant.ts`: tenant دمو؛ در تولید براساس hostname از Supabase خوانده می‌شود.
- `supabase/migrations/002_future_mirror_v2.sql`: Reference Library، تصاویر مرجع، Portfolio مستقل و Beauty Profile.

## ویدئوی خوش‌آمد
فایل فعلی در `public/videos/marvaa-welcome.mp4` است. مسیر آن از `demoTenant.consultant.videoUrl` می‌آید؛ در نسخه متصل به Supabase، مقدار `consultant_profiles.welcome_video_url` را از پنل «برند و مشاور» تغییر دهید. پوستر نیز به همین شکل قابل جایگزینی است.

## بخش‌های Mock
تولید تصویر، آمار/ذخیره پنل، تصاویر پورتفولیو و Beauty ID در MVP محلی و Mock هستند. `generateBeautySimulation()` تصویر ورودی را همراه metadata، prompt و فهرست مراجع استفاده‌شده برمی‌گرداند و هیچ API پولی فراخوانی نمی‌شود.

## اتصال provider واقعی در آینده
Reference Library ابتدا optionها را به تصاویر و قوانین مستقل تبدیل می‌کند. سپس `buildBeautyPrompt()` انتخاب کاربر، reference metadata و قوانین حفظ هویت را ترکیب می‌کند. provider واقعی باید پشت یک route امن سرور قرار بگیرد؛ کلید API فقط سرور باشد و تنها implementation سرویس generation جایگزین شود.

## V3: ورودی تصویر سرویس‌محور
هر سرویس در `lib/catalog.ts` متادیتای `photoRequirements` مستقل دارد. ورودی provider به سه نقش صریح `primaryImage`، `detailImages` و `referenceImages` تقسیم شده است. ناخن از عکس دست استفاده می‌کند؛ ابرو، مژه و لب عکس کامل چهره را اصلی نگه می‌دارند و نمای نزدیک اختیاری است. provider همچنان کاملاً Mock است و هیچ API یا کلید پولی به پروژه اضافه نشده است.

## تایپوگرافی
توکن‌های معنایی قلم در CSS تعریف شده‌اند: Vazirmatn برای رابط فارسی و Manrope برای متن انگلیسی. چون فایل دارای مجوز و قابل اتکایی از Peyda در مخزن موجود نبود، عنوان‌های نمایشی از زنجیره امن `Peyda, Vazirmatn` استفاده می‌کنند و بدون شکستن build به Vazirmatn برمی‌گردند.
