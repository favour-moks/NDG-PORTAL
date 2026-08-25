-- TASK-072: a viewer's state scoping has no edition predicate — deliberate,
-- not an oversight (viewer policy in 008_rls.sql). Cross-state isolation is
-- already covered inline in rls_viewer.sql; this file's job is the other
-- half — proving the SAME viewer sees their state's records across every
-- edition, not just the one they signed in during.
begin;
create extension if not exists pgtap;
select plan(4);

select gen_random_uuid() as edition_current_id  \gset
select gen_random_uuid() as edition_previous_id \gset
select gen_random_uuid() as state_mine_id       \gset
select gen_random_uuid() as state_other_id      \gset
select gen_random_uuid() as category_id         \gset
select gen_random_uuid() as person_current_id   \gset
select gen_random_uuid() as person_previous_id  \gset
select gen_random_uuid() as person_other_id     \gset
select gen_random_uuid() as participation_current_id  \gset
select gen_random_uuid() as participation_previous_id \gset
select gen_random_uuid() as participation_other_id    \gset
select gen_random_uuid() as viewer_id           \gset

insert into editions (id, name, year, status) values
  (:'edition_current_id', 'Viewer States Test Edition Current', 8997, 'active'),
  (:'edition_previous_id', 'Viewer States Test Edition Previous', 8996, 'closed');

insert into states (id, name, code) values
  (:'state_mine_id', 'Viewer States Test Mine', 'VSM'),
  (:'state_other_id', 'Viewer States Test Other', 'VSO');

insert into categories (id, name, group_key, is_state_scoped, requires_sport, requires_committee)
values (:'category_id', 'Viewer States Test Athletes', 'participants', true, false, false);

insert into persons (id, full_name, normalised_name, nin_hash) values
  (:'person_current_id', 'Viewer States Person Current', 'current person states viewer', 'vs-test-hash-current'),
  (:'person_previous_id', 'Viewer States Person Previous', 'previous person states viewer', 'vs-test-hash-previous'),
  (:'person_other_id', 'Viewer States Person Other', 'other person states viewer', 'vs-test-hash-other');

-- Same state, two editions, plus one participation in an entirely
-- different state (in the current edition) to prove state scoping still
-- holds alongside the cross-edition visibility.
insert into participations (id, edition_id, person_id, category_id, state_id) values
  (:'participation_current_id', :'edition_current_id', :'person_current_id', :'category_id', :'state_mine_id'),
  (:'participation_previous_id', :'edition_previous_id', :'person_previous_id', :'category_id', :'state_mine_id'),
  (:'participation_other_id', :'edition_current_id', :'person_other_id', :'category_id', :'state_other_id');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (:'viewer_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rls-viewer-states-test@example.local', crypt('test-password-123', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
insert into user_profiles (id, full_name, role) values (:'viewer_id', 'RLS States Test Viewer', 'viewer');
insert into user_state_access (user_id, state_id) values (:'viewer_id', :'state_mine_id');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'viewer_id', 'role', 'authenticated')::text, true);

select is(
  (select count(*) from participations where id = :'participation_current_id')::int,
  1,
  'a Delta-equivalent viewer sees their state''s record in the current edition'
);

select is(
  (select count(*) from participations where id = :'participation_previous_id')::int,
  1,
  'the SAME viewer sees their state''s record in a previous, closed edition too — no edition predicate, by design'
);

select is(
  (select count(*) from participations where id = :'participation_other_id')::int,
  0,
  'the same viewer gets zero rows for an Edo-equivalent state, by direct id, even in the current edition'
);

select is(
  (select count(*) from participations
   where state_id = :'state_mine_id' and edition_id in (:'edition_current_id', :'edition_previous_id'))::int,
  2,
  'listing by state alone (no edition filter) returns both editions'' worth of the assigned state''s records'
);

select * from finish();
rollback;
