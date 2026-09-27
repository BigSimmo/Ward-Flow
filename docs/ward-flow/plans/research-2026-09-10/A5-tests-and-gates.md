# A5 — Tests and gates guarding the Ward Flow demonstration

Source: `D:/Worktrees/Database/readonly-plan-20260910`, detached at `20eb850792` (confirmed by
`git rev-parse HEAD`, verified by reading source). All counts below were measured directly against
this commit unless marked "read from a document."

## 0. Orientation: THREE separate ward artefact families, with different gates each

This matters more than any single test file. There are three unrelated things called "ward
mockups," and a plan must not assume one family's gates protect another.

| Family                                  | Where                                                                                                                                                                      | Guarded by                                                                                                                                                                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — live React feature**              | `src/components/ward-management/**`, routed at `src/app/mockups/ward-flow/**` (behind `DeveloperAreaGate`)                                                                 | The 361 `tests/ward-*.test.ts(x)` files + 12 `tests/ui-ward-*.spec.ts` Playwright journeys (all of section 1-4 below)                                                                                                                             |
| **B — byte-pinned static prototypes**   | `docs/ward-flow/design/prototypes/*.html`                                                                                                                                  | Exactly 2 Vitest files: `tests/ward-mockup-tokens-resolve.test.ts:34` and `tests/ward-statistics-v3-language.test.ts:22` (both `readdirSync`/`readFileSync` over that one directory). Excluded from Prettier: `.prettierignore:108`               |
| **C — the third-edition demonstration** | `docs/ward-flow/mockups/*-third-edition.html`, `WARD-FLOW-DESIGN-SYSTEM.md`, `third-edition-kit/*` — **this is what the current worktree's git status shows being edited** | **Zero Vitest tests** (verified: `grep -rl 'ward-flow/mockups' tests/` returns nothing). Not in `.prettierignore`, so it IS subject to whole-tree Prettier. Its only gate is the standalone `third-edition-kit` harness (section 2d), run by hand |

If this phase's work is Family C (the git status strongly suggests it is), the 361-file suite in
sections 1–4 below is **not a catcher for it at all** — it guards a different, unrelated codebase
that happens to share the word "ward." Read section 2d and section 6's Family-C row before assuming
any test in section 1 will catch a mistake in a `*-third-edition.html` file.

## 1. Test inventory (Family A), grouped

Exhaustively listing 361 files with a one-line pin each would run to ~5,000 words on its own, so
this groups by kind per the brief and gives verified aggregates, with representative files.
Full per-file listing available on request (I can re-run the grep and dump it if wanted).

| Group                                                          | Files                                                                           | `it`/`test` cases        | Use `readFileSync` (test:focused-blind)  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| Model/reducer/derivations/contract (`ward-*.test.ts`, non-DOM) | 217                                                                             | 2,296                    | 96 (44%)                                 |
| DOM render (`ward-*.dom.test.tsx`)                             | 144                                                                             | 1,321                    | 20 (14%)                                 |
| Browser journeys (`ui-ward-*.spec.ts`, Playwright)             | 12                                                                              | 100 `test(` declarations | n/a — different runner                   |
| Helpers (not tests)                                            | `tests/helpers/ward-{caption,invented-figures,place-names,referral-history}.ts` | —                        | shared fixtures many of the above import |
| Live red/deferral registry                                     | `tests/ward-expected-reds.json`                                                 | —                        | see section 4                            |

**One filename trap**: `tests/forward-codify-retrieval-targets.test.ts` matches `*ward*` but is a RAG
test — "ward" is inside "forward." `scripts/run-ward-tests.mjs:125-129` documents this exact trap.
Excluded from all counts above.

**readFileSync note (own finding, not from the memory doc alone)**: `scripts/test-focused.mjs:70`
forwards straight to `vitest related --run`, which selects tests by Vitest's static import graph.
A test that only reads a changed file via `readFileSync` (a doc, a CSS file, another test file's
text) has no import edge to it, so `vitest related` cannot select it even though its assertions
depend on that file's content. 44% of the non-DOM ward suite is invisible to focused runs this way.

Representative files (path, cases, `readFileSync` uses, one-line pin — verified by reading each
`describe(...)` and by grep):

| File                                              | Cases | readFileSync | Pins                                                                    |
| ------------------------------------------------- | ----- | ------------ | ----------------------------------------------------------------------- |
| `tests/ward-flow-reducer.test.ts`                 | 51    | 0            | reducer/seeding transitions                                             |
| `tests/ward-model.test.ts`                        | 25    | 0            | model constants                                                         |
| `tests/ward-model-phase3.test.ts`                 | 11    | 0            | Phase-3 model additions                                                 |
| `tests/ward-referral-matching.test.ts`            | 35    | 2            | matching-engine scoring                                                 |
| `tests/ward-statistics-derivations.test.ts`       | 44    | 0            | derived statistics figures                                              |
| `tests/ward-component-reachability.test.ts`       | 4     | 2            | every rendered component is still reachable by a coordinator            |
| `tests/ward-route-component-binding.test.ts`      | 2     | 2            | every ward route renders the component it's pinned to                   |
| `tests/ward-mode-workspace-reachability.test.ts`  | 2     | 2            | every rendered mode is still reachable                                  |
| `tests/ward-event-reachability.test.ts`           | 3     | 3            | every reducer event is reachable from a screen or logged as a known gap |
| `tests/ward-nav.test.ts`                          | 34    | 4            | route enumeration sanity                                                |
| `tests/ward-seed-reaches-every-branch.test.ts`    | 2     | 0            | seed data exercises every referral-screen branch                        |
| `tests/ward-css-token-references-resolve.test.ts` | 8     | 4            | CSS custom properties resolve                                           |
| `tests/ward-design-language-contract.test.ts`     | 17    | 15           | design-token contract text scan                                         |
| `tests/ward-mutation-tooling.test.ts`             | 10    | 6            | the mutation harness's own refusals (see section 6)                     |
| `tests/ward-expected-reds-manifest.test.ts`       | 5     | 4            | the red-registry file itself is well-formed                             |
| `tests/ward-expected-reds-comparison.test.ts`     | 7     | 0            | manifest vs. actual failing set, both directions                        |

No documented per-suite run time was found for the full ward Vitest population (`NOT CHECKED`
below). Two Playwright timings ARE documented (section 4): 5.1 min for 74 tests (2026-09-06) and
10.9 min for 171 tests across the whole `chromium-mockups` project, not ward-only (2026-09-10).

## 2. Gate commands a builder must know

**(a) Focused run on changed files** (Family A only; misses the 44% readFileSync-blind set):

```
npm run test:focused -- --files <paths>
```

Fails closed (exit 2, "Run the full unit suite with: npm run test") for deleted files, or any
changed path matching `tests/`, `scripts/`, `.github/`, `package(-lock).json`, `tsconfig*`,
`vitest.config*`, `next.config*`, `eslint*` — verified `scripts/test-focused.mjs:9,34-49`.

**(b) Ward structural/contract checks** — three purpose-built wrappers, none wired into
`verify:cheap`/`verify:pr-local`/CI (verified: none of these three names appear in `package.json`'s
`verify:cheap:internal` chain or in `.github/workflows/ci.yml`):

```
node scripts/run-ward-tests.mjs                          # every tests/ward-*.test.ts(x), refuses if any handed-in file produced no result (P1-05 guard)
node scripts/check-ward-expected-reds.mjs                # actual failing set === tests/ward-expected-reds.json, both directions
node scripts/check-ward-citations.mjs                    # verifies every SHA/path cited in docs/ward-flow/*.md still resolves
```

`run-ward-tests.mjs` explicitly does **not** take the repository's heavy-run lock (own header,
`scripts/run-ward-tests.mjs:33-44`) — running it concurrently with other heavy work is a known,
stated gap, not an oversight.

**(c) Browser journeys — inert by default, and how to arm them.** `playwright.config.ts:101-119`:
the default `chromium` project uses `grepInvert: mockupTag` (`/@mockup/`); every `ui-ward-*.spec.ts`
describe block carries that tag (verified e.g. `tests/ui-ward-coordinator.spec.ts:94`). So
`npm run test:e2e:pr` (which `verify:ui` calls) collects zero ward tests. To arm them:

```
npm run ensure                    # start/confirm the dev server first (AGENTS.md Local Server Safety)
npm run test:e2e:ward-journeys    # chromium-mockups project, files starting ui-ward- only
npm run test:e2e:advisory         # broader: chromium + chromium-mockups, @quarantine|@mockup, ALL advisory journeys not just ward
```

This is deliberate design ("a red mockup can never mask a production-journey regression," comment
at `playwright.config.ts:13-14`), not a bug.

**(d) The mockup harness (Family C)** — standalone, no npm/CI wiring at all (verified:
`grep 'third-edition-kit' package.json` returns nothing). Per
`docs/ward-flow/mockups/third-edition-kit/AGENT-BRIEF.md:51-58`, from repo root, one file at a time:

```
npx prettier --write docs/ward-flow/mockups/<page>-third-edition.html
node docs/ward-flow/mockups/third-edition-kit/check.mjs <file> platinum
node docs/ward-flow/mockups/third-edition-kit/check-shell.mjs <file> platinum
node docs/ward-flow/mockups/third-edition-kit/shots.mjs <file> <scratch>/shots/page platinum
```

These scripts launch Playwright's Chromium directly and do **not** go through
`scripts/run-playwright.mjs` or the heavy-run coordinator — they can run alongside a locked gate,
but nothing coordinates two agents running the harness at once either.

**(e) Formatting.** Family C files are ordinary Prettier targets (`npm run format` = `prettier
--write .`, `package.json:177`); Family B (`docs/ward-flow/design/prototypes/`) is deliberately
excluded because whole-tree Prettier broke 10 byte-pinned tests on 2026-09-10
(`.prettierignore:103-108`). The repo-wide format-before-push rule in `AGENTS.md` applies to Family
C unchanged.

**(f) What runs once at the end, and the lock.** `verify:cheap`, `verify:pr-local`, `verify:ui`,
`verify:release`, and any full `npm run test`/build/lint take an **exclusive** lease from
`scripts/test-run-lock.mjs:346` (`acquireHeavyRunLock`); at most 2 **shared** focused-test/typecheck
leases are allowed concurrently, cross-worktree. A refusal surfaces as **exit 75** with marker
`DATABASE_HEAVY_RUN_ADMISSION_BUSY` — verified at `scripts/run-playwright.mjs:112-135` and
`scripts/run-heavy.mjs:57-79` (detection mirrored in `scripts/guard-push.mjs:1048-1070`). Exit 75
means "blocked, retry" — never treat it as a test failure.

## 3. What goes red when a Family-A screen is redesigned

From `docs/ward-flow/archive/dated-notes/what-goes-red-when-you-redesign-2026-09-05.md` (measured across 261 files then;
361 today — **read from a document, not re-measured**), plus my own check of two of its cited lines
against current source:

| #           | What reddens                                                                         | File                                       | Wanted or noise                                                              |
| ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| 1           | 6 table-min-width pins (30/44/46/48/35/27.5rem)                                      | `tests/ward-table-min-width.test.ts`       | **Wanted** — moves only when a column count changes; re-derive, don't delete |
| 2           | ~40 `toHaveLength(n)` element counts                                                 | scattered across DOM tests                 | Wanted when screen-content count genuinely changes                           |
| 3           | 4 ordering assertions (`firstElementChild`)                                          | `tests/ward-referral-screens.dom.test.tsx` | Wanted — reordering is a real claim                                          |
| 4           | Wording assertions, ~95 total, ~7 confirmed reworded to match concepts not sentences | various                                    | Mostly already redesign-safe; the other ~88 unverified                       |
| Not fragile | 23 `tagName` (`SELECT`/`BUTTON`/etc.) accessibility contracts                        | various                                    | Keep — these should fire if a control becomes a `<div>`                      |

Zero hex/rgb/oklch/hsl/`getComputedStyle`/snapshot assertions exist in the suite — a pure visual
restyle (palette, spacing, radii, shadows) of Family A breaks nothing here. **This document says
nothing about Family C** (the actual `*-third-edition.html` files) — there is no equivalent analysis
for them because, per section 0, no Vitest test touches that directory at all. I found no newer
document superseding this specific analysis for Family A.

## 4. Currently red or deferred

**Family A Vitest suite**: `tests/ward-expected-reds.json` currently declares `"expected": []` —
the manifest asserts the suite should be fully green right now (verified by reading the file). This
is enforced (both directions, floors `FLOOR_FILES=200`/`FLOOR_TESTS=2500` against a real population
of 361/3,617) but **only when someone runs `node scripts/check-ward-expected-reds.mjs` by hand** —
it is not in any automatic chain.

**Family A/mockup Playwright journeys**: per `docs/ward-flow/archive/dated-notes/deferred-ward-browser-failures-2026-09-10.md`
(owner ruling, 2026-09-10) — a single first-ever `chromium-mockups` run, 171 declared/171 run, 151
passed, 15 failed, 5 skipped:

| Where                            | What                                                                                                                                        | Status                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-ward-referrals.spec.ts:1056` | 4 approved table columns off-screen at 641px                                                                                                | Real reachability defect; owner **deferred** repair, unanswered design question left open (drop/stack columns, or make scrolling visible) |
| `ui-ward-referrals.spec.ts:414`  | seed order assertion, expected 0 got 2                                                                                                      | Suspected stale fixture vs. real defect — **unconfirmed**, doc explicitly warns against assuming "stale fixture"                          |
| `ui-ward-roles.spec.ts:559`      | testid not found for `peel-ed`                                                                                                              | Same caveat as above                                                                                                                      |
| 12 more failures                 | non-ward mockups (`caring-contact-mockup`, `tools-collapse`, `tools-task-directory`, `sidebar-live-mockup`, `answer-chat-perfected-mockup`) | Out of scope for any ward deferral; unowned                                                                                               |

⚠️ Only ONE run — repo policy needs 3 reproductions on one SHA before any quarantine claim, and
these journeys run under neither `verify:ui` nor `test:e2e:pr`, so this snapshot could be stale by
weeks with no regression having occurred. An earlier 2026-09-06 run
(`docs/ward-flow/archive/dated-notes/ward-browser-journeys-first-run-2026-09-06.md`) found 8→2 failures after same-day
triage; none of that triage is the same failures as the 2026-09-10 set.

CI carries a non-blocking `ui-ward-journeys` job (`continue-on-error:` gated on
`vars.WARD_JOURNEYS_BLOCKING != 'true'`, verified `.github/workflows/ci.yml:865-872`) — it runs on
every UI PR but cannot fail a merge while that variable stays unset.

## 5. Hook constraints

**Pre-commit** (`.githooks/pre-commit`) does not block on ward content directly; it blocks on
**documentation sync**. The `src/components/`/`tests/` refusal mechanism cited in `AGENTS.md`
resolves to this exact code path: staging any file under `src/app/`, `src/components/`, `tests/`
(among others) sets `sync_design_system_adoption=1` (`:40-41`); the hook then checks the **working
tree** (unstaged + untracked) for any file matching that same pattern, and if any exist, refuses
with "Documentation inputs have unstaged or untracked changes" (`:61-67`, exit 1) — this is why a
concurrent agent's untouched-but-uncommitted edit under `tests/` or `src/components/` blocks your
otherwise-unrelated commit.

**Pre-push** (`.githooks/pre-push`) delegates entirely to `scripts/guard-push.mjs` (6 guards: auto-
merge ownership — no override; in-flight CI; format-before-push; drift-manifest freshness; static
gate; ledger-write discipline). `GUARD_PUSH_DISABLE=1` bypasses everything except the auto-merge
guard.

**Never `git add -A`**: standing repo rule (AGENTS.md), not hook-enforced; relevant here because
multiple ward chats/worktrees are commonly live at once per the coordination docs.

**`.prettierignore` ward entries**: only two ward paths are excluded, both for the same reason
(content-addressing or byte-pinning would break under reformatting) — `docs/ward-flow/control/**`
JSON/`.md` records (SHA-256-named or append-only, `:85-101`) and `docs/ward-flow/design/prototypes/`
(`:103-108`, Family B, byte-compared against `statistics-language-*.css`). **Family C
(`docs/ward-flow/mockups/*.html`) is NOT in this list** — it gets normal whole-tree formatting.

## 6. Catcher menu

| Build task                                              | Family A catcher (if touching `src/components/ward-management`)                                                                                                                         | Family C catcher (if touching `*-third-edition.html`)                                                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New route / nav wiring                                  | `tests/ward-route-component-binding.test.ts`, `ward-mode-workspace-reachability.test.ts`, `ward-nav.test.ts`                                                                            | **None exists.** Closest pattern: none in Family C at all — the third-edition-kit's `check-shell.mjs` only proves the shell copy is intact, not that a link resolves           |
| New component                                           | `ward-component-reachability.test.ts` (proves it's still reachable, not that it's correct)                                                                                              | **None exists** — copy-review only, per AGENT-BRIEF §"Do, in this order" step 1                                                                                                |
| Model field                                             | `ward-model.test.ts` / `ward-model-phase3.test.ts` pattern — add a case there                                                                                                           | N/A (no model in static HTML)                                                                                                                                                  |
| Selector/matching logic                                 | `ward-referral-matching.test.ts` pattern                                                                                                                                                | N/A                                                                                                                                                                            |
| Seed data                                               | `ward-seed-reaches-every-branch.test.ts`, `ward-admissions-seed.test.ts`                                                                                                                | N/A — "invented data" is reviewed by eye per AGENT-BRIEF §8 wording rules, no automated check for honesty-of-invented-figures in Family C                                      |
| Shell change                                            | `ward-shell-mounted.dom.test.tsx`, `ward-shell.dom.test.tsx`                                                                                                                            | `check-shell.mjs` (Family C) — but only for the ONE file it's run against; copying shell drift into a second file is not cross-checked automatically                           |
| Statistics chart                                        | `ward-statistics-derivations.test.ts` (numbers), `ward-statistics-ed-wait-chart.dom.test.tsx` (render)                                                                                  | **None exists** — `check.mjs` checks tokens/contrast/type-scale generically, not chart-specific correctness                                                                    |
| CSS token / colour                                      | `ward-css-token-references-resolve.test.ts`, `ward-design-language-contract.test.ts`                                                                                                    | `check.mjs` (7/7 mutation-proven claims per `third-edition-review-2026-09-09.md` §3) and `recompute-contrast.mjs` (now has a real failure path — see section 7)                |
| Proving a **new** test is a real catcher, either family | `npm run mutate` / `npm run mutate:self-test` (`scripts/ward-flow/mutation-run.mjs`) — crash-safe mutation driver, restores from captured bytes not `HEAD`, verifies restore by content | Same script is Family-A-shaped (targets `src/`/`tests/`); no Family-C equivalent — the harness's own `check.mjs` mutation-proof (section 7) was done by hand, not by this tool |

## 7. Defects noticed (evidence only, verified by reading current source)

1. **`ward-ed-psychiatry-hub.dom.test.tsx:1687`** — `expect(245 - 35, "...").toBe(210)` is two
   integer literals; no production code can redden it. **Still present at the pinned commit** (I
   grepped it directly). The doc that found this (`wf-build3-004-dom-test-sweep.md`) notes the real
   guard sits two lines away via `data-minutes-in-department`/`data-minutes-since-referral` — only
   the dead literal-arithmetic line is spurious.
2. **`ward-board-fixed-note` testid asserted absent in two tests, never asserted present, and
   doesn't exist anywhere in `src/`** — `tests/ward-board-live-state.dom.test.tsx:129`,
   `tests/ward-daily-sheet.dom.test.tsx:294`; confirmed absent from `src/` by grep. Re-adding the
   frozen-board note under any other id, or none, passes both tests while silently reintroducing the
   defect they were written to catch (per the sweep doc).
3. **A 2026-09-09 review of the third-edition kit (`third-edition-review-2026-09-09.md` §3) found
   `recompute-contrast.mjs` had no failure path at all and rewrote its own reference file on every
   run.** Verified against the **current** pinned commit: this is **already fixed** —
   `recompute-contrast.mjs:136-142` now sets `process.exitCode = 1` when any pair is below 4.5:1 or
   disagrees with `contrast-pairs.json`. Same review's hardcoded-`/opt/pw-browsers/chromium` finding
   for all three Playwright-driving checkers is also fixed: `check.mjs:9-14`, `check-standard.mjs:13-18`,
   and `shell/check-preview.mjs:17` all now guard with `existsSync` and fall back to Playwright's own
   Chromium. **Not checked**: whether `recompute-contrast.mjs`'s self-rewrite-before-comparing
   behaviour was also addressed — I did not trace its `write` flag's default.
4. **`check:ward-expected-reds` and `run-ward-tests.mjs` are real, well-built gates that run in
   neither `verify:cheap`, `verify:pr-local`, nor CI** — confirmed by grep across all three; they
   exist only as manually-invoked npm/node scripts. A builder who runs the standard verification
   pyramid and nothing else will never see either.

---

PROVEN BY READING SOURCE: the three-family split and each family's exact test population/counts;
the `readFileSync`/`vitest related` focused-blind mechanism and its 44%/14% rates; every exact
command and file/line in sections 2 and 5; the pre-commit `src/components`/`tests` refusal
mechanism; the four items in section 7; the `.prettierignore` ward entries and their absence for
Family C; `ward-expected-reds.json`'s current empty state; the two now-fixed 2026-09-09 kit defects.

NOT CHECKED: no documented aggregate run time for the full Family-A Vitest population; whether any
of the ~88 unconfirmed wording assertions in section 3 item 4 have since been reworded; whether
`recompute-contrast.mjs` still overwrites its artefact before comparing; current reproduction status
of the three 2026-09-10 ward Playwright failures (only one run exists, per the doc itself); the
remaining 53 (of 61) DOM findings and 131 (of that, untriaged) `.test.ts` findings in
wf-build3-004/005 beyond the ones I independently spot-verified — those documents are also
measured against populations (56/89 files) far smaller than today's (144/217), so most of their
per-file verdicts cannot be assumed to generalise without re-sweeping.

QUESTIONS: which family (A, B, or C) is this plan actually building in — the brief says
"demonstration," which section 0 argues is almost certainly Family C, but sections 1–4 are
Family-A-heavy because that's what the SOURCE list's specific documents and `tests/` directory
mostly describe; if the plan is Family C work, most of the catcher menu's "Family A" column and all
of sections 1, 3, and 4 do not apply, and the working catcher set shrinks to section 2d plus eyeball
review against `WARD-FLOW-DESIGN-SYSTEM.md`. This is a scope decision I'm handing back rather than
guessing.
