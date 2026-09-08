-- Secure admin, modular references, recommendation rulebook and a portfolio kept separate from AI references.
create table if not exists tenant_users (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('owner','manager','staff')),
 active boolean not null default true, created_at timestamptz not null default now(), unique(tenant_id,user_id)
);
insert into tenant_users(tenant_id,user_id,role) select tenant_id,user_id,'owner' from tenant_members on conflict do nothing;
alter table tenant_users enable row level security;
create policy "members read own membership" on tenant_users for select using(user_id=auth.uid());
create policy "owners manage memberships" on tenant_users for all using(exists(select 1 from tenant_users me where me.tenant_id=tenant_users.tenant_id and me.user_id=auth.uid() and me.active and me.role='owner')) with check(exists(select 1 from tenant_users me where me.tenant_id=tenant_users.tenant_id and me.user_id=auth.uid() and me.active and me.role='owner'));
create or replace function is_tenant_member(tid uuid) returns boolean language sql security definer set search_path=public stable as $$ select exists(select 1 from tenant_users where tenant_id=tid and user_id=auth.uid() and active) $$;

alter table style_references add column if not exists reference_type text not null default 'other' check(reference_type in ('technique','color','shape','style','makeup','pmu','hairstyle','other'));
alter table style_references add column if not exists name_fa text;
alter table style_references add column if not exists name_en text;
alter table style_references add column if not exists technical_definition text;
alter table style_references alter column service_option_id drop not null;
update style_references set name_fa=coalesce(name_fa,title),name_en=coalesce(name_en,title) where name_fa is null or name_en is null;
alter table style_reference_images add column if not exists storage_path text;
alter table style_reference_images add column if not exists public_url_or_signed_path text;
update style_reference_images set public_url_or_signed_path=coalesce(public_url_or_signed_path,image_url) where public_url_or_signed_path is null;

create table if not exists recommendation_rules (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 service_category_id uuid references service_categories(id) on delete cascade, style_reference_id uuid references style_references(id) on delete cascade,
 feature_key text not null, operator text not null check(operator in ('equals','not_equals','contains','known','unknown')),
 comparison_value jsonb, score_adjustment numeric not null default 0 check(score_adjustment between -100 and 100),
 reason_fa text not null, reason_en text not null, priority int not null default 0, active boolean not null default true,
 metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table recommendation_rules enable row level security;
create policy "members manage recommendation rules" on recommendation_rules for all using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
create index if not exists recommendation_rules_tenant_service_idx on recommendation_rules(tenant_id,service_category_id,priority);

alter table portfolio_items add column if not exists service_option_id uuid references service_options(id) on delete set null;
alter table portfolio_items add column if not exists title_fa text;
alter table portfolio_items add column if not exists title_en text;
alter table portfolio_items add column if not exists description_fa text;
alter table portfolio_items add column if not exists description_en text;
alter table portfolio_items add column if not exists cover_image_path text;
alter table portfolio_items add column if not exists featured boolean not null default false;
alter table portfolio_items alter column image_url drop not null;
create table if not exists portfolio_images (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 portfolio_item_id uuid not null references portfolio_items(id) on delete cascade, storage_path text not null,
 is_cover boolean not null default false, sort_order int not null default 0, created_at timestamptz not null default now()
);
alter table portfolio_images enable row level security;
create policy "members manage portfolio images" on portfolio_images for all using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
create policy "public reads active portfolio" on portfolio_items for select using(active);
create policy "public reads active portfolio images" on portfolio_images for select using(exists(select 1 from portfolio_items p where p.id=portfolio_item_id and p.active));
create index if not exists portfolio_images_item_idx on portfolio_images(portfolio_item_id,sort_order);

alter table leads add column if not exists service_category_id uuid references service_categories(id) on delete set null;
alter table leads add column if not exists selected_options jsonb not null default '{}';
alter table leads add column if not exists preferred_at timestamptz;
alter table leads add column if not exists status text not null default 'new' check(status in ('new','contacted','booked','closed'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('style-references','style-references',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('salon-portfolio','salon-portfolio',true,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "tenant admins upload style references" on storage.objects for insert to authenticated with check(bucket_id='style-references' and is_tenant_member((storage.foldername(name))[1]::uuid));
create policy "tenant admins manage style references" on storage.objects for all to authenticated using(bucket_id='style-references' and is_tenant_member((storage.foldername(name))[1]::uuid)) with check(bucket_id='style-references' and is_tenant_member((storage.foldername(name))[1]::uuid));
create policy "tenant admins manage portfolio files" on storage.objects for all to authenticated using(bucket_id='salon-portfolio' and is_tenant_member((storage.foldername(name))[1]::uuid)) with check(bucket_id='salon-portfolio' and is_tenant_member((storage.foldername(name))[1]::uuid));
create policy "public reads portfolio files" on storage.objects for select using(bucket_id='salon-portfolio');

-- Seed metadata only when matching tenant service categories exist. No reference images are invented.
do $$ declare r record; sid uuid; begin for r in select * from (values
 ('hair-color','balayage','بالیاژ','Balayage','technique'),('lashes','spiky-lashes','مژه اسپایکی','Spiky Lashes','style'),
 ('haircut','graduated-bob','باب گرَجوشن','Graduated Bob','style'),('makeup','light-makeup','میکاپ لایت','Light Makeup','makeup'),
 ('brows','microblading','بلید ابرو','Microblading','pmu'),('lip','lip-shading','شیدینگ لب','Lip Shading','pmu'),
 ('nails','almond-nails','ناخن بادامی','Almond Nails','shape'),('updo','half-up','شینیون موی باز','Open / Half-up Hairstyle','hairstyle'),
 ('hair-color','icy-hair','رنگ موی یخی','Icy Hair Color','color'),('nails','red-nails','خانواده قرمز ناخن','Red Nail Color Family','color')
 ) x(service_slug,slug,name_fa,name_en,reference_type) loop
  select id into sid from service_categories where tenant_id='00000000-0000-0000-0000-000000000001' and slug=r.service_slug limit 1;
  if sid is not null then insert into style_references(tenant_id,service_category_id,service_option_id,title,slug,name_fa,name_en,reference_type,technical_definition)
   values('00000000-0000-0000-0000-000000000001',sid,null,r.name_en,r.slug,r.name_fa,r.name_en,r.reference_type,'Pilot metadata; editable in Admin Reference Library.') on conflict(tenant_id,slug) do nothing; end if;
 end loop; end $$;
