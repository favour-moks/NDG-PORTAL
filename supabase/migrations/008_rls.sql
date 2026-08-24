-- ============================================================
-- Helper functions
-- ============================================================

create or replace function current_role_of() returns text
language sql stable security definer as $$
  select role from user_profiles where id = auth.uid() and active
$$;

create or replace function has_state_access(target uuid) returns boolean
language sql stable security definer as $$
  select current_role_of() in ('admin','editor')
      or exists (
        select 1 from user_state_access
        where user_id = auth.uid() and state_id = target
      )
$$;

-- ============================================================
-- participations — the core beneficiary table
-- ============================================================

alter table participations enable row level security;

-- Editors and admins: all rows, all editions.
create policy participations_editor_all on participations
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

-- Viewers: their assigned state(s), ACROSS ALL EDITIONS, read only.
-- Note there is no edition predicate here — that is deliberate: liaisons
-- need to browse their state's history across editions, per PRD § 3.
create policy participations_viewer_state on participations
  for select to authenticated
  using (
    current_role_of() = 'viewer'
    and state_id is not null
    and has_state_access(state_id)
  );

-- Closed editions are read-only for everyone, including editors and admins.
-- This MUST be `as restrictive`: a plain (permissive) policy here would be
-- OR'd with participations_editor_all rather than AND'd, so an editor's
-- unconditional access would silently override the closed-edition check and
-- this block would do nothing. Restrictive policies are the mechanism that
-- narrows what permissive policies already allow.
--
-- Scoped to UPDATE only (not `for all`): a restrictive policy's USING clause
-- also gates SELECT, and closed editions must remain readable — "read-only"
-- means writes are blocked, not that the edition disappears.
create policy participations_no_write_when_closed on participations
  as restrictive
  for update to authenticated
  using (
    exists (select 1 from editions e
            where e.id = edition_id and e.status = 'active')
  );

-- ============================================================
-- persons — durable identity
-- ============================================================
-- participations_viewer_v joins persons for full_name. Views run RLS against
-- the querying role's own privileges (not the view owner's), so viewers need
-- a narrow read path here or the view silently returns zero rows for them.

alter table persons enable row level security;

create policy persons_editor_all on persons
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy persons_viewer_via_participation on persons
  for select to authenticated
  using (
    current_role_of() = 'viewer'
    and exists (
      select 1 from participations p
      where p.person_id = persons.id
        and p.state_id is not null
        and has_state_access(p.state_id)
    )
  );

-- ============================================================
-- payments and payment_batches — viewers never touch these
-- ============================================================

alter table payments enable row level security;
alter table payment_batches enable row level security;

create policy payments_editor_only on payments
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy payment_batches_editor_only on payment_batches
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

-- ============================================================
-- import_runs and duplicate_reviews — editor/admin operational tables
-- ============================================================

alter table import_runs enable row level security;
alter table duplicate_reviews enable row level security;

create policy import_runs_editor_only on import_runs
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy duplicate_reviews_editor_only on duplicate_reviews
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

-- ============================================================
-- Reference tables
-- ============================================================
-- Supabase grants broad default table privileges to any authenticated user;
-- RLS is what actually restricts access. These six were not in the task list
-- alongside participations/persons/payments/payment_batches/duplicate_reviews/
-- import_runs, but leaving them RLS-disabled would let any signed-in viewer
-- write directly to reference data (categories, banks, rates...) via the API.
-- Read is open to every authenticated user because filter dropdowns need it;
-- writes are editor/admin only, matching FR-020's reference-data admin screen.

alter table editions   enable row level security;
alter table states     enable row level security;
alter table categories enable row level security;
alter table sports     enable row level security;
alter table committees enable row level security;
alter table banks      enable row level security;

create policy editions_read_all on editions
  for select to authenticated using (true);
create policy editions_write_editor_admin on editions
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy states_read_all on states
  for select to authenticated using (true);
create policy states_write_editor_admin on states
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy categories_read_all on categories
  for select to authenticated using (true);
create policy categories_write_editor_admin on categories
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy sports_read_all on sports
  for select to authenticated using (true);
create policy sports_write_editor_admin on sports
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy committees_read_all on committees
  for select to authenticated using (true);
create policy committees_write_editor_admin on committees
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

create policy banks_read_all on banks
  for select to authenticated using (true);
create policy banks_write_editor_admin on banks
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

-- rates carries payment amounts — financial data, so unlike the other
-- reference tables it is NOT readable by viewers at all (FR-013).
alter table rates enable row level security;
create policy rates_editor_admin_only on rates
  for all to authenticated
  using (current_role_of() in ('admin','editor'))
  with check (current_role_of() in ('admin','editor'));

-- ============================================================
-- User/access tables
-- ============================================================

alter table user_profiles       enable row level security;
alter table user_state_access   enable row level security;
alter table user_category_access enable row level security;
alter table access_logs         enable row level security;

create policy user_profiles_self_read on user_profiles
  for select to authenticated using (id = auth.uid());
create policy user_profiles_editor_admin_read on user_profiles
  for select to authenticated using (current_role_of() in ('admin','editor'));
create policy user_profiles_admin_write on user_profiles
  for all to authenticated
  using (current_role_of() = 'admin')
  with check (current_role_of() = 'admin');

create policy user_state_access_self_read on user_state_access
  for select to authenticated using (user_id = auth.uid());
create policy user_state_access_editor_admin_read on user_state_access
  for select to authenticated using (current_role_of() in ('admin','editor'));
create policy user_state_access_admin_write on user_state_access
  for all to authenticated
  using (current_role_of() = 'admin')
  with check (current_role_of() = 'admin');

create policy user_category_access_self_read on user_category_access
  for select to authenticated using (user_id = auth.uid());
create policy user_category_access_editor_admin_read on user_category_access
  for select to authenticated using (current_role_of() in ('admin','editor'));
create policy user_category_access_admin_write on user_category_access
  for all to authenticated
  using (current_role_of() = 'admin')
  with check (current_role_of() = 'admin');

-- access_logs: every authenticated user may write their own log row (server
-- actions log on the user's behalf); only admins may read the audit trail.
create policy access_logs_self_insert on access_logs
  for insert to authenticated with check (user_id = auth.uid());
create policy access_logs_admin_read on access_logs
  for select to authenticated using (current_role_of() = 'admin');

-- ============================================================
-- Views
-- ============================================================

grant select on participations_viewer_v to authenticated;
revoke all on participations_v from authenticated;
grant select on participations_v to authenticated;  -- RLS on base tables still applies
