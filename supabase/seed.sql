-- ============================================================
-- States — the nine Niger Delta states (NDDC Act), state-scoped
-- categories filter against these.
-- ============================================================

insert into states (name, code) values
  ('Abia', 'ABI'),
  ('Akwa Ibom', 'AKW'),
  ('Bayelsa', 'BAY'),
  ('Cross River', 'CRO'),
  ('Delta', 'DEL'),
  ('Edo', 'EDO'),
  ('Imo', 'IMO'),
  ('Ondo', 'OND'),
  ('Rivers', 'RIV');

-- ============================================================
-- Categories
-- Participants are state-scoped; personnel are not (PRD § 3).
-- ============================================================

-- requires_arrival_accreditation defaults to true for every category except
-- LOC: LOC members organise before the Games start and may not go through
-- venue arrival accreditation the way athletes/coaches/officials do. This
-- is a reasonable starting default, not a confirmed policy — flagged in
-- docs/infrastructure.md as needing the Secretariat's sign-off (PRD § 14
-- open question 3) before real payments depend on it.
-- ON CONFLICT DO UPDATE, not a plain INSERT: unique(name, group_key) means
-- a plain insert is a silent no-op against a database that already has
-- these rows, so a later edit to any value here (like requires_arrival_
-- accreditation) would never actually reach an already-seeded database.
insert into categories (name, group_key, is_state_scoped, requires_sport, requires_committee, sort_order, requires_arrival_accreditation) values
  ('Athletes', 'participants', true,  true,  false, 10, true),
  ('Coaches',  'participants', true,  true,  false, 20, true),
  ('LOC',                 'personnel', false, false, true,  30, false),
  ('MOC',                 'personnel', false, false, false, 40, true),
  ('Technical Leads',     'personnel', false, true,  false, 50, true),
  ('Technical Officials', 'personnel', false, true,  false, 60, true),
  ('State Liaisons',      'personnel', false, false, false, 70, true),
  ('Volunteers',          'personnel', false, false, false, 80, true)
on conflict (name, group_key) do update set
  is_state_scoped = excluded.is_state_scoped,
  requires_sport = excluded.requires_sport,
  requires_committee = excluded.requires_committee,
  sort_order = excluded.sort_order,
  requires_arrival_accreditation = excluded.requires_arrival_accreditation;

-- ============================================================
-- Sports — editable later via the reference-data admin screen (Phase 5)
-- without a deployment; this is a reasonable starting set.
-- ============================================================

insert into sports (name) values
  ('Athletics'), ('Badminton'), ('Basketball'), ('Boxing'), ('Chess'),
  ('Cycling'), ('Football'), ('Handball'), ('Judo'), ('Karate'),
  ('Rowing and Canoeing'), ('Swimming'), ('Table Tennis'), ('Taekwondo'),
  ('Tennis'), ('Volleyball'), ('Weightlifting'), ('Wrestling');

-- ============================================================
-- Committees — edition_id left null (applies to all editions);
-- also editable via the reference-data admin screen.
-- ============================================================

insert into committees (name) values
  ('Accreditation Committee'),
  ('Medical and Anti-Doping Committee'),
  ('Technical Committee'),
  ('Protocol Committee'),
  ('Media and Publicity Committee'),
  ('Security Committee'),
  ('Transport and Logistics Committee'),
  ('Welfare and Catering Committee'),
  ('Ceremonies Committee');

-- ============================================================
-- Banks — CBN/NIP institution codes and aliases.
--
-- IMPORTANT: these six-digit codes are the standard, widely-published CBN
-- interbank settlement codes. VERIFY them against an authoritative CBN/NIBSS
-- source before Phase 4 (disbursement) goes live — an incorrect institution
-- code is exactly the kind of silent error that could misroute a real
-- payment. Aliases cover the casing/naming variants expected from the Edo
-- fixture (TASK-014); add more as real import files surface new spellings.
-- ============================================================

insert into banks (id, name, aliases) values
  ('000014', 'Access Bank', array['ACCESS BANK', 'ACCESS', 'Access Bank Plc']),
  ('000004', 'United Bank for Africa', array['UNITED BANK FOR AFRICA', 'UBA', 'UBA PLC']),
  ('000016', 'First Bank of Nigeria', array['FIRST BANK', 'FIRSTBANK', 'FBN', 'First Bank of Nigeria Limited']),
  ('000003', 'First City Monument Bank', array['FCMB', 'First City Monument Bank Plc']),
  ('000007', 'Fidelity Bank', array['FIDELITY BANK', 'FIDELITY', 'Fidelity Bank Plc']),
  ('000013', 'Guaranty Trust Bank', array['GTBANK', 'GTB', 'GUARANTY TRUST BANK', 'Guaranty Trust Holding']),
  ('000002', 'Keystone Bank', array['KEYSTONE BANK', 'KEYSTONE']),
  ('000008', 'Polaris Bank', array['POLARIS BANK', 'POLARIS']),
  ('000012', 'Stanbic IBTC Bank', array['STANBIC IBTC BANK', 'STANBIC IBTC', 'STANBIC']),
  ('000001', 'Sterling Bank', array['STERLING BANK', 'STERLING']),
  ('000018', 'Union Bank of Nigeria', array['UNION BANK', 'UNION BANK OF NIGERIA']),
  ('000011', 'Unity Bank', array['UNITY BANK']),
  ('000017', 'Wema Bank', array['WEMA BANK', 'WEMA']),
  ('000015', 'Zenith Bank', array['ZENITH BANK', 'ZENITH']),
  ('000010', 'Ecobank Nigeria', array['ECOBANK', 'ECOBANK NIGERIA', 'ECO BANK']),
  ('000020', 'Heritage Bank', array['HERITAGE BANK', 'HERITAGE']),
  ('000009', 'Citibank Nigeria', array['CITIBANK', 'CITIBANK NIGERIA']),
  ('000021', 'Standard Chartered Bank', array['STANDARD CHARTERED', 'STANDARD CHARTERED BANK']),
  ('000023', 'Providus Bank', array['PROVIDUS BANK', 'PROVIDUS']);
