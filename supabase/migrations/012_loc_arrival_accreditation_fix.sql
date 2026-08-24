-- 011_arrival_requirement.sql was amended after it had already been applied
-- to this project (to add the LOC correction and fix seed.sql's upsert
-- behaviour) — amending an applied migration doesn't get replayed, so this
-- separate migration carries the same fix forward for databases that ran
-- the original 011. 011 itself is correct as written for any fresh
-- database created from scratch.
update categories set requires_arrival_accreditation = false where name = 'LOC';
