# Retiring PsychSift from the Ward Flow folder

**Plan written 25 September 2026 by the cleanup thread, at Josh's request: "remove any code that is
left over from the other project (database/psychsift) … begin with remove of easy things that are
safe and easy to remove while other stuff is happening."** Every number below was measured on the
ward line at `a2f12e9250` (9,021 tracked files). The line moves several times a day, so re-measure
before relying on a count.

## The short version

1. **Ward Flow is about 2,500 of the 9,021 files.** The rest is PsychSift (the psychiatry search app)
   and its tooling, left over from when Ward Flow was built inside it.
2. **Ward Flow's screens use only 47 PsychSift files directly**: the shared buttons, drawers and
   tooltips, the theme and brand mark, the developer-key gate in front of Ward Flow, and the WA
   legal forms list with the small search helpers it pulls in. These stay, and later move into Ward
   Flow's own folder.
3. **The easy removals are done**, on the branch `ward/psychsift-retirement-20260925` (not yet
   folded): 25 PsychSift design-study pages and the Railway deploy settings and webhook, 42 files.
   **Correction, the same afternoon:** this item first said about 2,280 files were safe to remove now.
   That was too many. The PsychSift pages are listed in the design-system adoption contract, which the
   pre-commit hook and a ward-suite test both check, and the PsychSift web routes are still called by
   PsychSift screens the shared frame loads. Both now wait for Phase 2.
4. **About 1,200 more are held in by three pieces of shared plumbing**, and come out after those are
   untangled: the app frame Ward Flow sits inside (PsychSift's page layout, sign-in wall and search
   bar), the test and check tools, and 15 PsychSift tests that run inside the ward suite.
5. **About 2,400 PsychSift documents need your yes** before they go, because some are handover and
   decision records. **614 Claude and AI tool files belong to the setup thread**, not this one.
6. **Railway:** nothing in this folder can deploy, because the Ward Flow line is never pushed. The
   leftovers (deploy settings, Docker files, GitHub workflows and a Railway webhook) are batch 2.
   The Railway connection in Claude's own settings is for the setup thread and you.
7. **One new risk to know about.** Once PsychSift is deleted from this line, the line must never be
   merged into PsychSift's GitHub `main`: that would delete the live app. The push guard that already
   blocks this stays in place until Ward Flow has a home of its own.

## How the trace was done

A read-only tracer walked every tracked file and followed four kinds of link: code imports (including
CSS and HTML loads), file paths named in code or settings (a test that reads a file, a script that
runs another), web addresses that Ward Flow's own code and tools call (for example the
`/api/local-project-id` check that `npm run ensure` makes), and the Next.js rules that wrap every page
in its parent layouts. It started from Ward Flow's screens, engine, tests (the whole ward suite as its
runner defines it), scripts, tool settings and documents, then added the shared frame and the git
hooks. A separate batch check then confirms, for each batch, that nothing left behind imports, reads
or visits anything the batch deletes, and that no folder a kept file names is emptied.

**What a trace like this cannot see:** a path built at run time from pieces, and text that only looks
like a path. So the trace decides what is _worth trying_, and the tests decide what is _safe_: every
batch is checked as described in "How each batch is checked" before the next one starts.

## What the trace found

| Group                                                                    |     Files | What happens to it                 |
| ------------------------------------------------------------------------ | --------: | ---------------------------------- |
| Ward Flow's own files (code, tests, scripts, documents)                  |     2,496 | Stays                              |
| PsychSift files Ward Flow's screens load                                 |        47 | Stays; later moves into Ward Flow  |
| PsychSift files only Ward Flow's tests and tools load                    |        57 | Stays; runners simplified later    |
| PsychSift tests inside the ward suite, and what they load                |   15 + 81 | Untangle first                     |
| Loaded only through the shared app frame                                 |       452 | Untangle first (step 2.1)          |
| Named by path in something kept (a gate, a runner, a test that reads it) |       567 | Untangle first, case by case       |
| Claude and AI tool folders (`.claude`, `.agents`, `.cursor` and others)  |   614 + 2 | Setup thread decides               |
| PsychSift documents                                                      |     2,407 | Needs Josh's yes (step 3.1)        |
| **Not used, read or checked by anything kept**                           | **2,283** | **Safe to remove now, in batches** |

**The 47 files Ward Flow's screens load.** `ui-primitives.tsx` and the four `primitive-recipes/`
files; nine files in `components/ui/` (sheet, sheet focus, tooltip, missing value, form field, text
field, overlay root, the pulse circle and its styles, design-system diagnostics); the brand mark and
theme (`clinical-dashboard/brand.tsx`, `use-theme.ts`, `lib/theme.ts`, `lib/brand-mark.ts`);
`contextual-back-link.tsx`; the developer-key gate and its route guard with
`lib/developer-area/{headers,link-access,link-access-shared}.ts`; the legal forms register
(`form-register.ts`) and the search helpers it drags in (`form-ranker`, `catalog-search`,
`keyword-query`, `search-scope`, `smart-search-intent`, `service-ranker`, `service-urgent-routing`,
`source-authority-registry`, `source-metadata`, `app-modes`, `document-flow-routes`,
`consolidated-mode-home-redirect`, `search-navigation-context`); `env.ts` with the three small files it
imports (`supabase/project.ts`, `python-bin.ts`, `upload-limits.ts`); `owner-scope.ts`; and
`types.ts`, `cn.ts`, `tailwind-merge.ts`, `client-store-factory.ts`.

**The 57 files only Ward Flow's tests and tools load.** The tool settings (package, TypeScript,
Vitest, Playwright, ESLint and its five rules, PostCSS, Prettier, git attributes), the test and
browser runners (`run-vitest`, `run-playwright`, `gate-arbiter`, `gate-receipts`, `test-run-lock`
and their helpers), `ensure-local-server.mjs`, five shared test helpers, and four PsychSift ledger
scripts, the developer hub panel list, the tools catalogue and two Caring Contacts route helpers,
which two ward tests reach into.

## Things found along the way

- **`src/lib/ward-output.ts` is PsychSift, not Ward Flow.** It formats PsychSift's clinical answers
  (`formatWardNote`, clipboard text, evidence maps) and dates from July 2026, before Ward Flow. Its
  test `tests/ward-output.test.ts` is in the ward suite only because its name starts with `ward-`, and
  the organisation registry lists the module as a Ward Flow root. Both should move out with PsychSift.
- **Fifteen PsychSift tests run inside the ward suite**, because they mention a ward path:
  `dependency-drift-check`, `design-system-adoption`, `developer-hub-panels`, `guard-push`,
  `mockup-retirement`, `playwright-exit-code-contract`, `pre-commit-ward-flow-main-guard`,
  `pressure-strip.dom`, `proxy-session-refresh`, `proxy`, `stale-resume-instructions`,
  `statistics-v4-primitives-tokens`, `tracker-derivations`, `viewport-fill-contract` and
  `ward-output`. Some guard Ward Flow (the push guard, the pre-commit main guard, the proxy's Ward
  Flow rules) and should become Ward Flow tests; the rest test PsychSift and should go with it.
- **The mockups layout imports PsychSift's whole search shell even though Ward Flow skips it.**
  `mockups-layout-client.tsx` returns Ward Flow's pages untouched, but its import alone pulls about
  370 PsychSift files into every Ward Flow page build.
- **`.audit-reports/` is Ward Flow's**, not PsychSift's: its screenshots and elevation reports come
  from `scripts/ward-flow/audit-*`. It is not part of this retirement.
- **The ward suite is red at its base.** The roadmap thread measured 79 failing files out of 648 at
  `a338c3067d`, with the type check passing. Removal batches are judged against that baseline.

## The plan

### Phase 1: safe now (done, on its own branch)

Each batch is a commit on the local branch `ward/psychsift-retirement-20260925`. Nothing is folded
into the ward line without Josh's yes.

| Batch                           | Files | What it is                                                                                                                                            | State                            |
| ------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1. PsychSift design studies     |    36 | 25 one-off study pages under `src/app/mockups/` that no kept file names, the 7 components only they use, and 4 tests; recorded in `mockups/README.md` | Done: `f8b855327e`, `e9b01e42de` |
| 2. Railway deploy settings      |     6 | `railway.app.json`, `railway.worker.json`, the Railway webhook route and the 3 PsychSift tests that only checked them                                 | Done: `004e81b057`               |
| 3. PsychSift product pages, API |     — | The PsychSift app's own pages and its API routes                                                                                                      | Moved to Phase 2: see below      |
| 4. The other 52 design studies  |     — | kept files name 43 of them by address (mostly `mockups-layout-client.tsx`), and `mockups.css` names the component folders of the other 9              | Moved to Phase 2, with the frame |

**Checked at `004e81b057`:** the full ward suite fails 78 files, all on the 25 September baseline and
none new; all 32 static Ward Flow routes load (27 render, 5 are deliberate redirect pages); the type
check, the organisation check and the diff-integrity check pass.

**Why batch 3 moved.** The first trace read `docs/design-system/adoption-contract.json` as a record,
but the pre-commit hook's adoption generator treats every page route it declares as required, and
`tests/design-system-adoption.test.ts` runs in the ward suite. The PsychSift API routes are called by
PsychSift screens (the search shell, the Caring Contacts workspace) that the shared frame still loads.
Both come out after step 2.1 below, with the contract trimmed in the same change.

**Held back from Phase 1 because a kept file still reads them:** the Supabase migrations (three are
read by a kept retrieval test, and two scripts walk the functions folder), the ingestion worker and
eval labs (two worker files load Python helpers, and a kept test reads a Caring Contacts migration),
and `public/` (Ward Flow's own screens and audit scripts use `public/mockups/`, and a browser spec
reads `public/llms.txt`). Each moves to Phase 2.

### Phase 2: untangle, then remove

1. **Give Ward Flow its own frame.** Replace the three shared pieces Ward Flow sits inside with
   Ward-only versions: a root layout without PsychSift's sign-in, account, install-app and web-vitals
   wrappers; a mockups layout that does not import the PsychSift search shell; and a proxy that keeps
   only the developer-key gate and the Ward Flow offline header. Trim `next.config.ts` (Sentry,
   Supabase image hosts, therapy asset headers) and drop the Sentry instrumentation. This frees the
   452 frame-only files. It changes how every Ward Flow page loads, so it gets its own thread, the
   default model at high effort, and a full browser check.
2. **Move the 47 shared files into Ward Flow**, cutting the search helpers `form-register.ts` drags in
   and the database settings `env.ts` carries. Update the organisation registry's roots to match, and
   remove `src/lib/ward-output.ts` from them.
3. **Sort the 15 mixed tests.** Rewrite the Ward Flow guards among them as Ward Flow tests; retire the
   rest with PsychSift. Point `tests/ward-sign-in-shell.dom.test.tsx`,
   `tests/ward-flow-sandbox.test.ts` and `tests/ward-ledger-stale-row-guard.test.ts` at Ward Flow's
   own code instead of PsychSift's.
4. **Simplify the runners and gates.** `run-vitest` passes through PsychSift's CI routing
   (`gate-arbiter`, `ci-change-scope`) and `gate-receipts` names PsychSift files. Keep what Ward Flow
   needs (the test lock, the ward suite, the diff-integrity check); retire the rest.
5. **Stop the pre-commit hook running PsychSift's document generators** (site map, scripts index,
   codebase index, design-system adoption). The "Add pre-commit checks" thread owns the hooks, so this
   is handed to it rather than done here.
6. **Then remove** what those five steps free, plus the Supabase, worker, eval and `public/` batches
   held back from Phase 1, and prune `package.json` scripts and packages no longer used (`openai`,
   the PDF and spreadsheet libraries, `pg`, Sentry, and Supabase once the frame no longer needs it).

### Phase 3: needs a decision first

1. **PsychSift documents (2,407 files).** Mostly the old issue inbox (1,154), branch review records
   (637), Caring Contacts (160), superpowers plans (127) and Care Plan (39). Some are handover and
   decision records, which the project rules protect. Removing them from this line does not destroy
   them: they stay in git history and on PsychSift's GitHub. **Needs Josh's yes, with the list shown
   first.**
2. **The three developer-gated prototypes, Care Plan, Caring Contacts and the Developer Hub.** The
   repository's own retirement policy treats removing these as an owner decision, and a ward-suite
   test currently requires them to exist. **Needs Josh's yes.**
3. **Claude and AI tool folders.** The setup thread decides, including the Railway entries in
   `.mcp.json`, `.codex/config.toml`, `AGENTS.md` and `CLAUDE.md`.
4. **A home of its own (recommended last step).** Once only Ward Flow remains, move it into its own
   local folder with no GitHub, Railway or Supabase attached. That removes the last way an accidental
   push could reach the live PsychSift app. A decision for later, not needed now.

## Railway leftovers

Railway deploys PsychSift from GitHub `main`. The Ward Flow line is never pushed, so nothing here
deploys. What is left over:

- **Deploy settings and images (batch 2):** `railway.app.json`, `railway.worker.json`, `Dockerfile`,
  `Dockerfile.worker`, `.dockerignore`, `.github/workflows/docker-image.yml`.
- **Railway webhook (batch 2):** `src/app/api/webhooks/railway/route.ts` and its test.
- **Railway settings in code (Phase 2):** the `RAILWAY_*` variables in `src/lib/env.ts` (loaded by
  the developer-key gate) and `.env.example`, plus scripts that check deploy readiness
  (`production-readiness.ts`, `check-env-parity.mjs`, `check-local-presence.mjs` and others).
- **Railway connections for Claude (setup thread):** the Railway server in `.mcp.json` and
  `.codex/config.toml`, the "Railway project safety" rules in `AGENTS.md`, and the Railway connector
  attached to Claude sessions on this machine (a claude.ai connector setting).

## How each batch is checked

Before the first batch, the branch base gets its own baseline run. After each batch:

1. **Type check** of the whole project: `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit`.
2. **Organisation checkpoint:** `npm run ward:organise:check -- --source working-tree`.
3. **Retirement gate** when mockups go: `node scripts/check-mockup-retirement.mjs` and
   `node scripts/check-mockup-retirement.mjs --diff <branch base>`.
4. **The 15 mixed tests** and any ward test that names the batch's area, with
   `node scripts/run-vitest.mjs <files>`.
5. **Diff integrity** for the deleted tests: each batch records its test deletions in
   `diff-integrity.json`, and `node scripts/check-diff-integrity.mjs --base <branch base>` must pass.
6. **The full ward suite** (`node scripts/check-ward-expected-reds.mjs`) at the end of each working
   session, not after every batch, so it does not hold the machine-wide test lock while other threads
   build. Its failing set must match the baseline's: any new failing file is a regression, and the
   batch that caused it is reverted.
7. **The Ward Flow screens**, once per session: start the server with `npm run ensure` and load every
   Ward Flow route once, checking for errors.

## Keeping other work safe

- The removal happens in a temporary clone in this thread's scratch folder, not in `ward-lead`, so no
  thread reading `ward-lead` sees anything change. Each commit is brought back to the main repository
  as the local branch `ward/psychsift-retirement-20260925` straight away.
- A backup branch of the ward line is made before anything is folded, and nothing is folded into the
  ward line without Josh's yes.
- Nothing under `.githooks/`, `.claude/`, `.agents/`, `.cursor/` or `docs/ward-flow/` is removed, and
  the six ward folders with uncommitted edits are not touched.
- The push guard (`scripts/guard-push.mjs` and `.githooks/pre-push`) stays, because it is what stops
  a PsychSift-free line from ever reaching PsychSift's GitHub `main`.
