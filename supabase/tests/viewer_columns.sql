-- FR-013 / TASK-071: participations_viewer_v must carry zero numeric/money-
-- typed columns — not just the three currently-named ones (amount_paid,
-- balance, entitlement_amount). Checking by data_type rather than by name
-- is what makes this fail automatically if a future migration adds a new
-- money column to the view without updating this test, per the task's own
-- verify criterion ("suite fails if a money column is ever added").
begin;
create extension if not exists pgtap;
select plan(2);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'participations_viewer_v'
     and data_type in ('numeric', 'money')
  )::int,
  0,
  'participations_viewer_v has zero numeric/money-typed columns'
);

-- Sanity check: proves the query above isn't vacuously true because of a
-- typo in table/schema name — payments.amount is a real numeric column
-- elsewhere in the schema, and this same style of query finds it.
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'payments'
     and column_name = 'amount' and data_type = 'numeric'
  )::int,
  1,
  'sanity check: the information_schema query correctly finds a real money column on another table'
);

select * from finish();
rollback;
