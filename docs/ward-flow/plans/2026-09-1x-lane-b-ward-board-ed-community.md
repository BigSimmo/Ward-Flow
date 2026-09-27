# Lane B — Ward, Bed board, Emergency department, Community team — Implementation Plan

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the four Lane B screens to their third-edition mockups, inside the shared shell,
with every figure derived through the facade and every panel the app already has either folded into
a drawn panel or listed for the owner — never silently dropped.

**Architecture:** Each screen keeps its existing route and component directory and is renamed and
regrouped to its drawing. No screen mounts a rail or header of its own; the shell owns those from
Phase 1. Every figure is read through `useWardFlow()` and the facade; no screen holds a figure in
local state that the reducer also holds, and no screen types an href.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, Tailwind 4 `@theme` tokens,
Vitest (DOM tests via jsdom), Playwright (browser journeys).

**Spec:** `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md` §4.5–§4.8 — on
`claude/wardflow-design-review-43df97` @ `e9c6900e3e`, reachable only with
`git show <ref>:<path>`; it is **not** on the line. Plus `docs/ward-flow/owner-decisions-2026-09-1x.md`
and `docs/ward-flow/owner-decisions-2026-09-09.md` §7–§9, both **on** the line.

**Branch:** `ward/lane-b-ward-board-ed-community-20260910`, cut from line tip `8c5aebc938`, then
**merged up to the line after the third-edition drawings folded** — the drawings this plan describes
are the post-fold ones. ⚠️ **Before the fold the line carried the SUPERSEDED shell**; a plan or
inventory built against a pre-fold drawing describes a drawing that no longer exists (see §2.1).

---

## 0 · Three corrections to the master plan, measured in this tree

**Read these before the master plan's §3.3, because two of them contradict it.** Each was measured
here at `8c5aebc938` with the command shown.

### 0.1 🔴 The reconciliation sentence in the master plan is the one the owner ruled OUT

| Source                                                 | Sentence                                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master plan §3.3 **and §5.0 item 6**                   | _"Synthetic snapshot at &lt;clock&gt;, figures reconcile"_ — and §5.0(6) requires **a test that pins it**                                                                                |
| `owner-decisions-2026-09-09.md` §7, 2026-09-10 evening | **"Adopt _'Invented figures, reconciled with each other'_ everywhere. The sixteen third-edition pages move off _'Synthetic snapshot at …, figures reconcile'_. Open item 7 is CLOSED."** |

**This lane builds the owner's sentence.** A definition-of-done item cannot outrank a ruling made the
same evening, and a test pinning the superseded wording would be a guard defending a superseded
ruling — green only while the screen is wrong.

✅ **RULED, and no longer this lane's judgement call.** Raised with Ward Lead 2026-09-10; Ward Lead
recorded the amendment in `docs/ward-flow/plans/2026-09-10-master-plan-errata.md` §B, on the line at
`8a41ff867a`, and every lane now reads the errata beside the plan. **The owner's ruling overrides the
master plan.** §5.0 item 6 is **amended, not deleted**:

    the STRING changes  ->  "Invented figures, reconciled with each other, as at <time>"
    the PROPERTY stays  ->  it goes red when a figure is made to disagree, and never reads "Live"

⚠️ **The master plan itself is deliberately NOT edited** — it lives on another chat's branch, and
rewriting somebody's argument to match its conclusion destroys the record of what was believed when.
**So a lane reading only the plan still lands on the retired sentence. Read the errata.**

✅ **The consequence I warned about is ALREADY CLOSED — re-measured, not assumed.** The mockup kit's
shell checker used to positively require the retired sentence, so it would have reddened on correct
work. Ward Mockups has since fixed it; it now reads:

    /Invented figures, reconciled with each other, as at \d\d:\d\d/.test(head) && !/^Live/.test(head.trim())

**Both halves are now right**, and the format it requires — `as at HH:MM` — is the format this plan
writes. **Nothing is outstanding on that check.**

🔴 **ERRATA §B IS CLOSED. DO NOT ACT ON IT — acting on it now would damage a working guard.**

⚠️ **My own spread expired twice in two hours, and the second reading was ALREADY STALE when I wrote
it:**

    old sentence in the drawings   21  ->  5 (my tree)  ->  0 (the line)
    new sentence in the drawings    3  ->  9 (my tree)  -> 18 (the line)
    old sentence anywhere in src/   0  ->  0            ->  0   (always ahead of us)

**The migration is complete and the kit checker enforces the current sentence.** Every one of those
readings was honest when taken. **The counts are a property of the tree you are standing in — exactly
like a line number** (§2.1), and I am 1–3 commits behind the line while writing this.

✅ **Verified, not assumed:** `node scripts/ward-flow/check-errata-freshness.mjs` re-derives all
thirteen errata claims against the current tree and exits non-zero if a live one has expired. It
reports **§B as "CLOSED, still resolved — old sentence in 0 drawings, new in 18, kit guard enforces
the current sentence."** 🔴 **Run it before acting on ANY errata entry, including the ones I
contributed.**

⚠️ **Its own closing caveat is worth more than its green:** _"This does NOT mean the errata is right
— only that what these checks measure still holds. A claim whose check is weaker than the claim
passes here and is still wrong."_

**Measured**, with a known-good and a known-bad control either side — `MARKER` from
`tests/ward-provenance-sentences-carry-their-own-marker.test.ts`, **run as a regex, not reasoned about**:

    UNMARKED  "Synthetic snapshot at 10:42, figures reconcile"                <- plan + mockups
    MARKED    "Invented figures, reconciled with each other, as at 10:42"     <- owner ruling
    MARKED    "These are invented figures."                                   <- control, known good
    UNMARKED  "Live, reconciled 10:42"                                        <- control, known bad

⚠️ **Scope, so this is not written wider than it is.** That predicate governs sentences under a
**provenance heading** (`:282`), not every rendered line, and the mockup pages already disclose
elsewhere. **No live provenance hole is claimed.** What it shows is that only the owner's wording
carries its own provenance when read alone — which is the standing rule.

🔴 **AND THE SCOPE IS NARROWER THAN THAT CAVEAT ADMITS — MEASURED 2026-09-11, AND IT MATTERS TO THIS
LANE MORE THAN TO ANY OTHER.** Errata §V establishes the checker's population is **provenance blocks
inside files that have a provenance HEADING**, not screens and not layers. Approximating its
`PROVENANCE_HEADING` pattern across `src/components/ward-management/` returns **two files:**

    src/components/ward-management/hub/hub-screen.tsx
    src/components/ward-management/ward-management-modes.tsx

🔴 **NEITHER IS IN LANE B. All four screens in this plan are outside that guard's population
entirely** — no heading matches in `ward/`, `board/`, `ed/` or `community/`, so nothing in them is
walked, in any layer. **`community-index.tsx` carries a `Synthetic prototype` marker paragraph and is
still never reached, because the marker is a `<p>` with no provenance heading above it.**

⚠️ **Stated at the strength of the evidence:** the two-file list is from **my grep approximating the
checker's heading pattern**, not from the checker's own output — it prints no file list. I ran the
guard itself (**8 passed**, including its own anti-vacuity test, so it is not measuring nothing).
**What it measures simply does not include this lane.**

**Consequence for every task here: a green provenance suite says nothing about these four screens.**
Do not cite it as marker coverage. **Ward Lead re-derived this independently and confirms it holds
for lanes A, C and D too** — neither reached file is in any lane's directory.

#### ⚠️ The "structural trap" on this page is REAL in its conclusion and WRONG in its stated reason

`community-index.tsx:496-498` records, in the file's own words, that the footer _"first shipped with
`<h2>About this list</h2>` and `ward-community-index.dom.test.tsx` went red immediately: this page
renders **EXACTLY ONE** `<h2>`"_ — so it was made a `<p>`. Read as: satisfying the heading-count
guard permanently excludes the page from the marker guard's population.

🔴 **Measured 2026-09-11: no guard in this tree counts `<h2>`s on this page.** The named test file
contains **no heading-level assertion at all** and never mentions _"About this list"_. Swept all ten
test files touching `CommunityIndex`, in every form such a guard could take
(`level: 2`, `querySelectorAll("h2")`, `getAllByRole("heading")`, `toHaveLength`): **none counts
`h2`s.**

✅ **Positive control on the method** — the same search found a real `level: 2` assertion in
`tests/calculators-mode.dom.test.tsx`. **The search can say yes, so its no carries information.**

**So the comment is a HISTORICAL record — true when written — describing a guard that is no longer
there.** The trap is not currently structural: adding a heading today would probably redden nothing.

🔴 **THE ACTIONABLE RULE, AND IT IS THE HARDER OF THE TWO READINGS ON PURPOSE.**
**Open the guard, not the description of it.**

⚠️ **Two causes here, and only one of them is anybody's to fix.** Time made the comment false — a
comment true when written, decaying with no date on it, is a real and distinct failure mode and it is
worth knowing. **But the comment NAMED THE FILE.** Checking it was one `grep`. **Repeating it as fact
without opening the named file is what turned a decayed comment into a false claim**, and that half
was cheap to prevent.

⚠️ **I first offered the softer framing — "what made it false was time" — and Ward Lead declined it
and asked for this version.** Recorded, because **a concession in somebody's favour is exactly the
correction that goes unaudited**, and because a plan carries whichever version is written down.
**The fix is identical either way, which is the tell that the softer framing was not load-bearing.**

🔴 **THIS IS NOT A LICENCE TO ADD ONE.** The reason to leave it alone is **the owner's ruling that
the reach stays at 2** — which is untouched by any of this. ⚠️ **The conclusion was right and its
justification had expired**, which is the more dangerous of the two failures: **a reader who tests
the stated reason, finds it false, and acts — when the real reason still holds and was never
examined.**

### 0.2 The wiring-contract shorthand names four routes that do not exist

Master plan **§1.5** writes `/ward/[unitId]`, `/board/[unitId]`, `/ed/[edId]`, `/community/[teamId]`.
**None of those exists.** Measured: `src/app/ward`, `src/app/board`, `src/app/ed`,
`src/app/community` are all absent. **The MASTER PLAN's §1.4 route table has the real ones** — not
this plan's §1.4, which is about live regions; the numbers collide and only one of them is a route
table. This lane uses these:

    /mockups/ward-flow/ward/[unitId]        /mockups/ward-flow/ed/[edId]
    /mockups/ward-flow/board/[unitId]       /mockups/ward-flow/community/[teamId]   (index /mockups/ward-flow/community)

**Never type one of these.** Every href comes from the facade;
`tests/ward-links-never-point-at-redirect-stubs.test.ts` is the catcher.

### 0.3 Two gate paths in the master plan are wrong

`run-ward-tests.mjs` and `check-ward-expected-reds.mjs` live in **`scripts/`**, not `scripts/ward-flow/`:

```bash
node scripts/run-ward-tests.mjs
```

```bash
node scripts/check-ward-expected-reds.mjs
```

---

## 1 · Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the
master plan §3.3 and the owner decisions, **except where §0 above corrects them**.

- **Tokens only.** No hex, no `color-mix`, no shadow inside a panel, **no coloured bar on any edge,
  no top highlight**, **one primary action per panel**.

  🔴 **THE CATCHER, MEASURED HERE 2026-09-11 — I ran the experiment rather than reading filenames.**
  Added `.wardHexProbe2026 { color: #bada55; }` to `ward/ward.module.css`, ran each candidate,
  restored with `git show HEAD:<path> > <path>` and confirmed byte-identical:

        tests/ward-css-token-references-resolve.test.ts   8 passed WITH the hex present  -> NOT a catcher
        eslint no-hardcoded-hex                            scans classNames in JS/TSX, not .css -> NOT a catcher
        scripts/check-design-system-contract.mjs           rawColorLiterals 0 -> 1, NAMED MY FILE,
                                                           true exit 1                  -> THIS IS THE CATCHER

  ⚠️ **The gate's rule is "no MORE raw colour in this path", not "tokens only"** — existing literals
  are tolerated by baseline. **For this lane those are the same rule in practice, because the colour
  baseline for `ward/`, `board/`, `ed/` and `community/` is 0** — so any hex is a regression. **Do not
  restate that equivalence for another lane without measuring its baseline.**

  🔴 **AND THE GATE IS ALREADY RED ON A CLEAN TREE — IT CANNOT BE USED BY EXIT CODE ALONE.**
  Measured with **nothing of mine in the tree**: true exit **1**, from regressions in
  `delays/delays.module.css` and `ward-global-search.module.css` (motion durations, padding, radius,
  margin, line-height, layout-transition exceptions). **None is Lane B's.** So a red here does **not**
  mean you broke something. **Diff the report against the clean-tree run; never read the exit code.**

  ⚠️ **I got the exit code wrong first time by piping the gate into `tail`, which returns TAIL's
  status — the trap §7 of this very plan warns about.** `EXIT=0` on a run that had actually failed.
  **Redirect to a file and read `$?`; never pipe a gate.**

  🔴 **AND THE TRANSFERABLE HALF: THE ERROR WAS NOT IN THE THING I WAS BEING CAREFUL ABOUT.** I was
  concentrating on the claim under test; the pipe was incidental scaffolding. **A rule you know
  protects the command you are thinking about. The scaffolding goes unguarded.**

  ⚠️ **A caution for whoever is told to "clear the debt" on a flagged literal — measured 2026-09-11.**
  One of the two hits in `ward-global-search.module.css` is `margin: -1px` inside the **canonical
  visually-hidden block** (`position:absolute; width:1px; height:1px; clip:rect(0,0,0,0)`).
  **That is a required magic number in a screen-reader-only idiom, not a spacing decision —
  tokenising it would be a defect, not a fix.**

  🔴 **And there is no way to say so to the gate.** Measured: `RAW_COLOR_EXEMPTIONS` exists
  (imported at `:7`) — **for colour only.** `rawMarginLiterals` goes straight to `recordDebt(...)`
  with **no exemption filter**. **So a literal that MUST stay can only be left in the baseline** —
  and **"baselined because it is correct" and "baselined because nobody has got to it" are the same
  state, indistinguishable from outside.** That is the design-system question, not a ward one.

  ⚠️ **Forward hazard for THIS lane.** Measured: `ward/`, `board/`, `ed/` and `community/` **do not
  carry that idiom today**. But §1.4 pushes this lane toward `sr-only` announcements — **the moment a
  rebuild adds one in the canonical form, this lane acquires margin debt it must not tokenise and
  cannot exempt.** Flag it to Ward Lead rather than solving it in a screen.
  ✅ **The shell branch adds neither part of the idiom** (Ward Lead checked before folding), so the
  fold does not create this for anyone.

  🔴 **AND WRITING DOWN WHY IT MUST STAY IS ITSELF THE TRAP — errata §AB-3.** The gate reads **raw
  file text, including comments.** So a comment explaining the kept declaration **counts as another
  raw literal, and the better the justification the more debt it records.**

  **RULE: DESCRIBE the declaration, NEVER REPRODUCE it.** Write _"the negative margin in the
  visually-hidden block"_. **Never the declaration itself** — in code, in comments, anywhere the gate
  reads.

  ✅ **Measured where the boundary actually is, rather than assuming it:** the gate scans
  **`.css`, `.ts`, `.tsx` only** (`SOURCE_EXTENSIONS`). Verified by report rather than by reading the
  source — this plan is `.md`, it **spells the declaration out in full above**, and the run is
  **byte-identical** to the clean-tree run taken before that text existed (`rawMarginLiterals 27 → 29`
  both times), with **this file appearing zero times** in the report.

  ⚠️ **Which produces a real tension, not a tidy answer: the only place safe to explain it is the
  place the reader is not.** Whoever next meets that literal is reading the `.css` file, where the
  full explanation cannot be written. **A pointer to this plan is the most that may go in the
  stylesheet.**

  ⚠️ **And do not carry "that file is the idiom file" forward** (§AB-4). Its other flag —
  a raw radius on a `kbd` element — is **an ordinary outlier**, in a file where every other radius
  uses the token. **Two flags, one file, one idiom and one outlier. Judge each hit.**
  _Flagged, therefore check whether it is an idiom_ — yes. _In the file I was told contains an idiom,
  therefore it is one_ — no.

- 🔴 **Text size — the standard and the gate enforce OPPOSITE floors, and the ruling is "no NEW".**

        ward standard §4        floor is 12px — "nothing is set smaller" (one exception: the flow map)
        the app's own tokens    --text-3xs = 10px, --text-2xs = 11px
        check-type-scale.mjs    its own comment: "text-3xs (10px) is the floor"

  🔴 **OWNER RULING D-3, 2026-09-10** (`owner-decisions-2026-09-1x.md:182`) — **this supersedes the
  earlier "not yours to change" wording in this plan, which was half wrong:**

        NEW ward code        never below 12px for HTML text. A smaller size is a
                             stop-and-hand-back, not a token choice.
        the existing uses    raised SCREEN BY SCREEN as each screen is rebuilt.

  ⚠️ **THREE CASES, AND THE MIDDLE ONE IS THE EASY MISTAKE — it is refused even on a screen you ARE
  rebuilding:**

        NOT a sweep          389 raised at once across 50 files, layout changing everywhere
                             simultaneously with nothing checking it — refused
        NOT a drive-by tidy  raising a NEIGHBOURING declaration "for consistency" while you
                             are doing something else — still refused, on any screen
        YES, rebuild work    a screen you are rebuilding comes up to 12px as part of THAT
                             rebuild, with its layout re-proved in the same work
        the flow map         UNCHANGED. Its 10.5/11.5px exception stands.
        the notice           .syntheticNotice raised on every screen NOW, ahead of its
                             turn — WARD LEAD IS DOING THAT. Not this lane.
        the ratchet          today's count may fall, never rise.

  🔴 **So the sub-12px text on THESE FOUR SCREENS IS THIS LANE'S WORK**, done inside the rebuild of
  each one — not swept, not deferred. **Measured in this tree:**

        ward/ 17 · board/ 25 · ed/ 11 · community/ 14   =  67 uses

  **Why it is done in the rebuild and nowhere else** (D-3's own reasoning, worth carrying): raising
  389 declarations at once **would change layout everywhere simultaneously** — wrapped headings,
  clipped labels, overflowing counts — and this project already carries layout defects no automated
  check catches. **A rebuild re-lays the screen out anyway, so it absorbs the larger text with its own
  layout checked in the same work.** Near-zero cost at that moment, high at any other.

  ⚠️ **What was wrong before D-3, and it is the reason the rule needed stating at all:** the standard
  said 12px and "nothing is set smaller"; the app's tokens reach 10px and `check-type-scale.mjs`
  declares 10px the floor **in its own comment**. **A builder obeying the brief and a builder obeying
  the linter were obeying different rules, and only the linter was checked.**

  ⚠️ **Two honest counts exist and NEITHER is the ruling:** Ward Lead measured **389 across 50 files**,
  I measured **393 across 39** (`--text-3xs`/`--text-2xs` under `src/components/ward-management/**/*.css`).
  **Different sweeps, not a contradiction.** The ratchet pins whatever the real number is on the day it
  runs, which settles it for free — **do not spend time reconciling them.**

- **Words before colour.** Every state carries text; colour only reinforces a word already present.
- **Absence and zero.** A missing value is **shown and marked absent, never dropped**; zero reads
  _none_. _"Renders as absent"_ means **shown and marked**, not **disappears**.
- **Invented and real.** Every synthetic number carries the invented-figure marker where it is read.
  Never _"Live"_, never _"reconciled with reality"_. The sentence is
  **_"Invented figures, reconciled with each other, as at &lt;clock&gt;"_** (see §0.1).
  **A sentence must be true read alone.**
- **Derived, never typed.** Every count, tile, line, tag and reconciliation line is computed from
  state on every render. **A literal figure in JSX is a defect.**
- **Clock.** The reconciliation line prints the clock's time. **Nothing calls `Date.now()`.**
- **Vocabulary.** The third bed stage is **discharged**, never _released_. **Available**, never
  _Unoccupied_. A community patient is a team's by the **explicit team on the referral**, never by
  home area. A team sees the decline reason **for its own referrals only** (`FD-23`).
  _Legal authority_ reads **Yours**; wait bands are **8 and 24 hours**.
- **Sex and gender** (owner, `owner-decisions-2026-09-09.md` §8–§9). Two fields. Sex is a recorded
  clinical fact on the person. Gender is **Female | Male** on the patient profile, plus a distinct
  **not yet recorded** state that is **NEVER defaulted from sex**. **Gender decides the bed. There is
  NO override path on the gender gate** — do not add one on the grounds that nine other gates have
  one. ⚠️ `Unit.sexMix` is `Record<Sex, number>`; **whether the bed mix becomes a gender mix is a
  decision to hand back, not a rename.**
- **Acuity** (Q-1). The referring clinician marks it. **The system never computes it.** It is
  **shown as a word**, never used as a **sort key**. Nothing on a bed tile carries it.
- **Catchment** (Q-2). **Information, never a filter.** No bed is hidden or excluded by where
  someone lives. This does not license computing a catchment relationship the model does not hold.
- **No forensic-unit exclusion.** There is no ruling, so `!unit.forensic` is not built.
- **Never read `Unit.held`** (I-9) — the facade exposes `unitCapacity()` only.
- **Role types** (I-4). `WardFlowRole` for dispatch, `WardChromeRole` for shell adaptation, **never
  `WardRole`**, and no fourth type. Renaming is out of scope.
- **The mockup engines are the spec for what is SHOWN, never for how data is HELD** (I-10). A figure
  a mockup shows that the model cannot derive is a **stop-and-hand-back**, not an invention.
- **Escape never clears the service selector; drawers are modal; the rail's state is remembered.**
  Keyboard reach and visible focus on every control.
- **Eight widths, two themes, forced colours, print:** 1920, 1600, 1440, 1280, 1200, 1100, 390, 320.
  **At least one width in the 641–1000px band** (I-16) — six of twelve ward specs never look there.
- **The changeable-data rule.** The owner will replace every invented figure with real ones.
  **Nothing may be built that only works for the seed.**
- **A new reducer action is a stop-and-hand-back.** A screen dispatches only actions that already
  exist in `ward-flow-reducer.ts`.
- **Never `git add -A`.** Explicit paths. Prettier on touched files before every commit.
  **`npm run format` is not trusted** — it exits 0 having changed nothing when binaries are absent.
  Check first with `ls node_modules/.bin | wc -l` (**147 in this worktree, verified 2026-09-10**).
- **If you reach a decision this plan does not cover, stop and hand it back — do not choose.**

### 1.3 🔴 How to mutate and restore — the obvious way is BLOCKED and strands the mutant

**Every task below ends with a mutation proof.** The restore leg is not `git checkout --`.

    git checkout -- <any ward source path>       BLOCKED — even as a no-op on a clean file
    git show HEAD:<path> > <path>                WORKS
    git diff --quiet <path>                      CONFIRM — byte-for-byte, every time

🔴 **The block fires AFTER your mutation is already in the tree**, so it leaves a deliberately broken
file in place with the obvious repair refused. **A driver who does not read the refusal ships the
mutant.** Both legs verified in this worktree, 2026-09-10: the no-op checkout was refused; the
`git show` restore round-tripped byte-identically.

⚠️ **The refusal names `CLAUDE_ALLOW_PROTECTED_DELETE=1`. DO NOT USE IT.** That override is for
deletions the owner has approved, and this is not a deletion — the hook is a false positive on the
word shapes in the path. **Never edit or disable the hook either.**

⚠️ **A restore that merely looks right is not a restore.** `git diff --quiet` is the proof, and it is
not optional — a mutation left in a file that later gets committed is a defect you introduced while
proving you had not.

🔴 **NEVER `git stash`, and never `git stash pop`.** The stash stack is **shared with every worktree
on this machine and with other live sessions** — a bare stash can pick up, or hand away, another
chat's uncommitted work. **To set work aside, make a temporary commit.**

### 1.4 🔴 Live regions — read them on every browser pass, and test absence NEGATIVELY

**Errata §U (Lane C, 2026-09-11, master line `fbb1b6d7ca` — folded).** Patient search produced its
refusal **exactly right** — fixed sentence in both places, `role="status"`, zero rows — and every
test asserting that **passed**. In the same breath a sibling component's live region said
**_"Nobody matches."_**

🔴 **That sentence claims the system LOOKED and found nobody. It did not look.** The standard says a
refusal is spoken and nothing is returned, and that **it is never an empty list**. That IS the empty
list, spoken. **A screen-reader user heard the one sentence the refusal exists to prevent.**

⚠️ **Why all three of this project's review methods were blind to it:** it lived in an `sr-only` live
region — **no screenshot can show it and no person looking at the screen can see it** — and it lived
in **a different file from the refusal**, in a component the refusal task had no reason to open.

**Two changes, both binding here:**

1. 🔴 **On every browser pass, READ THE LIVE REGIONS.** Not the screenshot, not the visible text.
   Add it as a step in the task's browser check.
2. 🔴 **Where a screen states an absence or a refusal, the assertion is NEGATIVE and scoped to the
   WHOLE announcement**, not to the refusing component. _"The refusal appears"_ + _"no rows render"_
   are **both positive and both local** — they pass with a contradiction sitting beside them. The
   catching form is: **while an absence stands, nothing anywhere may make a claim about matches or
   counts** — spoken, visible, or in a near-miss note.

**This generalises past refusals: any state whose whole point is _"this was not measured"_ can be
undone by any other mounted component that speaks as though it was.** Every screen in this lane has
such states — the four catchment lookup states, `record not linked`, `Absence here means none is
recorded`, `Not derivable from the catchment table`.

#### Measured in this lane, 2026-09-11 — and it is CLEAN, which is why it is worth writing down

    aria-live / role="status" in ward/, board/, ed/, community/    ->  ONE
    community-index.tsx:352   aria-live="polite"
      "<n> of <total> names shown — matching "<query>""

🔴 **THIS COUNT HAS A KNOWN EXPIRY AND IT IS NOT YET REACHED. DO NOT INHERIT IT.**
**Phase 1's shell adds a SHARED live-region component.** The moment it mounts, this lane's count of
one — and Lane A's zero — **both become false.** Neither is wrong today; both are about to be.
**Re-derive before relying on it:**

```bash
grep -rn 'aria-live\|role="status"' src/components/ward-management/{ward,board,ed,community,shell}/
```

⚠️ **THE EXPIRY HAS NOT FIRED — AND I SAID IT HAD. Corrected 2026-09-11, measured both ways:**

    live-region FILES in the five directories        TWO
      community/community-index.tsx                    the gateway's result line   THIS LANE'S
      shell/ward-live-region.tsx                       imported by ward-bar and ward-rail

    live regions REACHABLE FROM A RENDERED SCREEN    ONE
      nothing in src/app/ mounts the shell — the mount was folded and REVERTED within the hour
      (it put two search boxes on every screen), and is being re-landed as a pair

🔴 **Both counts are honest and they answer different questions.** I ran the grep, saw the second
file, and reported _"the expiry has fired"_ — **which is a claim about REACHABILITY made from a
measurement of EXISTENCE.** Ward Lead's count of one is the operationally correct one and mine was
the wrong unit. **Establish the unit before counting.**

⚠️ **The expiry stands, unfired, and its trigger is unchanged: the MOUNT, not the file.** The moment
`src/app/` mounts the shell, every screen inherits that announcer and §U3 applies in full — **read it
on each screen, never once for the shell.** **Re-derive then; do not carry either figure across it.**

⚠️ **And `ward-live-region.tsx` carries its own warning that a SECOND `aria-live` region in `shell/`
would be "the same defect as a second fixed search bar"** — which is the duplicate-DOM-node class a
fold shipped today and neither the offline suite nor `tsc` could see. **This lane's region is not in
`shell/` and so is not that defect** — but **every screen now inherits the shell's announcer**, so
§U3 applies in full: **read it ON EACH SCREEN, never once for the shell.**

✅ **D-8 is already satisfied on this lane's region** — it reads **"_n_ of _total_ **invented names**
shown"**, the marker riding the noun, and **"names" not "people"**. Applied on the line and arrived
here by merge; **not this lane's edit, and re-checked rather than assumed.**

🔴 **AND THE SHARED REGION IS §U's MECHANISM MADE STRUCTURAL.** §U's defect survived because the
contradicting component was _"one the refusal task had no reason to open"_. **A shell-owned announcer
is that component for every screen at once, by construction** — no lane owns it, no lane's brief
lists it, and every lane's screen inherits whatever it says. **The browser pass reads it on every
screen, not once for the shell.** (Errata **§U3**.)

🔴 **AND THE REPORTING RULE THAT FOLLOWS FROM IT:**

> **"The shell's live region is correct" is NOT a finding about any screen.**

**A report must name the screens it was read on.** The contradiction does not live in the component —
**it comes into existence when the component is mounted beside a screen that has just refused to
answer something.** ⚠️ **A single clearance of the shell, however careful, is §U's defect in its
reporting form: correct about the part, silent about every place the defect can actually occur.**

**That page also carries an explicit stated absence** (`:285-287`): the counts are counts of **names,
not services**, some names are one team spelled several ways, _"and this page **cannot say how much
smaller**."_

✅ **They agree today, and the agreement is load-bearing on ONE WORD.** The live region says
**"names shown"** — exactly the unit the caveat protects. 🔴 **Change that word to _services_ or
_teams_ and the page speaks a measurement it has just said it cannot make** — aloud, in the one place
no screenshot and no reader can see. **Pin the word, not the sentence.**

#### ⚠️ The MARKER half is a different defect, and §U's negative assertion cannot find it

**Errata §U2 (Lane D):**

    A REFUSAL is a sentence that must be ALONE.     -> negative assertion works: a contradiction exists
    A MARKER  is a sentence that must be TOGETHER.  -> nothing contradicts anything; there is just
                                                       a number, announced bare

🔴 **THIS LANE HAS ONE, FLAGGED AND NOT FIXED HERE.** `community-index.tsx:352` announces
`<n> of <total> names shown` — **counts of synthetic teams, with no marker inside the region.** The
page's `Synthetic prototype` marker sits **63 lines away at `:289`, in the visible layer only, and is
never announced with the count.** The figure travels into the live region; the marker stays behind.
**That is §U2's described shape exactly.**

🔴 **DO NOT WRITE A GUARD FOR IT HERE.** Ward Lead's instruction, 2026-09-11: the catching form is
positive-over-the-whole-surface — _every announced figure carries its marker, in every layer it is
announced in_ — and **that is a guard whose strength is the whole point. It needs its own brief and
its own adversarial pass, and is deliberately unwritten.** Flagged to Ward Lead; **improvising a weak
version here would be worse than none, because its green would then be cited as coverage.**

⚠️ **The two visible chip counts (`:344`, `:347`) are NOT the same case** — they sit in the same
layer as the marker, where a reader meets both. **Only the announced one separates the figure from
its marker.**

#### 🔴 THE GENERAL RULE THIS PAGE PRODUCED — it applies to every screen in this lane

**Wherever a caveat protects a UNIT, the guard belongs on the UNIT WORD, not on the sentence
carrying it.**

    names, not services      community index — the caveat this page already carries
    moves, not patients      one patient can have several movements
    beds, not people         a bed on leave is held for someone who is not in it

**A test asserting the sentence renders survives the one edit that breaks it** — swapping the unit
word leaves the sentence structurally identical and semantically false. **This project has a whole
family of these**, and each is one word from announcing a measurement it has just disclaimed.

⚠️ **`ed/` carries eleven `sr-only` spans.** None is a live region today — **but `sr-only` text placed
inside one announces**, so the ED browser pass reads them specifically.

### 1.1 Files this lane may NEVER edit

`layout.tsx`, `ward-nav.ts`, `shell/**`, `ward-facade.ts`, the seeds, `ward-model.ts`,
`ward-flow-reducer.ts`, any `*.module.css` outside this lane's directories,
`docs/ward-flow/mockups/**`. A change needed there is a four-line message to Ward Lead.
**A mockup defect goes to Ward Mockups and is never fixed here.**

### 1.2 What this lane consumes from Phase 1

- The shell in `layout.tsx` — rail, header, drawers. **No screen mounts its own.**
- `ward-facade.ts` href builders for every route in §0.2, plus `raiseReferralHref({...})`.
- **`communityTeamHref` moves out of `community-screen.tsx` into the facade** (Ward Lead, Phase 1).
  **Assume it arrives from the facade.**
- **I-6, the seed fix (Phase 1.5):** three of four seed sites manufacture `Admission.referralId` from
  the admission id, so `admissionBelongsToTeam` returns false and community team pages read empty.
  🔴 **Task set D is BLOCKED on this. Do not work around it inside the screen.**

---

## 2 · How the inventories below were obtained, and what is wrong with them

Four read-only extraction agents (**Sonnet, extraction** — the output is a factual inventory anyone
can check against the files, and the files are the catcher) inventoried the four screens.
**Every load-bearing claim below was then spot-checked by hand against the tree.**

### 2.1 🔴 The drawings changed under two of the agents, and that is my error

I merged the line (bringing the folded third-edition drawings) into this worktree **while two agents
were still reading the mockups**. All four drawings changed substantially in that fold
(417 insertions, 106 deletions across the four).

**Consequence, measured:** the agents' **mockup line numbers are stale** — ED's claimed `:5475`,
`:7623`, `:8560` all point at unrelated lines in the current file. **Their content claims survive**:
re-checked by name against the current drawings, ED's five chips are all still present and its three
app-only panels are all still absent; the Ward, Bed board and Community claims re-checked the same
way and held.

⚠️ **Every mockup line number in §3–§6 is therefore UNRELIABLE. Find by name, never by line.** The
app-side line numbers are sound — the four components did not change in the fold (measured:
`git diff --stat 8c5aebc938 <tip> -- src/components/ward-management/{ward,board,ed,community}/`
returns empty).

### 2.2 ⚠️ A grep of mine manufactured a false absence — the failure this plan is most likely to repeat

Checking whether the Ward drawing still had its `Today's return` panel:

    grep -c "Today's return"  ward-third-edition.html   ->  0     WRONG
    the drawing actually says  <h2 id="returnH">Today&rsquo;s return</h2>

**The apostrophe is the HTML entity `&rsquo;`, not `'`.** The panel was there the whole time. Had I
stopped at the zero I would have written a task removing a panel the owner's drawing still draws.

🔴 **Rule for every task below: when a grep of a drawing returns zero, check the punctuation before
believing it.** Curly quotes, `&rsquo;`, `&mdash;`, `&hellip;` and non-breaking spaces all defeat a
literal search. **A zero from a search of an HTML drawing is not evidence of absence.**

🔴 **AND THE POSITIVE RULE, WHICH IS THE ONE THAT ACTUALLY PREVENTS IT: COPY EVERY HEADING STRING
OUT OF THE DRAWING. NEVER RETYPE ONE.** Retyping silently converts `&rsquo;` or U+2019 into `'`, and
the resulting screen renders a heading that looks identical and matches nothing.

**Two lanes hit this in one hour with two different characters** — a curly apostrophe and the HTML
entity. **`node scripts/ward-flow/check-errata-freshness.mjs` re-measures it as entry I: six of the
eighteen drawings use the entity in headings** (verified in this tree). ⚠️ **My own instance is §2.2
above: I got a zero and nearly wrote a task deleting a live panel.**

---

## 3 · Task set A — Ward (`/mockups/ward-flow/ward/[unitId]`)

**Drawing:** `ward-third-edition.html` · **Component:** `src/components/ward-management/ward/ward-screen.tsx` (2,352 lines)

**The drawing's panels, in order:** This ward → Ward figures, right now (with Worth your attention,
Coming in, Beds on the way out, Awaiting your answer nested in an unheaded two-column grid) →
Today's return → Every bed on this ward → The record for today → Where to refer (with
Print the handover sheet as its `h3`).

**The app's panels today:** `h1` = the ward's name → an unheaded `entryHero` → Confirm today's
numbers → Bed capacity → Incoming referrals awaiting an answer → Accepted, pulled or en route here →
Withdrawn from {ward} → Overrides recorded against {ward}.

### 🔴 Two things measured before Task A starts — both would have produced a silent wrong result

**Derived 2026-09-11 from the post-fold drawing and the current component, before any edit.**

#### A-prep-1 · The apostrophe is NOT the same character in two drawings

    community-team-third-edition.html   "Waiting for the team's answer"    plain U+0027  (od-verified)
    ward-third-edition.html             "Today&rsquo;s return"             HTML ENTITY -> U+2019

🔴 **So the rule "copy, never retype" is not enough on its own — copying from the WRONG DRAWING is
the same defect.** A builder who takes the community pattern and types a plain `'` into the Ward
screen produces a heading that looks identical and matches nothing. **Copy each string from ITS OWN
drawing**, and when a grep of a drawing returns zero, check the punctuation before believing it
(§2.2).

#### A-prep-2 · The Ward screen has TWO naming layers, and they already disagree

    <section aria-label="Incoming referrals">        <h2>Incoming referrals awaiting an answer</h2>
    <section aria-label="Overrides recorded against this ward">   <h2>Overrides recorded against {unit.name}</h2>
    <section aria-label="Bed capacity">              <h2>Bed capacity</h2>              (these two agree)

⚠️ **An inventory taken by `aria-label` and one taken by heading text return DIFFERENT LISTS** — the
same trap the ED screen carries (§5, Task C4). 🔴 **And the accessible name is the one a screen-reader
user navigating by region actually hears**, so renaming only the visible heading leaves the two
layers describing the same panel differently — **which is §U's shape in a third layer.**

**Every rename in Task set A changes BOTH layers, or states why not.** ⚠️ **And the D2 lesson applies
first: establish the population — headings, `aria-label`s, tile/figure labels, and the document
title — BEFORE writing the guard, not after it is green.**

### Task A1: The heading contract

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx` (the `h1` — currently `{unit.name}`)
- Modify: `src/app/mockups/ward-flow/ward/[unitId]/page.tsx` (the document title)
- Test: `tests/ward-screen-third-edition-headings.dom.test.tsx` (create)

**Interfaces:**

- Consumes: `useWardFlow()`, `unitById(unitId)` from the facade.
- Produces: nothing other screens read. The `h1` text becomes the constant `Ward`.

**Catcher:** the new DOM test below, plus the existing `tests/ward-landmarks.test.ts` (one `h1` per
route) and `tests/ward-management-role.test.ts` (one `ward-unit-screen` testid), both of which must
stay green unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as the sibling ward-screen dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE DRAWING PUTS THE SCREEN'S NAME IN THE h1 AND THE WARD'S NAME IN A PANEL.
 *
 * The app had it the other way round: the h1 was the ward's own name, so every ward rendered a
 * different h1 and the screen had no stable name anywhere on it.
 *
 * ⚠️ THE FLOOR IS NOT DECORATION. Asserting only that the h1 reads "Ward" would pass on a screen
 * that had lost the ward's name entirely — which is the worse defect of the two, because a
 * coordinator cannot tell which ward they are looking at. Both halves are asserted together.
 */
function renderWard(unitId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the ward screen's heading contract", () => {
  const units = allUnits();

  it("has units to walk, so the assertions below are not vacuous", () => {
    expect(
      units.length,
      "no units in the fixture — every case below would pass having rendered nothing",
    ).toBeGreaterThan(1);
  });

  it("names the SCREEN in the h1, on every ward", () => {
    for (const unit of units.slice(0, 5)) {
      renderWard(unit.id);
      expect(
        screen.getByRole("heading", { level: 1 }),
        `the h1 on ${unit.name} is not the screen's name`,
      ).toHaveTextContent(/^Ward$/u);
      screen.getByRole("heading", { level: 1 }).remove();
    }
  });

  it("still names the WARD, in the This ward panel — the half a lazy fix would drop", () => {
    const unit = units[0];
    renderWard(unit.id);
    expect(
      screen.getByTestId("ward-this-ward"),
      "the ward's own name is no longer anywhere on its own screen",
    ).toHaveTextContent(unit.name);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-screen-third-edition-headings.dom.test.tsx
```

Expected: FAIL — the `h1` currently renders the unit's name, so the `/^Ward$/` assertion fails, and
`ward-this-ward` does not exist yet.

- [ ] **Step 3: Make the change**

In `ward-screen.tsx`, change the `h1` to the constant `Ward`, and move `{unit.name}` into a new
`This ward` panel carrying `data-testid="ward-this-ward"` with the ward's name as its `h3`.
In the route's `page.tsx`, set the document title to `Ward — {unit.name}` (§15.1) — **the document
title keeps the ward's name; only the on-screen `h1` becomes the constant.**

- [ ] **Step 4: Run it green, and prove the old pins still hold**

```bash
npx vitest run tests/ward-screen-third-edition-headings.dom.test.tsx tests/ward-landmarks.test.ts tests/ward-management-role.test.ts
```

- [ ] **Step 5: Prove the test is a catcher, not a passenger**

Revert the `h1` to `{unit.name}` by hand, re-run, **watch it go red**, then restore **by the
procedure in §1.3 — not with `git checkout --`, which is blocked and will strand the mutant.**

- [ ] **Step 6: Prettier, then commit with explicit paths**

```bash
npx prettier --write src/components/ward-management/ward/ward-screen.tsx tests/ward-screen-third-edition-headings.dom.test.tsx
```

**Not built:** the panel renaming (Task A2); anything in `Where to refer` (Task A3).

**Report:** proven by test / proven by looking / not proven — three lines.

### Task A2: Rename and regroup the panels to the drawing

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx`
- Test: `tests/ward-screen-third-edition-headings.dom.test.tsx` (extend)

**Catcher:** a DOM assertion that reads the rendered `h2` list **in order** and compares it to the
drawing's list as an array — `toEqual` on an array pins count, order and spelling in one assertion.

⚠️ **`toHaveTextContent` and array `toEqual` both read `textContent`, which a `display: none`
element still supplies.** Add a per-heading `toBeVisible` loop; that is the matcher that fails for
`display: none`, `visibility: hidden` and a zero-size box alike.

**The mapping** (drawing ← app today):

| Drawing panel           | App today                                    |
| ----------------------- | -------------------------------------------- |
| This ward               | the `h1` + `entryHero`                       |
| Ward figures, right now | Bed capacity (the four sub-panels nest here) |
| ├ Worth your attention  | — **not in the app; new**                    |
| ├ Coming in             | — **not in the app; new**                    |
| ├ Beds on the way out   | the unheaded bed-release blocks              |
| └ Awaiting your answer  | Incoming referrals awaiting an answer        |
| Today's return          | Confirm today's numbers                      |
| Every bed on this ward  | links out to the bed board                   |
| The record for today    | Withdrawn from {ward} + Overrides + declines |
| Where to refer          | — **not in the app; new** (Task A3)          |

🔴 **Q-12: nothing is dropped.** `Withdrawn from {ward}` and `Overrides recorded against {ward}` both
**fold into The record for today** as disclosures, which is where the drawing puts them. **List both
in the report** — silently keeping a panel without listing it breaks the ruling exactly as silently
dropping one does.

**Not built:** `Where to refer` and the print link (Task A3).

**Report:** three lines.

### Task A3: Where to refer, and the handover print link

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx`
- Test: `tests/ward-screen-where-to-refer.dom.test.tsx` (create)

**Catcher:** the new test asserts **all four catchment lookup states in words**, including the two
that refuse to give one answer; plus `tests/ward-links-never-point-at-redirect-stubs.test.ts` for the
print link.

⚠️ **The four states are the point of this panel.** Two of them refuse a single answer (built
2026-09-05 — keep them). A test asserting only the happy state would pass on a panel that had lost
its refusals, which is the failure that matters clinically: a screen that guesses a team.

🔴 **AND THE REFUSAL ASSERTION HERE IS NEGATIVE AND WHOLE-PAGE (§1.4).** Two of these states refuse
to name one team. **While such a refusal stands, nothing anywhere on the screen — spoken, visible or
in a near-miss note — may name a team or claim a count of matching teams.** Assert it over the whole
rendered container, not over the panel. **Positive assertions that the refusal appeared and that no
row rendered both pass with a contradiction beside them** — that is exactly how §U survived a full
task's tests. **Read the live regions in this task's browser pass.**

**The print link** goes to the existing `/handover` page with `?unitId=`. **Handover scoping to one
ward is Q-12** — the master plan recommends scoping it. ⚠️ **That is a recommendation, not a ruling.
Scope it and LIST IT in the report as a Q-12 item**; do not treat the recommendation as settled.

**Not built:** the handover page itself (it exists); catchment as a filter (Q-2 — catchment is
information, never a filter).

**Report:** three lines.

### Task A4: The typed denominator

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx` (the `Confirm today's numbers` count)
- Test: `tests/ward-daily-return-rows.dom.test.tsx` (extend)

**The defect.** The panel renders

```tsx
count={`${confirmedToday.size} of 3 confirmed since this page opened`}
```

**`3` is typed, not derived** — a literal figure in JSX, which the global constraints call a defect.

⚠️ **AND THE OBVIOUS FIX IS WRONG.** The comment above it explains why the denominator is 3 and not
5: _"Rows 4 and 5 record an ITEM, never an answer act, so they can never increment it."_ Deriving it
from the row count gives **5** and the screen starts under-reporting its own completeness forever.

**Derive it from the rows that can actually increment it** — the subset of return rows that record an
answer act — so it stays correct when a row is added. **That is the changeable-data rule applied to a
denominator.** Preserve the comment's distinction in the new code.

**Catcher:** a test that adds a sixth, answer-act row to the fixture and asserts the denominator
moves to 4; and a second that adds an item-only row and asserts it does **not** move.
⚠️ **Both directions, or the derivation could just be `rows.length` and pass.**

**Not built:** any change to what the five rows ask.

**Report:** three lines.

---

## 4 · Task set B — Bed board (`/mockups/ward-flow/board/[unitId]`)

**Drawing:** `bed-board-third-edition.html` · **Component:** `src/components/ward-management/board/ward-board.tsx` (1,981 lines)

**Drawing:** Bed board (`h1`) → ward name (`h2`) → Needs you this shift → Every bed, and who is in it
→ Either side of this ward (three tabs: Going out / Coming in / Since yesterday) → the record panel
for a chosen bed.

**App today:** ward name (`h1`) → Today on this ward → Needs a look this shift → Coming in → Going
out today → Since yesterday → an **unheaded** bed grid → a dynamic detail `aside` → Where these beds
free up to → The ward's daily sheet → Who is in these beds.

### Task B1: Headings, and fold the three flow sections into one panel

**Files:** modify `ward-board.tsx`; test `tests/ward-board-third-edition.dom.test.tsx` (create).

**Catcher:** ordered-array `h2` assertion + per-heading `toBeVisible`, as Task A2.

**The mapping.** `Coming in`, `Going out today` and `Since yesterday` become **three groups inside
Either side of this ward**. The bed grid **gains the heading it does not have**: `Every bed, and who
is in it`.

🔴 **Q-12, and this one has a documented answer already:** `Where these beds free up to` — **the
drawing's own footnote says it was folded into Going out**, because both listed the same beds. **Fold
it there and list it.** Verified in the current drawing by name.

🔴 **Q-12, unresolved, hand back if unclear:** `The ward's daily sheet` and `Who is in these beds`.
⚠️ **`Who is in these beds` is `display: none` on screen** (`board.module.css`, described in its own
comment as _"the ONE piece of hidden content on this board"_) — **it exists for print only.** It is
not a visible panel and must not be "folded" into a visible one without deciding what print does.
**List both; decide neither.**

✅ **RULED — D-13 (A-3), and it resolves FOR THE CODE.** The drawing puts a bed number on every tile;
**the component refuses it and is right.** 🔴 **The data carries no per-tile bed number** — `Unit.blocked`
is a COUNT, and which tile is blocked or held is recorded as not knowable — **so a number drawn on a
tile would be invented, on the screen a coordinator uses to place people.**
**The DRAWING is corrected; no code change. Routed to Ward Mockups.**

🔴 **DO NOT ADD TILE NUMBERS.** This lane has not, and Task set B has not started — **so there is
nothing for me to remove**, which I have verified rather than assumed.

**Not built:** filter chips and the Order select (the drawing has them, the app has none — **new
surface, list it**).

**Report:** three lines.

### Task B2: Tile state words

**Files:** modify `ward-board.tsx`; catcher `tests/ward-board-tile-labels-distinct.dom.test.tsx` and
`tests/ward-pull-vocabulary.dom.test.tsx` **stay green — never convert the latter**.

**Measured, current app tile words:** `Ready` (empty), `Held`, `Empty, waiting`, `Out of service`,
and for an occupied bed a day count with the band label only in an `sr-only` span.

**Measured:** `released` and `Unoccupied` appear **nowhere** in `ward-board.tsx`. ✅ The vocabulary
rulings are already satisfied — **do not "fix" what is already right.**

🔴 **One real difference:** the drawing's `stateWord()` renders the literal **`Occupied`** for an
occupied bed; **the app renders no state word on an occupied tile at all**, only a day count.
⚠️ **This is a decision, not a rename** — adding `Occupied` puts a word on every occupied tile in the
ward. **Hand it back.**

**Not built:** any acuity mark on a tile (Q-1 and §4.6 both exclude it).

**Report:** three lines.

### Task B3: 🔴 The two `arrivedAt` fields, and the double-allocation they hide

**Files:** modify `ward-board.tsx`; test `tests/ward-board-absent-arrival.test.ts` (create).

**The defect, from the errata (Ward Builder Four, via Ward Lead).** Two different fields are called
`arrivedAt` and are absent in **two different ways**:

    Admission.arrivedAt      Instant | null
    TransportJob.arrivedAt   Instant | undefined

⚠️ **A guard written `=== null` silently passes every `undefined`; one written `=== undefined`
silently passes every `null`. Neither goes red.** And `pulledAt` / `arrivedAt` / `leftAt` are all
`Instant | null` — **a derivation written the obvious way filters the nulls and draws a clean picture
of a quietly different population, passing every test that counts rows.**

**Why it is clinical here.** A pulled bed with a null arrival **is not empty**. Offering it again is
a double-allocation the ward discovers when **two people turn up for one bed**.

**Catcher.** A test over the real fixture asserting a bed whose admission has `pulledAt` set and
`arrivedAt === null` is **not** counted as available — plus **a second case with `undefined`**, so a
`=== null` guard cannot pass it. ⚠️ **Both absence shapes, or the test cannot tell the two apart —
which is the whole defect.**

**Report:** three lines.

### Task B4: The two I-14 test defects

**Files:** modify `tests/ward-ed-psychiatry-hub.dom.test.tsx`, `tests/ward-board-live-state.dom.test.tsx`,
`tests/ward-daily-sheet.dom.test.tsx`.

🔴 **FIND BY NAME, NEVER BY LINE.** The master plan says the dead assertion is at line `1687`. It is
at **1698** on the line and **1649** on a branch 212 commits behind. **All three are true** — a line
number is a property of the tree you stand in. Search for the text.

**Defect 1 — the dead literal.**

```
expect(245 - 35, "the gap this row exists to show, and the reason one clock is not enough").toBe(210);
```

It asserts arithmetic about two constants and **can never fail**. It sits inside
`it("⚠️ renders RF-009's two clocks on the hub, so the 210-minute gap is legible on screen")`, whose
**other** assertions are real (they read `data-minutes-in-department="245"` and
`data-minutes-since-referral="35"` off the row and pin the rendered clock wording).

⚠️ **Do not merely delete it — that leaves the 210 unasserted.** Replace it with an assertion that
reads **both numbers off the rendered row** and checks their difference, so it fails if either
rendered figure moves. **Deleting an assertion does not move `check:diff-integrity`'s floor** —
verified: that guard counts test cases from the AST, not assertions — but a deletion that removes
the only check of a rendered figure is still a loss.

**Defect 2 — `ward-board-fixed-note`.** Asserted **absent** in two tests
(`ward-board-live-state.dom.test.tsx`, `ward-daily-sheet.dom.test.tsx`) while existing **nowhere in
`src/`** — verified, zero occurrences. **An absence assertion for a testid that does not exist
cannot fail.** Re-point both at the element that actually carries the frozen-board note.

🔴 **With a positive control**: remove the note by hand, watch **both** tests redden, restore.
⚠️ **A `queryByTestId(...)`/`toBeNull()` pair passes when the element is deleted, when it is renamed,
and when it never existed — three states, one green.**

**Report:** three lines.

---

## 5 · Task set C — Emergency department (`/mockups/ward-flow/ed/[edId]`)

**Drawing:** `emergency-department-third-edition.html` · **Component:** `src/components/ward-management/ed/ed-screen.tsx` (2,654 lines — the largest in this area)

**Drawing:** Emergency department (`h1`) → Emergency departments (the 8-department pressure strip) →
Needs attention → Department lists (four tabs) → "{site} board" with five filter chips →
Seen in the last 24 hours → What is invented and what is real. A person opens a **modal dialog** with
three sections: Where they are up to / Handover / The journey the record holds.

**App today, five headed populations** (all verified, with their derivations):

| Section                    | Derivation                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Expects                    | `edExpectsFor(referrals, thisEdId, "psychiatric_review")`                                   |
| Referrals                  | `edArrivedFor(referrals, thisEdId, "psychiatric_review")`                                   |
| Recently answered          | `edAnsweredReferralsFor(...)` capped at `ANSWERED_VISIBLE_CAP`                              |
| Psychiatry outbox          | `patients.filter((m) => m.acceptedUnitId !== undefined)`                                    |
| This department's patients | `movements.filter((m) => m.originEdId === thisEdId && !m.closure && m.stage !== "arrived")` |

### Task C1: The board and its five chips

**Files:** modify `ed-screen.tsx`; test `tests/ward-ed-third-edition.dom.test.tsx` (create).

**The five chips, verified present in the current drawing by name:** `Everyone`, `Not reviewed`,
`Under a form`, `No destination`, `For discharge`.

**Catcher.** Every chip's count equals its population derivation, **and the chips sum to Everyone**.
⚠️ **The sum assertion is the one that matters** — per-chip equality can be satisfied by five
derivations that each agree with themselves while double-counting a person across two chips.

⚠️ **`Expects` becomes the chip `Expected, not yet here`** (owner concept, 2026-09-07: addressed but
not physically present). **Do not merge it into an arrival population** — that is the distinction the
concept exists to keep.

⚠️ **AMBIGUITY, flagged not resolved.** The drawing's `Expected` tab is driven by a forward-looking
arrival clock; the app's `Expects` is referral-based. **The labels are close and the underlying
models differ.** If they are meant to be one population, that is a **stop-and-hand-back**.

**Report:** three lines.

### Task C2: The person dialog

**Files:** modify `ed-screen.tsx`; test `tests/ward-ed-person-dialog.dom.test.tsx` (create).

Three sections from the movement and referral records: **Where they are up to / Handover / The
journey the record holds**.

**Catcher:** keyboard open and close, focus trap, Escape order. ⚠️ **Escape closes the dialog and
must NOT clear the service selector** — that is a standing global constraint and the two are easy to
wire to one handler.

**Report:** three lines.

### Task C3: The inline form becomes the bar's New referral

**Files:** modify `ed-screen.tsx`; re-point `tests/ui-ward-referrals.spec.ts`.

**Measured:** the inline form dispatches `RAISE_REFERRAL` with `role: "ed"`, `edId: department.id`
and a full draft, passing **no patient or movement identifier** — it raises a new referral scoped to
the department. The bar's New referral goes to `/mockups/ward-flow/referrals/new` with `source=ed`
and `originEdId` prefilled, built by `raiseReferralHref({...})`.

🔴 **This is a route change, not a loss.** `ui-ward-referrals.spec.ts` is **re-pointed, never
skipped.** ⚠️ That spec currently has **two owner-deferred failures**; re-pointing it must not be
allowed to mask them — record its state before and after.

**Report:** three lines.

### Task C4: The Q-12 list for this screen

🔴 **Three panels the app has and the drawing does not — all three verified absent from the current
drawing by name** (`outbox`, `Statewide capacity`, `Recently answered` → **0 hits each**):

1. **Psychiatry outbox** (visible heading `Still to be moved`) → the Activity drawer's ED view.
2. **Statewide capacity (read-only)** → one line linking to Capacity.
3. **Recently answered** → the drawing's `Seen in the last twenty four hours`.

⚠️ **These are the master plan's RECOMMENDATIONS, not rulings.** Q-12 settles the principle — nothing
is dropped — and explicitly **does not settle the inventory**. **List all three in the report.**

⚠️ **And a trap in the app worth knowing before you inventory it:** two sections have an `aria-label`
that does not match their visible heading (`Psychiatry outbox` renders `Still to be moved`;
`This department's patients` renders `{department.name} · {n} patients`). **An inventory taken by
`aria-label` and an inventory taken by heading text return different lists.**

**Not built:** any triage or acuity computation; medical clearance as a blocker.

**Report:** three lines.

---

## 6 · Task set D — Community team (`/mockups/ward-flow/community/[teamId]`)

🔴 **BLOCKED on I-6 (Phase 1.5).** Three of four seed sites manufacture `Admission.referralId` from
the admission id, so `admissionBelongsToTeam` returns false and team pages read empty. **Do not work
around it in the screen.**

**Drawing:** Community team (`h1`, generic) → the team's name (`h2`) with a five-tile band →
Waiting for the team's answer → Worth attention → In a bed or holding one → Admitted while already
with the team → Discharged into the catchment → This team. **Bar primary: Contact a team.**

### Task D1: 🔴 Q-5 is ALREADY SATISFIED — do not "fix" it

**Measured, and this corrects the master plan.** §4.8 says the screen must render _"one team list
(Q-5)"_ and I-7 says _"until answered, lane B renders the one the current Community screen renders"_.

**The screen already renders the sixty-five.** `community-screen.tsx` and `community-derivations.ts`
import **only** `COMMUNITY_TEAM_PAGES` (65, catchment) and **never** `ward-teams.ts` /
`COMMUNITY_TEAMS` (10, region). `community-derivations.ts` says so in its own comment: the region
list _"is deliberately NOT read here"_.

⚠️ **The four grep hits for `COMMUNITY_TEAMS` in these two files are all COMMENTS explaining why it
is not used.** A grep for a name finds its prose — **do not read those hits as consumption.**

**So there is no migration task here.** **Task D1 is to prove it and pin it**, not to change it:
a test asserting the screen's team list is `COMMUNITY_TEAM_PAGES` and that neither file imports
`ward-teams`. The count itself is already pinned by `tests/ward-community-team-count.test.ts`, which
re-derives it from `S2015_CATCHMENT_ROWS` rather than hard-coding 65.

**Report:** three lines.

### Task D2: Rename to the drawing, keep the honest suburb state

**Files:** modify `community-screen.tsx`; test extends `tests/ward-community-corrected-claims.test.ts`.

| Drawing                              | App today                             |
| ------------------------------------ | ------------------------------------- |
| Waiting for the team's answer        | Waiting for your answer               |
| Worth attention                      | Worth your attention                  |
| In a bed or holding one              | Ours, in a bed or holding one         |
| Admitted while already with the team | Admitted while already with this team |
| Discharged into the catchment        | Discharged into the area              |
| This team                            | This team ✅                          |

**Keep** the honest suburb state, verified verbatim in the component:
`"Not derivable from the catchment table"`.

🔴 **Q-12 — four app panels the drawing does not draw, all verified absent by name:**

1. **`Left the ward another way`** → a group inside `Discharged into the catchment`.
2. **`Referrals we have made`** → **no recommendation exists. Hand back.**
3. **`What this page cannot tell you`** → **no recommendation exists. Hand back.**
4. **`Go to`** → the shell owns navigation from Phase 1; **confirm before folding.**

⚠️ **`Expected back` is NOT a fifth item, and the master plan gets this wrong.** It is a top-level
panel in the app and **a table column plus a band tile in the drawing** — present at content level,
absent at panel level. **Fold the panel into `In a bed or holding one` as that column.** Listing it
as "dropped" would be false.

Also unlisted anywhere and easy to lose: the near-duplicate-spelling warning and the ratified-alias
notice — **two non-heading blocks. List them.**

**Report:** three lines.

### Task D3: Contact a team

**Files:** modify `community-screen.tsx`; test `tests/ward-community-contact.dom.test.tsx` (create).

The bar's primary opens `This team`'s contacts — **placeholders in the shape of the real thing**,
ext 11 onward, addresses ending `example.invalid`, **said twice**.

**Catcher:** no digit string of phone-number length appears outside the placeholder pattern.
⚠️ **Assert the SHAPE, not the sample values** — a test pinning `ext 11` goes red on the day a second
placeholder is added and green on the day a real number appears in a different format.

**Report:** three lines.

### Task D4: Membership and decline reasons

**Measured — `admissionBelongsToTeam` is already correct.** It keys on `admission.referralId`
resolving to a referral whose `destinations` name this team, and **reads no geography field at all**.
`referral.homeRegion` is displayed on a waiting card as information only and never enters the
decision. ✅ **Nothing to change. Pin it.**

🔴 **AND ONE MASTER-PLAN CLAIM FAILS HERE.** §4.8 task 3 requires _"decline reasons visible for this
team's own referrals only (FD-23)"_. **The screen renders no decline reason for any referral, and has
no accept or decline button at all** — the app states in prose that the action is not available here.
**There is nothing to restrict.**

⚠️ **So the named catcher cannot fail for its own reason.** Building "restrict decline reasons to
own referrals" against a screen that shows none would be a guard over an empty population —
**compliance without coverage.**

✅ **RULED — D-13 (A-4), and it resolves FOR THE CODE.** The drawing draws the accept/decline controls
**disabled**; the app has none and says in prose that the action is unavailable here. 🔴 **A disabled
control is a worse answer than a sentence: it shows a clinician a door, gives no reason, and leaves
them to guess whether they lack a permission, whether the patient is ineligible, or whether the
feature is unfinished. The sentence says which.** **The app is right; the drawing is corrected.**

**So FD-23 is vacuously satisfied here and NO catcher is to be written for it on this screen.**
⚠️ **Record it as vacuous rather than as covered** — a later reader finding no decline-reason guard
must meet the reason, not the gap.

**Report:** three lines.

---

## 7 · Verification for every task

```bash
node scripts/run-ward-tests.mjs
```

```bash
node scripts/check-ward-expected-reds.mjs
```

⚠️ **`vitest` does not typecheck. Run it separately, always:**

```bash
npx tsc --noEmit
```

⚠️ **Never pipe a test run into `tail` or `head`** — the pipe returns the _last_ command's exit code,
and a 56-failure run has already reported exit 0 that way here. ⚠️ **`--reporter=basic` does not
exist in this repo**: it runs zero tests, exits 0, and the empty failure list reads as "all passing".

**Four of `check:diff-integrity`'s siblings and the ward suite's own gates run in NO automatic
chain** (I-12) — a builder running only the standard pyramid never sees them. **Run them by name.**

⚠️ **44% of non-DOM ward tests read files with `readFileSync`, so `test:focused` cannot select them**
(I-13). **Name them directly.**

## 7.1 · 🔴 Sync-and-run before declaring this branch ready (errata §AF)

**Two green suites are not one green suite.** A whole-tree guard **cannot see a file until that file
is in the tree**, so some guards only acquire a subject once both sides are present. The shell passed
26/26, `tsc`, `eslint` and three review rounds including a browser pass, then produced **four new
failures on merging into the line and three more on merging the line back in.**

**So, before ready:**

```bash
git merge --no-edit codex/task-ward-flow-live-state-20260831
```

```bash
node scripts/run-ward-tests.mjs
```

**It surfaces the union without touching the line, and puts the fixing on this branch under this
lane's review.**

### Run of 2026-09-11 — done, and what it establishes

    files handed in : 365      files that ran : 365      batches : 3
    tests collected : 4374     passed : 4297             failed : 2

✅ **The runner's Windows batching repair is present on this branch** — checked before trusting any
figure, per §AF. **365 handed in, 365 ran, reconciled.** ⚠️ **A branch predating that repair dies on
the command-line limit and writes no report, which the runner correctly refuses to call a pass** — so
any full-suite figure held from before a sync is worthless, not merely stale.

🔴 **The 2 failures are the LINE's, not this lane's.** Measured: this branch's entire diff against the
line is **one `.md` file** (`git diff --stat` — 1 file, plan only). **No source, no styles, no tests**,
so no whole-tree guard can have gained a subject from anything here.

    ✓ ward-reanchor            FIXED at 0943633f68 — verified by ARTEFACT (readAt now in the
                               shift list) and then by RUNNING it: 39 passed
    ✗ ward-referral-matching   still red — traced below, not repaired here

**On the first, traced here:** the unshifted field is **`readAt`** (`ward-model.ts:2026`, optional).
**Nothing reads it** — its only other mention sets it to `undefined` at creation — **so the clinical
impact today is zero and the guard has caught it before a consumer exists**, which is the cheapest
moment it could have. ⚠️ **This is the guard whose earlier blind spot put _"two hours in an ED"_ on a
board as fifteen**; it is now doing exactly what it was rebuilt to do. **Reported to Ward Lead; not
this lane's file.**

⚠️ **§AF's mechanism cannot bite this branch yet, and that is temporary.** It bites the moment Task
set A adds its first component or stylesheet. **Re-run the sync-and-run then — a clean result today
says nothing about that day.**

## 7.2 · 🔴 A FOURTH REPORT LINE — what population did this green walk?

Every task in this plan ends with **"Report: proven by test / proven by looking / not proven."**
**That is three lines and it is one short.**

> **Line 4 — POPULATION: what did the green actually walk, and what is it silent about?**

⚠️ **This lane has already produced two greens that were sound, honestly run, and said nothing about
what they appeared to say:**

- **the provenance suite** — 8 passed, its own anti-vacuity test included, over a population that
  **contains none of these four screens** (§0.1);
- **this branch's own sync-and-run** — 4297 passed, 365/365 files reconciled, **over a branch whose
  entire diff is one `.md` file**, so no whole-tree guard had a subject from it (§7.1).

🔴 **Neither was wrong. Both would have been cited as coverage.** The distinguishing fact is never in
the pass count — **it is the population, and nothing in a green reports it.**

**So state it, per task:** the files the gate walked, the screens the browser pass was read on
(§1.4 — _"the shell's live region is correct" is not a finding about any screen_), and the widths the
looking covered (§8 item 11 — the suite cannot see text size at all).

⚠️ **And point it hardest at this lane's own first real green.** Everything green here so far has been
green over a population that does not yet include a line of this lane's code. **The first green after
Task A1 is the first one that could be wrong, and it is the one to distrust.**

## 8 · Definition of done

Master plan §5.0, **with item 6 amended per the errata** (`docs/ward-flow/plans/2026-09-10-master-plan-errata.md`
§B, on the line at `8a41ff867a`): the string becomes
**_"Invented figures, reconciled with each other, as at &lt;time&gt;"_**; **the property is unchanged** —
it goes red when a figure is made to disagree, and never reads _"Live"_.

**Plus an eleventh item, from owner ruling D-3:**

11. 🔴 **No HTML text on the rebuilt screen is below 12px** — the screen's own existing sub-12px
    declarations are raised **as part of this rebuild**, and the report names how many it raised.

    ⚠️ **THIS IS THE ONE ITEM OF THE ELEVEN THAT THE SUITE CANNOT SEE** (errata §O): `vitest` loads
    no CSS Modules and cannot evaluate a cascade, **so a screen can be fully green on every DOM test
    with 10px text on it.** The other ten _are_ checkable by the suite — which is exactly why
    _"green on all eleven"_ is a sentence to distrust. **It can mean green on ten and unmeasured on
    the eleventh.**

    🔴 **And the second half is sharper: raising text is precisely the change that wraps a heading or
    clips a label** — D-3's own reason for refusing the sweep. **So the act that satisfies the rule is
    the one most likely to break the layout, and NEITHER half is visible to the suite.**
    **The proof is the eyes.** Read the screen's CSS, then look at it at the widths in §1.

    ⚠️ **A COUNT WITHOUT A LOOK IS HALF THE WORK.** Naming how many declarations were raised is a
    compliance count — and (errata §P) **a compliance count over a population where compliance was
    easy says nothing about the hard case.** The count is not the evidence; the look is. **Report
    both, and if the look did not happen, say so rather than letting the number stand in for it.**

⚠️ **And re-run `node scripts/ward-flow/check-errata-freshness.mjs` IN THIS TREE before acting on any
errata entry — including §H1–§H5, which are mine.** A count or a line number read in another chat's
tree is not a fact about yours; that is the mistake this plan records twice against its own author
(§0.1, §2.1).
