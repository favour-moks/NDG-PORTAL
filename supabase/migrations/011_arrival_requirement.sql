-- Not every category needs arrival (venue) accreditation to be payable —
-- LOC members, for instance, organise before the Games start. is_payable
-- is a generated column and generated columns cannot reference other
-- tables, so the flag is denormalised from categories onto participations
-- at import time (see src/lib/import/persist.ts) rather than joined at
-- read time.
alter table categories add column requires_arrival_accreditation boolean not null default true;
alter table participations add column requires_arrival_accreditation boolean not null default true;

-- Sets the one non-default value this phase seeds (LOC = false). This is
-- a migration-owned correction, not something left to supabase/seed.sql:
-- seed.sql's plain INSERTs are silently no-ops against a database that
-- already has these category rows (unique(name, group_key) means nothing
-- to re-apply), so on an already-seeded database only an explicit UPDATE
-- here actually takes effect. See docs/infrastructure.md — this default
-- still needs Secretariat sign-off before real payments depend on it.
update categories set requires_arrival_accreditation = false where name = 'LOC';

-- Postgres has no ALTER COLUMN ... SET EXPRESSION for generated columns
-- across the versions in play here, so is_payable is dropped and
-- recreated — which means everything that depends on it (a partial index
-- and both participations views) has to be dropped first and rebuilt
-- after. Safe: the table is empty in every environment this has run
-- against so far (verified before this migration was written).
drop index if exists idx_part_payable;
drop view if exists participations_viewer_v;
drop view if exists participations_v;

alter table participations drop column is_payable;

alter table participations add column is_payable boolean generated always as (
  pre_games_accredited
  and (not requires_arrival_accreditation or arrival_accredited)
  and exclusion_reason is null
  and account_number is not null
  and bank_id is not null
) stored;

comment on column participations.is_payable is
  'Generated column. Payability is derived, never entered. Any requirement that appears
   to need an override is a missing accreditation state, not a reason to make this writable.
   requires_arrival_accreditation is denormalised from categories at import (TASK-033).';

comment on column participations.requires_arrival_accreditation is
  'Copied from categories.requires_arrival_accreditation at import time — generated
   columns cannot join other tables, so is_payable reads this column on the same row.';

create index idx_part_payable on participations (edition_id, category_id)
  where is_payable = true;

-- Rebuilt verbatim from 007_views.sql — the view definitions themselves
-- didn't change, only the is_payable column they select had to be dropped
-- and recreated.
create view participations_v as
select
  p.*, pe.full_name, pe.normalised_name, pe.phone,
  c.name as category_name, c.group_key,
  s.name as state_name, sp.name as sport_name,
  cm.name as committee_name, b.name as bank_name,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as amount_paid,
  p.entitlement_amount
    - coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as balance
from participations p
join persons pe on pe.id = p.person_id
join categories c on c.id = p.category_id
left join states s on s.id = p.state_id
left join sports sp on sp.id = p.sport_id
left join committees cm on cm.id = p.committee_id
left join banks b on b.id = p.bank_id
left join payments pay on pay.participation_id = p.id
group by p.id, pe.id, c.id, s.id, sp.id, cm.id, b.id;

create view participations_viewer_v as
select
  p.id, p.edition_id, p.person_id, p.category_id, p.state_id, p.sport_id, p.committee_id,
  pe.full_name,
  c.name as category_name, s.name as state_name, sp.name as sport_name,
  b.name as bank_name,
  p.pre_games_accredited, p.arrival_accredited, p.is_payable,
  payment_status_for(p.id) as payment_status
from participations p
join persons pe on pe.id = p.person_id
join categories c on c.id = p.category_id
left join states s on s.id = p.state_id
left join sports sp on sp.id = p.sport_id
left join banks b on b.id = p.bank_id;

grant select on participations_viewer_v to authenticated;
revoke all on participations_v from authenticated;
grant select on participations_v to authenticated;
