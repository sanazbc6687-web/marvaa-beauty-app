# Marvaa Beauty — MVP

وب‌اپ فارسی و mobile-first برای انتخاب و شبیه‌سازی خدمات زیبایی با معماری white-label و آماده‌ی multi-tenancy.

## اجرا

```bash
npm install
npm run dev
```

- تجربه کاربر: `http://localhost:3000`
- داشبورد: `http://localhost:3000/admin`

## معماری

- `app/`: مسیرهای تجربه کاربر و داشبورد مدیریت
- `components/`: اجزای مشترک برند و مشاور
- `lib/tenant.ts`: تنظیمات tenant دمو (در استقرار واقعی بر اساس hostname از Supabase)
- `lib/catalog.ts`: fallback محلی کاتالوگ برای اجرای دمو بدون env
- `lib/simulation/`: قرارداد مستقل تولید تصویر و Prompt Builder
- `supabase/migrations/`: schema، ایندکس‌ها، RLS و seed اولیه

## بخش‌های Mock

تولید تصویر در MVP عمداً Mock است و همان تصویر ورودی را پس از loading بازمی‌گرداند. آمار داشبورد و ذخیره فرم‌ها نیز داده نمایشی‌اند. فایل ویدئویی واقعی وجود ندارد و پوستر سبک جایگزین نمایش داده می‌شود.

## اتصال provider تصویر در مرحله بعد

یک route سمت سرور ایجاد کنید که فایل موقت را از Storage خصوصی بخواند، prompt ساخته‌شده را به provider مجاز ارسال کند، نتیجه را در bucket خصوصی ذخیره و ردیف `image_generations` را به‌روزرسانی کند. سپس تنها پیاده‌سازی `generateBeautySimulation` را به آن route متصل کنید؛ رابط و جریان UI نیاز به بازنویسی ندارند. کلید API باید فقط سمت سرور باشد.
