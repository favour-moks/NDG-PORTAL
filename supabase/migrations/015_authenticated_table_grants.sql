-- RLS policies (008_rls.sql onward) restrict WHICH rows the authenticated
-- role can see or write, but Postgres checks baseline table-level
-- privilege first — RLS narrows what a grant already allows, it doesn't
-- substitute for one. Hosted Supabase projects get broad default grants
-- automatically as part of the platform's own provisioning (roughly
-- `alter default privileges ... grant all on tables to authenticated`),
-- which is why every migration up to this one worked correctly against
-- the live hosted project. But a plain `supabase start` / CI instance
-- built purely from these migrations does not get that platform-level
-- bootstrapping — every query as `authenticated` failed with "permission
-- denied for table participations" regardless of what the RLS policies
-- said, caught the first time the pgTAP suite actually ran in CI (Docker
-- was never available in any environment this was built in before then).
-- Explicit grants here make the schema fully self-contained on any
-- Postgres, not just a Supabase-hosted one.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  editions, states, categories, sports, committees, banks, rates,
  persons, participations,
  payment_batches, payments,
  import_runs, duplicate_reviews,
  user_profiles, user_state_access, user_category_access,
  access_logs
to authenticated;

-- access_logs.id is bigserial — INSERT needs USAGE on its sequence too.
grant usage, select on all sequences in schema public to authenticated;
