# Product Idea — NDG Payment & Accreditation Portal

## One-liner

A permanent system of record for the Niger Delta Games that decides who is eligible to be paid each edition and produces the disbursement file that actually pays them — built for the NDG Secretariat's payment lead, who currently holds that answer across nine state spreadsheets.

**Scope note:** this is an internal system for NDG only. It will not be sold or licensed to other events. "Reusable" means NDG runs every future edition on it — which makes edition/year scoping an architectural requirement rather than a feature.

## Background

Favour works at Crestpoint Consulting, which is already delivering NDG accreditation and payment support by hand: per-state final reports for Abia, Akwa Ibom, Bayelsa and Cross River were written manually, and payment reports like the Edo coaches file are assembled after the fact from a third-party vendor's transaction exports. The 33-section portal specification is a description of a process Crestpoint already runs — which is why the idea is credible and why the scope is dangerous. The next edition of the Games is under three months away, and the build is solo with AI coding tools.

## The problem

Nobody can currently answer "who has been accredited, who is eligible, and who has actually been paid?" without opening several state workbooks and a stack of Word reports. During Games week that question is asked hourly by people with authority, and the answer arrives late and sometimes wrong.

The expensive failures are ghost beneficiaries and double payments — real money out the door, plus audit and reputational exposure afterwards. The everyday version is measurable in the existing data: in the February 2026 Edo coaches batch, three of thirty-four records disappeared from the success report entirely (vendor codes 23340, 23349, 23356), and because the current process only captures `SUCCESSFUL` rows, nothing flagged them. Failures are invisible today.

Today's coping mechanism is the master spreadsheet, WhatsApp threads, printed DRM lists signed at the accreditation desk, and schedules handed to a third-party payment vendor (Dunamis-Icon Limited is the company of record on every Edo transaction). It works. It is slow and error-prone, but it has shipped payments for previous editions and everyone knows how to operate it.

## Target user

**The NDG Secretariat's payment/finance lead** — the specific individual who owns the master beneficiary spreadsheet today, assembles disbursement schedules for the payment vendor, and takes the call when a state complains its coaches were not paid. One person, known by name, working across nine states (Abia, Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Imo, Ondo, Rivers) and roughly a dozen beneficiary categories under a fixed event deadline.

Secondary users: **state liaisons**, who need read-only access to their own state's participants and non-financial payment status without being able to see amounts or other states.

## Proposed solution

An eligibility-to-disbursement spine, edition-scoped from the first migration:

1. Import beneficiaries per edition, state and category against a template that mandates a person identifier (BVN or NIN, at least one required).
2. Deduplicate within and across editions, surfacing conflicts for editor review rather than silently deleting.
3. Hold accreditation status per person per edition, linking pre-games accreditation to arrival verification.
4. **Emit the disbursement file in the exact format the payment partner accepts** — correctly formatted, deduplicated, eligibility-checked.
5. Import the payment result file back and reflect per-person status.
6. Role-scoped access (editor; state-limited viewer) and export that respects applied filters.

**Magic moment:** the payment lead applies a filter — 2026 → Delta → Basketball → eligible — clicks once, and gets a disbursement file the payment vendor accepts without a single manual correction. The moment that file is the thing that moves money, the master spreadsheet stops being the source of truth.

### Multi-edition requirements

Every category's headcount and every payment amount changes between editions, so the system must be edition-aware at the schema level, not through a filter bolted on afterwards:

- **People are separate from participation.** A person record keyed on BVN/NIN persists across editions; an edition-participation record holds category, state, sport, committee, rate, accreditation status, payment status and bank details. The same individual can be a Delta athlete one edition and an Edo coach the next without being duplicated.
- **Bank details attach to the participation, not the person** — the account used for a payment must stay attached to that payment permanently for audit.
- **Configuration is data, not code.** Categories, committees, sports, states and roles all change between editions. Hardcoded enums mean edition two needs a developer.
- **Rates are a table:** edition × category (× sport or role where needed) → amount. Entitlement is separate from payment, since a category can be paid across several batches.
- **Editions have a lifecycle** — draft → active → closed — and closed editions become read-only so the audit trail holds.
- **Edition rollover** lets an editor seed a new edition from the previous one (LOC committees, technical officials, vendors) then edit down. This is what makes the second edition cheaper than the first.
- **The Games run annually**, so "year" is a valid label and the next edition begins roughly twelve months after this one. Rollover therefore pays back quickly and should be the first thing built after this edition ships — not a distant nice-to-have.
- **Editors set the active edition; viewers receive it — but state liaisons can browse their own state's full history across all editions.** Financial restrictions still apply in every year: no amounts, no disbursement totals, no expenditure. Access is scoped by state across time, not by active edition.
- **Historical data is imported as reference-only, never as authoritative.** Records from previous editions exist but are scattered and of uncertain quality. They must carry a `reference` flag so duplicate detection can *warn* ("possible match in 2025 reference data — review") without ever blocking a payment. Dirty history that gates live eligibility would stop legitimate athletes being paid during Games week, which is a worse failure than the duplicates it is meant to prevent.

## Why you

Crestpoint is already doing this job manually and holds the data, the client relationship, and the domain knowledge. Favour has personally written the per-state final reports and has access to historical payment records, which means the build can be tested against real beneficiary data on day one rather than fixtures — a position most founders never get.

Evidence: existing per-state final reports (Abia, Akwa Ibom, Bayelsa, Cross River), the Edo coaches payment report covering two disbursement batches six weeks apart, and an executives database — all already in hand before a line of code is written.

## Candidates considered

Not applicable — direct validation run. This idea arrived as a complete 33-section specification rather than as one of several candidates.

## Risky assumptions

1. **The Secretariat will run payments *through* the portal, not *alongside* the spreadsheet.** The critical word is "through." A portal that receives payment results after the fact is a reporting layer; a portal that produces the file the payment partner acts on is the system of record. Same screens, entirely different business — and only the second one displaces the spreadsheet.

2. **The third parties who own arrival accreditation and wallet/ATM issuance will deliver usable data, on time, with a shared identifier.** Payment eligibility is defined as a function of biometric arrival accreditation, and payment itself as a function of wallet issuance — neither of which is under Favour's control. If that data arrives late or without a matching key, the eligibility gate degrades into manual reconciliation, which is the exact process being replaced.

3. **States will supply BVN or NIN in the pre-games upload.** Duplicate detection cannot work on name plus account number: the existing data shows mixed name casing (16 of 45 records ALL CAPS), inconsistent name ordering (given-name-first and surname-first within the same file), and mutually incompatible reference schemes between batches. Account number is the only field stable across batches, and it is not a person key. Under the multi-edition plan the identifier is also the only thing linking a person from one edition to the next — without it, every edition starts from zero. Collection rate is a first-order project risk, not a data-hygiene detail.

4. **The system will still be owned and funded between editions.** Internal tools rarely fail by being rejected; they fail by being rebuilt, because nobody owned them in the quiet period. A named owner inside the Secretariat, held credentials, and a paid hosting bill in the eighteen months after the Games are what make "reusable" true.

## Compliance

The portal holds biometric verification results, BVN/NIN, and bank details for roughly 2,500 people. Under the Nigeria Data Protection Act 2023, biometric data is explicitly sensitive personal data requiring a lawful basis and appropriate technical and organisational measures. Encrypt identifiers at rest, never display them in full, log what is accessed rather than only who logged in, agree in writing that the NDG Secretariat is the data controller and Crestpoint the processor, and set an explicit multi-edition retention policy. Confirm current thresholds and registration obligations with the NDPC or counsel — see `validation-report.md` for detail and sources.

## Decisions taken during validation

- **Reusability:** clarified — this is for NDG only, across editions. Never sold or licensed. Edition/year scoping is therefore a v1 architectural requirement, not a later feature.
- **MVP scope:** Cuts accepted. Deferred until the spine works — the executive dashboard and reports (Sections 19, 20, 27), the Upload Centre and checklist (25, 26), the wallet/card lifecycle states, Operations Committees financials (15), the Guests section, and any direct biometric device integration. The edition *schema* ships in v1; the edition *rollover screens* can wait until after this Games.
- **Identity key:** BVN or NIN, at least one required, mandated in the pre-games upload template.

## Next step

Run `/plaid` to walk through the Plan intake and generate the vision, PRD and roadmap. Two things should happen before the PRD is written: obtain the disbursement file specification from the payment partner, and settle the edition data model on paper. Those two artifacts determine everything else in the schema.
