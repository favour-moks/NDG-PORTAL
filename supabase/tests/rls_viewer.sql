-- Viewer RLS assertions: scoped to one state, zero financial access, and the
-- viewer view still reports the right payment status without exposing amounts
-- (see the payment_status_for() comment in 007_views.sql for why this needs
-- its own regression test — a naive EXISTS subquery against `payments` would
-- silently report "Pending" for every viewer, always).
begin;
create extension if not exists pgtap;
select plan(7);

select gen_random_uuid() as edition_id       \gset
select gen_random_uuid() as state_mine_id    \gset
select gen_random_uuid() as state_other_id   \gset
select gen_random_uuid() as category_id      \gset
select gen_random_uuid() as person_mine_id   \gset
select gen_random_uuid() as person_other_id  \gset
select gen_random_uuid() as person_uninserted_id \gset
select gen_random_uuid() as participation_mine_id  \gset
select gen_random_uuid() as participation_other_id \gset
select gen_random_uuid() as batch_id         \gset
select gen_random_uuid() as batch_creator_id \gset
select gen_random_uuid() as viewer_id        \gset

insert into editions (id, name, year, status) values
  (:'edition_id', 'RLS Viewer Test Edition', 2997, 'active');

insert into states (id, name, code) values
  (:'state_mine_id', 'RLS Viewer Test Mine', 'VTM'),
  (:'state_other_id', 'RLS Viewer Test Other', 'VTO');

insert into categories (id, name, group_key, is_state_scoped, requires_sport, requires_committee)
values (:'category_id', 'RLS Viewer Test Athletes', 'participants', true, false, false);

insert into persons (id, full_name, normalised_name, nin_hash) values
  (:'person_mine_id', 'Viewer Test Person Mine', 'mine person test viewer', 'viewer-test-hash-mine'),
  (:'person_other_id', 'Viewer Test Person Other', 'other person test viewer', 'viewer-test-hash-other'),
  (:'person_uninserted_id', 'Viewer Test Person Uninserted', 'uninserted person test viewer', 'viewer-test-hash-uninserted');

insert into participations (id, edition_id, person_id, category_id, state_id, account_number, bank_id, entitlement_amount) values
  (:'participation_mine_id', :'edition_id', :'person_mine_id', :'category_id', :'state_mine_id', '0033558463', null, 5000),
  (:'participation_other_id', :'edition_id', :'person_other_id', :'category_id', :'state_other_id', '0033558464', null, 5000);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (:'batch_creator_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rls-viewer-test-creator@example.local', crypt('test-password-123', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into payment_batches (id, edition_id, reference, filter_json, generated_by)
values (:'batch_id', :'edition_id', 'RLS-VIEWER-TEST-BATCH', '{}'::jsonb, :'batch_creator_id');

insert into payments (batch_id, participation_id, amount, account_number, bank_id, status)
values (:'batch_id', :'participation_mine_id', 5000, '0033558463', (select id from banks limit 1), 'paid');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (:'viewer_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rls-viewer-test@example.local', crypt('test-password-123', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
insert into user_profiles (id, full_name, role) values (:'viewer_id', 'RLS Test Viewer', 'viewer');
insert into user_state_access (user_id, state_id) values (:'viewer_id', :'state_mine_id');

-- Structural check — doesn't depend on the current role.
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'participations_viewer_v'
     and column_name in ('amount_paid', 'balance', 'entitlement_amount'))::int,
  0,
  'participations_viewer_v exposes no monetary column'
);

-- Switch to the viewer's authenticated session.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'viewer_id', 'role', 'authenticated')::text, true);

select is(
  (select count(*) from participations where state_id = :'state_mine_id')::int,
  1,
  'a viewer assigned to their state sees its participations'
);

select is(
  (select count(*) from participations where state_id = :'state_other_id')::int,
  0,
  'a viewer assigned to Delta-equivalent state gets zero rows for an unassigned state (Edo-equivalent)'
);

select is(
  (select count(*) from payments)::int,
  0,
  'a viewer gets zero rows from payments, unconditionally'
);

-- 42501 is Postgres's code for "new row violates row-level security policy".
select throws_ok(
  format($$ insert into participations (edition_id, person_id, category_id, state_id)
            values (%L, %L, %L, %L) $$,
         :'edition_id', :'person_uninserted_id', :'category_id', :'state_mine_id'),
  '42501',
  'a viewer cannot write to participations even within their own state'
);

select is(
  (select payment_status from participations_viewer_v where id = :'participation_mine_id'),
  'Paid',
  'the viewer view reports the correct payment status without the viewer having any payments access'
);

select is(
  (select count(*) from persons where id = :'person_other_id')::int,
  0,
  'a viewer cannot read a person whose only participation is outside their assigned state'
);

select * from finish();
rollback;
