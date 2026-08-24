-- Configuration as data, not code.

create table editions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- 'NDG 2026'
  year          integer not null,
  status        text not null default 'draft'
                check (status in ('draft','active','closed')),
  is_reference  boolean not null default false,   -- imported history, advisory only
  starts_on     date,
  ends_on       date,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,
  unique (year, name)
);
comment on column editions.is_reference is
  'Historical data imported for warning purposes only. Never gates eligibility.';

-- Only one edition may be active at a time.
create unique index one_active_edition on editions ((status)) where status = 'active';

create table states (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,                  -- 'Delta'
  code     text not null unique,                  -- 'DEL'
  active   boolean not null default true
);

create table categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,                        -- 'Athletes', 'Coaches', 'LOC'
  group_key text not null
            check (group_key in ('participants','personnel','guests','operations')),
  is_state_scoped boolean not null default false, -- participants: true; personnel: false
  requires_sport  boolean not null default false,
  requires_committee boolean not null default false,
  sort_order integer not null default 0,
  active    boolean not null default true,
  unique (name, group_key)
);

create table sports (
  id     uuid primary key default gen_random_uuid(),
  name   text not null unique,
  active boolean not null default true
);

create table committees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  edition_id uuid references editions(id),        -- null = applies to all editions
  active     boolean not null default true
);

create table banks (
  id                text primary key,             -- CBN/NIP institution code, e.g. '000013'
  name              text not null,                -- canonical: 'Guaranty Trust Bank'
  aliases           text[] not null default '{}', -- 'GTBANK','GTB','Guaranty Trust'
  active            boolean not null default true
);
comment on table banks is
  'Source data carries free-text bank names in inconsistent case across 11+ institutions.
   Aliases drive normalisation at import; the id is what the disbursement file must carry.';

create table rates (
  id          uuid primary key default gen_random_uuid(),
  edition_id  uuid not null references editions(id) on delete cascade,
  category_id uuid not null references categories(id),
  sport_id    uuid references sports(id),         -- null = applies to whole category
  amount      numeric(14,2) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  unique (edition_id, category_id, sport_id)
);
