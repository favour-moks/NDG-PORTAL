-- A closed edition is read-only for every role, including editors and
-- admins. This exercises the `as restrictive` policy in 008_rls.sql —
-- without `restrictive`, participations_editor_all would silently permit
-- the write anyway, since permissive policies are OR'd together.
--
-- Note: an UPDATE blocked by a restrictive USING clause does not raise an
-- exception — RLS filters the row out before the UPDATE ever sees it, the
-- same way a WHERE clause that matches nothing does. So these assertions
-- check affected-row counts, not thrown errors.
begin;
create extension if not exists pgtap;
select plan(4);

select gen_random_uuid() as closed_edition_id \gset
select gen_random_uuid() as open_edition_id   \gset
select gen_random_uuid() as state_id          \gset
select gen_random_uuid() as category_id       \gset
select gen_random_uuid() as person_closed_id  \gset
select gen_random_uuid() as person_open_id    \gset
select gen_random_uuid() as participation_closed_id \gset
select gen_random_uuid() as participation_open_id   \gset
select gen_random_uuid() as editor_id         \gset

insert into editions (id, name, year, status, closed_at) values
  (:'closed_edition_id', 'RLS Closed Test Edition', 2996, 'closed', now()),
  (:'open_edition_id', 'RLS Open Test Edition', 2995, 'active');

insert into states (id, name, code) values (:'state_id', 'RLS Closed Test State', 'CTS');

insert into categories (id, name, group_key, is_state_scoped, requires_sport, requires_committee)
values (:'category_id', 'RLS Closed Test Athletes', 'participants', true, false, false);

insert into persons (id, full_name, normalised_name, nin_hash) values
  (:'person_closed_id', 'Closed Edition Test Person', 'closed edition person test', 'closed-test-hash'),
  (:'person_open_id', 'Open Edition Test Person', 'open edition person test', 'open-test-hash');

insert into participations (id, edition_id, person_id, category_id, state_id) values
  (:'participation_closed_id', :'closed_edition_id', :'person_closed_id', :'category_id', :'state_id'),
  (:'participation_open_id', :'open_edition_id', :'person_open_id', :'category_id', :'state_id');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (:'editor_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rls-closed-edition-test@example.local', crypt('test-password-123', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
insert into user_profiles (id, full_name, role) values (:'editor_id', 'RLS Closed Test Editor', 'editor');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'editor_id', 'role', 'authenticated')::text, true);

select is(
  (select count(*) from participations where edition_id = :'closed_edition_id')::int,
  1,
  'a closed edition remains readable — read-only means writes are blocked, not that it disappears'
);

select is(
  (with updated as (
     update participations set exclusion_reason = 'test withdrawal'
     where id = :'participation_closed_id'
     returning id
   )
   select count(*) from updated)::int,
  0,
  'an editor update targeting a participation in a closed edition affects zero rows'
);

select is(
  (with updated as (
     update participations set exclusion_reason = 'test withdrawal'
     where id = :'participation_open_id'
     returning id
   )
   select count(*) from updated)::int,
  1,
  'the same editor can update a participation in an open edition (control — the block is edition-specific)'
);

select is(
  (select exclusion_reason from participations where id = :'participation_closed_id'),
  null,
  'the blocked update did not silently partially apply'
);

select * from finish();
rollback;
