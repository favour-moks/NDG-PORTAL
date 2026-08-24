-- Durable identity, separate from participation.

create table persons (
  id                uuid primary key default gen_random_uuid(),
  bvn_encrypted     bytea,                        -- pgp_sym_encrypt
  nin_encrypted     bytea,
  bvn_hash          text unique,                  -- sha256, for exact match without decrypting
  nin_hash          text unique,
  full_name         text not null,
  normalised_name   text not null,                -- unaccent+lower+sorted tokens
  phone             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint person_has_identifier
    check (bvn_hash is not null or nin_hash is not null)
);
comment on column persons.normalised_name is
  'unaccent(lower(name)) with tokens sorted alphabetically, so
   "MADWEGWU JOSEPHINE NKECHI" and "Josephine Nkechi Madwegwu" normalise identically.';
comment on constraint person_has_identifier on persons is
  'At least one national identifier is required. This is the only field that links a
   person across batches, states and editions — see validation-report.md, fatal flaw 2.';

create table participations (
  id                  uuid primary key default gen_random_uuid(),
  edition_id          uuid not null references editions(id) on delete cascade,
  person_id           uuid not null references persons(id) on delete restrict,
  category_id         uuid not null references categories(id),
  state_id            uuid references states(id),      -- required when category.is_state_scoped
  sport_id            uuid references sports(id),
  committee_id        uuid references committees(id),

  -- bank details belong to the participation, not the person:
  -- people change accounts between editions, and the account used for a payment
  -- must stay attached to that payment permanently for audit.
  account_name        text,
  account_number      text check (account_number ~ '^[0-9]{10}$'),
  bank_id             text references banks(id),

  pre_games_accredited  boolean not null default false,
  arrival_accredited    boolean not null default false,
  arrival_accredited_at timestamptz,
  arrival_source        text check (arrival_source in ('biometric_feed','manual_desk')),

  entitlement_amount  numeric(14,2),              -- resolved from rates at import/approval
  exclusion_reason    text,                       -- set when explicitly withdrawn

  -- eligibility is COMPUTED, never asserted. There is no editor screen that sets this.
  is_payable boolean generated always as (
    pre_games_accredited
    and arrival_accredited
    and exclusion_reason is null
    and account_number is not null
    and bank_id is not null
  ) stored,

  source_import_id    uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (edition_id, person_id)                  -- one participation per person per edition
);
comment on column participations.is_payable is
  'Generated column. Payability is derived, never entered. Any requirement that appears
   to need an override is a missing accreditation state, not a reason to make this writable.';
