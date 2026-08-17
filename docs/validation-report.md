# Validation Report — NDG Payment & Accreditation Portal

_Generated: 2026-08-15 · Revised after founder clarification on reusability_

_Inputs: `NDG Payment & Accreditation Portal` (33-section spec, 462 paragraphs), `Edo Coaches Payment Report.xlsx` (45 real disbursement records across 2 batches), founder answers on commercial frame, timeline, build capacity, and integration ownership._

> **Revision note.** The first version of this report treated "reusable" as *sold to other events* and scored the idea against a market that turned out not to exist in the plan. Favour clarified: the portal is for NDG only and will never be sold; **"reusable" means NDG keeps using it edition after edition.** That is a materially different and much better-founded proposition, and it removes the single weakest element of the original assessment. It also introduces a requirement — edition/year scoping — that is architectural rather than cosmetic, and is now the most consequential design decision in the project.

---

## Verdict

**Strong. Build it.**

A funded single buyer you already serve, a fixed deadline, real historical data in hand, and a process you personally run by hand today. With the product ambition removed, there is no market risk left to argue about — the only questions are delivery and longevity. Two risks decide the outcome: whether the portal **emits the disbursement file** rather than merely reporting on payments made elsewhere, and whether the **edition model is built into the schema from day one** rather than bolted on for the second Games. The first determines whether it displaces the spreadsheet. The second determines whether it survives past this edition, which is the entire point of the clarified plan.

---

## Scorecard

Two rows are reinterpreted for an internal multi-edition system: "buyer clarity" now means clarity of the single customer rather than of a market, and "differentiation" means displacement of the incumbent process rather than advantage over competitors.

| Area | Score | Read |
|---|---:|---|
| Pain intensity | 5/5 | Nine states, multiple categories, real money, audit exposure, hard event date. The Edo file shows the same category paid in two runs six weeks apart — reconciliation is already painful enough to leave a paper trail. |
| Buyer clarity | 5/5 | One buyer, known, funded, already engaged, with a named individual owner of the problem. No market discovery required. Revised up from 3/5 once the "sell to other events" ambition was withdrawn. |
| Urgency | 5/5 | Under 90 days to a fixed Games date. Nothing concentrates scope like an event that cannot slip. |
| Differentiation | 3/5 | Not about competitors — about displacing the master spreadsheet. The wedge is real but narrow: only the disbursement file does it. Nothing else in the 33 sections displaces anything on its own. |
| Speed to validate | 4/5 | You hold real historical beneficiary data and can put a build in front of the actual decision-maker this week. Docked one point because arrival accreditation and wallet issuance are owned by third parties you do not control. |
| Founder advantage | 5/5 | Crestpoint is already delivering this manually; you have written the per-state final reports yourself (Abia, Akwa Ibom, Bayelsa, Cross River) and hold the payment data. Textbook founder-market fit. |

**Total: 27/30.** The single remaining soft spot is displacement — and it has a specific, buildable answer.

---

## Core Assumption

_The NDG Secretariat will run each edition's payments **through** the portal as the system of record — not alongside the master spreadsheet they already trust — and will still be doing so at the next edition._

The critical word is **"through," not "alongside."** A portal that receives payment results after the fact is a reporting layer. A portal that produces the file the payment partner acts on is the system of record. Same screens, entirely different outcome.

The clarified multi-edition scope adds a second clause with its own failure mode. A system that is genuinely re-used across editions is not the same artifact as one that happens to still exist in two years: it needs edition-scoped data, configuration held as data rather than code, a clean handover path, and someone whose job it is to run it. Most internal tools fail this test quietly — they work brilliantly once, then get rebuilt from scratch next cycle because nobody could adapt them.

---

## Fatal Flaws

Ranked by severity.

| Risk | Severity | Why It Matters | Fast Test |
|---|---|---|---|
| **You do not own arrival accreditation or wallet issuance, but your core promise depends on both** | High | Sections 5, 8 and 9 make payment eligibility a function of biometric arrival accreditation, and payment itself a function of wallet/ATM issuance. You marked both as someone else's problem. If their data arrives late, in an unusable shape, or with no shared identifier, the eligibility gate silently degrades into manual reconciliation — which is exactly the process you are replacing. Under 90 days, there is no room to discover this in month two. | This week, one email to each owner: "Send me a sample record and tell me which field uniquely identifies a person." If neither can produce a sample in five working days, you are building a reporting tool. Plan accordingly rather than hoping. |
| **There is no unique person identifier anywhere in the data — so Section 18 duplicate checking cannot work as specified, and cross-edition history is impossible** | High | Section 18 proposes matching on Name + Account Number + Account Name + Bank. The real Edo file shows why that fails (see Evidence). Account number is the only field stable across batches, and it is not a person key — one person can hold several, and beneficiaries frequently submit a relative's. Without NIN or BVN you get false positives (blocking legitimate athletes at a payment desk) and false negatives (double payments). **Under the multi-edition plan this doubles in importance:** the identifier is also the only thing that links a person from the 2026 edition to the 2028 one. Without it, every edition starts from zero and "has this person been paid before?" is unanswerable forever. | Add a mandatory BVN-or-NIN column to the pre-games upload template **before** the states submit. Retrofitting an identifier after nine states have uploaded is a different and much worse project; retrofitting it after a completed edition is worse still. |
| **The edition model is architectural and cannot be added later without a rewrite** | High | "Add a year dropdown" sounds like a feature. It is not. If `year` is a column on a flat beneficiary table, the second edition duplicates every person, rates cannot vary by category and edition, closed editions stay editable, and cross-edition history is lost. The correct shape separates **people** (durable, identified by BVN/NIN) from **edition participation** (category, state, sport, committee, rate, accreditation status, payment status — all scoped to one edition). Getting this wrong is not a bug you fix later; it is a migration you cannot afford during Games week. | Model two editions on paper before writing schema. Put the same athlete in 2026 as a Delta basketball player and in 2028 as an Edo coach, at different rates. If the schema cannot express that without duplicating the person, it is wrong. |
| **The spec is a 6–9 month scope and you have under 3 months solo** | High | 33 sections: four role-scoped areas, two-stage accreditation, wallet lifecycle states, batch payments with installments, an upload centre rated for ~1,000 files, a dedup engine, an executive dashboard, per-state viewer permissions, login auditing, and filter-respecting PDF/Excel export — now plus edition scoping. AI coding tools compress the CRUD, not the integrations, the data cleaning, or the stakeholder loops, and those are where this project actually lives. | Choose what to cut deliberately this week (see MVP below). If you do not, the Games date will choose for you, and it will cut whatever happens to be unfinished — which will not be the dashboard. |

### Evidence from the real data

Measured directly against `Edo Coaches Payment Report.xlsx` — 45 successful records, one state, one category:

- **The two batches use mutually incompatible reference schemes.** February used `NDG34892`–`NDG34925` with vendor codes `COA23333`–`COA23366`. April used reference strings like `IYOsWUNA 151` and vendor codes like `OMOPEKaUNOLA 63` — mangled text with inconsistent internal casing, almost certainly manual entry or a template that was never cleaned. **No field identifies the same person across the two batches.** If this is true within one state and one category in one edition, it will certainly be true across editions.
- **Three records are missing from the February sequence** — vendor codes 23340, 23349 and 23356 and their matching references are absent, though transaction IDs run contiguously. Roughly 9% of that batch was never submitted for payment, or was handled another way. The report contains only `SUCCESSFUL` rows, so **failures and exclusions are invisible in the current process.** This matters directly: Section 11 asks for Paid / In Progress / Pending, and today no data source produces the last two.
- **Name formatting is inconsistent in both case and order.** 16 of 45 records are ALL CAPS, the rest title case, mixed within the same batch. Order varies too — `Kate George` and `Godwin Olueh` read given-name-first, while `Ashofor Rachael Ige`, `MADWEGWU JOSEPHINE NKECHI` and `OSUAGWU CHIMA GODWIN` read surname-first. Any naive name match across states will miss real duplicates and flag false ones.
- **A near-miss that will bite fuzzy matching.** All four Fidelity accounts share the same first five digits — `5332721095`, `5332723288`, `5332723329`, `5332728324` — and two of them differ only in their final three. These are four different people. Fuzzy or edit-distance matching on account number is not safe here.
- **All 45 account numbers are correctly-formed 10-digit NUBANs — and 16 of them begin with a leading zero**, two with three leading zeros (`0005206866`, `0002662225`). Any import path that touches Excel as a number type will silently destroy those (`0033558463` → `33558463`) and the payment will fail. Force text on import and validate the 10-digit format.
- **Bank names are free text with inconsistent casing** (`Polaris Bank` against `ZENITH BANK`, `GTBANK`, `UNITED BANK FOR AFRICA`) across 11 institutions, and there are **no bank codes**. Disbursement files need CBN/NIP institution codes, not names. Map them once, centrally, and keep the mapping as reference data that survives editions.
- **Payments already ran through a third party** — `DUNAMIS-ICON LIMITED` is the company of record on every row. That is the existing payment rail and the most likely source of the file format you must produce.
- **The same category was paid in two runs six weeks apart** (26 Feb and 7 Apr), at a flat ₦105,000 each. Section 10's insistence on non-overwriting batches is not theoretical; it is a description of what already happens. Note also that a single flat rate applied to an entire category — which is exactly the kind of value that changes between editions.
- **Fields the portal needs that the current data does not carry at all:** accreditation status, sport (Section 14 wants coaches and officials filterable by sport), NIN/BVN, phone number, edition/year, and state — state is currently encoded only in the filename.

---

## Multi-Edition Design Requirements

The clarified scope makes these non-negotiable in v1, because none can be retrofitted cheaply.

**1. Separate people from participation.** A `person` record keyed on BVN/NIN persists across editions and holds name, identifier, and contact details. An `edition_participation` record holds everything that varies: edition, category, state, sport, committee, rate, accreditation status, payment status, bank details. The same individual can be a Delta athlete in one edition and an Edo coach in the next without being duplicated — and "has this person been paid in a previous edition?" becomes answerable, which is worth a great deal in an audit.

**2. Bank details belong to the participation, not the person.** People change banks and accounts between editions, and the account used for a given payment must stay attached to that payment permanently for audit purposes. Never overwrite historical account data.

**3. Configuration must be data, not code.** Categories, committees (roughly 16 LOC committees this edition, likely different next), sports, states, and user roles all change between editions. If any of them are hardcoded enums, edition two requires a developer. If they are database rows an editor can manage, it requires an afternoon. This is the difference between a system NDG re-uses and a system NDG rebuilds.

**4. Rates are a table, not a field.** Amounts change per edition *and* per category — Edo coaches were a flat ₦105,000 this edition. Model rate as `edition × category (× sport or role where needed) → amount`, then derive each person's entitlement. Keep entitlement separate from payment: the Edo data shows the same category paid across two batches, so paid-to-date and balance need to be computed rather than stored as a single figure.

**5. Editions need a lifecycle, and closed ones must lock.** Draft → active → closed. Once closed, records become read-only. Without this, someone edits 2026 figures in 2028 and the audit trail is worthless — which defeats the main reason an organisation handling public money keeps a system across editions.

**6. Build edition rollover — this is the feature that earns the multi-edition claim.** Starting a new edition should let an editor seed lists from the previous one (LOC committee members, technical officials, vendors — populations that change far less than athletes do), then edit down. Without rollover, every edition re-keys thousands of records from scratch and the portal saves nothing except reporting. With it, the second edition is dramatically cheaper than the first, and that is the argument that keeps the system funded.

**7. Viewers get a year; editors set it — and viewers can browse their own state's history.** Editors control which edition is active. State liaisons see their assigned state across *all* editions, so a liaison can answer "was this coach paid last year?" without going through the Secretariat. The financial restrictions of Section 21 still apply in every year: no amounts, no disbursement totals, no expenditure figures. Practically this means access is scoped by **state across time**, not by active edition — write the permission check that way from the start, because retrofitting a time dimension into a permission model is as painful as retrofitting one into a schema. It also raises the data-protection stakes: more people seeing more personal data over a longer window, which is an argument for logging what is viewed rather than only who logged in.

**8. Historical editions import as reference-only, never as authoritative.** Records from previous Games exist but are scattered and of uncertain quality — consistent with what the Edo file already shows about reference schemes and name formatting. Import them behind a `reference` flag so duplicate detection can *warn* ("possible match in 2025 reference data — review") without ever gating eligibility. Letting unreliable history block a payment is a worse failure than the duplicate it was meant to catch: a legitimate athlete turned away at a payment desk during Games week is visible, political, and immediate, while a duplicate is recoverable afterwards. Promote a historical edition to authoritative only if and when someone reconciles it deliberately.

**9. The Games run annually.** The next edition starts roughly twelve months after this one, which cuts both ways: continuity risk is lower because the system never goes cold, but rollover pays back within a year and should be the first thing built once this edition ships.

---

## Compliance: NDPA 2023

Not a flaw, but a real obligation that shapes the data model, and cheaper to design in than to retrofit.

The portal will hold **biometric verification data, BVN/NIN, and bank details** for what the spec's own worked example puts at around 2,500 accredited individuals. Under the Nigeria Data Protection Act 2023, **biometric data is explicitly sensitive personal data**, and processing it requires a lawful basis plus "appropriate technical and organisational measures" — encryption, resilience, testing, and a data protection impact assessment for high-risk processing. Reported guidance puts the threshold for a "data controller or processor of major importance" at roughly 2,000 data subjects for sensitive categories, which this project plausibly exceeds; the sanction for registration failure is up to ₦10 million or 2% of annual gross revenue, whichever is greater, and commentary suggests 2026 is the year the Commission shifts from education to enforcement.

Practical implications for the build:

- Encrypt BVN/NIN at rest, never display them in full in the UI or in exports, and log every access. The login-activity requirement in Section 23 is a good instinct — extend it to record *what* was viewed, not just that someone logged in.
- The **data controller is most likely the NDG Secretariat**, with Crestpoint acting as a processor. Get that in writing before Games week, along with who registers with the NDPC. Do not assume it has been handled.
- Multi-edition retention needs an explicit policy. "Keep everything forever" is not a lawful default for sensitive data; decide what is archived, what is anonymised, and when.

Treat the figures above as a prompt for a conversation with counsel, not as legal advice — thresholds, fees and deadlines have moved more than once and are worth confirming directly with the NDPC.

---

## Problem Reality

- **Pain:** Today nobody can answer "who has been paid, and who is still owed?" without opening several state workbooks and a stack of Word reports — you have been producing those reports by hand. During Games week that question gets asked hourly by people with authority, and the answer arrives late and sometimes wrong. The expensive failures are ghost beneficiaries and double payments: real money out the door, and audit and reputational exposure afterwards. The Edo file quantifies the smaller everyday version — 3 of 34 February records vanished from the success report and nothing in the current process flags them.
- **Early adopter:** Not "games organisers." It is the **NDG Secretariat's payment/finance lead** — the specific person who owns the master spreadsheet today and takes the call when a state complains its coaches were not paid. You almost certainly know their name. Everything about the MVP should be aimed at making that one person's Games week survivable.
- **Vitamin or painkiller:** **Painkiller.** Money, a fixed deadline, and audit exposure at once.

---

## Competition

- **Current behavior:** Per-state Excel workbooks, WhatsApp threads, printed DRM lists signed at accreditation desks, schedules handed to a third-party payment vendor (Dunamis-Icon), and manually written per-state final reports. This process works. It is slow and error-prone, but it has shipped payments for previous editions and everyone knows how to operate it.
- **Real enemy:** **The master spreadsheet and the person who owns it.** If the finance lead keeps their own workbook "just to be safe," the portal becomes a dashboard and the spreadsheet stays the truth — and you will have spent 90 days building a very expensive report. Second enemy, at the venue: the printed list at the accreditation desk, which beats any web app the moment the network drops. Plan for offline or for paper as an explicit fallback, not as a failure state. Third enemy, and the one specific to the multi-edition plan: **the next edition's temptation to start fresh.** Internal tools die by being rebuilt, not by being rejected.
- **Differentiation needed:** Be the only place that can produce **the disbursement file the payment partner actually accepts**, correctly formatted, deduplicated, and eligibility-checked. If the portal emits that file, the spreadsheet dies of natural causes because it can no longer produce the artifact that moves money. If the portal merely displays results, nothing is displaced.

---

## First Steps

Customer #1 is already yours, so these three actions lock the deployment rather than hunt for buyers.

1. **Sit with the NDG payment/finance lead for 45 minutes, screen shared, with last edition's actual files open.** Do not ask whether they would use a portal — they will say yes to be polite. Ask what broke, what they re-keyed by hand, which reconciliation took longest, and what they were asked for that they could not produce. _Success:_ you leave with their real working spreadsheet and the five columns they actually operate from. If they will not share the file, that is your answer about who owns the truth.

2. **Get the disbursement file specification from whoever owns the wallet and ATM side — Dunamis-Icon or whoever replaces them.** One email: "What format do you need the payment schedule in, which fields are mandatory, and how do you return results?" _Success:_ a sample file or a field list. This is the single highest-leverage artifact in the entire project — it defines your data model, your validation rules, and your wedge, and everything else should be built backwards from it.

3. **Settle ownership and continuity now, while you have leverage.** Who inside the Secretariat owns the system between editions? Who holds the hosting credentials and pays the bill in the eighteen quiet months after the Games? Who is the data controller for NDPA purposes? A tool with no owner between editions is rebuilt from scratch at the next one, which would waste the entire multi-edition investment. _Success:_ a named person and a written answer on each of the three.

---

## MVP

- **Build — the eligibility-to-disbursement spine, edition-scoped from the first migration.** Import beneficiaries per state and category against a template mandating BVN or NIN → deduplicate within and across editions → hold accreditation status per person per edition → **emit the disbursement file in the exact format the payment partner accepts** → import the result file back → per-person payment status. Plus the three things that cannot be added later without rework: **edition scoping**, role-scoped access (editor; state-limited viewer), and filter-respecting Excel/PDF export.

- **Cut — deliberately, this week:**
  - **Sections 19, 20 and 27 (dashboard and reports).** The most impressive-looking, least load-bearing part of the spec. A correct filtered export gets you 90% of the value; build the charts in the last two weeks if there are two weeks.
  - **Sections 25 and 26 (Upload Centre rated for ~1,000 files, plus checklist).** Replace with plain per-category import and a static checklist page. File management is a whole product; you do not need it before the Games.
  - **The wallet and card lifecycle states** (Wallet Pending / Created / Card Pending / Issued). Store one imported status field from the partner. Do not model a lifecycle you do not control.
  - **Section 15 Operations Committees.** Contract-and-milestone data, not beneficiary data — a different shape entirely. A separate flat table, not part of the beneficiary model, or it will contaminate your schema.
  - **Guests (VIP/VVIP).** Smallest headcount, highest confidentiality risk. Add after the spine is proven.
  - **Biometric device integration.** You do not own it. Consume a file or an API; never talk to a device.
  - **Edition rollover UI.** The *schema* must support multiple editions on day one; the *screens* for seeding the next edition can wait until after this one ships. With an annual cadence you have roughly twelve months for those and about twelve weeks for everything else — so this is a deferral, not an abandonment, and it should be first in the queue afterwards.
  - **Reconciling the historical editions.** Import old records behind a `reference` flag and leave them alone. Cleaning them is a project of its own and must not compete with the live edition for time.

- **2-week test:** Load the real Abia, Akwa Ibom, Bayelsa, Cross River and Edo records you already hold into the spine, tagged as a prior reference edition. Run dedup across states and categories. Produce a disbursement file. Then put it in front of the finance lead and ask one question: **"Would you have run last edition's payments off this?"** Separately, hand a real state liaison a viewer login and see whether they can answer "was my coach paid?" without calling you. _Success looks like the finance lead asking for a column you do not have_ — that means they are mentally operating it. Polite praise is a failure.

- **If the assumption fails** — if the finance lead keeps the spreadsheet, or the disbursement format never arrives — the pivot is: **stop building a portal and build the reconciliation and dedup engine as an internal Crestpoint tool**, with the payment run delivered as a service. Same value, no adoption risk, and the portal becomes the client-facing surface of something you already do.

---

## Edits Applied to product-idea.md

Created `docs/product-idea.md` from this validation run, then revised it after the reusability clarification. Directional choices made by the founder:

- **Ambition** — corrected. "Reusable" means **NDG re-using it across editions**, not selling it to other events. The product-market analysis in the first draft has been removed as inapplicable; multi-edition longevity replaces it as the long-term risk.
- **Target user** — narrowed from "multi-state games organisers" to **the NDG Secretariat's payment/finance lead**, with state liaisons as read-only secondary users.
- **MVP shape** — reframed around the eligibility-to-disbursement spine. Cuts accepted in full: dashboard and reports (19, 20, 27), Upload Centre and checklist (25, 26), wallet/card lifecycle states, Operations Committees (15), Guests, and direct biometric device integration. Edition scoping added as a v1 non-negotiable.
- **Identity key** — **BVN or NIN, at least one required**, mandated in the pre-games upload template. Now doing double duty: dedup within an edition, identity across editions.
- **Risky assumptions** — rewritten around run-through-not-alongside, third-party data dependency, and edition-model correctness.

`## Candidates considered` is marked "Not applicable — direct validation run."

---

## Next Step

Run `/plaid` to plan the build. Two things should happen before the PRD is written: obtain the disbursement file specification from the payment partner, and settle the edition data model on paper. Those two artifacts determine everything else in the schema.

---

_Sources for the NDPA section: [CookieYes — NDPA 2023 guide](https://www.cookieyes.com/blog/nigeria-data-protection-act-ndpa/), [Global Advisory Experts — NDPC data controller registration 2026](https://globaladvisoryexperts.com/ndpc-data-controller-registration/), [Nigeria Data Protection Commission](https://ndpc.gov.ng/)._
