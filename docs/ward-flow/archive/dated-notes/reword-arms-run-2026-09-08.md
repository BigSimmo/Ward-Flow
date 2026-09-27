# The reword arms, RUN on the real components — 2026-09-08, handed over incomplete

**Ward Builder Two (2026-09-08 session).** Branch `ward/reword-arms-20260908`, cut from
`codex/task-ward-flow-live-state-20260831` @ `05792e7a3f`, merged forward to `138dbdfb43`.

**Handed to Ward Lead on the owner's instruction with 9 of 55 sites proven. It is not finished and
the count below is the point of this file.** A report that lists only what it found is
indistinguishable from a complete one.

---

## 🔴 READ THIS BEFORE QUOTING ANY EARLIER NUMBER

Two figures are in circulation and **both are now wrong**.

**"Roughly 7 of the 95 conversions have had their reword arm run"**
(`redesign-brittleness-audit-2026-09-05.md`). Superseded the same night.

**"All 95 have had the arm run"** (`reword-arm-audit-2026-09-05.md`). True, but **that arm was run
against CAPTURED TEXT, not by editing the components** — its own §5 says so. What it proved is a
pure function of `(text, spellings)`. A guard whose assertion navigates the DOM can pass that arm
and still break on a rewrite that moves the element, because the text is identical and the lookup
above it is not. **That same blindness is what inflated that pass's own deletion finding from three
to ten before the author caught it.**

> **The honest sentence: a text-level simulation has been run across 95 sites. The arm the owner's
> instruction actually needs — reword the real sentence in the real component — has now been run on
> nine.**

### The population is bigger than any of those numbers

Re-counted 2026-09-08 with comments blanked. The counter reproduces the 2026-09-05 audit's own
`95 across 22 files` **exactly at that audit's tip `2fa5f0b69`**, which is why it is trusted here.

    audit tip  2fa5f0b69   22 files    95 call sites
    now        138dbdfb43  23 files   119 call sites   (108 tolerant + 11 negative bans)

    movement: ward-statistics +18 · statistics-ed-wait-chart +6 (a file that did not exist) ·
              referral-screens +3 · console-controls +2 · community-hub −2 · statistics-sections −3

⚠️ **24 net-new call sites have had NO arm run at all, of any kind.** They were written after the
pass that measured the population. **24 of the 29 gross additions are in `ward-statistics-*`**,
which is the previous Ward Builder Two's dormant claim — Ward Lead has put its ownership to the
owner and instructed that nobody start there.

### And 3 of the 119 cannot be proven by anyone

`ward-morning-page.dom.test.tsx` is a bare `describe.skip` — 20 tests, of which 3 are converted
sites. **This is not a defect.** It is the owner's ruling of 2026-09-06 (`cdb9edf7c3`), retiring 82
cases over eleven unreachable screens, recorded in `retired-coverage-record-2026-09-06.md`.

**But those 3 are counted inside the 119.** A conversion inside a skipped block is green, is
counted, and executes never. Confirmed two ways: statically, and by a 17-file run reporting
`16 passed | 1 skipped`, `414 passed | 20 skipped`.

    claimed  58   ·   inert 3   ·   LIVE 55   ·   proven 9   ·   OUTSTANDING 46

---

## What nine sites cost, and what they bought

**Both arms on the real component, per site: reword the real sentence (must stay GREEN), break the
real subject (must go RED), restore, re-run both arms against the fix.**

| file                    | sites      | reword arm | verdict                              |
| ----------------------- | ---------- | ---------- | ------------------------------------ |
| `ward-daily-sheet`      | 2          | **RED**    | brittle — fixed, both arms re-proved |
| `ward-console-controls` | 1 (`L573`) | **RED**    | brittle — fixed, both arms re-proved |
| `ward-console-controls` | 3          | GREEN      | **sound, and now proved sound**      |
| `ward-governance`       | 3          | **RED**    | brittle — fixed, both arms re-proved |

**Six of nine were fighting a reword.** Every one had a _single_ load-bearing spelling.

- `ward-daily-sheet` ×2 — `["real day"]`. Died on _"not a record of any real day"_ → _"nothing here
  was recorded on an actual date"_.
- `ward-console-controls:573` — `["bed"]`. Died on _"The pull on the bed at X ran out"_ shortened to
  _"The pull at X lapsed"_. **Its own comment three lines above says "Reword it freely; it may not
  stop saying it."** It did not honour that.
- `ward-governance` ×3 — `["not enough data"]`, `["evidence"]`, `["legal deadline"]`.

**Three were genuinely robust and are now recorded as proved, so nobody re-does them:** the
locked-ward legal-status warning (`["voluntary","locked","legal"]`, the clinically important one —
substantially rewritten and it held), and the reservation-ending concept.

---

## 🔴 THE FINDING THAT MATTERS MORE THAN THE SIX

**Widening a converted guard can buy exactly nothing, and only running the arm reveals it.**

On `ward-governance`, after all three converted guards were widened and re-proved, **the file still
went red on the identical reword.** Two _unconverted_ assertions pinned the **same suppression
sentence** verbatim — an element-level `toHaveTextContent("Not enough data to compute")` and a
joined-text one. The screen was no more rewordable than before.

> **A converted guard standing beside a verbatim pin on the same sentence yields ZERO tolerance
> gain. Both are green until somebody actually rewords the copy.**

This is not a `ward-governance` quirk. `ward-daily-sheet` has the same shape (`toMatch(/synthetic/i)`
beside the converted pair), and so does `ward-board-selection` (`toContain("never a bed")` over the
sentence its two converted sites read). **The conversion programme's benefit is capped by the 55
pins the 2026-09-05 audit deliberately left standing** — and nothing in the population count shows
that, because the count only counts conversions.

⚠️ **Scope deliberately extended once, flagged for objection.** Those two governance pins were
converted anyway, because otherwise this file would report _"the acceptance guard is now
reword-tolerant"_ while the screen it guards still could not be reworded — a claim written wider
than its evidence. Both keep the strength they actually had: **the element lookup STAYS**
(`getByTestId` throws when the element goes, which a text assertion on the parent cannot see), and
the measured basis _"from 1 of 27 recorded acceptances"_ stays **pinned verbatim**, a figure with
its attribution.

⚠️ **And one of those pins carried a comment that overstated it.** It claimed the joined text is
what stops a basis rendered elsewhere on the page satisfying the check. It is not — both assertions
read the `acceptance` element, so the element scope already excludes the rest of the page. The join
added only that no text sits between the two sentences. **The rationale was doing work the code was
not.**

---

## ⚠️ THE METHOD TRAP, HIT TWICE, AND IT MANUFACTURES FALSE PROOF

**A batched break arm silently leaves later sites unmeasured while the run still goes red and reads
as proof of all of them.**

Sites sharing one `it()` are asserted in sequence. The first failure stops the test; every later
assertion **never executes**. The file goes red. Nothing in the output says which sites ran.

- `ward-console-controls` — broke two subjects at once; `L573` failed, `L574` never ran. I would
  have recorded `L574` as proven having never executed it. Isolated with a label carrying "bed" but
  no ending word; it then failed on its own message.
- `ward-governance` — **all three sites sit in ONE `it()`.** My first run measured one site while
  appearing to measure three. Re-run with each subject restored in turn.

> **One mutation per assertion. Read WHICH message came back, never just the colour.**

Second trap, same family: **a compound reword produces a red you cannot attribute.** My first
daily-sheet reword changed two words at once and reddened an unconverted pin as well as the two
converted ones. Narrowed to touch only the clause the guard reads.

Third: **the ward-flow protection hook refuses a git restore of any path matching `ward-management`**,
because it reads as a deletion. Correct behaviour; do not disable it. **Reverse the edit precisely
instead, and prove the restore with an empty `git diff` AND a green run — not a matching hash.**

---

## The 46 outstanding, and where their sentences live

Ordered as I would take them. **The two board files are already located — that work is done and
should not be redone:**

| file                    |             sites | the real sentence                                                                                                              | source                      |
| ----------------------- | ----------------: | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `ward-board-selection`  | 2 (`L181`,`L199`) | _"Which bed is not recorded. An admission records the ward it is on and never a bed…"_ — **both sites read the SAME sentence** | `board/ward-board.tsx:1713` |
| `ward-board-selection`  |        1 (`L160`) | _"No stay yet — not arrived"_                                                                                                  | `board/ward-board.tsx:572`  |
| `ward-board-selection`  |        1 (`L161`) | _"This ward has already given this bed away…"_                                                                                 | `board/ward-board.tsx:1556` |
| `ward-board-triage`     |                 2 | timing caveat; the beds-not-people caveat                                                                                      | `board/`                    |
| `ward-screen`           |                 3 | incl. the same locked-ward warning **already proved sound** in console-controls                                                | `ward-derivations.ts:641`   |
| `ward-patient-page`     |                 3 | the only `expectCaption` sites in scope — `numeralFree`/`minimumLength` have **never** been exercised by any arm               |                             |
| `ward-community-index`  |                 2 |                                                                                                                                |                             |
| `ward-referral-screens` |                 7 | **Ward Lead ruled 2026-09-08 that this file IS in scope**; the "Ward Builder One … + tests" row is dormant                     |                             |
| singles ×6              |                 6 | add-patient, community-gateway, discharge-board, handover, network-referral-placement, patient-search                          |                             |
| `ward-community-hub`    |                19 | **the long pole**, and it holds all 3 of the negative bans in scope                                                            |                             |

⚠️ **`ward-board-selection:161` needs care.** Its haystack is the whole detail panel, and
`ward-board.tsx:543` renders _"Bed given away — when is not recorded"_ separately. **Check whether
"given away" survives your reword from that second source before calling the guard tolerant** —
otherwise the arm passes for a reason unrelated to the sentence you changed.

⚠️ **The 11 negative bans (`expectNeverSaysAgain`) have had NO arm of any kind, ever** — the
2026-09-05 pass says so explicitly. They ask the opposite question: does the retired false claim
return _paraphrased_. **And widening a ban is not free** — a ban forbids more, so every spelling
added is a new way to go red on honest work. `ward-community-hub` legitimately says _"does not mean
everybody is being followed up"_ three lines from a ban on _"nobody is missing follow-up"_.

## Off limits, verified 2026-09-08

`tests/ward-statistics-*` and `statistics/**` (dormant claim, ownership with the owner) ·
`tests/ward-ed-*`, `ed/`, `ward-referrals.ts` · `tests/ui-ward-*.spec.ts` ·
**`ward-pull-vocabulary.dom.test.tsx` — never convert it; its pins exist to hold the WORD on the
screen after the hold→pull rename, and converting them to concepts would gut it.**

## What this pass did NOT do

- **46 of 55 live sites are unmeasured.** Treat them as unproven, not as green.
- **Nothing was opened in a browser.** Every result here is a property of a rendered DOM in jsdom.
- **No negative ban was tested**, and no `expectCaption` rule (`numeralFree`, `minimumLength`) was.
- **No structural reword was tried** — every reword changed words inside an existing element. A
  redesign that MOVES an element is the failure a text-level arm cannot see, and this pass did not
  exercise it either. **That gap is inherited, not closed.**
