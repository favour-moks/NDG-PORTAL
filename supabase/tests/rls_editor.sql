-- Editor/admin RLS assertions, and the one thing no role can do:
-- write to the generated is_payable column.
--
-- Fixtures are inserted as the `postgres` superuser, which bypasses RLS.
-- Assertions run after `set local role authenticated` plus a fake JWT via
-- set_config('request.jwt.claims', ...) so auth.uid() resolves to the test
-- user — the standard way to exercise RLS policies inside pgTAP.
begin;
create extension if not exists pgtap;
select plan(5);

select gen_random_uuid() as edition_id      \gset
select gen_random_uuid() as other_edition_id \gset
select gen_random_uuid() as state_a_id      \gset
select gen_random_uuid() as state_b_id      \gset
select gen_random_uuid() as category_id     \gset
select gen_random_uuid() as person_a_id     \gset
select gen_random_uuid() as person_b_id     \gset
select gen_random_uuid() as editor_id       \gset

insert into editions (id, name, year, status) values
  (:'edition_id', 'RLS Test Edition', 2999, 'active'),
  (:'other_edition_id', 'RLS Test Edition Two', 2998, 'draft');

insert into states (id, name, code) values
  (:'state_a_id', 'RLS Test State A', 'TSA'),
  (:'state_b_id', 'RLS Test State B', 'TSB');

insert into categories (id, name, group_key, is_state_scoped, requires_sport, requires_committee)
values (:'category_id', 'RLS Test Athletes', 'participants', true, false, false);

insert into persons (id, full_name, normalised_name, nin_hash) values
  (:'person_a_id', 'Editor Test Person A', 'a editor person test', 'editor-test-hash-a'),
  (:'person_b_id', 'Editor Test Person B', 'b editor person test', 'editor-test-hash-b');

insert into participations (id, edition_id, person_id, category_id, state_id) values
  (gen_random_uuid(), :'edition_id', :'person_a_id', :'category_id', :'state_a_id'),
  (gen_random_uuid(), :'other_edition_id', :'person_b_id', :'category_id', :'state_b_id');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  :'editor_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'rls-editor-test@example.local', crypt('test-password-123', gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'
);
insert into user_profiles (id, full_name, role) values (:'editor_id', 'RLS Test Editor', 'editor');

-- Switch to the editor's authenticated session for the rest of this test.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'editor_id', 'role', 'authenticated')::text, true);

select is(
  (select count(*) from participations where edition_id in (:'edition_id', :'other_edition_id'))::int,
  2,
  'editor sees participations across every state and edition, not just their own'
);

select lives_ok(
  format($$ update participations set exclusion_reason = 'test withdrawal' where edition_id = %L $$, :'edition_id'),
  'editor can write to participations in an open edition'
);

select throws_ok(
  format($$ update participations set is_payable = true where edition_id = %L $$, :'edition_id'),
  'is_payable is a generated column — no role can write it directly, regardless of permissions'
);

select is(
  (select count(*) from user_profiles where id = :'editor_id')::int,
  1,
  'editor can read their own profile'
);

select is(
  (select count(*) from banks)::int > 0,
  true,
  'editor can read reference data (banks) needed for filters'
);

select * from finish();
rollback;
