-- is_payable cannot be written through any path, each of the four
-- conditions independently blocks payability, and revoking accreditation
-- after a batch leaves the historical batch untouched (TASK-039).
begin;
create extension if not exists pgtap;
select plan(10);

select gen_random_uuid() as edition_id                        \gset
select gen_random_uuid() as state_id                          \gset
select gen_random_uuid() as category_arrival_required_id      \gset
select gen_random_uuid() as category_arrival_not_required_id  \gset
select gen_random_uuid() as person1_id \gset
select gen_random_uuid() as person2_id \gset
select gen_random_uuid() as person3_id \gset
select gen_random_uuid() as person4_id \gset
select gen_random_uuid() as person5_id \gset
select gen_random_uuid() as participation1_id \gset
select gen_random_uuid() as participation2_id \gset
select gen_random_uuid() as participation3_id \gset
select gen_random_uuid() as participation4_id \gset
select gen_random_uuid() as participation5_id \gset
select gen_random_uuid() as batch_creator_id \gset
select gen_random_uuid() as batch_id \gset

insert into editions (id, name, year, status) values (:'edition_id', 'Eligibility Test Edition', 8999, 'active');
insert into states (id, name, code) values (:'state_id', 'Eligibility Test State', 'ETS');
insert into categories (id, name, group_key, is_state_scoped, requires_arrival_accreditation) values
  (:'category_arrival_required_id', 'Eligibility Test Athletes', 'participants', true, true),
  (:'category_arrival_not_required_id', 'Eligibility Test LOC', 'personnel', false, false);

insert into persons (id, full_name, normalised_name, nin_hash) values
  (:'person1_id', 'Eligibility Person One', 'eligibility one person', 'elig-test-hash-1'),
  (:'person2_id', 'Eligibility Person Two', 'eligibility person two', 'elig-test-hash-2'),
  (:'person3_id', 'Eligibility Person Three', 'eligibility person three', 'elig-test-hash-3'),
  (:'person4_id', 'Eligibility Person Four', 'eligibility four person', 'elig-test-hash-4'),
  (:'person5_id', 'Eligibility Person Five', 'eligibility five person', 'elig-test-hash-5');

-- Baseline: fully accredited, bank details present, arrival required and met.
insert into participations (id, edition_id, person_id, category_id, state_id, requires_arrival_accreditation, pre_games_accredited, arrival_accredited, account_number, bank_id)
values (:'participation1_id', :'edition_id', :'person1_id', :'category_arrival_required_id', :'state_id', true, true, true, '0011223301', (select id from banks limit 1));

-- Plain 2-arg form (sql, errcode) — see supabase/tests/rls_editor.sql for
-- why a third text argument isn't used (it's matched against the actual
-- error message, not treated as a free-form description). 428C9 is
-- Postgres's code for "generated column can only be updated to DEFAULT".
select throws_ok(
  format($$ update participations set is_payable = true where id = %L $$, :'participation1_id'),
  '428C9'
);

select is(
  (select is_payable from participations where id = :'participation1_id'),
  true,
  'a fully accredited participation with bank details is payable'
);

-- Condition 1: not pre-games accredited.
insert into participations (id, edition_id, person_id, category_id, state_id, requires_arrival_accreditation, pre_games_accredited, arrival_accredited, account_number, bank_id)
values (:'participation2_id', :'edition_id', :'person2_id', :'category_arrival_required_id', :'state_id', true, false, true, '0011223302', (select id from banks limit 1));

select is(
  (select is_payable from participations where id = :'participation2_id'),
  false,
  'not pre-games accredited blocks payability independently'
);

-- Condition 2: not arrival accredited, when the category requires it.
insert into participations (id, edition_id, person_id, category_id, state_id, requires_arrival_accreditation, pre_games_accredited, arrival_accredited, account_number, bank_id)
values (:'participation3_id', :'edition_id', :'person3_id', :'category_arrival_required_id', :'state_id', true, true, false, '0011223303', (select id from banks limit 1));

select is(
  (select is_payable from participations where id = :'participation3_id'),
  false,
  'not arrival accredited blocks payability independently, when the category requires it'
);

-- Condition 2, contrast case: a category that does NOT require arrival
-- accreditation (LOC-style, TASK-033) is payable without it.
insert into participations (id, edition_id, person_id, category_id, requires_arrival_accreditation, pre_games_accredited, arrival_accredited, account_number, bank_id)
values (:'participation4_id', :'edition_id', :'person4_id', :'category_arrival_not_required_id', false, true, false, '0011223304', (select id from banks limit 1));

select is(
  (select is_payable from participations where id = :'participation4_id'),
  true,
  'a category with requires_arrival_accreditation = false is payable without arrival accreditation'
);

-- Condition 3: missing bank details.
insert into participations (id, edition_id, person_id, category_id, state_id, requires_arrival_accreditation, pre_games_accredited, arrival_accredited, account_number, bank_id)
values (:'participation5_id', :'edition_id', :'person5_id', :'category_arrival_required_id', :'state_id', true, true, true, null, null);

select is(
  (select is_payable from participations where id = :'participation5_id'),
  false,
  'missing bank details blocks payability independently'
);

-- Condition 4: withdrawn.
update participations set exclusion_reason = 'test withdrawal' where id = :'participation1_id';

select is(
  (select is_payable from participations where id = :'participation1_id'),
  false,
  'a withdrawn participation (exclusion_reason set) is not payable, independently of accreditation'
);

-- Revoking accreditation after a batch leaves the historical batch untouched.
update participations set exclusion_reason = null where id = :'participation1_id';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (:'batch_creator_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'eligibility-test-creator@example.local', crypt('test-password', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into payment_batches (id, edition_id, reference, filter_json, generated_by, total_amount, record_count)
values (:'batch_id', :'edition_id', 'ELIGIBILITY-TEST-BATCH', '{}'::jsonb, :'batch_creator_id', 5000, 1);

insert into payments (batch_id, participation_id, amount, account_number, bank_id, status)
values (:'batch_id', :'participation1_id', 5000, '0011223301', (select id from banks limit 1), 'paid');

-- Accreditation is revoked after the batch already exists.
update participations set arrival_accredited = false where id = :'participation1_id';

select is(
  (select is_payable from participations where id = :'participation1_id'),
  false,
  'revoking accreditation after a batch makes the participation non-payable going forward'
);

select is(
  (select status from payments where batch_id = :'batch_id' and participation_id = :'participation1_id'),
  'paid',
  'the historical payment status is untouched by the later accreditation change'
);

select is(
  (select amount from payments where batch_id = :'batch_id' and participation_id = :'participation1_id')::numeric,
  5000::numeric,
  'the historical payment amount is untouched by the later accreditation change'
);

select * from finish();
rollback;
