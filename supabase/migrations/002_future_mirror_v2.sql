-- Future Mirror V2: bilingual taxonomy, independent reference library, portfolio and Beauty ID.
alter table salons add column if not exists name_en text;
alter table consultant_profiles add column if not exists consultant_enabled boolean not null default true;
alter table service_categories add column if not exists name_fa text;
alter table service_categories add column if not exists name_en text;
alter table service_options add column if not exists name_fa text;
alter table service_options add column if not exists name_en text;
alter table service_options add column if not exists parent_option_id uuid references service_options(id) on delete set null;
alter table service_options add column if not exists prompt_metadata jsonb not null default '{}';

create table if not exists style_references (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 service_category_id uuid not null references service_categories(id) on delete cascade,
 service_option_id uuid not null references service_options(id) on delete cascade,
 title text not null, slug text not null, description text, primary_reference_image text,
 visual_rules jsonb not null default '[]', generation_rules jsonb not null default '[]', prompt_fragment text,
 negative_constraints jsonb not null default '[]', active boolean not null default true, sort_order int not null default 0,
 metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,slug)
);
create table if not exists style_reference_images (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 style_reference_id uuid not null references style_references(id) on delete cascade, image_url text not null,
 alt_fa text, alt_en text, is_primary boolean not null default false, sort_order int not null default 0, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists portfolio_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 service_category_id uuid not null references service_categories(id) on delete cascade, image_url text not null,
 title text, caption text, sort_order int not null default 0, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists beauty_profiles (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references salons(id) on delete cascade,
 session_id uuid references anonymous_sessions(id) on delete cascade, lead_id uuid references leads(id) on delete set null,
 undertone text, preferred_color_family text, preferred_intensity text, favorite_looks jsonb not null default '[]',
 signature_hair text, suggested_lash text, preferred_makeup text, previous_liked_simulations jsonb not null default '[]',
 metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists style_references_tenant_option_idx on style_references(tenant_id,service_option_id);
create index if not exists style_reference_images_reference_idx on style_reference_images(style_reference_id,sort_order);
create index if not exists portfolio_items_tenant_category_idx on portfolio_items(tenant_id,service_category_id,sort_order);
create index if not exists beauty_profiles_tenant_session_idx on beauty_profiles(tenant_id,session_id);
alter table style_references enable row level security; alter table style_reference_images enable row level security; alter table portfolio_items enable row level security; alter table beauty_profiles enable row level security;
create policy "members manage references" on style_references for all using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
create policy "members manage reference images" on style_reference_images for all using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
create policy "members manage portfolio" on portfolio_items for all using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
create policy "members manage beauty profiles" on beauty_profiles for all using(is_tenant_member(tenant_id)) with check(is_tenant_member(tenant_id));
update salons set name_en='Marvaa Beauty Studio',theme='{"background":"#050407","surface":"#100d16","accent":"#d8bd82","purple":"#6f3cff","text":"#f6f0e5"}' where id='00000000-0000-0000-0000-000000000001';
update consultant_profiles set welcome_video_url='/videos/marvaa-welcome.mp4',poster_url='/images/video-poster.svg' where tenant_id='00000000-0000-0000-0000-000000000001';
update app_settings set value='{"anonymous":1,"extra_after_lead":2,"maximum":3,"generation_enabled":true}' where tenant_id='00000000-0000-0000-0000-000000000001' and key='generation_limits';
