-- TASK-038 requires recording who withdrew a participation and when, but
-- exclusion_reason alone can't carry that. Mirrors the accountability
-- pattern duplicate_reviews already uses (resolved_by/resolved_at).
alter table participations add column excluded_by uuid references auth.users(id);
alter table participations add column excluded_at timestamptz;
