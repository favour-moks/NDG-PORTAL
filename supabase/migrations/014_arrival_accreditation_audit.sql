-- TASK-035 requires recording the acting user for manual desk
-- accreditation, but there was no column for it — arrival_source only
-- records the method ('biometric_feed' | 'manual_desk'), not who.
alter table participations add column arrival_accredited_by uuid references auth.users(id);
