create table user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       text not null check (role in ('admin','editor','viewer')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table user_state_access (
  user_id  uuid not null references user_profiles(id) on delete cascade,
  state_id uuid not null references states(id) on delete cascade,
  primary key (user_id, state_id)
);

create table user_category_access (
  user_id     uuid not null references user_profiles(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (user_id, category_id)
);

create table access_logs (
  id            bigserial primary key,
  user_id       uuid references auth.users(id),
  role          text,
  route         text not null,
  action        text not null,                    -- 'list','export','reveal_identifier'
  edition_id    uuid,
  filters       jsonb,
  record_count  integer,
  ip            inet,
  created_at    timestamptz not null default now()
);
