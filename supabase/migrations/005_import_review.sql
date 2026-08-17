create table import_runs (
  id             uuid primary key default gen_random_uuid(),
  edition_id     uuid not null references editions(id) on delete cascade,
  kind           text not null
                 check (kind in ('beneficiaries','arrival_accreditation','payment_results')),
  category_id    uuid references categories(id),
  state_id       uuid references states(id),
  file_path      text not null,                   -- Supabase Storage
  original_name  text not null,
  row_count      integer not null default 0,
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  rejections     jsonb not null default '[]',     -- [{row, field, value, reason}]
  status         text not null default 'pending'
                 check (status in ('pending','completed','failed')),
  uploaded_by    uuid not null references auth.users(id),
  created_at     timestamptz not null default now()
);

create table duplicate_reviews (
  id                 uuid primary key default gen_random_uuid(),
  edition_id         uuid not null references editions(id) on delete cascade,
  participation_id   uuid not null references participations(id) on delete cascade,
  matched_person_id  uuid not null references persons(id),
  matched_edition_id uuid not null references editions(id),
  match_type         text not null
                     check (match_type in ('identifier_exact','account_exact','name_similar')),
  similarity_score   numeric(4,3),
  is_blocking        boolean not null default false,  -- false whenever matched edition is_reference
  status             text not null default 'open'
                     check (status in ('open','confirmed_duplicate','dismissed')),
  resolved_by        uuid references auth.users(id),
  resolved_at        timestamptz,
  resolution_note    text,
  created_at         timestamptz not null default now()
);
comment on column duplicate_reviews.is_blocking is
  'Matches against reference (historical) editions are ALWAYS non-blocking. A legitimate
   athlete turned away at a payment desk is a worse failure than a recoverable duplicate.';

-- Enforced by trigger, not application code: application code can be bypassed
-- or get this wrong; the database cannot.
create or replace function enforce_reference_edition_non_blocking()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from editions e
    where e.id = new.matched_edition_id and e.is_reference = true
  ) then
    new.is_blocking := false;
  end if;
  return new;
end;
$$;

create trigger duplicate_reviews_reference_non_blocking
  before insert or update on duplicate_reviews
  for each row execute function enforce_reference_edition_non_blocking();
