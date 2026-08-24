create table payment_batches (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid not null references editions(id) on delete cascade,
  reference     text not null,
  description   text,
  filter_json   jsonb not null,                   -- the exact filter that produced it
  record_count  integer not null default 0,
  total_amount  numeric(16,2) not null default 0,
  status        text not null default 'generated'
                check (status in ('generated','submitted','reconciled')),
  generated_by  uuid not null references auth.users(id),
  generated_at  timestamptz not null default now(),
  unique (edition_id, reference)
);

create table payments (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references payment_batches(id) on delete cascade,
  participation_id uuid not null references participations(id) on delete restrict,
  amount           numeric(14,2) not null,
  -- snapshot of the account at time of payment; never updated afterwards
  account_number   text not null,
  bank_id          text not null references banks(id),
  status           text not null default 'pending'
                   check (status in ('pending','in_progress','paid','failed','unmatched')),
  partner_reference text,
  failure_reason   text,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (batch_id, participation_id)
);
comment on table payments is
  'Multiple batches per edition are normal — the real Edo data shows one category paid
   in two runs six weeks apart. Never overwrite a prior batch; paid-to-date and balance
   are computed from this table.';
