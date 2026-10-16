-- Applied automatically on server start. Safe to run repeatedly.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (length(username) between 3 and 32),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Total cost of the item, including fees and shipping.
  bought_for numeric(12, 2) not null check (bought_for >= 0),
  listed_for numeric(12, 2) check (listed_for >= 0),
  status text not null default 'in_stock' check (status in ('in_stock', 'listed', 'sold')),
  sold_for numeric(12, 2) check (sold_for >= 0),
  sold_date date,
  brand text,
  size text,
  measurements text,
  flaws text,
  created_at timestamptz not null default now(),
  -- When the status last changed. Kept by a trigger.
  status_changed_at timestamptz not null default now(),
  constraint sold_items_have_sale_details
    check (status <> 'sold' or (sold_for is not null and sold_date is not null))
);

create index if not exists items_user_id_status_idx on items (user_id, status);

-- Several items listed together for one price. Items join through items.bundle_id.
create table if not exists bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  listed_for numeric(12, 2) not null check (listed_for >= 0),
  created_at timestamptz not null default now()
);

alter table items add column if not exists bundle_id uuid references bundles (id) on delete set null;
create index if not exists items_bundle_id_idx on items (bundle_id);

create table if not exists item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items (id) on delete cascade,
  -- Path inside the photo directory: <item_id>/<photo_id>.jpg
  storage_path text not null unique,
  position integer not null default 0
);

create index if not exists item_photos_item_id_idx on item_photos (item_id, position);

create or replace function set_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists items_status_changed_at on items;
create trigger items_status_changed_at
  before insert or update on items
  for each row execute function set_status_changed_at();

-- Every status an item has had, with the time it changed. Kept by a trigger.
create table if not exists item_status_history (
  id bigint generated always as identity primary key,
  item_id uuid not null references items (id) on delete cascade,
  status text not null check (status in ('in_stock', 'listed', 'sold')),
  changed_at timestamptz not null default now()
);

create index if not exists item_status_history_item_idx on item_status_history (item_id, changed_at);

create or replace function log_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into item_status_history (item_id, status, changed_at)
    values (new.id, new.status, new.status_changed_at);
  end if;
  return null;
end;
$$;

drop trigger if exists items_log_status_change on items;
create trigger items_log_status_change
  after insert or update on items
  for each row execute function log_status_change();

-- Items that existed before the log: start it with their current status.
insert into item_status_history (item_id, status, changed_at)
select i.id, i.status, i.status_changed_at
from items i
where not exists (select 1 from item_status_history h where h.item_id = i.id);
