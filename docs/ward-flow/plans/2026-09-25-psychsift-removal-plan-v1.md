# Removing the rest of PsychSift — plan v1

25 September 2026. Follows [`2026-09-25-psychsift-retirement.md`](2026-09-25-psychsift-retirement.md)
(the first plan, batches 1 and 2, and the Phase 2 outline). Written by the "Remove PsychSift
leftovers" thread for the coordinator's finish plan.

## Where things stand

- **Folded:** batch 1 (25 design studies) and batch 2 (Railway settings and webhook).
- **Ready, not folded:** Ward Flow's own page frame (`ward/frame-ward-only-20260925`). Ward Flow
  pages no longer render PsychSift's sign-in, account, install-app, web-vitals or keyboard
  wrappers; PsychSift pages keep them in one `PsychSiftAppFrame` branch of the root layout.
- **Committed, checks queued:** batch 3a (`ward/psychsift-batch3-20260925`, stacked on the frame).
  It removes Care Plan, Caring Contacts (prototype, workspace app and its data routes) and the
  developer hub, with their tests. Josh approved it on 25 September.
- **Dropped:** a standalone "3b" (PsychSift's pages and data routes on their own). About 200 of
  its 404 files are tests that also cover PsychSift library code which would survive, so each
  would need hand-editing, only to be deleted later with those libraries. The rest of PsychSift
  goes in **one pass** instead, after steps 2 to 4 below.

## Step 2: cut the drags, don't move the files

The first plan said "move the 47 shared files into Ward Flow". Measured again, most of them are
not PsychSift at all. They are the app's shared building blocks: `ui-primitives.tsx`, the
sheet, tooltip, missing-value and text-field components, `cn.ts`, `client-store-factory.ts`, the
theme files, the brand mark, the developer-key gate, and the test helpers and runners. Moving
them would change about 60 Ward Flow import lines across files other threads own (the gender
split holds `ward-model`, `ward-flow-reducer`, `ward-screen` and `ward-board` until it folds),
for no behaviour gain. **They stay where they are**, and simply outlive PsychSift.

What does need changing is the handful of shared files that **drag PsychSift code in behind
them**:

| File                                                              | What it drags in                                             | Change                                                                                                                                                | Who edits it                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/form-register.ts` (9 Ward Flow users)                    | `form-ranker.ts` and, through it, PsychSift's search helpers | Split the plain register data from the ranking; Ward Flow keeps the data                                                                              | This thread; its Ward Flow users need no change if the export names stay |
| `src/lib/env.ts` (via `src/app/mockups/layout.tsx` and the proxy) | Supabase project settings, Python path, upload limits        | Give the mockups layout a two-line check of its own for the mockups switch                                                                            | This thread                                                              |
| `src/proxy.ts`                                                    | Supabase session refresh, CSRF, PsychSift redirects          | Keep only the nonce and CSP, the Ward Flow offline header, the developer-key gate and the constellation redirect; its PsychSift test cases go with it | This thread, in the removal pass                                         |
| `next.config.ts`, `src/instrumentation.ts`, Sentry configs        | Sentry, Supabase image hosts, therapy asset headers          | Remove                                                                                                                                                | This thread, in the removal pass                                         |
| `src/lib/tools-catalog.ts`                                        | App modes, Caring Contacts routes, catalogue search          | Remove with PsychSift; the Ward sandbox test's "no catalogue leak" case goes with it, since there is no catalogue left to leak into                   | This thread, in the removal pass                                         |
| `src/app/layout.tsx`                                              | `PsychSiftAppFrame`                                          | Delete that function and its two branches                                                                                                             | This thread, in the removal pass                                         |

## Step 3: sort the mixed tests (next, edit-only)

Fifteen PsychSift tests run inside the ward suite because they mention a Ward Flow path.
`developer-hub-panels` has gone with batch 3a. For each of the other fourteen, keep the Ward Flow
guard and write the PsychSift part up for retirement in the removal pass. **Nothing is skipped,
disabled or removed now**; every test keeps running until the pass that deletes its code.
Sorted on 25 September (each file read in full; line numbers are at `a3dc7caac0`):

| Test file                                                                      | Verdict                                                                                      | In the removal pass                                                                                                                                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit-ward-flow-main-guard`                                              | Keep: all Ward Flow (the commit-time "never to `origin/main`" guard)                         | Nothing                                                                                                                                                                       |
| `pressure-strip.dom`, `tracker-derivations`, `statistics-v4-primitives-tokens` | Keep: all test Ward Flow code                                                                | Nothing                                                                                                                                                                       |
| `guard-push`                                                                   | Keep: shared push-guard mechanics plus the Ward Flow `origin/main` guard (lines 837 to 1163) | Nothing                                                                                                                                                                       |
| `playwright-exit-code-contract`                                                | Keep: shared runner contract; one case reads a Ward Flow handover doc                        | Nothing                                                                                                                                                                       |
| `stale-resume-instructions`                                                    | Keep: repo-wide doc hygiene; "ward-flow" appears only in a fixture branch name               | Nothing                                                                                                                                                                       |
| `dependency-drift-check`                                                       | Keep: shared tool                                                                            | Trim the `rag` and `caring-contacts` entries from its real-surface list                                                                                                       |
| `viewport-fill-contract`                                                       | Keep: shared layout rule that Ward Flow screens still need                                   | Prune the four PsychSift exemption rows                                                                                                                                       |
| `proxy-session-refresh`                                                        | Split                                                                                        | Keep the Ward Flow independence case and the shared refresh and PWA cases that still apply after the proxy trim; retire the rest with the session refresh                     |
| `proxy`                                                                        | Split                                                                                        | Keep CSP, CSRF-mechanism, the Ward Flow gate, offline-header and constellation cases; retire Care Plan, developer hub, Caring Contacts, document-source and medications cases |
| `mockup-retirement`                                                            | Split                                                                                        | Keep the tool tests and the Ward Flow gated-prefix assertions; drop the retired prototypes' prefixes from the two committed-repository cases                                  |
| `design-system-adoption`                                                       | Split                                                                                        | Keep the checker-logic tests and the constellation redirect case; retire the real-manifest census and PsychSift component cases with PsychSift's pages                        |
| `ward-output`                                                                  | Retire with PsychSift                                                                        | Delete: it tests PsychSift's answer formatting (`src/lib/ward-output.ts`); the name is a hospital "ward note", not Ward Flow                                                  |

Until the pass, every one of these keeps running unchanged.

## Step 4: runners and gates

Every runner stays: Ward Flow's tests, build, lint and type check all go through them. What goes
is the PsychSift content inside them. Surveyed 25 September by reading each file (line numbers at
`f55e574c2e`, extraction only, nothing run). The hunks below are cut **in the removal pass**,
after the trees they describe are gone, so no pattern is removed while something still matches it.

| File                                                            | Keep                                                                                                                                                                       | Cut in the pass                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-vitest`, `run-heavy`, `test-run-selection`, `gate-arbiter` | Whole file                                                                                                                                                                 | Nothing. The arbiter's `db`, `rag` and `container` classes simply stop firing once `ci-change-scope` stops producing them                                                                                                                                                                                                                                                                                       |
| `gate-receipts`                                                 | Everything (Ward Flow's `chat-control` imports it)                                                                                                                         | Lines 310 to 314: the two Caring Contacts entries in `OUTCOME_AFFECTING_ENV_VARS` and their comment                                                                                                                                                                                                                                                                                                             |
| `run-playwright`                                                | Port and build-root handling, the lock, server wait and route probe, isolated build and start (Ward Flow's journeys run through it)                                        | Lines 40 to 74 except `mockupProjectRequested` (66 to 72): the Caring Contacts seeded server; 284 to 293 (its cleanup, keeping line 294); 434 to 454 (its start-up). Reword "PsychSift" in the messages at 22 to 25 and 247. Reduce `routeSmokePaths` (33 to 39) to Ward Flow routes                                                                                                                            |
| `ci-change-scope`                                               | The classifier engine (42 to 67, 553 to 763), the ward derivation (112 to 157, 180 to 192, 214), generic doc, source and config patterns, the ward self-tests (898 to 914) | The answer, Supabase and worker sentinels (7 to 19); the non-ward mockup patterns (159 to 178); the performance, database, RAG, ingestion and PsychSift container patterns (317 to 500, keeping `package.json`, the lockfile, `next.config.ts` and `tsconfig.json`); the medication lexicon special case (238 to 241); `plugins/clinical-kb` (249); their self-tests (1045 to 1196, 1215 to 1343, 1450 to 1486) |
| `test-environment`                                              | The `offlineTestEnvironment` function the runners call                                                                                                                     | The provider, database and Sentry key lists (1 to 52), the Caring Contacts database block (54 to 88, 96 to 101), `RAG_PROVIDER_MODE` (118) and the live-provider permission helpers (124 to 145). Check who reads `NEXT_PUBLIC_DEMO_MODE` (119) first                                                                                                                                                           |
| `playwright.config.ts`                                          | The `chromium-mockups` project (112 to 119) and the ward names in `mockupSpecPattern` and `testMatch`                                                                      | PsychSift names in the spec patterns (13 to 28, 53 to 54); the seeded-server block (31 to 49); the `chromium`, seeded, `firefox`, `webkit` and both mobile projects (101 to 110, 120 to 163), none of which a Ward Flow script selects                                                                                                                                                                          |
| `vitest.config.mts`                                             | The `node` and `jsdom` projects, the `@` and `server-only` aliases, the whole-repo coverage floor (44 to 47, re-baselined after the pass)                                  | The Caring Contacts database wiring and project (6 to 15, 119 to 123, 142 to 160); the Supabase coverage exclusion (35 to 40); the per-module coverage floors for RAG and clinical libraries (60 to 104)                                                                                                                                                                                                        |
| `.githooks/pre-commit`                                          | The Ward Flow index block (28 to 68) and the local-`main` fold guard (70 to 94)                                                                                            | The PsychSift library names in the site-map trigger (105) and `supabase/schema.sql` in the module-map trigger (111)                                                                                                                                                                                                                                                                                             |
| `.githooks/pre-push`                                            | Whole file (it carries the Ward Flow `origin/main` guard)                                                                                                                  | Nothing here; the drift check it describes lives in `guard-push`                                                                                                                                                                                                                                                                                                                                                |

Not yet surveyed, and needed before the pass: `guard-push` (its drift and auto-merge guards), the
four document generators the commit hook calls (site map, scripts index, codebase index,
design-system adoption), and the CI workflow file. The generators and the hook belong to the Fix
thread, and the pass waits for its hook work.

## The removal pass

One batch, after steps 2 to 4: PsychSift's pages and data routes, its libraries and components,
their tests, the Supabase migrations and functions, the worker and eval labs, the PsychSift parts
of `public/`, and the `package.json` scripts and packages nothing uses any more. Before it runs,
the exact deletion list goes to Josh as one question. Checks: the full fold gate, including the
build and the Ward Flow journeys, plus the frame's desktop screenshot comparison, because the
root layout changes again.

## Kept on purpose for now

- The four Caring Contacts plan-draft logic modules
  (`src/components/caring-contacts/workspace/plan-wizard/{plan-draft,plan-activation,patient-detail,stages}.ts`):
  PsychSift's account sign-out test clears their stored draft. They go in the removal pass.
- The developer-area gate, its hub components and their tests: orphaned by batch 3a, harmless,
  removed in the pass.
- The three developer-gated prefixes for the retired prototypes in
  `src/lib/developer-area/headers.ts`: they now gate nothing. Removing them changes the proxy's
  tests, so it rides with the proxy trim.

## Draft deletion list for Josh

Drafted 25 September from a fresh trace of the batch 3a branch. The counts will move a little
once steps 2 to 4 land, and the final list is regenerated just before the pass. Josh's version:

> **Removing the rest of PsychSift.** Everything below belongs only to PsychSift, the older app
> that shared this folder. Ward Flow's screens, its engine, its tests and its own documents are
> not on the list, and every item was checked to be something Ward Flow neither loads nor reads.
> Everything stays recoverable from a backup branch.
>
> 1. **About 210 PsychSift pages** (search, documents, dictionary, therapy, tools and the rest).
>    Ward Flow has its own pages and never links to these.
> 2. **About 50 data routes** that served PsychSift's search, answers, documents and uploads.
>    Ward Flow keeps the one address its local server check uses.
> 3. **About 480 screen parts and 390 code libraries** only PsychSift uses: its search bar,
>    answer and document viewers, sign-in and account code, and the clinical search engine.
>    The shared building blocks Ward Flow uses (buttons, sheets, tooltips, the theme) stay.
> 4. **About 1,000 PsychSift tests.** Ward Flow's own tests stay, and the few mixed tests keep
>    their Ward Flow checks.
> 5. **About 250 database files, 50 ingestion worker files and 130 public files** for
>    PsychSift's live database, document processing and downloads. Ward Flow uses made-up
>    patients in memory and never touches the database.
> 6. **About 280 PsychSift scripts and its GitHub, Docker and Railway settings.** Ward Flow's own
>    scripts and the test runners stay.
>
> Not in this list, and asked about separately: about 2,400 PsychSift documents (some are
> handover and decision records), and the Claude and AI tool folders, which the setup thread
> handles.

Appendix for the steward: the list is the tracer's non-Ward classes (`safe`, `frameOnly`,
`namedByKept`, `mixedTestLoads`) at pass time, minus Ward Flow's `.audit-reports/`, the root
`README`, `LICENSE` and contributor files (decide separately), `.design-sync/` (check its owner
first), and the 16 mixed tests handled in step 3. Regenerate with the thread's
`trace-ward.mjs` against the batch branch, then run `plan-exclusive.mjs` so no survivor loads,
names or visits a removed file. Trace of `a3dc7caac0`: pages 214, data routes 47, screen
components 478, libraries 386, tests 1,000, migrations and functions 247, worker and eval 47,
public 127, scripts 281, documents 2,451 (not in this pass).
