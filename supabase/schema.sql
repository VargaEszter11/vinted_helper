-- Vinted Helper database schema.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- It is safe to run again: on an existing project it updates what changed.
--
-- The app signs in with a single built-in user: username "admin", password "admin".
-- Change that password (see the README) before putting the app online.

-- ---------------------------------------------------------------------------
-- Default user: admin / admin
-- The app turns the username "admin" into the email admin@vinted-helper.local.
-- Created here because Supabase sign-up rejects passwords shorter than 6 characters.
-- ---------------------------------------------------------------------------

do $$
declare
  admin_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'admin@vinted-helper.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@vinted-helper.local', extensions.crypt('admin', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, 'email', admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@vinted-helper.local', 'email_verified', true),
      now(), now(), now()
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Total cost of the item, including fees and shipping.
  bought_for numeric(12, 2) not null check (bought_for >= 0),
  listed_for numeric(12, 2) check (listed_for >= 0),
  status text not null default 'in_stock' check (status in ('in_stock', 'listed', 'sold')),
  sold_for numeric(12, 2) check (sold_for >= 0),
  sold_date date,
  created_at timestamptz not null default now(),
  constraint sold_items_have_sale_details
    check (status <> 'sold' or (sold_for is not null and sold_date is not null))
);

-- Items saved while the app had no login have no owner: give them to admin.
update public.items
set user_id = (select id from auth.users where email = 'admin@vinted-helper.local')
where user_id is null;

alter table public.items alter column user_id set not null;

create index if not exists items_user_id_status_idx on public.items (user_id, status);
drop index if exists public.items_status_idx;

create table if not exists public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  -- Path inside the "item-photos" bucket, e.g. <item_id>/<file>.jpg
  storage_path text not null unique,
  position integer not null default 0
);

create index if not exists item_photos_item_id_idx on public.item_photos (item_id, position);

-- ---------------------------------------------------------------------------
-- Row level security: each user only sees and changes their own data
-- ---------------------------------------------------------------------------

alter table public.items enable row level security;
alter table public.item_photos enable row level security;

drop policy if exists "App manages items" on public.items;
drop policy if exists "Users manage their own items" on public.items;
create policy "Users manage their own items"
  on public.items
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "App manages item photos" on public.item_photos;
drop policy if exists "Users manage photos of their own items" on public.item_photos;
create policy "Users manage photos of their own items"
  on public.item_photos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = item_photos.item_id
        and items.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.items
      where items.id = item_photos.item_id
        and items.user_id = (select auth.uid())
    )
  );

revoke all on public.items, public.item_photos from anon;
grant select, insert, update, delete on public.items, public.item_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for item photos (read through signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- A file belongs to a user when its first folder is one of their item ids
-- (or their user id, the layout used by the first version of the app).
create or replace function public.owns_photo_folder(folder text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select folder = (select auth.uid())::text
    or exists (
      select 1 from public.items
      where items.id::text = folder
        and items.user_id = (select auth.uid())
    );
$$;

revoke execute on function public.owns_photo_folder(text) from public, anon;
grant execute on function public.owns_photo_folder(text) to authenticated;

drop policy if exists "App manages item photo files" on storage.objects;
drop policy if exists "Users read their own photos" on storage.objects;
drop policy if exists "Users upload their own photos" on storage.objects;
drop policy if exists "Users update their own photos" on storage.objects;
drop policy if exists "Users delete their own photos" on storage.objects;
drop policy if exists "Users manage their own photo files" on storage.objects;
create policy "Users manage their own photo files"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'item-photos'
    and public.owns_photo_folder((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'item-photos'
    and public.owns_photo_folder((storage.foldername(name))[1])
  );
