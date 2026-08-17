-- Editor-facing enriched view
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

-- 008_rls.sql blocks viewers from the payments table entirely (FR-013). But this
-- view must still surface Paid / In Progress / Pending to viewers — a status word,
-- not an amount. A plain EXISTS subquery here would be silently wrong for viewers:
-- RLS would hide every payments row from them, so it would always evaluate to
-- false and report "Pending" regardless of the real status. This helper runs
-- security definer, the same pattern already used for current_role_of() and
-- has_state_access(), so it can read payments.status while still returning
-- nothing beyond the derived word.
create or replace function payment_status_for(target_participation_id uuid)
returns text
language sql stable security definer as $$
  select case when exists (
    select 1 from payments pay
    where pay.participation_id = target_participation_id and pay.status = 'paid'
  ) then 'Paid'
  when exists (
    select 1 from payments pay
    where pay.participation_id = target_participation_id and pay.status in ('pending','in_progress')
  ) then 'In Progress'
  else 'Pending' end
$$;

-- Viewer-facing view: NO financial columns exist here at all.
-- This is why financial protection is a view, not an RLS policy: RLS scopes rows, not columns.
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
