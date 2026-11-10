# Ward Flow — five audit prompts (2026-11-02)

Five self-contained, copy-paste-ready audit prompts for `BigSimmo/Ward-Flow`. Each is written to
run in a fresh session with no other context. Each is **read-only by default**: it produces
findings and evidence, not fixes or commits. Shared boundaries are baked into every prompt, so
any one can be pasted on its own.

Grounding used to write these: `AGENTS.md`, `package.json` (script inventory), the code map
(`docs/ward-flow/code-map/README.md`), `docs/agents/building-ui.md`, `script-budget.json`, and
memory of the 2026-11-01 M-series audit findings and open issues #1117 (backend uptime outage)
and #1118 (invariant-guard failures).

| #   | Audit                                         | Question it answers                                                                                           |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A1  | Full run-through & multi-surface simulation   | Does every screen actually work, end to end, on desktop, phone emulation, Android emulator and iOS simulator? |
| A2  | Engine & domain-logic integrity               | Is the state machine, authority model and data correctness sound, with no remaining unguarded paths?          |
| A3  | Tests, gates & evidence hygiene               | Do the checks that protect this repo actually run, pass, and mean what they claim?                            |
| A4  | Security, privacy & synthetic-data discipline | Could real data or secrets leak, and does the prototype honour its own privacy rules?                         |
| A5  | Accessibility, phone UX & performance budgets | Is it usable one-handed on a ward phone, by keyboard, and fast enough on first load?                          |

Suggested order: A1 first (it exercises the real app), then A2, A3, A5, A4. A1 and A3 both run
suites — don't run them in the same worktree at the same time.

---

## A1 — Full app run-through and multi-surface simulation

```text
You are auditing Ward Flow (BigSimmo/Ward-Flow), a prototype for psychiatric bed flow in Western
Australia running on 100% synthetic data. It is NOT validated clinical decision support. Your task
is a full manual-plus-scripted run-through of the entire app across every available surface:
desktop browser, phone-size browser emulation, Android emulator, and iOS simulator. You observe
and report; you do not fix, commit, or push.

START HERE
1. Read AGENTS.md at the repo root, then docs/agents/building-ui.md ("Local server safety") and
   docs/ward-flow/code-map/README.md plus the Screens A / Screens B / shell pages.
2. This is a custom Next.js (16.4.2) — check node_modules/next/dist/docs/ for anything you would
   otherwise judge from training data. The docs are authority, not your prior.
3. Establish checkout and ownership: record branch, HEAD SHA, and dirty files. The working tree
   may have Josh's uncommitted changes (branch fix/audit-remaining-authority-checks at the time
   of writing). Do not stage, stash, discard, or reformat anything. Never `git add -A`, never
   `git stash`.

HARD BOUNDARIES (non-negotiable)
- No providers without Josh's explicit yes in this session: no Supabase, Railway, GitHub/GitLab,
  hosted CI, live sites, network Git (including `git fetch`). Audit the LOCAL app in local
  synthetic mode only. Shared/Supabase mode is known-blocked anyway (issue #1117 backend outage) —
  record that as context, do not try to reach it.
- Synthetic data only. When the app needs typed input, use obvious fakes ("Test Referral A").
  No real-looking patient details in URLs, logs, screenshots, or your report.
- Read-only repo: your only writes are evidence artifacts under a NEW directory
  `audit-evidence/2026-11-02-A1/` (screenshots, logs, the report). Nothing else.

SERVER AND BROWSER SETUP
4. Run `npm run ensure`. Use ONLY the URL it prints. Never assume port 3000/3001/3002. Before any
   browser attachment, GET `/api/local-project-id` and confirm it identifies this project; if not,
   stop and report.
5. Prefer Chrome, then Edge. Do the desktop pass with Chrome DevTools MCP or browser-use control.
6. The app root is <printed URL>/ward-flow. There are 53 routes under /ward-flow plus sign-in and
   digest — enumerate them from src/app/ward-flow/**/page.tsx and ward-nav.ts (single source of
   nav truth), not from memory.

PASS 1 — DESKTOP FULL WALKTHROUGH
7. Drive every reachable route in local synthetic mode. Reuse scripts/ward-flow/
   audit-all-screens-visual.mjs if it still works, then fill gaps manually. For EVERY route record:
   renders without error; console messages (errors/warnings); failed network requests; screenshot.
8. Role matrix: the app has a role switcher (ward-role-switcher.tsx) and route-role previews.
   Walk the main desk roles (coordinator, ED, ward, community, on-call) and confirm each route
   shows the right desk's authority and never borrows coordinator authority elsewhere. Note any
   route reachable but broken for its role, and any nav link that 404s or renders stale chrome.
9. Golden-path journeys (synthetic): ED referral arrival → acceptance → bed allocation →
   movements → observation recording → leave → discharge → reflected in reports/chronology and
   statistics. Verify figures on screen come from state, not thin air (the code map calls
   invented figures the biggest recurring defect family — hunt for it live).
10. Edge paths: offline/online toggle (use-online-status), save-failure and retry UI,
    undoable steps, dirty-state guard, downtime pack and weekly report rendering with current
    seed data, demo reset, empty states. Unconnected controls must say "Not wired in this
    prototype." — flag any control that silently does nothing or lies about availability.

PASS 2 — PHONE EMULATION (desktop Chrome device emulation)
11. Repeat the top ~15 high-traffic routes at phone viewport (match the release-gate-phone
    Playwright project's viewport in playwright.config.ts). Check: no horizontal overflow,
    controls reachable one-handed, text size floors hold (npm run check:ward-text-size for the
    rule), modals usable, rail/nav behaviour.

PASS 3 — ANDROID EMULATOR (android-emulator plugin)
12. Run the plugin preflight. Boot or create a mid-range AVD (API 34-ish phone profile). Open the
    printed local URL in the emulator's Chrome. Walk the same top routes; capture screenshots and
    logcat for renderer crashes/ANRs. Confirm touch target behaviour and viewport meta are right
    on real Android Chrome, not just emulation.
13. Record precisely: emulator vs physical device (this is an emulator — say so), AVD model/API,
    Chrome version. If the plugin is unavailable, record that as unavailable evidence and rely on
    Pass 2, saying exactly that.

PASS 4 — iOS SIMULATOR (ios-simulator plugin)
14. Same pattern: preflight, boot an iPhone simulator, open the URL in Safari, walk the top
    routes, screenshots plus system log. Watch for iOS-specific issues: safe-area insets, 100vh
    behaviour, input zoom on focus, date pickers. Record simulator vs physical device honestly.

PASS 5 — SCRIPTED SUITES AS SIMULATION BACKSTOP (all local)
15. `npm run test:e2e:pr` (chromium, quarantine/mockup excluded), then
    `npm run test:e2e:release-gate` (release-gate-desktop + release-gate-phone). These are the
    repo's own journey simulations; failures are findings. Known context: a tour flake was fixed
    via #1113; if the tour flakes again, report it as recurrence, not a new defect.
16. Reconcile: routes covered by Playwright but not your manual pass, and vice versa.

EVIDENCE AND REPORT
17. Keep everything under audit-evidence/2026-11-02-A1/: per-route screenshot named by route,
    console captures, emulator/simulator captures, suite output.
18. Write audit-evidence/2026-11-02-A1/REPORT.md: a route x surface matrix (pass/fail/partial per
    surface), defect list with P0 (broken core journey) / P1 (wrong figure, broken control, role
    authority leak) / P2 (UX defect) / P3 (polish), each with route, surface, repro steps,
    screenshot reference, and suspected source file. End with an evidence classification:
    what is fresh vs reused vs skipped vs unavailable, and the known findings you did NOT
    re-report (2026-11-01 M-series audit, e.g. M3 out-of-area travel bands; #1117; #1118).
19. Plain Australian English. Answer first. No fixes applied. One numbered list of questions for
    Josh at the end, each with your recommendation.
```

---

## A2 — Engine and domain-logic integrity audit

```text
You are auditing the behaviour core of Ward Flow (BigSimmo/Ward-Flow), a synthetic-data prototype
for psychiatric bed flow in Western Australia. The engine is the behaviour authority: screens call
dispatch(event), and one reducer validates role, payload, view freshness and domain rules before
state changes or a refusal is recorded. Your task is a deep integrity audit of that engine and the
selectors screens rely on. Read-only: findings only, no fixes, no commits.

START HERE
1. Read AGENTS.md, then docs/ward-flow/code-map/engine.md and data-and-rules.md, then the source:
   src/components/ward-management/ward-flow-events.ts, ward-flow-event-roles.ts (EVENT_ROLE),
   ward-flow-reducer.ts, ward-flow-reducer-slices.ts, ward-flow-reducer-slice-registry.ts,
   ward-flow-persistence-classification.ts, and the pure selectors (ward-derivations*.ts,
   ward-occupancy.ts, ward-bed-states.ts, ward-legal-clock.ts and friends).
2. This is a custom Next.js 16.4.2 / React 19.3.1 tree — consult node_modules/next/dist/docs/
   before judging framework-level behaviour.

HARD BOUNDARIES
- Local and offline only. No Supabase, Railway, GitHub, hosted CI, network Git, or any provider
  action without Josh's explicit yes in this session. No live shared-mode testing (known outage,
  issue #1117).
- Synthetic data only; no real-looking patient details anywhere in your outputs.
- Do not modify tracked files. You may run local tests/scripts and write notes to a NEW directory
  audit-evidence/2026-11-02-A2/. Never `git add -A`, never `git stash`; leave the working tree's
  uncommitted changes untouched.

AUDIT PLAN
3. Event quadruple-check ("adding an event in one place" pitfall from the code map): for EVERY
   event type in ward-flow-events.ts, confirm all four exist — union member, EVENT_ROLE entry,
   reducer case (across the slice registry), persistence classification, plus a permissions test.
   Output a table; every gap is a finding.
4. Authority model sweep — this repo is mid-flight on branch
   fix/audit-remaining-authority-checks (commit 1e7652e2f "enforce audit authority checks and
   observation consistency"). Your job is to find the REMAINING gaps: enumerate every mutating
   action and every screen that can trigger it; confirm the engine checks the caller's role AND
   that the screen's view is not stale; confirm no reachable screen borrows coordinator authority
   for another desk (code-map rule 5). Cross-check src/components/ward-management/
   governance-access-review.ts and ward-access-*.ts / ward-role-*.ts against what the reducer
   actually enforces, not what the files claim.
5. Invariant sweep. Define and then test, from source and with local runs, at least:
   one active placement per patient; occupancy = occupied beds per ward/pod matches selector
   output on every screen that shows it; movement timelines monotonic; bed holds/closures cannot
   double-book; referral state transitions follow the allowed graph (ask/send/answer/commitment/
   followup/owner event families); leave/absence and readmission paths cannot strand a bed.
   Reuse and extend scripts/ward-flow/engine-fuzz-window.mjs for time-window fuzzing.
6. Clock and time: WardFlowProvider uses wall-clock plus 30-second ticks; initialNow pins it.
   Check every due-time, delay, on-call and legal-clock calculation for timezone handling
   (Australia/Perth), DST transitions, and end-of-month boundaries. D-70 ruling: the engine does
   NOT compute Mental Health Act expiry — it stores the entered due time, and no screen may show
   section references or a computed countdown. Verify nothing regressed against D-70.
7. Persistence and contention: local save/reload round-trip, typed-text ledger and scrub
   (ward-flow-typed-text-ledger.ts, ward-flow-typed-text-scrub.ts — D-72 scrubbed device copy),
   contention handling (ward-contention.ts), optimistic updates and undo
   (use-undoable-step.ts, ward-flow-undo-events.ts, ward-undo.ts), save-failure paths
   (ward-save-failure.ts). What happens on double-dispatch, stale tab, and reload mid-action?
8. Backend parity: backend/ward-flow has its own engine build and tests. Run
   `npm run test:backend` and `npm run typecheck:backend` locally and reconcile any divergence
   between the backend engine's rules and the front-end reducer's rules.

REPORT
9. audit-evidence/2026-11-02-A2/REPORT.md with: the event table (complete), authority-gap list
   (P1 each unless it exposes another desk's data — then P0), invariant results with the exact
   check that proved each, clock findings, persistence findings. Every finding cites file:line.
   Distinguish fresh evidence from reused. Note prior 2026-11-01 M-series findings you verified
   as still-open vs fixed (e.g. M3 travel bands) without re-reporting them as new.
10. Plain Australian English. Answer first. One numbered question list for Josh, each with a
    recommendation.
```

---

## A3 — Tests, gates and evidence hygiene audit

```text
You are auditing the verification system of Ward Flow (BigSimmo/Ward-Flow), a synthetic-data
prototype psychiatric bed-flow app. Question: do the checks that protect this repo actually run,
pass, and mean what they claim? Prototype Operating Mode applies (AGENTS.md): no clinical proofs,
advisory test floors, but every claim of "passing" must be real. Read-only: you run checks and
report; you do not fix tests or commit.

START HERE
1. Read AGENTS.md (hard rules 5 and 11), docs/agents/checks-and-evidence.md,
   docs/ward-flow/code-map/tests.md and scripts-and-tooling.md. This is a custom Next.js
   16.4.2 tree; consult node_modules/next/dist/docs/ before judging build-level behaviour.

HARD BOUNDARIES
- Everything local and offline: vitest, eslint, tsc, prettier, Playwright against local projects.
  No Supabase, Railway, GitHub, hosted CI, network Git, or provider calls of any kind without
  Josh's explicit yes in this session. Live/test:live suites are OFF LIMITS (shared backend is
  in outage, issue #1117 — record, don't attempt).
- No tracked-file modifications. Evidence only under a NEW audit-evidence/2026-11-02-A3/
  directory. Never `git add -A`, never `git stash`, never discard Josh's uncommitted changes.

AUDIT PLAN
2. Inventory first, from docs/ward-flow/code-map/tests.md and the tree: how many test files,
   which source modules have zero direct coverage, and whether the map's claims match reality
   (map entries are dated; verify against the tree). Flag especially the recently modified
   ward-management components on the current branch (community-index, coordinator-screen,
   delays-board, ed-index, movements-screen, on-call-screen, downtime-pack-screen,
   weekly-report-screen) and tests/ward-command-third-edition.dom.test.tsx — do their tests
   cover the changed behaviour?
3. Run the local suite ladder, in order, recording pass/fail/skip counts and wall time:
   `npm run test` (vitest, full), `npm run typecheck`, `npm run lint`, `npm run test:backend`.
   Use `npm run test:focused -- --files <changed files>` to check the related-test selector
   actually selects the right tests.
4. Expected-reds reconciliation: `npm run check:ward-expected-reds`. For every expected-fail
   entry, confirm the test still exists, still fails for the DOCUMENTED reason, and that no
   unexpected red is being hidden by the list. Any red not on the list is a finding.
5. Known-issue verification: tour flake supposedly fixed via #1113 — run the tour journey
   (find it in tests/ or Playwright specs) enough repetitions to say flaky or fixed (cap it,
   e.g. 10 runs; don't babysit for hours). PR #1118 reported invariant-guard failures — locate
   those tests and report their current local status.
6. E2E locally: `npm run test:e2e:pr`, then `npm run test:e2e:release-gate`. Record flaky-vs-
   stable by re-running only failures once. Check
   `npm run check:playwright-browser-revision` passes.
7. Gate health, each with its self-test where provided: `npm run guard:push:self-test`,
   sign-out guard (scripts/ward-flow/sign-out-check.mjs — note it has uncommitted modifications
   on this branch; test the working-tree version and say which you tested),
   `npm run check:diff-integrity`, `npm run check:verification-plan`,
   `npm run check:coverage-inventory`, `npm run check:knip` (dead-code baseline — list new
   candidates), `npm run check:mockups`, `npm run docs:check-links`, `npm run docs:check-scripts`.
8. Coverage reality: `npm run test:coverage` with reportOnFailure, then judge: does the
   coverage-inventory gate measure anything meaningful, or is it a rubber stamp? Advisory floors
   per Prototype Mode — report the floor values and actual counts.
9. Build-dependent checks: run `npm run build`, then the script-budget check
   (scripts/check-script-budget.mjs against script-budget.json — locate the exact invocation
   from HOW-WE-WORK §6 / the budget file's $comment). Report current per-route KB vs budget.

REPORT
10. audit-evidence/2026-11-02-A3/REPORT.md: the full ladder with real counts and times; a
    gate-by-gate table (gate, self-test, verdict, what it actually catches, what it misses);
    zero-coverage module list; flake verdicts; expected-reds audit. Every claim backed by the
    command output archived in the evidence directory. Explicit evidence classification:
    fresh / reused / skipped / failed / unavailable. Never claim a skipped or advisory check
    passed.
11. Plain Australian English. Answer first. One numbered question list for Josh, each with a
    recommendation.
```

---

## A4 — Security, privacy and synthetic-data discipline audit

```text
You are auditing Ward Flow (BigSimmo/Ward-Flow), a prototype psychiatric bed-flow app for Western
Australia, for security and privacy discipline, calibrated to Prototype Operating Mode: 100%
synthetic data, no live EHR, no clinical sign-off gates. The question is not "is this production-
hardened?" but "could real data or secrets leak today, and does the app honour its own privacy
rules (no typed text in browser storage, scrubbed copies, safe URLs)?" Read-only audit: findings
only, no fixes, no commits, no deletions.

START HERE
1. Read AGENTS.md (hard rules 1, 7), docs/ward-flow/DATABASE.md including its account-selection
   section, docs/agents/building-ui.md, and SECURITY.md. Custom Next.js 16.4.2 — use
   node_modules/next/dist/docs/ for framework facts, not training data.

HARD BOUNDARIES
- No provider actions without Josh's explicit yes in this session: no Supabase connection or
  query, no Railway, no GitHub/API, no network Git, no `npm audit` (network) — do dependency
  review from the lockfile locally instead, and note npm audit as a follow-up needing approval.
- Never print, copy, or transmit file contents that could contain secrets; when inspecting
  suspicious files, report path, size, and classification only.
- Do not modify or delete ANY file — several untracked artifacts (handover-docs.tgz,
  mockup-backup-2026-11-01/, republish/, screenshots/, ed-test.log, dev-server.log) are Josh's;
  classify them, touch nothing. Evidence notes only, under a NEW audit-evidence/2026-11-02-A4/.

AUDIT PLAN
2. Secrets: read scripts/check-client-bundle-secrets.mjs to learn the repo's own definition, run
   `npm run check:client-bundle-secrets`, then go beyond it: search tracked source for hardcoded
   keys/tokens/ connection strings; verify .env* patterns are gitignored and no real values are
   committed in history-visible files; confirm any Supabase reference in client code uses only
   publishable keys and that no service-role key path exists client-side (ward-supabase-auth.ts,
   ward-shared-client.ts, use-ward-supabase-shared.ts).
3. Untracked-artifact risk triage: for each untracked file/dir in `git status --porcelain`
   (the artifacts listed above, plus .mimosa/, .trigger-tree/, .v2c/), classify: could it contain
   secrets, typed text, or real-looking patient data? Check what a careless `git add -A` would
   stage (never run it — reason from .gitignore). This is a standing hazard: report it.
4. Privacy rule conformance (owner rules, HOW-WE-WORK §6 and D-67/D-72): no typed text in browser
   storage — trace what actually lands in localStorage/sessionStorage/IndexedDB in local synthetic
   mode (ward-flow-demo-storage.ts, ward-flow-typed-text-ledger.ts, ward-session-drafts.ts,
   ward-offline-copy.ts) and by running the app locally and inspecting storage; the scrubbed
   device copy must exclude original typed values and refuse to save an unsafe copy; URLs must
   stay safe (ward-safe-url.ts) — no patient names or typed text in query params; clipboard and
   download paths (ward-clipboard.ts, ward-download.ts) must not leak beyond expectation.
5. Auth and authority surface: map what authentication exists client-side vs what the reducer's
   EVENT_ROLE enforces; document clearly that prototype enforcement is client-side only and what
   that means; confirm route-role previews can't be mistaken for real authority; read the RLS/
   shared-mode assumptions documented in DATABASE.md and flag anything the front end assumes but
   no document guarantees.
6. Injection and client sinks: dangerouslySetInnerHTML uses, href/src assignment from state,
   window.open targets, any eval/Function, file-upload handling (ward-uploaded-file.ts),
   markdown/link rendering. XSS-relevant findings ranked by reachability.
7. Dependency posture (local only): from package-lock.json, list direct deps with known-risky
   majors or abandoned packages, and confirm the overrides block covers the intended packages;
   report `npm audit --omit=dev` as recommended follow-up requiring network approval.
8. Headers and transport (local build only): from next.config.ts, what security headers exist
   (CSP, X-Frame-Options, Referrer-Policy)? What does the app expose via /api routes — enumerate
   every route handler under src/app/api/** and classify each: auth required? data returned?

REPORT
9. audit-evidence/2026-11-02-A4/REPORT.md: findings with severity calibrated to prototype reality
   (P0 = real-data or secret leakage path; P1 = privacy-rule violation by the app's own standards;
   P2 = hardening gap; P3 = hygiene), each with file:line and proof. Include the artifact triage
   table and the explicit "not tested" list (e.g. live Supabase RLS — blocked by #1117 outage and
   by policy). Evidence classification: fresh / reused / skipped / unavailable.
10. Plain Australian English. Answer first. One numbered question list for Josh, each with a
    recommendation (e.g. recommended disposition for each risky untracked artifact — but you
    deleted nothing).
```

---

## A5 — Accessibility, phone UX and performance budget audit

```text
You are auditing Ward Flow (BigSimmo/Ward-Flow), a synthetic-data prototype psychiatric bed-flow
app, for accessibility, phone usability, and performance budgets. This app is meant to be used
one-handed on a ward phone by busy clinical staff, and every control must work or accessibly
explain why it is unavailable. Read-only audit: findings and evidence only, no fixes, no commits.

START HERE
1. Read AGENTS.md, docs/agents/building-ui.md, docs/ward-flow/SCREEN-DEFINITION-OF-DONE.md
   ("acceptable appearance and accessible controls"), and HOW-WE-WORK §6 (owner rules that fail
   builds: text size floors, script budgets). Custom Next.js 16.4.2 — use
   node_modules/next/dist/docs/ for framework facts.

HARD BOUNDARIES
- Local only: `npm run ensure` server (use only its printed URL; verify /api/local-project-id
  first; never assume a port), local builds, local Playwright. No providers (Supabase, Railway,
  GitHub, hosted CI, network Git) without Josh's explicit yes in this session. Shared mode is
  known-blocked (issue #1117).
- Synthetic data only in any typed input. Evidence under a NEW audit-evidence/2026-11-02-A5/.
  Never `git add -A`, never `git stash`; leave uncommitted work alone.

AUDIT PLAN
A. AUTOMATED AXE SWEEP
2. The repo ships @axe-core/playwright. Write a THROWAWAY spec under the evidence directory
   (not into tests/) that visits every route in local synthetic mode at desktop and the
   release-gate-phone viewport, runs axe, and dumps violations. Run it against the local server.
   Deduplicate violation types and rank by pages affected.

B. KEYBOARD AND FOCUS (manual, desktop)
3. Keyboard-only journey through the golden path: sign-in/role selection → coordinator → ED
   detail → referral acceptance → bed allocation → movements → discharge. Check: visible focus
   on every interactive element, logical tab order, modals trap and restore focus
   (ward-modal-focus.ts), drawers and the global search (ward-global-search.tsx) are keyboard
   operable, Escape behaviour, no keyboard traps, skip/landmark structure on the shell.

C. PHONE UX (Chrome device emulation + simulators if available)
4. At the phone viewport: one-handed reachability of primary actions on the top ~15 routes;
   touch target sizes (flag anything under ~44px); text size against the floor enforced by
   `npm run check:ward-text-size`; `npm run check:type-scale` and `npm run check:icon-scale`
   (both --strict); reduced-motion behaviour (ward-reduced-motion.module.css) with the OS
   emulation toggled; form controls and pickers usable on touch; sticky rails/bars not
   obscuring content; orientation change survival.
5. If the android-emulator and ios-simulator plugins are available in the session, repeat the
   top routes in an emulator Chrome and a simulator Safari for real-mobile confirmation
   (viewport quirks, safe areas, input zoom). Record emulator/simulator vs physical honestly;
   if unavailable, say so and rely on emulation alone.

D. PERFORMANCE BUDGETS
6. `npm run build`, then run the script-budget check against script-budget.json (five budgeted
   routes: /ward-flow, /referrals, /ed, /ward/rph-adult-secure, /movements/WF-001). Report
   actual vs budget KB gzipped per route and which routes are near their ceiling. Per
   HOW-WE-WORK §6, a PR may raise a budget by at most 5 KB per screen after a real trim attempt —
   report anything that would need more.
7. Lighthouse (Chrome DevTools MCP or equivalent) on /ward-flow, /ward-flow/ed and
   /ward-flow/movements/WF-001 at phone emulation: LCP, CLS, TBT, accessibility score. Capture
   the top opportunities. Also note render-heavy boards: large lists without virtualisation,
   30-second tick re-renders (WardFlowProvider) — spot-check with React DevTools profiling if
   available, else reason from component structure and label it as analysis, not measurement.

REPORT
8. audit-evidence/2026-11-02-A5/REPORT.md: axe violation summary (type x count x worst pages);
   keyboard journey step list with failures; phone UX findings per route; budget table (actual
   vs budget vs headroom); Lighthouse numbers; a top-10 fix list ranked by user impact vs effort,
   each with the suspected file. Evidence classification: fresh / reused / skipped / unavailable,
   and which surfaces were emulation vs emulator vs simulator.
9. Plain Australian English. Answer first. One numbered question list for Josh, each with a
    recommendation.
```

---

## Usage notes

- Each block is standalone — paste one into a fresh session with no other context.
- All five are read-only by default and write evidence only under new `audit-evidence/<date>-<id>/`
  directories. None will touch Josh's uncommitted changes on `fix/audit-remaining-authority-checks`.
- All provider actions (Supabase, GitHub, hosted CI, network Git) are gated behind an explicit
  yes in-session, per AGENTS.md hard rule 3. The audits are designed to be fully runnable without
  any provider, using local synthetic mode.
- Known context baked into the prompts so findings aren't duplicated: 2026-11-01 M-series audit
  (e.g. M3 travel-bands inversion), issue #1117 (backend outage — shared mode blocked),
  PR #1118 (invariant-guard failures), tour flake fixed via #1113.
