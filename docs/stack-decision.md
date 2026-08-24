# Stack Decision — NDG Payment Accreditation Portal

_2026-08-15 · Decision record for the backend, database, and frontend_

## What the system actually is

Before comparing tools, it is worth naming the workload honestly, because it is not the workload most modern BaaS platforms are optimised for.

This is a **relational reporting and reconciliation system with a strict permission model and a hard deadline.** Roughly:

- Six or seven entities with real relationships: `person` ↔ `edition_participation` ↔ `payment` ↔ `batch`, plus `rate`, `category`, `committee`, `sport`, `state`, `edition`.
- Bulk import of thousands of rows per edition, with validation, from files of variable quality.
- **Fuzzy duplicate detection** across states, categories, and editions, against names with inconsistent case and word order.
- A permission model scoped by **role × state × edition**, plus column-level hiding of financial figures from viewers.
- Filtered exports to Excel and PDF, potentially thousands of rows, respecting every applied filter.
- Aggregations for dashboards (deferred from v1, but the schema must not preclude them).
- Audit logging of what was viewed, not merely who logged in.

There is almost no real-time collaboration, no chat, no live cursors, no feed. Up to five editors work concurrently and would not notice a two-second refresh delay. **Real-time reactivity — the headline strength of the modern BaaS generation — is close to worthless here.** Relational query power and enforceable access control are close to everything.

---

## Options compared

| | **Supabase (Postgres)** | **Convex** | **Managed Postgres + own API** |
|---|---|---|---|
| **Data model fit** | Native. The schema above is textbook relational. | Document-relational; joins are explicit and manual. Workable, but you fight it. | Native, same as Supabase. |
| **Fuzzy dedup** | `pg_trgm` + `unaccent` give trigram similarity in SQL — precisely the tool for mixed-case, mixed-order names. Indexed and fast. | Hand-written in TypeScript, scanning records in a function. Awkward and slow at thousands of rows. | Same as Supabase; you install the extensions yourself. |
| **Access control** | **Row-level security enforced in the database.** A bug in a React component cannot leak Delta's data to an Edo viewer. | Enforced in application functions. Correct until someone writes a function that forgets the check. | Enforced in your API layer. Same caveat as Convex. |
| **Aggregations** | Real SQL. Trivial. | Harder over large sets; often needs precomputed tables. | Real SQL. Trivial. |
| **Bulk import** | `COPY`, server-side, fast. | Batched mutations; fine but slower. | Same as Supabase. |
| **Auth included** | Yes, with invite flows. | Yes. | No — you build or bolt on. |
| **Hosting region** | US, Canada, EU, APAC, São Paulo. **No African region.** EU is the sensible choice. | **US only.** | Widest choice; some providers reach closer to Nigeria. |
| **NDPA posture** | EU region plus SCCs in the DPA. Defensible. | US-hosted, and the US is not currently designated adequate by the NDPC. Weakest of the three. | Best available, if you pick the region deliberately. |
| **Solo velocity, 12 weeks** | High. Auth, storage, RLS and an admin-friendly SQL console out of the box. | Highest raw DX, but you spend the savings re-implementing relational queries. | Lowest. You build auth, permissions, and migration tooling yourself. |
| **Handover / maintainability** | Very common stack, large talent pool, and it is just Postgres underneath — `pg_dump` and leave whenever you want. | Smaller talent pool; proprietary query model raises the cost of the next person picking it up. | Ordinary Postgres, but bespoke API means bespoke knowledge. |
| **Cost** | Free tier, then roughly $25/month. Negligible against the payment volumes involved. | Comparable. | Comparable to slightly higher once you add auth. |

---

## Decision

**Next.js + Supabase (Postgres), hosted in an EU region, with Standard Contractual Clauses in the data processing agreement.**

Three reasons, in order of weight:

1. **Row-level security matches the permission model exactly.** The viewer rule — "your state, all editions, no financial columns" — is the single most security-sensitive requirement in the specification, because breaching it means one state seeing another's beneficiary data, or a liaison seeing disbursement totals. Enforcing that in the database rather than in application code means a front-end mistake cannot cause a leak. Nothing else on the list offers that.

2. **`pg_trgm` directly attacks the second fatal flaw.** Trigram similarity over normalised names is the correct instrument for `MADWEGWU JOSEPHINE NKECHI` versus `Josephine Madwegwu`, and it is a few lines of SQL against an index rather than a bespoke matching engine. BVN/NIN remains the primary key for identity; trigram matching is the safety net that catches the records where the identifier is missing or mistyped.

3. **It is boring and handoverable.** This system has to survive an annual cycle and people who are not you. Postgres plus Next.js is the least surprising choice available, and "least surprising" is a feature when the maintenance question is unresolved.

**Departure from the PLAID default noted:** PLAID leans toward Convex for backend and database. Its own rule is to prefer Supabase when heavy relational data is central, and here it plainly is. Convex is good software and the wrong shape for this problem — chosen here it would trade the exact strengths this system needs for a real-time capability it does not use.

**Payments: none.** The portal charges no one. Money leaves via a disbursement file handed to the payment partner, not through a processor. Stripe, Polar and equivalents are out of scope and should stay out.

---

## Implementation notes

- **Region:** Frankfurt (`eu-central-1`) or Ireland (`eu-west-1`). Record the choice and the SCC clause in the DPA, and revisit if the Secretariat later imposes a residency requirement.
- **Financial column hiding is not RLS.** Row-level security scopes *rows*, not columns. Hide amounts from viewers with dedicated views (`participation_viewer_v` exposing no financial fields) and grant viewers access only to those. Attempting column masking through RLS policies produces the kind of subtle bug that leaks money figures.
- **Keep RLS policies simple and testable.** State × edition × role is already enough complexity to get wrong. Write a test per role that asserts what each cannot see, and run it in CI. This is the one area where test coverage genuinely pays for itself within twelve weeks.
- **Store BVN/NIN encrypted**, never render them in full in UI or exports, and log reads. `pgcrypto` handles this in-database.
- **Force account numbers to text on import** and validate the 10-digit NUBAN format — 16 of the 45 records in the sample file carry leading zeros that a numeric import destroys silently.
- **Keep a `reference` flag on imported historical editions** so dedup warns without ever blocking eligibility.
- **Auth:** Supabase Auth with invite links. The editor invites; the user sets their own password. No password travels by email. Section 23's underlying goal — knowing whose account was used — is preserved through the session and access logs, and better served by them.

---

## Sources

- [Supabase — Available regions](https://supabase.com/docs/guides/platform/regions)
- [Afriwise — Cross-border data transfers under Nigeria's NDPA](https://www.afriwise.com/blog/cross-border-data-transfers-under-nigerias-ndpa-implications-for-u-s-saas-providers)
- [CookieYes — Nigeria Data Protection Act 2023 guide](https://www.cookieyes.com/blog/nigeria-data-protection-act-ndpa/)
