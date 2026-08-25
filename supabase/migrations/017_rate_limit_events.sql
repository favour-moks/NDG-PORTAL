-- Backing store for src/lib/rate-limit.ts — durable so a limit survives
-- across serverless invocations (an in-memory counter wouldn't), the same
-- reason import_runs already doubles as the counter for the import
-- limit. One row per attempt; old rows are never read once their window
-- has passed, so no cleanup job is required for correctness (only for
-- table growth, which is out of scope for this phase).
create table rate_limit_events (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_events_bucket_time on rate_limit_events (bucket, created_at desc);

-- Written from a direct postgres.js connection before a session exists
-- (sign-in attempts, by definition) — never through the RLS-scoped
-- client, so no authenticated-role grant or RLS policy applies here.
