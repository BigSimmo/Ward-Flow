---
name: ward-journeys-run-in-neither-loop
description: verify:ui runs no ward end-to-end spec and test:focused cannot select the ward contract guards — the two routine gates cover neither
metadata:
  node_type: memory
  type: project
  originSessionId: b1ace96a-832b-4e38-9f46-6c2896334ea0
  modified: 2026-09-03T21:18:29.683Z
---

**The two gates everyone reaches for cover neither half of Ward Flow's safety net.** Verified
2026-09-04 at `e8f630413`, by reading `package.json` and counting the tags myself.

⚠️ **RE-MEASURED 2026-09-11: the population is now TWELVE, not six** — the mechanism below is
unchanged and still true, but the figure aged. **And there is a targeted command the original entry
did not name: `npm run test:e2e:ward-journeys` (`run-playwright.mjs --project=chromium-mockups
ui-ward-`).** Use that rather than a full `test:e2e`.

✅ **AND IT SCOPES TO ONE SPEC:** `node scripts/run-playwright.mjs --project=chromium-mockups
ui-ward-search` — **6 assertions, 16 seconds.** So this is a per-screen habit, not a fold-time
ceremony. ⚠️ **Invoking the Playwright CLI directly is refused with a message naming the right
command**, so the wrong route costs nothing to discover.

🔴 **THIS ENTRY EXISTED, WAS CORRECT, AND WAS NOT CONSULTED.** On 2026-09-11 I folded four times
quoting _"366 of 366 ran"_, while the runner printed its own exclusion notice every time, and a lane
had to re-derive it from scratch. **A memory answers the question you arrive with; it does not raise
one.** The trigger is not _"am I about to run tests"_ — it is **"am I about to claim coverage of a
ward screen"**.

**`verify:ui` runs zero ward end-to-end specs.** All twelve `tests/ui-ward-*.spec.ts` tag their
describes `@mockup`. `verify:ui` → `test:e2e:pr` → `--project=chromium
--project=chromium-caring-contacts-seeded --grep-invert "@quarantine|@mockup"`. Excluded twice: by
the tag, and by project selection, since the ward specs live in `chromium-mockups`. Only
`test:e2e:mockups`, `test:e2e:chromium`, full `test:e2e`, and `verify:release` run them.

**`test:focused` cannot select the ward contract guards.** It is `vitest related --run`, selecting
by import graph; ~16 ward tests read source with `readFileSync` and import nothing from `src/`.
That includes every print guard and `ward-design-language-contract`. An adopter editing a
stylesheet gets a green focused run omitting the only guard on the rule they just changed.

**Consequence:** two gates sat red on the integration line for hours and no routine loop could
have caught either. Say which gate ran, never "browser journeys green" — I reported `55/1` from
`verify:ui` earlier that night having exercised no ward screen at all.

Also: `tests/ui-ward-*.spec.ts` are `.spec.ts`, so Vitest's `tests/**/*.test.ts` and
`tests/**/*.dom.test.tsx` globs never collect them — **any "N ward test files" count excludes the
only end-to-end coverage.** Adding a new `ui-ward-*.spec.ts` also needs `playwright.config.ts`'s
`testMatch` alternation updated or it collects zero tests silently;
`tests/playwright-project-isolation.test.ts` reddens if that is forgotten.

See [[the-suite-never-tests-the-absence]] and [[agreeing-checks-with-one-blind-spot]].

## 2026-09-04: and the two ward suites are disjoint, which I used as evidence anyway

`npm run test:e2e:mockups` collects the six Playwright `ui-ward-*.spec.ts` journeys. The ward DOM
guards are `*.dom.test.tsx` under Vitest and **that command cannot collect them.** I cited a
"134 passed, 1 failed" Playwright result to a peer as proof that a Vitest DOM assertion was green.
The suites share a prefix, a subject and a vocabulary, and nothing about either result says which
one it is.

⚠️ **Before citing a run as evidence for an assertion, name the file the assertion lives in and
confirm the command collects THAT file.** A pass count is not evidence about a test that never ran.

## 2026-09-11: and the exclusion makes them UNFINDABLE, not just unrun

**Ward Lead searched for a rig that walks ward routes in Chromium reading `getComputedStyle`,
found none, and had a lane start building one.** Five exist, committed, ward-specific:
`ui-ward-table-thresholds.spec.ts` (a `ROUTES` list walked per route, reading
`getComputedStyle(table).minWidth`), `ui-ward-forced-colors`, `-referrals`, `-search`,
`-statistics-journey`. **Thirty committed files under `tests/`+`scripts/` use `getComputedStyle`;
twenty-five mention ward.**

🔴 **The search was not careless. It reasoned from what gets EXECUTED — and these are unreachable
by the only loop anybody runs, so they are invisible to anyone forming their picture of the
repository from run output.** ⚠️ **Cost: a sixth rig nearly got written, which would have joined
the same unrun pile.**

**So the consequence of an unscheduled suite is not only missing coverage. It is that the work
inside it stops counting as existing, and gets rebuilt.** ✅ **Before concluding an instrument is
absent, grep the tree for the API it would have to call — never infer absence from what runs.**

See [[enumerate-to-establish-what-exists]] and [[a-working-safeguard-leaves-no-trace]].

## ⚠️ 2026-09-12: A CI LANE NOW RUNS THEM. The local half of this entry is still true; the conclusion is not.

**Measured at `57ca0ed793` while triaging the issue backlog:**

    .github/workflows/ci.yml:865   ui-ward-journeys:          ← "Ward Flow browser journeys"
    .github/workflows/ci.yml:872   continue-on-error: ${{ vars.WARD_JOURNEYS_BLOCKING != 'true' }}

**It runs on every UI-touching pull request and reports, on an explicit owner instruction quoted in
the file: _"RUN EVERY TIME, REPORT LOUDLY, DO NOT BLOCK."_**

✅ **STILL TRUE, and unchanged:** `verify:ui` → `test:e2e:pr` still carries
`--grep-invert "@quarantine|@mockup"` and still selects neither `chromium-mockups` nor the ward
specs; `test:focused` still cannot select the `readFileSync` contract guards. **The two gates a
person reaches for locally still cover neither half.**

🔴 **NO LONGER TRUE:** _"two gates sat red on the integration line for hours and no routine loop
could have caught either."_ **A routine loop now can — it just does not stop anybody**, because the
job is deliberately non-blocking.

⚠️ **So the failure mode has CHANGED SHAPE rather than closed, and the new shape is quieter: the
result exists, is printed on every UI PR, and gates nothing.** That is [[an-unrun-suite-accumulates-findings]]'s
sibling — not a suite nobody runs, but a suite nobody has to read. **Before claiming ward coverage,
still name the command; and if you cite the CI lane, say that it does not block.**

🔴 **AND THE GENERAL LESSON ABOUT THIS FILE: the mechanism outlived the conclusion drawn from it.**
Both halves were written in one pass and only the conclusion aged. See
[[self-invalidating-pins]] — re-derive a conclusion in the same pass that quotes it, not only the
figure it rests on.
