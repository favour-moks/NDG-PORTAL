# Infrastructure

## Supabase project

| Setting | Value |
|---|---|
| Project ref | `tvrcpkxrnzusclawzbxc` |
| Project URL | `https://tvrcpkxrnzusclawzbxc.supabase.co` |
| Region | Frankfurt (`eu-central-1`) |
| Tier | Pro (required for daily backups, point-in-time recovery, and to prevent the project auto-pausing between editions) |

**Why EU, not US or an African region:** Supabase has no African region. The US is not currently designated adequate by Nigeria's NDPC. The EU region is used with Standard Contractual Clauses (SCCs) in the payment/beneficiary data processing agreement — see PRD § 2 and the compliance checklist to be completed in Phase 6 (`docs/compliance.md`, TASK-092).

**The region cannot be changed later without a full migration.** Decided once, at project creation.

## Database access

- **Migrations and type generation** run against `DATABASE_URL`, via `npm run db:push`, `npm run db:reset`, and `npm run db:types` (see `scripts/with-db-url.mjs`, `scripts/db-types.mjs`). Uses the **Session pooler** connection string (Connect → Session pooler), not the direct connection — new Supabase projects' direct-connection hostnames resolve to IPv6 only, which fails to connect from IPv4-only networks. The pooler hostname (`aws-0-eu-central-1.pooler.supabase.com`) is IPv4-compatible.
- **Never edit the schema through the dashboard UI.** Every schema change is a migration file in `supabase/migrations/`, because the next maintainer needs the history.
- The Supabase CLI is invoked with `--db-url` rather than `supabase link`/`supabase login`, so no personal access token needs to be shared with the coding agent — only the project's own database connection string, which is already a secret specific to this project.
- **`npm run db:types` needs Docker**, which hasn't been available in this environment — `supabase gen types typescript --db-url` shells out to a container for schema introspection. `src/types/database.ts` has instead been kept up to date via `scripts/db-types-fallback.mjs`, a direct `information_schema` query (needs `npm install --no-save pg` first; not a project dependency since only this script uses it). Once Docker Desktop (or a Supabase personal access token, for the `--project-id` path) is available, `npm run db:types` will work normally and should be preferred going forward — the fallback doesn't know about custom functions/enums and reconstructs the shape from columns alone.

## Auth configuration (TASK-016)

Configured via Supabase Dashboard → Authentication → Providers/URL Configuration (not yet scriptable through the CLI for hosted projects):

| Setting | Value |
|---|---|
| Email provider | Enabled |
| Sign-ups | **Disabled** — the single most important setting; the app is invite-only |
| Confirm email | Enabled |
| JWT expiry | 28800 seconds (8 hours) |
| Site URL | `http://localhost:3000` in development; production app URL once deployed |
| Redirect URLs | `/auth/confirm` added — the invite email links here first (per Supabase's server-verified token pattern), which exchanges the token for a session server-side, then redirects on to `/accept-invite` |

## Backups

Pro tier includes daily backups and point-in-time recovery. An actual restore-to-scratch-project rehearsal is TASK-090 (Phase 6) — not yet performed.

## Environment variables

See `.env.local.example`. `SUPABASE_SERVICE_ROLE_KEY` and `PII_ENCRYPTION_KEY` are server-only and must never be prefixed `NEXT_PUBLIC_`.

**`PII_ENCRYPTION_KEY`** (added Phase 1, TASK-025) encrypts BVN/NIN at rest via `pgp_sym_encrypt` (see `supabase/migrations/010_domain_functions.sql`). It was generated once as 32 random bytes, base64-encoded, and lives only in `.env.local` — which is gitignored and therefore **not backed up anywhere by this repo**. **If this key is lost, every stored BVN/NIN becomes permanently undecryptable — there is no recovery path.** Before real beneficiary data is imported, copy it somewhere durable (a password manager, or a secrets manager if this deploys to Vercel) and set the same value there. Rotating it later requires decrypting every identifier with the old key and re-encrypting with the new one — not a task to improvise under pressure, so treat the current value as permanent once real data exists.

## Policy defaults needing Secretariat confirmation

**`categories.requires_arrival_accreditation`** (added Phase 2, TASK-033) — whether a category needs venue arrival accreditation (not just pre-games accreditation) to be payable. Seeded `false` for LOC only, `true` for everything else. This resolves PRD § 14 open question 3 with a reasonable starting assumption (LOC members organise before the Games start and may not go through the same venue arrival process as athletes/coaches/officials) — it is **not a confirmed policy**. Before real payments depend on it, confirm with the Secretariat which categories genuinely don't require arrival accreditation, and adjust via the reference-data admin screen (Phase 5, TASK-076) rather than a new migration.
