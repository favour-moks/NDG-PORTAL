-- amount_paid and balance (participations_v) are computed from `payments`,
-- never stored on the participation — two batches weeks apart for the same
-- person must sum correctly, and only 'paid' payments count toward
-- amount_paid (TASK-066).
begin;
create extension if not exists pgtap;
select plan(6);

select gen_random_uuid() as edition_id           \gset
select gen_random_uuid() as state_id             \gset
select gen_random_uuid() as category_id          \gset
select gen_random_uuid() as person_id            \gset
select gen_random_uuid() as participation_id     \gset
select gen_random_uuid() as generator_id         \gset
select gen_random_uuid() as batch1_id            \gset
select gen_random_uuid() as batch2_id            \gset

insert into editions (id, name, year, status) values (:'edition_id', 'Payment Aggregates Test Edition', 8998, 'active');
insert into states (id, name, code) values (:'state_id', 'Payment Aggregates Test State', 'PAT');
insert into categories (id, name, group_key, is_state_scoped, requires_arrival_accreditation) values
  (:'category_id', 'Payment Aggregates Test Athletes', 'participants', true, true);
insert into persons (id, full_name, normalised_name, nin_hash) values
  (:'person_id', 'Payment Aggregates Person', 'aggregates payment person', 'pay-agg-test-hash-1');

insert into participations (
  id, edition_id, person_id, category_id, state_id, requires_arrival_accreditation,
  pre_games_accredited, arrival_accredited, entitlement_amount, account_number, bank_id
) values (
  :'participation_id', :'edition_id', :'person_id', :'category_id', :'state_id', true,
  true, true, 150000, '0011229901', (select id from banks limit 1)
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (:'generator_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'payment-aggregates-test-generator@example.local', crypt('test-password', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- Baseline: entitled 150000, nothing paid yet.
select is(
  (select amount_paid from participations_v where id = :'participation_id'),
  0::numeric,
  'amount_paid is 0 before any batch'
);
select is(
  (select balance from participations_v where id = :'participation_id'),
  150000::numeric,
  'balance equals the full entitlement before any batch'
);

-- First batch, six weeks before the second — pays half.
insert into payment_batches (id, edition_id, reference, filter_json, generated_by, total_amount, record_count, generated_at)
values (:'batch1_id', :'edition_id', 'PAY-AGG-TEST-BATCH-1', '{}'::jsonb, :'generator_id', 75000, 1, now() - interval '6 weeks');
insert into payments (batch_id, participation_id, amount, account_number, bank_id, status)
values (:'batch1_id', :'participation_id', 75000, '0011229901', (select id from banks limit 1), 'paid');

select is(
  (select amount_paid from participations_v where id = :'participation_id'),
  75000::numeric,
  'amount_paid reflects the first batch alone'
);
select is(
  (select balance from participations_v where id = :'participation_id'),
  75000::numeric,
  'balance reflects the first batch alone'
);

-- Second batch, later — pays the remainder. A 'pending' row in the same
-- batch must NOT count toward amount_paid.
insert into payment_batches (id, edition_id, reference, filter_json, generated_by, total_amount, record_count)
values (:'batch2_id', :'edition_id', 'PAY-AGG-TEST-BATCH-2', '{}'::jsonb, :'generator_id', 75000, 1);
insert into payments (batch_id, participation_id, amount, account_number, bank_id, status)
values (:'batch2_id', :'participation_id', 75000, '0011229901', (select id from banks limit 1), 'pending');

select is(
  (select amount_paid from participations_v where id = :'participation_id'),
  75000::numeric,
  'a pending payment in the second batch does not add to amount_paid'
);

update payments set status = 'paid' where batch_id = :'batch2_id' and participation_id = :'participation_id';

select is(
  (select amount_paid from participations_v where id = :'participation_id'),
  150000::numeric,
  'amount_paid sums across both batches once both are paid'
);

select * from finish();
rollback;
