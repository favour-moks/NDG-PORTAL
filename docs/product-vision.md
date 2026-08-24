# Product Vision — NDG Payment Accreditation Portal

## 1. Vision & Mission

### Vision Statement

Every person who works, competes or performs at the Niger Delta Games is paid correctly, on time, and only if they were actually there — and the Secretariat can prove it, in any year, in seconds.

### Mission Statement

Replace nine state spreadsheets with one edition-scoped system that computes payment eligibility from accreditation rather than assertion, and produces the disbursement file that moves the money.

### Founder's Why

You already do this job by hand. Crestpoint delivers NDG accreditation and payment support across nine states, and you have personally written the per-state final reports — Abia, Akwa Ibom, Bayelsa, Cross River — and reconstructed payment reports from a vendor's transaction exports after the fact. That is an unusual place to start a build from. Most people designing a system like this are inferring the workflow from interviews. You are describing your own week.

That matters more than it sounds, because the failure mode of internal software is almost never technical. It is building the process someone described rather than the process they run. You know, for instance, that the same category of beneficiary gets paid in two batches six weeks apart, that the reference numbering changes between those batches for no documented reason, and that the only report anyone keeps is the list of payments that succeeded. None of that appears in a requirements document. All of it determines whether the system works.

The deeper motivation is that this work is currently unprovable. During Games week the question "who has been paid?" is asked hourly by people with authority, and the honest answer is "give me an hour and several files." That is not a reporting inconvenience — it is an accountability gap around public money, and the person standing in it is the payment lead. You are building the thing that closes it, and the reason you want it to last across editions is that closing it once and then rebuilding from scratch next year would be a waste of the hardest part.

### Core Values

**Eligibility is computed, never asserted.** No one becomes payable because their name appears in a file. Payability is derived from accreditation status every time it is displayed, and there is no screen anywhere that lets an editor mark someone paid without a record of why they were eligible. This is the single rule that distinguishes the portal from the spreadsheet, and it should be defended in code review.

**Never silently change money data.** Duplicates get flagged, not deleted. Imports get validated, not coerced. If a record is ambiguous, a human decides. The one behaviour that would permanently destroy trust in this system is a payment that changed without anyone choosing to change it — and in a system whose entire purpose is auditability, a silent fix is worse than a visible failure.

**Say the number.** Every message names what happened and how many: "3 records need review before payment — 2 possible duplicates, 1 missing BVN." Never "some records require attention." The people using this are accountable for figures, and vague software makes them look careless in front of their own leadership.

**A warning must never block a payment.** Historical data is unreliable and always will be. Uncertain matches surface as review items and the payment proceeds. A legitimate coach turned away at a payment desk in front of his state delegation is a visible, political, immediate failure; a duplicate is recoverable next week. Rank them accordingly.

**Build for the person who inherits this.** Boring stack, plain naming, configuration in the database rather than in code, comments where the domain is strange. The system has to survive an annual cycle and people who are not you. Clever costs more than it saves here.

### Strategic Pillars

**The payment lead's workflow comes first, always.** When a design decision trades their speed against anyone else's convenience, they win. They are the person who decides whether this system lives, and they will decide it in the first week of use.

**Edition-scoping is architecture, not a filter.** Any change that makes the second edition harder gets rejected, even if it makes this edition easier. The entire justification for building rather than buying rests on the system being reused, and that reuse is decided in the schema during the first fortnight.

**Correctness over completeness, and completeness over polish.** A system that produces one correct disbursement file beats one with a beautiful dashboard and an unreliable dedup. When the deadline bites — and it will — cut features, never validation.

**Assume the network fails at the venue.** The accreditation desk is the highest-pressure, lowest-connectivity point in the whole operation. Paper is not the failure state; it is the documented fallback, and the system should make returning from paper easy rather than pretending it will not happen.

### Success Looks Like

Twelve months from now, the 2026 edition is closed and locked, and its data has already seeded the 2027 edition — the LOC committees, technical officials and vendors carried forward with a few hours of editing rather than weeks of re-keying. The payment lead opens the portal rather than a workbook, and when the Secretariat asks who has been paid, the answer arrives while the question is still being asked. The nine state liaisons stopped calling Lagos for status months ago. The disbursement file format is agreed with the payment partner and generated by the system, which means the 2027 edition is the one where money genuinely moves through the portal instead of alongside it. Someone at the Secretariat — a named person, not a role — holds the credentials and the hosting is a funded line item. And the awkward question from the last audit, the one about three coaches who vanished from a payment report, has a screen that answers it.

-----

## 2. User Research

### Primary Persona

**The Payment Lead.** Late thirties to fifties, Secretariat finance or operations, based wherever the Games administration sits, with a laptop and a workbook that has been copied forward through several editions. They are the custodian of the master beneficiary list, the person who assembles the payment schedule handed to the vendor, and the phone number states call when coaches complain.

Their day during Games week is interruption-driven. Someone senior wants a figure for a briefing. A state says its accompanying staff were left off. The payment vendor returns a file that does not reconcile. Between those, they are chasing outstanding submissions from states that have not uploaded. Everything is urgent, everything is verbal, and the workbook is the only thing holding the picture together.

Their tech comfort is high but specific: they are excellent in Excel and have earned that skill through necessity. They are not intimidated by software, but they are sceptical of it, because most systems they have been handed added a step without removing one. They will not say this out loud — they will simply keep the spreadsheet open in another tab, and that quiet parallel workbook is the true measure of whether the portal has succeeded.

Emotionally, they are accountable for numbers they cannot independently verify. That is a corrosive position, and it is the real pain the product addresses. What would make them switch is not features — it is the first time the portal answers a question faster than they could have, on data they recognise as correct. Everything in the MVP should be aimed at making that happen in the first session.

### Secondary Personas

**The State Liaison.** One per state across the nine, responsible for their delegation's submissions and for fielding "was I paid?" from their own people. They use software occasionally, not daily, and they are usually on a phone rather than a laptop. Their need is narrow and repetitive: check status for their state, across this edition and previous ones, without seeing money figures or other states. Trained ahead of the Games, they are the group that shifts the portal from a Secretariat tool to the system everyone uses.

**The Secretariat Editor.** Up to five working concurrently, covering accreditation, uploads, DRM review and reporting. They are colleagues of the payment lead with similar comfort levels and overlapping responsibilities, and they land on the dashboard at sign-in rather than choosing a category. Their main risk to the system is uncoordinated editing — two people resolving the same duplicate differently — which is an argument for visible review queues rather than silent edits.

**The Accreditation Desk Operator.** At the venue, under time pressure, with a queue in front of them and connectivity that may or may not hold. They interact with arrival accreditation, which is owned by a third party, so their touchpoint with the portal is indirect this edition. They matter to the design anyway, because their fallback to paper is the most likely source of a data gap that surfaces later as a payment dispute.

### Jobs To Be Done

**Functional — the payment lead:** _When I am asked how far payments have progressed, I want to produce a figure I can defend, so that I am not committing to a number I will have to correct later._ Also: _When a state disputes an omission, I want to see that person's full history in this edition and previous ones, so that I can resolve it in the conversation rather than after it._

**Functional — the state liaison:** _When someone from my delegation asks whether they were paid, I want to check it myself, so that I am not waiting on the Secretariat to answer a question I should be able to answer._

**Emotional — the payment lead:** _I want to stop feeling exposed by figures I cannot verify._ This is the deepest job the product does, and it is why trust matters more than features. A system that is 95% right and confident is worse than one that is 90% right and explicit about the other 10%.

**Emotional — the state liaison:** _I want to stop feeling like my state is being ignored._ Much of the friction between states and the Secretariat is not disagreement about outcomes; it is the delay before an answer.

**Social — the payment lead:** _I want to be seen as the person who has the operation under control, not the person still assembling spreadsheets when leadership walks in._ This is why the export must be presentable — a filtered PDF that goes straight into a briefing is worth more to them than a chart on a screen.

**Social — the Secretariat:** _We want to be an organisation that can withstand an audit._ The multi-edition record is what makes this claim credible, and it is a genuine reason for leadership to fund the system between Games.

### Pain Points

**1 — There is no single answer, and the cost is paid under maximum pressure.** Frequency: continuously during Games week, weekly otherwise. Currently handled by opening several workbooks and reconciling by eye. Consequence: severe. Decisions get made on stale figures, and the payment lead's credibility erodes each time a number is corrected.

**2 — No identifier links a person across batches, states, or editions.** Frequency: structural, present in every dataset. Currently handled by matching names by eye. Consequence: severe and expensive — this is the mechanism by which double payments and ghost beneficiaries occur. The real Edo data shows two batches with entirely incompatible reference schemes and no shared person key; names appear in inconsistent case and word order in the same file.

**3 — Failures are invisible.** Frequency: every payment run. Currently handled by nobody, because the reports only contain successful transactions. Consequence: high. Three of thirty-four records in one February batch simply do not appear, and nothing flagged it. The portal is asked to report "In Progress" and "Pending" states for which no data source presently exists — that gap must be filled by the disbursement result import, not assumed away.

**4 — Reconciliation consumes the hours that are least available.** Frequency: every batch, and there are several per edition. Currently handled by manual comparison. Consequence: moderate to high — it does not usually cause wrong outcomes, it causes late ones, and lateness is what states experience as neglect.

**5 — Each edition starts from an empty file.** Frequency: annual. Currently handled by copying last year's workbook and editing it, which propagates last year's errors. Consequence: moderate this year, compounding thereafter. This is the pain the multi-edition design exists to remove.

**6 — Access is uncontrolled.** Frequency: ongoing. Currently handled by sending files to whoever asks. Consequence: moderate today, high under NDPA scrutiny — beneficiary bank details and identifiers circulating by email and messaging app is a defensible practice in nobody's framework.

### Current Alternatives & Competitive Landscape

**The master spreadsheet.** What it does well: everything, badly but immediately. It is infinitely flexible, requires no training, works offline, and every stakeholder can open it. Where it falls short: no access control, no validation, no history, no way to prevent two people editing different copies. Switching requires the payment lead to trust a system more than their own hands — which is a matter of demonstrated correctness, not persuasion. **This is the real competitor.** If it stays open in another tab, the project has failed regardless of what else ships.

**Per-state Excel workbooks and WhatsApp.** What they do well: they match how states actually work, and they need no coordination. Where they fall short: nine sources of truth that diverge immediately, and no audit trail. Switching requires training liaisons before the Games, which is why that is the chosen adoption route.

**Printed DRM lists at the accreditation desk.** What they do well: they never lose connectivity and they carry a signature, which has real institutional weight. Where they fall short: the data goes stale the moment it is printed and re-entry is manual. Switching is partial at best — plan for paper as a documented fallback rather than trying to eliminate it.

**The payment vendor's own reporting.** Dunamis-Icon Limited is the company of record on every Edo transaction, and their export is currently the closest thing to a payment ledger. What it does well: it is authoritative for what was actually paid. Where it falls short: it only records successes, uses reference schemes that change between batches, and has no concept of accreditation or eligibility. It is an input to the portal, not a competitor to it.

**Doing nothing.** Genuinely viable. Previous editions shipped payments this way. The argument against it is not that it fails — it is that it fails invisibly and cannot be defended afterwards.

**Commercial alternatives.** Generic beneficiary-management and grant-disbursement platforms exist, but they assume a stable programme rather than an annual event with shifting categories, and none of them will generate the specific disbursement file this payment partner accepts. The build-versus-buy question resolves on that file.

### Key Assumptions to Validate

**We assume the Secretariat will run status through the portal rather than alongside the spreadsheet, because the portal answers faster.** To validate: watch whether the payment lead still opens their workbook in week two. If they do, ask which column the portal is missing — the answer is usually one field, not a philosophy.

**We assume states will supply BVN or NIN if it is mandatory in the template.** To validate: send the template to two states now and count the fill rate. Do not wait for all nine. This is the highest-risk assumption in the project and the cheapest to test.

**We assume the biometric owner can supply arrival accreditation data with a matching identifier.** To validate: request one sample record this week. Five working days without a sample is itself the answer, and the design should fall back to manual desk-flipping rather than discovering the gap in month two.

**We assume the payment partner will share their required disbursement format.** To validate: one email asking for a sample file and mandatory fields. Everything in the data model is downstream of this.

**We assume roughly 2,500 accredited individuals and payment volumes in the low hundreds of millions of Naira.** The spec's own worked example implies the first figure; the second follows from ₦105,000 flat rates across categories. To validate: confirm against last edition's totals — it affects both the NDPA threshold question and how hard the export path has to work.

**We assume five concurrent editors is the real ceiling.** To validate: ask. If it is fifteen during Games week, the concurrent-edit conflict design needs more attention than currently planned.

**We assume historical data is reliable enough to be useful as a warning signal but not as a gate.** To validate: import one previous edition and count how many warnings it generates against this edition's list. If the false-positive rate is high enough to be ignored, the feature is noise and should be tuned or dropped.

**We assume the system will be owned and funded between editions.** To validate: get a named person and a written answer on hosting before the Games, while you have leverage. This assumption is unusual in that it is not about users or data — it is the one that decides whether "reusable" is true.

### User Journey Map

**Awareness.** The payment lead does not discover this product; it arrives as a Crestpoint deliverable inside an engagement they already have. That removes acquisition risk entirely and replaces it with something harder: they did not ask for it, so their default posture is polite scepticism. The first impression is not a landing page — it is a conversation in which someone tells them their spreadsheet is being replaced.

**Consideration.** Their real question is "what happens when this is wrong?" They have seen systems that were confidently incorrect and are wary of being made accountable for output they cannot inspect. The consideration stage is won by showing them the review queue, not the dashboard — evidence that the system asks rather than assumes.

**First use.** They sign in via an invite link and land on the dashboard. The decisive moment is whether the data they see is *recognisably theirs*. Loading real historical records before their first session is not a nicety; it is the difference between a demo and a system. Friction here is mostly emotional: an empty state or an obviously fake name confirms every suspicion they arrived with.

**Magic moment.** They filter to a state, a category and an eligibility status, and export. The file is correct, the format is right, and it took eleven seconds instead of forty minutes. The specific feeling to design for is not delight — it is relief, followed by the thought that they could have used this last edition.

**Habit formation.** Habit forms when the portal becomes the fastest route to an answer someone else is waiting on. That is why status queries matter more than reports in the first weeks: the payment lead is asked questions constantly, and each time the portal answers one faster than the workbook, the workbook loses a little. Watch for the session where they stop cross-checking.

**Advocacy.** It arrives as delegation rather than enthusiasm: the payment lead tells a state liaison to check the portal themselves instead of answering. When that happens unprompted, adoption is real. The second signal is the Secretariat asking for a login for someone you had not planned for.

-----

## 3. Product Strategy

### Product Principles

**Eligibility is derived, not stored as an opinion.** Payability is recomputed from accreditation status wherever it appears. No editor screen sets "eligible" directly. This is the product's spine, and every feature that seems to require an override is a signal that the accreditation model is missing a state.

**The system must be able to say "I don't know."** Ambiguous duplicates, missing identifiers and unmatched result rows all surface as explicit review items with counts. A system that resolves ambiguity silently is not trustworthy in a money context, however clever the resolution.

**Filters are the interface.** Section 17 of the specification is right and should be taken further: filters, not sort options, and every export inherits the active filter. The payment lead thinks in filtered subsets — this state, this sport, this status — and the product should let them stay in that mental model rather than translating it.

**Every list is alphabetical until told otherwise.** A small rule with outsized effect. Predictable ordering is how someone scanning for a name works, and it is what makes a printed export usable at a desk.

**Financial visibility is a property of the view, not a conditional in the UI.** Viewers get views that do not contain money columns. There is no `if (role === 'viewer')` hiding an amount that was fetched anyway. This is a security stance dressed as a code convention, and it should be enforced at the database boundary.

**Historical data warns; live data decides.** Anything imported from a previous edition is advisory. It can raise a review item; it can never prevent a payment.

### Market Differentiation

The competitor is not software. It is a spreadsheet, a group chat, and a printed list — three tools that between them are flexible, familiar, offline-capable and universally understood. Any honest differentiation argument has to start by acknowledging that the incumbent is good at almost everything except being verifiable.

What the portal does that the spreadsheet structurally cannot: compute eligibility from accreditation, so that presence on a list is not the same as entitlement to money. That single property is the product. It cannot be replicated in a workbook because a workbook has no concept of a rule that survives editing — anyone can type a name into a payment sheet, and nobody can tell afterwards whether they should have.

The second differentiator is the one that makes the first one stick: the portal can produce the disbursement file the payment partner accepts. This is what converts the system from a reporting layer into the system of record. As long as the payment schedule is assembled elsewhere, the spreadsheet remains the truth and the portal is commentary. The moment the file originates in the portal, the spreadsheet cannot compete, because it can no longer produce the artifact that moves money.

The third is defensible in a different way: the portal accumulates. Every edition adds to a record that makes the next edition cheaper and the next audit answerable. A spreadsheet copied forward accumulates only errors. This is why the multi-edition architecture is a strategic decision rather than a feature request — it is the only part of the system that gets more valuable rather than more stale.

Be honest about where differentiation is weak. Nothing in the screen inventory is hard to copy, and if the Secretariat's priority shifted to a different vendor, most of this could be rebuilt. The defensibility is in the disbursement format relationship, the accumulated multi-edition record, and Crestpoint's operational knowledge — not in the code.

### Magic Moment Design

The moment is: filter to 2026 → Delta → Basketball → eligible, click once, receive a disbursement file the payment vendor accepts without a single manual correction.

For this to happen reliably, five things must be true. The **format must be exact**, which means obtaining the partner's specification before the data model is finalised rather than reverse-engineering it from a previous export. **Account numbers must survive as text** — sixteen of the forty-five records in the sample file carry leading zeros, and a numeric import destroys them silently, producing a file that looks correct and fails at the bank. **Bank names must map to institution codes**, since the file needs codes and the source data has eleven free-text bank names with inconsistent casing. **Eligibility must already be computed**, so the filter is a selection rather than a judgement. And **the filter state must flow through to the export**, which sounds trivial and is the single most common place this kind of feature breaks.

The shortest path from first sign-in to this moment is: invite link → dashboard → participants → filter → export. Four screens. Nothing should be added between them. In particular, resist any onboarding sequence — this user does not need to be taught what a beneficiary is.

The honest risk: **this moment is only fully available if the disbursement format is known.** The chosen 90-day goal is status-as-source-of-truth rather than payments-through-the-portal, which means the format may not be settled this edition. If so, build the export against the best available understanding and demonstrate it on real data anyway. A demonstrated capability is what makes it the default next edition; an undemonstrated one gets rebuilt by someone else.

### MVP Definition

**Edition-scoped data model.** Person records keyed on BVN/NIN, separate from per-edition participation carrying category, state, sport, committee, rate, accreditation status, payment status and bank details. Essential because it cannot be retrofitted — every other feature is cheaper to add later and this one is not. Done looks like: the same individual can exist as a Delta athlete in one edition and an Edo coach in another, at different rates, without duplication.

**Beneficiary import with validation.** Per state and category, against a template mandating BVN or NIN, forcing account numbers to text, validating the ten-digit NUBAN format, and rejecting files with clear diagnostics rather than importing them partially. Essential because bad data at the door is the source of every downstream failure. Done looks like: the real Edo file imports cleanly and a deliberately corrupted copy produces a specific, actionable error.

**Duplicate detection with a review queue.** Exact matching on identifier, trigram similarity on normalised names as the safety net, warnings against previous editions that never block. Essential because it is the mechanism preventing double payments, and because Section 18's specified approach cannot work without it. Done looks like: a reviewable list with a stated count and a resolution action that records who decided.

**Accreditation status and computed eligibility.** Pre-games status from import, arrival status from the biometric owner or manual desk entry, eligibility derived from both. Essential — this is the product. Done looks like: no path exists to place an unaccredited person on a payable list.

**Disbursement file generation and result import.** Export in the partner's format; import results back to per-person, per-batch payment status without overwriting previous batches. Essential because it is the differentiator and because it is the only source for the Pending and In Progress states the specification requires. Done looks like: a full round trip on real historical data.

**Role and state scoped access.** Editors see everything; state liaisons see their assigned state across all editions with no financial columns, enforced by row-level security and viewer-specific views rather than UI conditionals. Essential because it is the most security-sensitive requirement and cannot be bolted on. Done looks like: an automated test per role asserting what each role cannot see.

**Filter-respecting export to Excel and PDF.** Every list downloadable, honouring active filters, with the PDF paginating the full result set rather than the first page. Essential because it is how output leaves the system and enters briefings. Done looks like: filtered exports match on-screen counts exactly.

**Access logging.** Who signed in, when, and what they viewed. Essential under the NDPA and cheap now, expensive later.

### Explicitly Out of Scope

**Executive dashboard and reports (Sections 19, 20, 27).** Tempting because it is what leadership sees and what makes the project look finished. Deferred because a correct filtered export delivers most of the value and charts are the easiest thing to add under time pressure. Reconsider in the final fortnight if the spine is stable, otherwise immediately after the Games.

**Upload Centre with ~1,000-file management and checklist (Sections 25, 26).** Tempting because the specification describes it in detail. Deferred because file management is a product in its own right and a plain per-category import plus a static checklist page covers the actual need. Reconsider after this edition.

**Wallet and card lifecycle states.** Tempting because the specification enumerates them. Deferred because the lifecycle is owned by a third party — model a single imported status field rather than a state machine you cannot control. Reconsider when the wallet partner's data contract is known.

**Operations Committees financials (Section 15).** Tempting because it sits in the same document. Deferred because it is contract-and-milestone data, not beneficiary data, and merging the two shapes contaminates the schema. Reconsider as a separate flat module after the Games.

**Guests — VIP, VVIP, federation heads, celebrities.** Tempting because the headcount is small. Deferred because it carries the highest confidentiality risk for the least volume, and confidentiality mistakes here are the kind that end projects. Reconsider once role scoping is proven in production.

**Direct biometric device integration.** Tempting because it would close the loop. Deferred because you do not own the device — consume a file or an API. Do not reconsider; this boundary is correct permanently.

**Edition rollover screens.** The schema supports multiple editions from day one; the UI for seeding the next edition can wait. Reconsider immediately after this edition ships — with an annual cadence, it pays back within twelve months and should be first in the queue.

**Historical data reconciliation.** Import behind a reference flag and leave it. Cleaning it is its own project and must not compete with the live edition.

### Feature Priority (MoSCoW)

**Must Have:** edition-scoped schema; beneficiary import with validation and text-safe account numbers; BVN/NIN capture; duplicate detection with review queue; accreditation status and computed eligibility; DRM list view with printable output; disbursement file export; payment result import with batch history; role and state scoped access via RLS; financial-column-free viewer views; filter-respecting Excel and PDF export; alphabetical default ordering; access logging; encrypted identifiers.

**Should Have:** cross-edition duplicate warnings; per-category and per-state completion checklist; bank name to institution code mapping table; editor-managed reference data for categories, committees, sports and states; invite-based user management; payment installment tracking against entitlement.

**Could Have:** executive dashboard tiles; payment progress percentages by category and state; charts; upload centre with file inventory; wallet and card status fields; guests module; operations committees module.

**Won't Have (this time):** biometric device integration; wallet lifecycle state machine; offline mode at the accreditation desk; mobile application; automated reconciliation of historical editions; multi-tenancy for other events.

### Core User Flows

**Flow 1 — Import and clean a state's pre-games list.** Trigger: a state submits its athlete list. Steps: editor selects edition, state and category; uploads the file; system validates the template, forces account numbers to text, checks NUBAN format, and requires BVN or NIN; system reports what will import and what will not, with reasons; editor confirms; system runs duplicate detection within the edition and warns against previous ones; conflicts land in a review queue with counts. Outcome: the state's list is in the system with known data quality. Success criteria: no partial imports, every rejection has a stated reason, and the editor knows exactly what needs their attention.

**Flow 2 — Produce a disbursement file.** Trigger: a payment batch is authorised. Steps: payment lead filters to the target population; system shows only those whose eligibility is computed as payable, with a count; lead reviews exclusions and their reasons; lead exports; system generates the file in the partner's format with institution codes and text account numbers, and records the batch. Outcome: a file the partner accepts unedited. Success criteria: exported record count matches the on-screen count exactly, and nobody unaccredited appears.

**Flow 3 — A liaison answers a status question.** Trigger: someone from a state delegation asks whether they were paid. Steps: liaison signs in; sees only their own state; selects an edition, including a previous one; filters by name or category; reads accreditation and payment status. Outcome: answered without contacting the Secretariat. Success criteria: no financial amounts are visible anywhere in the flow, no other state is reachable by any route including direct URL, and the access is logged.

### Success Metrics

**Primary metric — the parallel spreadsheet.** Whether the payment lead still maintains a private workbook. Good: they open it occasionally to cross-check. Great: they stop updating it entirely. This is the only metric that measures the thing the project is actually for, and it is observed by asking, not instrumented.

**Secondary — status query coverage.** Proportion of the nine states whose liaisons signed in and ran a query during the edition. Good: six of nine. Great: nine of nine, with liaisons answering their own delegations rather than calling.

**Secondary — data quality at the door.** Proportion of imported records carrying a valid BVN or NIN. Good: 80%. Great: 95%. Below 60% and the duplicate detection is running on the fallback path, which should be treated as an amber project status rather than a data note.

**Secondary — time to answer.** Time from question to defensible figure. Good: under two minutes. Great: under thirty seconds. Measure it once, informally, with a stopwatch during Games week.

**Leading indicator — review queue resolution.** Whether flagged duplicates are resolved or ignored. A growing unresolved queue means the flags are noise and the matching needs tuning; it is the earliest signal that trust is slipping.

**Leading indicator — export usage.** Exports per week. This is the clearest proxy for the portal being the route to an answer rather than a place data is stored.

### Risks

**Third-party data never arrives in usable form.** Likelihood: high. Impact: severe — it removes the eligibility gate, which is the product. Mitigation: request samples this week; design manual desk-entry of arrival status as a first-class path rather than a fallback, so the system works regardless.

**Identifier collection fails.** Likelihood: medium-high. Impact: severe — duplicate detection degrades to fuzzy name matching with human review, and cross-edition identity becomes impossible. Mitigation: mandate BVN or NIN in the template before states submit; test fill rate with two states immediately; build the trigram fallback regardless.

**Scope defeats the timeline.** Likelihood: high. Impact: high. Mitigation: the cut list above is a commitment, not a suggestion; protect validation and the data model, sacrifice everything visual first.

**The spreadsheet survives.** Likelihood: medium. Impact: severe in the long run — it makes the system a reporting layer permanently. Mitigation: load real historical data before the first demo; pursue the disbursement format even though the 90-day goal does not require it; treat the parallel workbook as the primary metric so the risk is visible early.

**The edition model is got wrong in week one.** Likelihood: medium. Impact: severe — it is the one thing that cannot be fixed later. Mitigation: model two editions on paper and test the returning-athlete case before writing the first migration.

**NDPA exposure.** Likelihood: medium. Impact: high — biometric data is sensitive personal data, the population plausibly exceeds the major-importance threshold, and penalties reach ₦10 million or 2% of gross revenue. Mitigation: encrypt identifiers, log what is viewed, agree controller and processor roles in writing with the Secretariat, and confirm registration obligations with counsel.

**Nobody owns it between editions.** Likelihood: medium-high. Impact: severe to the multi-edition thesis specifically — the system does not fail, it gets rebuilt. Mitigation: settle a named owner, credentials and funded hosting before the Games, while the leverage exists.

**Connectivity fails at the venue.** Likelihood: medium. Impact: moderate. Mitigation: treat paper as a documented fallback with a defined re-entry path rather than an exception.

**Concurrent editors conflict.** Likelihood: medium. Impact: moderate — two editors resolving the same duplicate differently produces exactly the ambiguity the system exists to remove. Mitigation: visible review queues with claim-and-resolve semantics, and record who decided what.

-----

## 4. Brand Strategy

### Positioning Statement

For the NDG Secretariat's payment lead, who is accountable for figures they cannot independently verify, the NDG Payment Accreditation Portal is the system of record that computes payment eligibility from accreditation and produces the file that pays people. Unlike the master spreadsheet, per-state workbooks and the vendor's transaction exports, the portal makes entitlement a rule rather than an entry — and keeps every edition, so that next year starts from this year rather than from nothing.

### Brand Personality

A calm, exact registrar. Someone who has kept records for a serious institution for a long time and takes quiet pride in the fact that the records are right.

In conversation they are unhurried and precise. They answer the question asked, give the number, and say what happens next. They never pad, never flatter, and never use three words where one will do. Asked something they cannot verify, they say so plainly rather than estimating — and that willingness to say "this needs review" is precisely why people believe the rest.

They dress institutionally and unremarkably. Nothing about them is trying to be noticed, because the work is the point and drawing attention to the tool would be a kind of vanity.

They would never joke about money. They would never hide a problem to keep a screen looking clean. They would never say "oops" or "something went wrong" — a person is accountable for public funds on the other side of that message, and vagueness makes them look careless in front of their own leadership. And they would never celebrate. Completing a payment run correctly is the expectation, not an achievement.

### Voice & Tone Guide

The **voice** is constant: plain, precise, unhurried, accountable. Facts before interpretation, numbers before adjectives, and always a stated next action. The **tone** shifts by context — warmer for occasional users like state liaisons, terser for the payment lead working at speed — but never becomes casual, and never becomes apologetic.

| Context | DO | DON'T |
|---|---|---|
| First sign-in | "Welcome, Adaeze. You have editor access to all states and categories for NDG 2026." | "Welcome aboard! 🎉 Let's get you set up — this will only take a minute!" |
| Empty state | "No athletes uploaded for Bayelsa yet. Upload a pre-games list to begin." | "Nothing here yet. Why not add some data?" |
| Import validation | "412 of 418 records ready to import. 6 rejected: 4 missing BVN or NIN, 2 account numbers not 10 digits. Download the rejected rows to correct and re-upload." | "Some records couldn't be imported. Please check your file and try again." |
| Duplicate warning | "3 records need review before payment — 2 possible name matches within this edition, 1 exact BVN match in NDG 2025 (reference only). Review now or continue; reference matches do not block payment." | "Potential duplicates detected! Resolve these issues to proceed." |
| Permission restriction | "Payment amounts are not available on your account. Contact the Secretariat if you need them." | "Access denied. You do not have permission to view this resource." |
| Import failure | "This file could not be read. Account numbers must be formatted as text — as numbers, leading zeros are lost and payments fail. Re-save the column as text and upload again." | "Invalid file format. Upload failed." |
| Export in progress | "Preparing 1,842 records for download. This takes about 20 seconds." | "Working on it… hang tight!" |
| Successful payment import | "1,800 payment results imported. 1,782 successful, 12 failed, 6 unmatched. Review the 18 exceptions." | "Payment import complete! ✅ Everything looks good." |
| Eligibility exclusion | "Excluded from this batch: 47 people. 44 have not completed arrival accreditation, 3 are missing bank details." | "Some people were not included in this export." |
| Edition locked | "NDG 2025 is closed. Records are read-only. To correct an entry, contact the Secretariat." | "You can't edit this. This edition is archived." |

### Messaging Framework

**Tagline:** One record. Every edition.

**Primary headline (sign-in page):** The system of record for NDG accreditation and payments.

**Value proposition 1 — Nobody unaccredited gets paid.** Eligibility is computed from accreditation status every time it is shown, so a name on a list is not the same as an entitlement to money. This is the difference between a record and a spreadsheet.

**Value proposition 2 — One answer, in seconds, that you can defend.** Filter to any state, category, sport or status and get the figure — plus the export that puts it straight into a briefing.

**Value proposition 3 — Next edition starts from this one.** Every Games adds to the record instead of replacing it, so committees and officials carry forward, and "was this person paid last year?" is answerable for the first time.

**Feature descriptions.** *Duplicate review:* flags possible duplicates within the edition and against previous ones, and asks you to decide — it never deletes a record or blocks a payment on its own. *Disbursement export:* produces the payment file in the format your partner accepts, with account numbers preserved as text and bank institution codes applied. *State access:* liaisons see their own state across every edition, and never see amounts.

**Objection handlers.** *"We already have the spreadsheet."* You do, and it will keep working — the portal is where eligibility gets decided, so the schedule you hand over is defensible. *"What if the system is wrong?"* Then it tells you. Anything ambiguous goes to a review queue with a count and a reason; nothing is resolved silently. *"We don't have time to learn a new system before the Games."* Liaisons need one screen and a filter. Editors need the flow they already run, minus the reconciliation. *"What happens after the Games?"* The edition closes and locks, and next year's seeds from it — which is the reason to build it rather than rent it.

### Elevator Pitches

**5-second:** One system that decides who gets paid at the Games — and keeps every edition.

**30-second:** The Secretariat currently answers "who has been paid?" by reconciling nine spreadsheets, and the answer arrives late and sometimes wrong. The portal computes payment eligibility from accreditation status, so nobody unaccredited can be paid, and it generates the disbursement file the payment partner accepts. Every edition lives in the same system, so next year starts from this year instead of an empty file.

**2-minute:** The Niger Delta Games pays thousands of athletes, coaches, officials and personnel across nine states, and right now the truth about who is accredited, who is eligible and who has been paid lives in several spreadsheets, a group chat and a stack of reports. During Games week that question gets asked hourly by people with authority, and answering it takes an hour and a degree of faith. In one state's coaches payment file from this year, three of thirty-four records simply vanish between the schedule and the report, and nothing flagged them — because the only records kept are of payments that succeeded.

The portal makes eligibility a rule rather than an entry. Accreditation status flows in from pre-games submission and arrival verification, eligibility is computed from it, and nobody who has not been accredited can appear on a payable list — no matter whose file their name arrived in. Duplicates are flagged for a human to resolve rather than silently removed, matched on national identifiers rather than on names that appear in three different formats. And the portal produces the disbursement file the payment partner accepts, which is what turns it from a report into the system of record.

Why now: this edition introduces a wallet and card arrangement, the accreditation process is moving to biometric arrival verification, and both changes make the existing spreadsheet process untenable — the eligibility rules are simply too complex to hold by hand. Why us: Crestpoint already runs this process manually across nine states, which means the system is being designed by the people who currently are the system, and can be tested against real payment data from the first week.

The ask: agree the disbursement file format with the payment partner, mandate a national identifier in the pre-games template before states submit, and name the person at the Secretariat who owns the system between editions. Those three decisions determine whether this is infrastructure or another spreadsheet.

### Competitive Differentiation Narrative

Every organisation that pays people at scale eventually discovers that the hard part is not payment — it is entitlement. Knowing who *should* be paid is a question about rules, evidence and identity, and a spreadsheet cannot answer it, because a spreadsheet has no concept of a rule that survives an edit. Anyone can type a name into a payment schedule, and nobody can tell afterwards whether they should have. That is the gap the NDG Payment Accreditation Portal closes: eligibility is computed from accreditation every time it is displayed, so presence on a list stops being the same thing as entitlement to money.

The current alternatives are not bad software — they are not software. They are nine workbooks, a group chat, a printed list carried to an accreditation desk, and a payment vendor's export that records only what succeeded. Each is genuinely good at something: the workbook is flexible, the chat is immediate, the printed list never loses connectivity, the vendor's file is authoritative about money that actually moved. What none of them can do is connect accreditation to payment, which means the connection is currently made in someone's head, under pressure, hourly.

What makes this defensible is not the interface. It is that the portal is the thing that emits the disbursement file, and that it accumulates. Whoever produces the file the bank acts on owns the process, and whoever holds every edition owns the institutional memory — the ability to answer, in an audit two years from now, exactly who was accredited, what they were entitled to, and when they were paid. A spreadsheet copied forward accumulates only its errors. This system gets more valuable each edition, which is the only kind of advantage worth building for an organisation that will still be running these Games in ten years.

-----

## 5. Visual Design

Visual design tokens (colors, typography, spacing, components, motion) live in `docs/design.md`. If that file does not yet exist, run `/plaid design` with image references to generate it before building.

One constraint worth carrying into that exercise: this interface is dense, tabular and frequently printed. Colour must survive black-and-white printing and projection in a bright room, status must never be conveyed by colour alone, and the type scale has to hold up in a table of two thousand rows read by someone in a hurry.
