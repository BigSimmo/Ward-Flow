# Load-bearing diagnostic comments in Ward Flow — an index

Read-only survey of `src/components/ward-management/**`, `tests/ward-*`, and `tests/ui-ward-*`
for comments that (1) record a measurement, experiment or diagnosis, (2) prevent a specific named
wrong move, and (3) are not reachable by searching for the problem they prevent. Entries are
grouped by the kind of mistake they stop, not by file.

---

## The five comments already known (given in the brief, listed for completeness)

- **do not assume a design token failed to resolve just because a value looks wrong on screen**
  `src/components/ward-management/referrals/referrals.module.css:~238` — a shell token could not
  resolve on a specific screen; recorded so the next person doesn't re-diagnose it as CSS breakage.
- **do not treat this token-resolution guard's green result as proof the tokens actually resolve everywhere**
  `tests/ward-css-token-references-resolve.test.ts:~54` — explains why the guard is green _by
  design_ (scope limitation), not because the property it sounds like it checks actually holds.
- **do not widen a route list expecting it to reach a table that has no wrapper**
  `tests/ui-ward-table-thresholds.spec.ts:~103-123` — a wrapperless table cannot be reached by the
  mechanism that finds every other table's scroll threshold.
- **do not write a CSS-module class selector into a production-build test and expect it to match**
  `tests/ui-ward-forced-colors.spec.ts:~27` — CSS-module class names survive in dev output but are
  hashed away in a production build, so a dev-only selector finds zero elements there.
- **do not treat a type-rank width/spacing figure as adjustable padding**
  `src/components/ward-management/delays/delays.module.css:~517` — records what the type ranks
  cost when they were bought, so a later "tidy" cannot shrink them back to the defect they fixed.

---

## New entries, grouped by the mistake they prevent

### Do not diagnose "unresolved CSS token" or "arbitrary CSS value" without checking the alternative first

- **do not assume a control's height problem is a broken `--ward-tap` token before checking whether the declaration is simply missing**
  `src/components/ward-management/ward-controls.module.css:17` — the sibling `.tabBtn` already used
  the same token correctly, so the first hypothesis (token fails to resolve here) was tested with
  `getComputedStyle` on the live page and found false; the token resolved fine, the `min-height`
  declaration on `.pill` was just absent. Filed under a tap-target fix, not under "tokens."

- **do not shrink the `19rem` delays-grid column back toward `15rem` as a tidy-up**
  `src/components/ward-management/delays/delays.module.css:410` — at 15rem the person rows measured
  113px tall against a 67px mockup target because two text lines wrapped in a 240px column, so only
  one patient fit on a 1440x900 screen; the four extra rems were taken from a column measured to
  have them spare, not chosen decoratively.

- **do not treat the delays-screen board and coordinator queue-region sizes as round numbers**
  `src/components/ward-management/coordinator/coordinator.module.css:377` and `:2073` — sizes were
  measured at 1600x1000 with a specific row count, then re-measured for a later task against a
  brief ruling; a plausible-looking round number here is a coincidence, not a target.

- **do not round a 48px tap-target rule down toward 44px on this specific control row**
  `src/components/ward-management/movements/movements.module.css:141` — measured live at 30px
  against the 48px floor; cites the specific fix brief rather than a general accessibility rule, so
  a generic-WCAG grep would not surface it.

### Do not assume a screen's zero or empty state is a genuine measured value

- **do not let `WardBar` receive a zero without deciding first whether it is a measured zero or an unknown**
  `src/components/ward-management/delays/delays-screen.tsx:274` — `WardBar` throws on an all-zero
  total by design (an empty rail should look like a loading state, never a real answer); the
  component itself cannot tell a measured "nobody is waiting" from an unmeasured unknown, so the
  caller must decide and word it before the value ever reaches the bar.

- **do not report an empty community team as "we looked and found nobody" without checking whether the join is actually broken**
  `src/components/ward-management/statistics/statistics-community-screen.tsx:55` and
  `src/components/ward-management/community/community-derivations.ts:330` — an admission whose
  `referralId` points at no referral in state produces the same empty list as a team that legitimately
  has nobody in it; the derivations file records the actual counts from the moment this was
  corrected (10 seeded ids resolving, 24 real ids, 257 honest nulls) so the two cases can be told
  apart.

- **do not read "18 of 50 movements reach this branch" copy as evidence the branch is rare or safe to leave alone**
  `src/components/ward-management/ward-management-console.tsx:1391` — an adversarial review
  measured that of 50 movements reaching this exact rendering branch, only 2 legitimately carried a
  positive `referralAbsence` record, so the other 16 pages were silently asserting a fact ("nobody
  was asked") the data never recorded; also reachable through the live reducer via
  `WITHDRAW_REFERRAL`, not just the fixture.

### Do not trust a canary, guard or gate's own metric to be measuring the thing it claims to measure

- **do not restore a length-ratio assertion (`stripped.length > component.length / 2`) as this file's canary**
  `tests/ward-transport-page-name.test.ts:92` — that exact assertion went red on 2026-09-06 with the
  comment stripper unchanged, because a retirement-marker comment took the file to 53% prose; the
  ratio was measuring comment density, not stripper correctness, and named the wrong culprit in the
  one place a debugger would trust it.

- **do not treat a green re-run of `ward-mutation-harness-reachable` (or its sibling) as proof the timing is fine**
  `tests/ward-mutation-harness-reachable.test.ts:79` — measured solo on an idle machine at 94% of
  its own 30-second ceiling; on a machine that runs 90-107 node processes at rest, any contention
  reddens it, so a passing re-run is indistinguishable from a real pass. A note two files away had
  already recorded this exact failure signature and sat unread for seven days before the same
  diagnosis was re-derived from scratch.

- **do not assume the spacing-ladder token guard also polices the same convention it was built for on leadings**
  `tests/ward-token-layer.test.ts:481` — the guard is hard-coded to two specific token names, so it
  answers the narrow incident it was aimed at and stays blind to the same convention applied
  elsewhere; the copy it was originally built to catch is already gone, which is recorded so nobody
  re-derives "this guard proves the property" from it passing.

- **do not trust Vitest's green run here as proof the suppressed-arm shape guarantee holds**
  `tests/ward-statistics-community-people.test.ts:90` — the actual proof is a `@ts-expect-error`
  line that only `tsc` enforces; the adjacent runtime assertion passes whether or not the guarantee
  holds, so a reader watching the test suite would see nothing if this protection were quietly lost.

- **do not read the module header's claim that `tsc` enforces the coordinator field set — it was tested and found false**
  `tests/ward-referral-visibility.test.ts:627` — adding `...referral` to the projection's root
  passed all 116 tests in the file and `tsc --noEmit` at exit 0, because TypeScript's excess-property
  check does not reach fields arriving through a spread; the module's own header claim was corrected
  only after a reviewer had already trusted it and stopped looking.

### Do not assume a data source, home, or wiring choice is complete or reachable without checking

- **do not trust a task brief's own list of timed-event sources as exhaustive**
  `src/components/ward-management/delays/delays-derivations.ts:292` — the brief named six candidate
  timestamp sources; two do not exist on the model as named, and three real recorded event
  timestamps the brief never mentioned were found populated in `ward-movements.ts` and would
  otherwise have been silently skipped, reproducing the exact stuck-duration failure the function
  exists to close.

- **do not add a new reason-label map to `ward-change-reasons.ts` just because that is where every other one lives**
  `src/components/ward-management/ward-model.ts:202` — that home is unreachable: `ward-model.ts`
  already imports `ward-change-reasons.ts`, so putting the new map there would require a reverse
  import and create a cycle; the actual precedent (`REFERRAL_DECLINE_REASONS`/`DECLINE_REASON_LABELS`)
  shows the label map belongs beside its own list instead.

- **do not delete either of the two community-name-collision detectors believing the other makes it redundant**
  `src/components/ward-management/community/community-vocabulary.ts:210` — measured, not assumed:
  each one catches a case the other structurally cannot (a suffix-length difference vs. a one-letter
  difference inside a word), so removing either is a silent narrowing of what gets caught.

- **do not treat the free-text history character limits as validated against real referrals**
  `src/components/ward-management/ward-model.ts:1653` — the limits are placeholders nobody has
  measured against a real referral; chosen only to be generous and bounded, and the owner has been
  told explicitly that the number is his to set, not a derived constant.

### Do not read a UI wait-time, wording, or route-precedence rule as correct because it looks plausible

- **do not assume "No unit accepts this referral right now" means capacity is the blocker**
  `src/components/ward-management/ward-referrals.ts:770` — measured on the shipped fixture: the one
  referral with zero accepting units failed on `age` for 22 of 23 candidates and on `security` for
  one; not one failed on bed availability, so the word "right now" tells a coordinator to wait for
  something that will never change.

- **do not assume the referral wait-clock defect is safe because the demo currently shows small numbers**
  `src/components/ward-management/ward-management-network.tsx:477` — measuring the seed directly
  found a referral reading "4h 55m waiting" against a true 25-minute wait, then found that specific
  case is filtered out of this exact screen — so the defect is real and wired in, just latent, and
  becomes visible the moment a queued referral is triaged during a live demonstration.

- **do not repeat the claim "every ward test passes `initialNow`" from an earlier handover without re-measuring it**
  `src/components/ward-management/ward-flow-provider.tsx:150` — a corrected paragraph records that
  236 provider render sites were counted directly from the tree; 18 sites across 12 files pass no
  clock pin at all, and an unrelated handover had already repeated the false wider claim and used it
  to conclude a whole class of clock-advance defect was unreachable.

- **do not assume Next.js's normal static-vs-dynamic route precedence applies here from general framework knowledge**
  `tests/ward-nav.test.ts:335` — this repo's pinned Next 16 version's own docs never state the
  precedence rule for a static segment against a same-level dynamic sibling; the behaviour was
  confirmed by loading the actual route in a running dev server and reading the rendered page title,
  not by citing framework conventions.

### Do not assume a number in a comment or a stale figure is still current

- **do not reuse contrast-ratio figures quoted in `community.module.css` as verified**
  `src/components/ward-management/community/community.module.css:592` — the original six ratio
  figures were computed against `globals.css`, which loses a CSS specificity contest to the token
  layer that actually applies; all six numbers were wrong, and the same six numbers were copied into
  26 other ward stylesheets, so the correction is recorded here rather than swept everywhere at
  once.

- **do not cite "27 files carry this stale contrast figure" from the same comment block without re-running the count**
  `src/components/ward-management/community/community.module.css:603` — the count itself went
  stale the moment one of the 27 was corrected, and the sentence recording the correction kept the
  pre-correction total; a live `grep -rl` returns 26. The comment about a stale number contained a
  second stale number.

- **do not treat "nobody has measured whether the handover table's clipped overflow visibly clips" as resolved**
  `tests/ward-table-min-width.test.ts:412` — pins today's rendered behaviour as a fact-of-record
  rather than blessing it, specifically so an intentional future change here has to be argued rather
  than arriving silently through a shared-block migration.

---

## Count, denominator, and scope

- **New entries indexed above: 21**, grouped into 6 mistake-kinds, plus the 5 already-known entries
  restated for completeness — **26 total**.
- **Denominator walked:**
  - `src/components/ward-management/**` — 218 files, ~108,500 lines (`.ts`/`.tsx`/`.css`).
  - `tests/ward-*` — 406 files, ~127,400 lines.
  - `tests/ui-ward-*` — 12 files, ~7,100 lines.
  - Total: **636 files, ~243,000 lines** searched by grep; a much smaller number were actually
    opened and read in full context.

## The limits of this index — read before trusting it as complete

- **This was built by grepping a fixed list of seam-phrases** (`MEASURED`, `ENUMERATED`, "in a
  production build", "dev only", "found by", "turned out", "was wrong", "the first version",
  "nobody", "silently", "zero elements", "cannot see", "does not reach") and reading the surrounding
  comment block for each hit. It can only find comments that happen to use one of those words or a
  close variant. A diagnostic comment written without any of these words — for example one that
  states a fact and a number with no framing word at all — is invisible to this method and is not
  in this index.
- **"silently" alone produced over 400 hits** across the two directories, and the large majority of
  them are ordinary defensive-design rationale ("throws rather than silently dropping X") rather
  than a recorded measurement or diagnosis. I read a sample of these, not all of them, and picked
  the ones that clearly stated a measured fact rather than a design preference. Some genuine
  diagnostic comments almost certainly sit unread in that pool.
- **"MEASURED" alone produced roughly 70 hits**, and I read the surrounding context for perhaps 25
  of them in enough detail to judge whether they qualified. The rest were triaged from the one-line
  grep match only and may contain further qualifying entries this index does not list.
- **I did not open every file in either directory.** 218 component files and 418 test files is
  more than could be read individually at the depth needed to judge condition 3 (searchability)
  correctly. I read full files or large sections only where a seam-phrase grep already pointed at
  them; files with no seam-phrase hit were not opened at all, so a diagnostic comment that avoided
  every seam phrase in a file I never opened would not be found by any step I took.
  guard/test files under `tests/ward-*` that concern non-diagnostic bookkeeping (pure fixture data,
  simple assertions) were not searched individually beyond the seam-phrase pass.
- **I did not verify condition 3 (undiscoverability) against an actual search attempt.** I judged it
  by reading each comment and asking whether its vocabulary matched the vocabulary of the problem it
  prevents, and whether it sat under a heading that would mislead a search. That is a judgement call
  about each comment's phrasing and placement, not a measured search-and-fail experiment. A
  differently-worded grep than the ones I tried might surface some entries I called "hard to find."
- **Cross-file comments are under-represented.** The strongest examples in the brief's own list of
  five span two files (a CSS declaration and a test that explains why the resulting guard passes).
  Finding more of that shape requires reading a defect's fix and then separately reading the test or
  sibling file that explains why the fix's own guard doesn't prove what it looks like it proves —
  that is slower per-entry than a single-file grep pass, so this index likely under-samples that
  category relative to how common it actually is.

## Entries I was unsure about, and what I did

- **`tests/ward-token-layer.test.ts:481`** — included. It reads more like an architectural
  limitation note than a diagnosis at first glance ("the guard cannot see X"), but the paragraph
  immediately below it records a real, dated, measured incident (`ward-sidebar.module.css` was four
  colour tokens short of canonical, which broke an urgent chip's colour) that the guard was built
  to catch and no longer can. I judged the diagnosis and the limitation as one comment block and
  kept it.
- **`src/components/ward-management/community/community.module.css:603`** — included, with some
  hesitation, because it is a comment correcting a NUMBER inside a comment correcting other numbers,
  which is a fairly narrow and self-referential kind of finding. I kept it because the actual wrong
  move it prevents — citing "27 files" as current — is exactly the kind of small, specific,
  otherwise-undiscoverable trap the brief is asking for, and it sits inside a much longer comment
  about contrast ratios, so a search for "27 files" or "stale count" would not obviously land here.
- **`tests/ward-mutation-harness-reachable.test.ts:79`** — included, but it is really two findings
  folded together (a flaky-test timing measurement, and a separate note that an existing comment
  recording an identical finding went unread for seven days). I wrote the entry around the timing
  measurement, since that is the one a stranger debugging a flaky red would actually need, and
  treated the "nobody read it" detail as context rather than a second bullet, to avoid double-
  counting one comment as two index entries.
- **Excluded:** the large "silently" and "cannot see" pools' entries that explain a design choice
  rather than report a specific measured incident (e.g., "throws rather than silently dropping the
  ward" with no attached measurement or date) — these are well-written rationale comments, useful on
  their own terms, but they do not satisfy condition 1 (a recorded measurement/diagnosis) and are
  reachable anyway by reading the function they annotate, so condition 3 would likely fail too. I
  did not enumerate them individually since there appear to be well over 100 such comments.
