-- Filtering: every list screen filters by edition + category, then narrows.
create index idx_part_edition_category on participations (edition_id, category_id);
create index idx_part_edition_state    on participations (edition_id, state_id);
create index idx_part_sport            on participations (sport_id) where sport_id is not null;
create index idx_part_committee        on participations (committee_id) where committee_id is not null;
create index idx_part_bank             on participations (bank_id);

-- Eligibility filtering is the hottest path — partial index keeps it small.
create index idx_part_payable on participations (edition_id, category_id)
  where is_payable = true;

-- Duplicate detection: exact identifier match without decrypting.
create index idx_persons_bvn_hash on persons (bvn_hash) where bvn_hash is not null;
create index idx_persons_nin_hash on persons (nin_hash) where nin_hash is not null;

-- Trigram fallback for records missing an identifier. Requires the operator class,
-- or similarity() sequential-scans and dedup becomes unusable.
create index idx_persons_name_trgm on persons using gin (normalised_name gin_trgm_ops);

-- Account-number matching (secondary signal only — never a person key).
create index idx_part_account on participations (account_number)
  where account_number is not null;

-- Payment aggregation for balance computation.
create index idx_payments_participation on payments (participation_id, status);
create index idx_payments_batch on payments (batch_id);

-- Review queue.
create index idx_reviews_open on duplicate_reviews (edition_id, status)
  where status = 'open';

-- Audit queries.
create index idx_access_logs_user_time on access_logs (user_id, created_at desc);

-- Default alphabetical ordering (product principle: every list is alphabetical
-- until told otherwise).
create index idx_persons_name_sort on persons (full_name);
