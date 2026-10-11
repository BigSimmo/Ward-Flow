# Preserve Azure and switch Ward Flow to Supabase Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for bounded independent tasks, with serial integration and fresh review. Reuse the same task checkpoint.

**Goal:** Preserve Azure and configure Supabase `zakzoemeedfepxcstsou` as the temporary synthetic backend with email/password sign-in.

**Architecture:** Keep the common PostgreSQL transactional store, reducer and `/v1/workspace` command API. Add database/auth factories and browser identity adapters, retaining Azure and the local demo. Run the existing standalone Node server locally; no new deployment.

**Tech Stack:** Node 24, Next.js/React/TypeScript, PostgreSQL/pg, Supabase Auth, existing Azure SDKs.

**Spec:** `docs/superpowers/specs/2026-10-11-supabase-backend-design.md`

## Global constraints

- Synthetic only. Target only `zakzoemeedfepxcstsou`; no other Supabase project, Azure mutation, publication or deployment.
- Verify backup restore before backend changes. Preserve divergent histories, private setup and existing worktrees.
- Secrets and coordinator identity remain in private configuration; no transcript/console/Git disclosure.
- Keep retries, CAS, audit atomicity, origin protections and coordinator allowlisting.
- Focused proof plus required repository gates; no repeated unchanged checks or optional polish.

## Review focus

- Wrong project/role or foreign token must fail closed.
- Save retry must not repeat a committed command; stale writers must not overwrite the winner.
- Account changes must not adopt a previous account's late response or replay its queue.
- Recovery session must not enter workspace before password update.
- Supabase startup must not require or initialise Azure resources; demo must make no provider calls.

## Task 1: Recoverable Azure preservation

**Ownership:** Private backup directory only, outside repo. Preserve baseline and retained Azure history; encrypt private archive; separate protected key.

- [ ] Create self-contained Git bundle and private archive with hashed manifest.
- [ ] Restore both revisions; decrypt/check every archived file; check deployment archive readability.
- [ ] Record proof and key/restore locations; release backend tasks only on pass.

## Task 2: Scoped host grant and target preflight

**Ownership:** Parent, local host hook adapter/scope tests and private grant record.
**Interfaces:** Grant pins repository, current thread, project and reviewed SQL digests. Existing Railway scope remains separate.

- [ ] Write/run denied and permitted operation tests before adding the Supabase predicate.
- [ ] Add narrow predicate with default deny, including wrong chat/repo/project/SQL denial.
- [ ] Run scope tests and existing boundary self-test; inspect exact project/schema/Auth metadata.
- [ ] Record project identity or exact blocker; do not use another transport to evade denial.

## Task 3: Backend provider/auth adapters

**Ownership:** Backend worker: `backend/ward-flow/` except Azure runbooks/setup scripts and generated outputs; parent owns final integration/docs.
**Interfaces:** `readConfig` returns `databaseProvider`, `authProvider`, shared/store settings; Azure remains default. Supabase settings use `WARD_SUPABASE_PROJECT_REF`, `WARD_SUPABASE_URL`, `WARD_SUPABASE_PUBLISHABLE_KEY`, `WARD_SUPABASE_DATABASE_URL`, `WARD_COORDINATOR_USER_IDS`; UUID allowlist maps to existing `coordinatorIds`. Existing shared HTTP wire shapes remain unchanged.

- [ ] Add failing provider/startup/Auth tests; observe feature failures.
- [ ] Add Supabase pool and bounded Auth verifier, generic factories, provider-selecting configuration/startup, provider-neutral error copy.
- [ ] Preserve Azure factory and targets; separate migration administration/runtime; add private-schema role SQL and compatible migration setup.
- [ ] Run focused backend tests; record skips for unavailable loopback PG; independently review and commit named files.

## Task 4: Browser identity and sign-in

**Ownership:** Frontend worker: `ward-shared-access.tsx`, `ward-shared-client.ts`, new adjacent auth modules/CSS, focused tests, `security-headers.ts` and its tests. Parent owns package/lock updates.
**Interfaces:** `NEXT_PUBLIC_WARD_AUTH_PROVIDER=entra|supabase`; `NEXT_PUBLIC_WARD_SUPABASE_URL`, `NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY`; existing `NEXT_PUBLIC_WARD_API_BASE_URL`. Keep existing shared connection contract; signIn opens credential form in Supabase mode. Execution ruling: use a small supported REST adapter to preserve active package/lock ownership. Nominated signup is confirmation-only, with browser-visible email supplied only by private local configuration; the server UUID allowlist remains authoritative.

- [ ] Read installed Next docs before source edits; add failing auth/session/disposal/CSP tests.
- [ ] Retain Entra behaviour; implement scoped Supabase email/password, refresh, sign-out and password recovery.
- [ ] Abort/dispose pending client work and suppress late responses. Keep demo lazy/no network.
- [ ] Allow exact Supabase and configured loopback API origin in dev; no wildcard/provider-wide allowances.
- [ ] Run focused frontend/security tests; independent review and named-file commit.

## Task 5: Hosted setup and local proof

**Ownership:** Parent only, after backup, scoped grant and stable adapters.

- [ ] Inspect existing schema objects/grants; apply compatible reviewed additive migrations, separate role grants and fresh workspace.
- [ ] Configure exact runtime pooler role/TLS credentials privately; prove current_user/grants and refusal of DDL/audit deletion.
- [ ] Resolve nominated account UUID and private password entry; no public registration or weakened confirmation.
- [ ] Run `npm run ensure`, map `/api/local-project-id` to this checkout; start owned local backend and configure exact origin.
- [ ] Verify owner save/reload/restart, denied allowlist and two-client revision conflict; record live-backed proof separately.

## Task 6: Review and recoverable handoff

- [ ] Add concise Supabase setup/provider presets/return-to-Azure documentation; update WF-33/WF-29/WF-57 checkpoint.
- [ ] Run focused combined checks, typecheck and required local gates once on final stable inputs.
- [ ] Fresh whole-branch review; fix substantive findings with focused regression proof.
- [ ] Format owned files and commit coherent named paths locally. No push/PR/deployment.
- [ ] Deliver backup/key locations, local URL, proof and exact remaining owner action.
