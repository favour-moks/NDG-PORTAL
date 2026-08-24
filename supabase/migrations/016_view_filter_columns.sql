-- Two gaps found while building the Phase 3 query layer:
--
-- 1. participations_v (editor view) had no payment_status column, only
--    participations_viewer_v did — editors would have had no consistent
--    way to filter by payment status. Both views now derive it the same
--    way, via payment_status_for() (007_views.sql).
-- 2. participations_viewer_v exposed bank_name but not bank_id, so
--    filtering by bank would have needed different logic per role.
--    bank_id isn't financial data (an institution code, not an amount),
--    so it's safe to expose to viewers too.
--
-- This needs a full drop/recreate, not CREATE OR REPLACE: participations_v
-- selected p.* to get every participations column, but Postgres freezes a
-- view's column list at creation time — p.* does not pick up columns
-- added to the base table afterwards (011/013/014 all added one). The
-- attempted CREATE OR REPLACE failed with "cannot change name of view
-- column" because the newly-expanded p.* shifted every later column into
-- a different position than the existing view expected. Explicit columns
-- avoid this whole class of problem recurring as participations keeps
-- growing in later phases.
drop view if exists participations_viewer_v;
drop view if exists participations_v;

create view participations_v as
select
  p.id, p.edition_id, p.person_id, p.category_id, p.state_id, p.sport_id, p.committee_id,
  p.account_name, p.account_number, p.bank_id,
  p.pre_games_accredited, p.arrival_accredited, p.arrival_accredited_at, p.arrival_source,
  p.arrival_accredited_by,
  p.entitlement_amount, p.exclusion_reason, p.excluded_by, p.excluded_at,
  p.is_payable, p.requires_arrival_accreditation,
  p.source_import_id, p.created_at, p.updated_at,
  pe.full_name, pe.normalised_name, pe.phone,
  c.name as category_name, c.group_key,
  s.name as state_name, sp.name as sport_name,
  cm.name as committee_name, b.name as bank_name,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as amount_paid,
  p.entitlement_amount
    - coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as balance,
  payment_status_for(p.id) as payment_status
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
  payment_status_for(p.id) as payment_status,
  p.bank_id
from participations p
join persons pe on pe.id = p.person_id
join categories c on c.id = p.category_id
left join states s on s.id = p.state_id
left join sports sp on sp.id = p.sport_id
left join banks b on b.id = p.bank_id;

grant select on participations_viewer_v to authenticated;
revoke all on participations_v from authenticated;
grant select on participations_v to authenticated;
