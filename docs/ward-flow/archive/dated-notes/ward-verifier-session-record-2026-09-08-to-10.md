# Ward Verifier — session record, 2026-09-08 to 2026-09-10

Worktree: `D:/Worktrees/Database/ward-verifier-9afb82c6e`. Branch:
`ward/phone-and-chrome-verify-20260908`. This branch is shared with other Ward Flow sessions
(Ward Lead, several Ward Builders); commits below are the ones attributable to this session's
own work, identified by subject and body. Where a commit is a fold of another session's fix
that this session's own finding produced, that is said explicitly.

## What this session was for

Three assigned jobs: (1) view the Delays screen on a phone, which had never been done before;
(2) confirm the ward chrome-header spec passes and extend it to five uncovered faults; (3) run
the ward end-to-end suite.

## What was delivered

- **The Delays screen was opened on a phone.** At a narrow (375px) viewport the ward search box
  was covered by a fixed phone header bar and was unreachable — a tap aimed at the centre of the
  search box landed on a different control (the sidebar's brand link) instead. This was routed to
  Ward Lead rather than fixed directly. Ward Lead's repair (commit `05792e7a3f`) added
  `padding-top: var(--spacing-ward-phone-bar)` to the row that was being covered, inside the
  existing narrow-viewport media query, so the row now reserves space above the fixed bar instead
  of sitting underneath it. Ward Lead's own commit records the proof: the header spec test that
  reproduces this exact tap was red before the fix and green after (11 of 11 tests in that spec
  passing), and putting the old styling back reproduces the original failure message verbatim,
  down to the class name of the element the tap lands on.

- **Separately, a sweep of every interactive control on the Delays screen at 375px** (commit
  `9f6c78f2fb`) found three controls under this repository's 48px tap-target floor: a filter pill
  at 27.6px and the phone bar's brand link at 32px (the sidebar toggle on Capacity/Movements was
  the third). Both were fixed in the same commit. The pill's sizing token was present but not
  applied to the actual button style; the brand link's visible 56px bar was not the same thing as
  its own tappable area, which was sized to its text. After the fix, every interactive element
  on Delays, Movements and Capacity clears the floor except the deliberately 1px screen-reader
  skip link.

- **The dev server would not start**, and diagnosing this took the first part of the session.
  Two earlier chats had each identified a real cause and stopped there. This session found a
  third, more persistent cause: a PostCSS subprocess crash (from a genuine out-of-memory
  condition) that Turbopack had written to its on-disk cache and was replaying on every
  subsequent restart — so the server kept failing even once memory was free, because it was
  reading a stored error rather than recompiling. The discriminator recorded in
  `docs/ward-flow/dev-server-failure-causes.md` is timing: a live stylesheet compile takes
  seconds (a hand-compile of `globals.css` outside the server took 5.2 seconds to succeed), so a
  route failing in about 27 milliseconds had not actually tried to compile anything. The fix was
  to delete the on-disk cache and restart; the route then served in 4.4 seconds. This document
  also records a fourth, related cause (the cache directory being deleted out from under a
  running server) and two false alarms that look like defects but are not (a Fast Refresh
  artefact, and a "port already running" message that is `npm run ensure` working correctly).
  Committed as `1c496315d8`.

- **A companion tool, `docs/ward-flow/tools/check-forward-composes.mjs`**, was written and
  committed alongside the dev-server document (same commit, `1c496315d8`). It checks every local
  CSS Modules `composes:` declaration in the codebase against the line its target class is
  declared on — the specific defect class that caused one of the outage causes documented above
  (a class composing another class declared later in the same file, which is invalid and 500s
  every page using it, and which a plain text search for the word `composes` cannot detect,
  because that search cannot tell a legal declaration from an illegal one). Verified at the time
  of writing across the whole tree: 64 CSS modules, 20 local `composes` declarations, 0 problems.

- **A lockfile bookkeeping gap was found and repaired in this worktree.** `node_modules/.package-lock.json`
  — npm's own record of what had actually been installed — was missing, which is what had left
  `node_modules/.bin` empty and every npm-script binary silently unrunnable by name while the
  underlying packages were present and correct on disk. Running the install repaired this and, as
  a side effect, corrected the committed lockfile's own listing of two development dependencies
  (`@sentry/core` and `playwright-core`) that were installed and declared in `package.json` but
  missing from the lockfile's dependency listing — no package version changed. This is recorded
  as `ec79ceb066`, folded into the branch as `d9fca9fd40`.

  ⚠️ **A SECOND, SEPARATE DEPENDENCY FAULT — and the way it was nearly dropped from this record is
  itself the session's subject.** The drafter of this document was told a version skew had been
  found in this worktree and could not confirm it, because it checked `package.json`. It was right
  to flag rather than assert, and right that `package.json` shows no discrepancy — **but
  `package.json` is the wrong population.** It records the range a dependency is _allowed_ to
  satisfy, not the version _installed_. Both `16.3.0` and `16.3.3` satisfy `^16.3.3`'s intent here,
  and both `4.1.10` and `4.1.11` satisfy `^4.1.10` — **so a declared-range check cannot detect this
  class of fault at all.**

  The measurement, captured verbatim on 2026-09-09 at 18:46 from
  `node scripts/check-installed-lock-parity.mjs`, which compares the INSTALLED tree against the
  lockfile:

  ```
  [installed-lock-parity] next: installed 16.3.0 does not match locked 16.3.3
  [installed-lock-parity] vitest: installed 4.1.10 does not match locked 4.1.11
  [installed-lock-parity] full tree: install stamp belongs to a different package-lock.json
  Installed dependencies do not match package-lock.json. Run npm ci before interpreting test failures.
  ```

  Repaired with `npm ci --include=dev` (783 packages, zero `npm error` lines, counted rather than
  read from the exit code), after which parity read `783 package locations; 74780 files`. The
  affected measurement — the chrome-header spec — was re-run on the corrected dependencies and
  passed 11 of 11. **This left no commit,** because a dependency install changes nothing tracked,
  which is exactly why a later reader searching the repository finds no trace of it.

  **The `npm ci` warning in §8b of the probes file is not in conflict with this.** That warning is
  about the _missing-bookkeeping_ fault immediately above, where `npm ci` wipes `node_modules` and
  has crashed on this machine. This fault was a stale install against a moved lockfile, where a
  clean reinstall is the correct remedy. **Two different faults, two different repairs, and the
  drafter was right to notice that the file appeared to contradict the brief.**

- **The full `chromium-mockups` Playwright project was run for the first time since 2026-09-06.**
  Result: 171 tests declared, 171 run, 151 passed, 15 failed, 5 skipped (Playwright exit 1). All
  15 failures were assertion failures — none were browser crashes or timeouts, which matters
  because the previously recorded state of this suite (2026-09-06: 78 tests, 1 failure that was a
  browser lost to memory pressure) does not describe this run and must not be used to explain
  these failures away. Recorded as `b90049e50e`.

- **Two documents and one runnable tool were committed** as the durable output of this session:
  `docs/ward-flow/probes-that-answer-a-neighbouring-question.md` (built up across several commits
  through the session — see "Where the work is" below), `docs/ward-flow/dev-server-failure-causes.md`,
  and `docs/ward-flow/tools/check-forward-composes.mjs`.

## What was NOT delivered

Job 2's extension was never done. The ward chrome-header spec
(`tests/ui-ward-chrome-header.spec.ts`) still covers 3 of the 8 header faults an earlier audit
found on the Delays screen (search clipping, the search box escaping its container, and the
referral board sitting off-screen on a phone — all fixed and tested with real clicks in commit
`fe117b11a3`). The other five audited faults — two top bars occupying the same 56px, the scope
chip's own layout contradicting its source comments, a 41px header jump between routes, the bar
sitting in no landmark, and a missing `nowrap` on one control — have no browser test watching
them. This is recorded as an open ledger item (see below), not fixed in this session.

## Corrections and retractions made during the session

1. Reported that the lockfile (`package-lock.json`) last changed on 2026-09-05 (commit
   `f006e40743`). It actually last changed on 2026-09-06 (`4533e96366`), inside a merge —
   `git log -- package-lock.json` silently omits merge-commit diffs unless run with
   `--diff-merges=separate`, so the command used gave a real, correct-looking answer to a
   different question than the one being asked. A derived "how stale is this" figure built on
   the wrong date was withdrawn along with it. (Recorded in
   `docs/ward-flow/probes-that-answer-a-neighbouring-question.md`, §1. The document itself gives
   the two commit SHAs above but does not restate the specific day-count figures; I could not
   independently confirm the exact "four days" and "3.4 days" wording from a repository file, so
   I have not repeated it as a quoted figure here — only the underlying date correction, which the
   git history confirms.)

2. Nearly reported the Escalation screen as a built screen that nothing in the app links to. The
   search used to check this was `grep -rn "ward-flow/escalation" src --include=*.tsx`, which
   returned nothing — but the navigation entry that links to it is defined in a `.ts` file, which
   that search excluded by its own file-extension filter. Escalation is in fact a redirect to
   `/delays`, not an orphaned screen. (Probes file, §2.)

3. Told Ward Lead, all four Ward Builders and the owner that a referral-board layout failure —
   a column of the queued referral board sitting off-screen at a 641px viewport, found by the
   `chromium-mockups` run above — was "the predictable consequence of an approved change," citing
   the owner's 2026-09-07 ruling approving five new columns. This was false, and was never
   checked before being said. The five columns from that 2026-09-07 ruling (Presentation, Review
   status, Plan, Bed number, Legal form expiry) do not exist anywhere in
   `src/components/ward-management/` and belong to the ward board, a different screen from the one
   that failed. The referral table that actually failed has a different column set (Referral,
   Tier, Since referral, Age band, Sex, Home region). Having read the ruling in the morning and
   seen an overflow failure in the afternoon, the two were joined without checking whether they
   named the same screen. On the strength of that invented cause, the finding was escalated to the
   owner twice as a decision only he could make. What the test itself actually reported the whole
   time was plainer: `"Home region (right edge 623 vs scroller 606)"` — the last column of the
   table clipped by about 17 pixels at a narrow viewport, an ordinary layout defect with no
   connection to the column-count ruling. The original ledger request carrying the false cause was
   cancelled rather than edited, and a replacement was queued carrying the same measurement and
   scope but not the invented explanation. (Retraction commit `7470f5de59`.)

   ⚠️ **This entry as first written said "four columns" in its opening line while its own closing
   line said "the last column" — singular. The opening was wrong; see correction 4, which was made
   by a later session and is what the run's output actually supports.**

What these three have in common: each was a confident claim built on a check that returned a
plausible, error-free answer to a question slightly different from the one being asked — a file
filter that quietly excluded the relevant file, a Git flag that quietly excluded the relevant
commit, and a ruling that was quietly about a different screen. None of the three checks failed
or warned; all three simply answered the wrong question well enough to be believed.

## A fourth correction — made later the same day, by the next Ward Verifier session

**Corrections 1–3 above were written by the session they describe. This one is not, and it is about
them: the count in correction 3 was wrong, and the retraction that removed a false cause carried
the wrong count through untouched.**

**The claim, standing in three artefacts** — correction 3's opening line, ledger request
`7235af08` and its replacement `03f090b7` — was that the 641px referral-board failure found
**four** columns off the screen, and that the guard **permits one**. Both halves are false.

**What the guard actually demands** (`tests/ui-ward-referrals.spec.ts:1096`):

```
    ).toEqual([]);
```

An empty list. It permits **zero**, not one.

**What it actually returned:**

```
    - Expected  - 1
    + Received  + 4

    - Array []
    + Array [
    +   "Home region (right edge 623 vs scroller 606)",
    +   "Perth Metropolitan (right edge 623 vs scroller 606)",
    + ]
```

🔴 **`- 1` and `+ 4` count DIFF LINES, not columns.** The received array holds **two** entries —
and the two are not two columns either. The guard collects `thead th` together with
`tbody tr:first-child td` (spec line 1071), so `"Home region"` is a column's heading and
`"Perth Metropolitan"` is the first data cell beneath it, at identical geometry: **one column,
reported twice.** One column clipped by about 17 pixels — which is exactly what correction 3's own
closing sentence said in words while its opening sentence said "four" in figures. **The prose and
the number disagreed inside one paragraph, and neither was checked against the output.**

⚠️ **AND THE MEASUREMENT IS NARROWER THAN RECORDED IN A SECOND WAY, NOT MENTIONED ANYWHERE.** The
test walks four viewport widths — 641, 700, 760 and 820 — and `expect` throws at the first
failure. It failed at 641, so **700, 760 and 820 were never measured.** Nothing is known about
them in either direction, and "no column is off the screen at any width the table is used at" is
the test's title, not its result.

The same shape, smaller, in the same row: failure (b) was recorded as `expected 0 received 2`.
Those are diff line counts too. The test's hard-coded list holds **4** ids and the app produced
**6**; the two extra are `RF-015` and `RF-014`. That one happens to come to the same answer, which
is why it was never questioned.

> 🔴 **Why it survived a retraction aimed at exactly this file's subject: the retraction was aimed
> at a false _cause_, and the count sat inside the _measurement_ — the half everybody had already
> agreed to trust. A correction that removes the story leaves the number underneath it unexamined,
> and the number is now the only thing carrying the finding.**

Request `03f090b7` was cancelled in turn and replaced by `c8a3914a`, carrying the corrected count,
the corrected threshold, the never-measured widths, and both retractions.

## The confirmation run, 2026-09-10 20:12, and the widths nobody had measured

**Both referral failures reproduce, and the defect is smaller than any version of the record has
said.** Run at `10c7414333` against the project's own dev server on port 3249, identity confirmed
through `/api/local-project-id` before anything was trusted.

```
Running 5 tests using 1 worker
  2 failed
  3 passed (17.7s)
```

3 + 2 + 0 skipped = 5 declared. Playwright exit 1, read from `echo exit=$?` and not through a pipe.
Both failures are the same two as run 1 — `:414` (the fixture list) and `:1056` (the clipped
column) — and `:1056` reproduced **byte for byte**, down to the `623 vs 606` geometry.

**The open scope limit is now closed.** Correction 4 records that the spec walks four widths and
`expect` throws at the first failure, so both runs measured 641px and nothing else. The guard's own
measurement (spec lines 1070–1092) was therefore reproduced verbatim **without `expect`**, so that
nothing aborts, and pointed at all four:

```
=== 641px === tables rendered: 2
  ward-referral-board-queued-table: 12 cells measured, 2 clipped
      Home region (right edge 623 vs scroller 606)
      Perth Metropolitan (right edge 623 vs scroller 606)
  ward-referral-board-decided-table: 10 cells measured, 0 clipped

=== 700px === tables rendered: 2
  ward-referral-board-queued-table: 12 cells measured, 0 clipped
  ward-referral-board-decided-table: 10 cells measured, 0 clipped
```

760px and 820px return the same two zero lines as 700px.

⚠️ **THE POSITIVE CONTROL IS THE ONLY REASON THOSE ZEROS MEAN ANYTHING**, and this file's own
companion document is about instruments that cannot return the answer they are read as giving. At
641px the reproduction returned the spec's two entries verbatim, geometry included — so it
demonstrably **can** say yes, and its silence at the other three widths carries information rather
than merely resembling good news.

**And it corroborates correction 4 from a second direction.** The queued table measures **12**
cells: six column headings plus six first-row cells, for the six columns the retraction commit
already named. Two clipped entries out of twelve is one column reported twice — not two columns,
and not four.

**What is now known:** one column of the queued referral table, clipped by about 17 pixels, at
641px only among the four widths the spec uses. The decided table is clean at every one of them.
**What is still not known:** anything about widths between or below those four, which nothing has
measured; and whether the `:414` fixture or the seed is the authoritative list, which nobody has
ruled on. Two reproductions on two SHAs is not the three-on-one-SHA the flake policy asks for, and
no quarantine is sought.

Request `c8a3914a` was cancelled in turn — accurate as written, but its "never measured" sentence
had stopped being true — and replaced by `297e9dcf`.

## Open items recorded in the ledger

The following were queued as ledger inbox requests during this session. Queuing a request does
not apply it to the canonical ledger (`docs/outstanding-issues.md`); that requires a separate
`npm run issues:reconcile` run from a dedicated branch. As of this record, the items below are
queued and unreconciled:

- The ward chrome-header spec covers 3 of the 8 audited faults on the Delays header (see "What
  was NOT delivered" above).
- The ward end-to-end suite (`chromium-mockups`) runs in neither of the two `verify:ui` paths, so
  neither the routine PR gate nor the broader UI gate currently exercises it — and, per this
  session's run, it currently has 15 assertion failures that nothing in the gate pyramid is
  reporting.
- The ED hub has two rival drawings with no ruling naming which one is the spec.
- Four Ward Flow screens (Command, the patient "Now" screen, the Search hub, and Delays) each have
  a reference drawing that cannot currently be opened — two of them (Command and "Now") have live
  builds in progress that are being built against a drawing whose link returns "not found."
  Queued as commit `0a1b7e438c`.

One queued row was cancelled: the community-team statistics page, originally filed as "drawn and
approved, never built," was cancelled (commit `33fb202384`) after it was found to have been built
and independently verified working against a running server — the statistics hub and two example
community-team pages returned success, and an unknown team id returned the correct "not found"
message rather than a silent redirect or empty page.

One queued row was cancelled and re-queued **twice**, for two different defects in the same three
sentences: the referral-board 641px column-overflow finding described in correction 3 above.
`7235af08` was cancelled for carrying an invented cause; its replacement `03f090b7` was cancelled
in turn for stating the measurement's own count wrongly (correction 4); `c8a3914a` is the row that
now stands. All three remain in the inbox — requests are immutable, and the trace of a claim
having been raised is meant to survive its withdrawal.

## Where the work is

Commits on this branch attributable to this session's own work, oldest to newest (short SHA,
date, subject — from `git log`):

```
fe117b11a3  2026-09-07  feat(ward-flow): the Delays board as the mockup drew it, and eight header faults nobody could see
a1658a6926  2026-09-07  merge(ward-flow): the forward composes that made every ward page return 500
ef838a1aca  2026-09-07  docs(ward-flow): Ward Lead handover — six folds, the row nothing rendered, and the phone view nobody has seen
05792e7a3f  2026-09-08  fix(ward-flow): the ward search box was unreachable on every phone, because yesterday's fix repaired the wrong half
9f6c78f2fb  2026-09-08  fix(ward-flow): four controls a coordinator taps were under the 48px floor, on every ward screen
1c496315d8  2026-09-08  docs(ward-flow): four causes for one blank page, and the instrument a grep cannot replace
49efdd7838  2026-09-09  docs(ward-flow): five probes that came back clean, specific and wrong, and none of them errored
41ceaf4b3e  2026-09-09  docs(ward-flow): put the missing name back on §4, and record why it went missing
88929949a1  2026-09-09  docs(ward-flow): §3 and §6 are one root cause an hour apart, and the second was invisible to the person who wrote the first
0b87a90fd9  2026-09-09  docs(ward-flow): §7 — a probe that could not have returned a positive, offered as the clearance for a dangerous act
5a7663efc4  2026-09-09  docs(ward-flow): §7 — the absence cannot announce itself, and reading a value does not save you
d551ccd28e  2026-09-09  docs(ward-flow): the one sentence this file was reaching for, and it is Ward Lead's about itself
50a64b0679  2026-09-09  issues: queue four Ward Flow items that existed only in one session's context
0a1b7e438c  2026-09-09  issues: queue the four Ward Flow screens whose drawings nobody can open
60b36a0379  2026-09-09  docs(ward-flow): §7 — Path is a ScriptProperty, and two of the three ways to look for it say it is not there
16cc2848ff  2026-09-09  merge(ward-flow): the probes file's §7 sharpened, plus five queued ledger requests
33fb202384  2026-09-10  issues: cancel the community-statistics row — built and verified before it ever reconciled
ec79ceb066  2026-09-10  chore(deps): lockfile's devDependencies listing omitted two packages it had installed
d9fca9fd40  2026-09-10  merge(ward-flow): fold chore(deps): lockfile's devDependencies listing omitted two packages it had inst
b90049e50e  2026-09-10  issues: record the first full chromium-mockups run — 15 assertion failures, routing deferred by the owner
4ba78d3473  2026-09-10  docs(ward-flow): §8 — a status that belongs to the wrapper, not the tool, in three shapes
7470f5de59  2026-09-10  issues: retract a false cause I attached to a true measurement, and re-queue the row without it
```

`fe117b11a3`, `a1658a6926` and `ef838a1aca` are dated 2026-09-07, immediately before this
session's stated window, and are included because they are the commits that first built the
rebuilt Delays screen, first hit and fixed the dev-server-crashing `composes` defect, and first
recorded that the phone view had never been checked — the fact this session's job 1 exists to
close. Everything from `05792e7a3f` onward falls inside the 2026-09-08–10 window. Two commits
(`05792e7a3f`, `9f6c78f2fb`) are fixes to code; the rest are documentation, tooling, or ledger
requests. `a1658a6926`, `d9fca9fd40` and `16cc2848ff` are merge commits folding in fixes or
requests that either responded to, or were produced alongside, this session's own findings.
