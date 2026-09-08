-- Complete database-backed Admin CMS. Safe to run after 001-003.
-- This migration creates both buckets; no Dashboard bucket creation is needed when it is applied.
alter table style_reference_images add column if not exists active boolean not null default true;
create index if not exists style_reference_images_tenant_idx on style_reference_images(tenant_id,style_reference_id,sort_order);
create index if not exists portfolio_items_active_idx on portfolio_items(tenant_id,active,sort_order);
create index if not exists leads_status_idx on leads(tenant_id,status,created_at desc);

-- Every admin-readable business table is tenant-protected (public portfolio has narrowly scoped select policies from 003).
drop policy if exists "members manage leads" on leads;
create policy "tenant members manage leads" on leads for all to authenticated using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
drop policy if exists "members manage requests" on contact_requests;
create policy "tenant members manage requests" on contact_requests for all to authenticated using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
drop policy if exists "members manage generations" on image_generations;
create policy "tenant members manage generations" on image_generations for all to authenticated using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));

-- Public visitors need only the service slug used to filter active portfolio records.
create policy "public reads enabled service names" on service_categories for select to anon using(enabled);

-- Ensure the eight initial lines exist for the bundled demo tenant. Other tenants should create their own rows.
insert into service_categories(tenant_id,slug,title,name_fa,name_en,sort_order,enabled) values
 ('00000000-0000-0000-0000-000000000001','hair-color','رنگ مو','رنگ مو','Hair Color',1,true),
 ('00000000-0000-0000-0000-000000000001','haircut','کوتاهی مو','کوتاهی مو','Haircut',2,true),
 ('00000000-0000-0000-0000-000000000001','lashes','مژه','مژه','Lashes',3,true),
 ('00000000-0000-0000-0000-000000000001','brows','ابرو','ابرو','Brows',4,true),
 ('00000000-0000-0000-0000-000000000001','makeup','میکاپ','میکاپ','Makeup',5,true),
 ('00000000-0000-0000-0000-000000000001','lips','لب','لب','Lips',6,true),
 ('00000000-0000-0000-0000-000000000001','nails','ناخن','ناخن','Nails',7,true),
 ('00000000-0000-0000-0000-000000000001','updo','شینیون','شینیون','Updo',8,true)
on conflict(tenant_id,slug) do update set name_fa=excluded.name_fa,name_en=excluded.name_en,enabled=true;

-- Seed editable metadata only. No portfolio or image is fabricated.
insert into style_references(tenant_id,service_category_id,title,slug,name_fa,name_en,reference_type,technical_definition)
select '00000000-0000-0000-0000-000000000001',c.id,v.name_fa,v.slug,v.name_fa,v.name_en,v.kind,v.definition
from (values
 ('hair-color','balayage','بالیاژ','Balayage','technique','روشن‌شدن تدریجی با ریشه طبیعی و بدون مرز افقی سخت.'),
 ('hair-color','icy-hair','رنگ موی یخی','Icy Hair Color','color','خانواده بلوند بسیار سرد با ته‌رنگ نقره‌ای.'),
 ('haircut','graduated-bob','باب گرَجوشن','Graduated Bob','style','باب ساختاریافته با پشت کوتاه‌تر و افزایش طول به سمت جلو.'),
 ('lashes','spiky-lashes','مژه اسپایکی','Spiky Lashes','style','اسپایک‌های باریک و جداشده میان مژه‌های کوتاه‌تر.'),
 ('brows','microblading','بلید ابرو','Microblading','pmu','هاشورهای بسیار ظریف و مویی در جهت طبیعی ابرو.'),
 ('makeup','light-makeup','میکاپ لایت','Light Makeup','makeup','میکاپ طبیعی و سبک با حفظ بافت واقعی پوست.'),
 ('lips','lip-shading','شیدینگ لب','Lip Shading','pmu','رنگ تدریجی و طبیعی با حفظ فرم و بافت لب.'),
 ('nails','almond-nails','ناخن بادامی','Almond Nails','shape','کناره‌های باریک‌شونده و نوک نرم و گرد.'),
 ('nails','red-nails','خانواده قرمز ناخن','Red Nail Family','color','طیف کنترل‌شده قرمز از روشن تا زرشکی.'),
 ('updo','half-up','موی باز / نیمه‌باز','Open / Half-up','hairstyle','بخشی از مو باز و بخشی جمع یا بافته می‌شود.')
) v(service_slug,slug,name_fa,name_en,kind,definition)
join service_categories c on c.tenant_id='00000000-0000-0000-0000-000000000001' and c.slug=v.service_slug
on conflict(tenant_id,slug) do update set service_category_id=excluded.service_category_id,name_fa=excluded.name_fa,name_en=excluded.name_en,reference_type=excluded.reference_type;

-- Prevent two covers/primary images for the same parent while still allowing none during an update.
create unique index if not exists one_primary_reference_image on style_reference_images(style_reference_id) where is_primary;
create unique index if not exists one_cover_portfolio_image on portfolio_images(portfolio_item_id) where is_cover;
