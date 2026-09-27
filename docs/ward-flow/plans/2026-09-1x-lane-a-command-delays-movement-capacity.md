# Lane A — Command, Delays, Movement, Capacity: task-level build plan

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` to
> implement this plan task by task — a fresh **Sonnet** implementer per task with the task's brief
> and the Global Constraints below pasted in (never linked), an **Opus** task reviewer on the diff,
> and one **Opus** whole-screen review before any SHA reaches Ward Lead. Steps use `- [ ]` so a
> reader can see what is done.

**Goal:** rebuild the four coordinator-facing screens — Command, Delays, Movement and Capacity — to
the third-edition drawings, inside the shared shell, with every figure derived and every state
carrying a word.

**Architecture:** each screen keeps its existing route and its existing derivation module. The work
is (a) restyle onto third-edition tokens and the drawings' panel order and words, (b) add the
panels, tabs and drawers the drawings show and the app lacks, (c) route every figure through the
Phase 1 facade and every href through the facade's builders. No screen gains local state the reducer
already holds, and no screen dispatches an action that does not already exist.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS modules over the ward
design tokens, Vitest + Testing Library for DOM tests, Playwright for the browser journeys.

**Spec:** `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md` §4.1–§4.4, §3.2, §3.3,
§5.0 — on branch `claude/wardflow-design-review-43df97` @ `e9c6900e3e`, **not on the master line**.
Read it with `git show e9c6900e3e:<path>`; `cat` returns "no such file" and that reads as your
mistake rather than as a branch boundary.

**Owner rulings:** `docs/ward-flow/owner-decisions-2026-09-1x.md` on the master line.

---

## 0 · Before you write a line — the three claims in the spec that are WRONG

I measured every factual claim §4.1–§4.4 makes about these four screens. **Three are wrong, and two
of them are wrong in the same direction: the spec says "build X" where X already exists and is
already tested.** Building them as written would duplicate tested work and, in one case, risk
re-opening a clinical defect that was found and closed on 2026-09-05.

| Spec says                                                                          | Measured                                                                                                                                                                                                                                                                                                                                                                                                     | What it changes                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.2 task 2 / I-8: `legalDeadlineMinutes` is _"a derivation with no reader today"_ | **FALSE.** Read at `delays-screen.tsx`, inside the `DelayRow` component; rendered as an urgent state; proved by a whole dedicated file, `tests/ward-delays-legal-deadline.dom.test.tsx`, whose own header says _"the deadline was never invisible everywhere"_                                                                                                                                               | Task **D2** shrinks from _wire it_ to _check the drawing's wording against the sentence already shipping_. 🔴 The shipping sentence names the legal form (`"{form} passed its deadline 10 min ago"`); the spec's proposed wording (`"Legal deadline passed 1h 10m ago"`) **drops the form's name** and would redden that file. Do not adopt it without Ward Lead. |
| §4.3 task 3 / I-20: the two movement figures have _"nothing reconciling them"_     | **FALSE.** `totalsReconciliation()` (`totalsReconciliation()` in `movements-derivations.ts`) builds exactly that sentence, is rendered at the `styles.reconciliation` paragraph in `movements-screen.tsx`, and is tested at `tests/ward-movements-derivations.test.ts`, the four cases from _"has a difference to explain at all"_ to _"TRACKS a changed population"_ including a one-fewer-arrived mutation | Task **M5** shrinks from _build the reconciliation_ to _move the existing derived sentence into the drawing's footer panel_. 🔴 **Do not write a second derivation.** The screen carries a 20-line comment recording the closed defect this sentence exists to prevent.                                                                                           |
| §4.4 task 1: `tests/ward-capacity-*` is _"fifteen files"_                          | **FOURTEEN** — and fourteen at `20eb850792`, the spec's own verification SHA, so the claim was wrong when written rather than merely aged                                                                                                                                                                                                                                                                    | Nothing structural. It matters only because a builder told to expect fifteen and finding fourteen will go looking for a deleted file that never existed.                                                                                                                                                                                                          |

⚠️ **The spec's own §6 marks I-8 and I-20 "Unproven" and says "re-measure before acting".** The
falsehood is load-bearing only where §4.2 and §4.3 restate them as fact in a _task_. The §6 caveat
did its job; the task lines did not carry it.

Minor, recorded so nobody re-derives it: `coordinator/shortlist-panel.tsx` is **1,585** lines, not
1,584. Every other line count in §4.1–§4.4 matched exactly.

**Superseded by the owner AFTER the spec was written — the spec's text is stale, not wrong:**

- §3.3 and §5.0 item 6 give the reconciliation sentence as _"Synthetic snapshot at &lt;time&gt;,
  figures reconcile"_. 🔴 The owner superseded it: the sentence is **"Invented figures, reconciled
  with each other, as at &lt;time&gt;"**. Use the owner's. 🔴 **The `, as at <time>` tail is part
  of it** — errata §B, amending §5.0(6). A test asserting the short form fails against a correct
  screen.
- §3.3 says whether beds may be ordered by the acuity mark _"is open (§7)"_. **Q-1 has answered it:
  NO.**

---

## Global Constraints

Every task's requirements implicitly include this section. Paste it into every brief — a link does
not bind.

- **Tokens only.** No hex, no `color-mix`, no shadow inside a panel, **no coloured bar on any edge,
  no top highlight**, nothing under 12px in HTML (SVG text ≥ 10.5px), **one primary action per
  panel**.
- **Words before colour.** Every state carries text; colour only reinforces a word already present.
- **Absence and zero.** A missing value is **shown and marked absent, never dropped**; zero reads
  _none_. _"Renders as absent"_ means **shown and marked**, not **disappears**.
- **Invented and real.** Every synthetic number carries the invented-figure marker where it is read.
  Never _"Live"_, never _"reconciled with reality"_. The sentence is **"Invented figures, reconciled
  with each other, as at &lt;time&gt;"** (owner, via errata §B, superseding the spec's _"Synthetic
  snapshot at …"_). 🔴 **The property is what §5.0(6) requires, not the string: the line goes red when
  a figure is made to disagree, and never reads _"Live"_.** A sentence must be true read alone.
- **Derived, never typed.** Every count, tile, line, tag and reconciliation line is computed from
  state on every render. **A literal figure in JSX is a defect.**
- **Vocabulary.** The third bed stage is **discharged**, never _released_. 🔴 **A free bed is
  READY.** A community patient is a team's by the explicit team on the referral, never by home area.
  A team sees the decline reason **for its own referrals only** (`FD-23`). _Legal authority_ reads
  **Yours**; the wait bands are 8 and 24 hours.

  🔴 **CORRECTED 2026-09-11 (R-6). This plan said _"Available, never Unoccupied"_, copied from
  §4.4's done-when. The RULE is right and BOTH ITS WORDS ARE WRONG.** Enumerated in
  `capacity/`:

  <!-- prettier-ignore -->
      "ready" / "Ready"     present — bed-map.tsx, capacity-screen.tsx, capacity-derivations.ts
      "Available"           ZERO occurrences
      "Unoccupied"          ZERO occurrences

  ⚠️ **Chasing that line literally would have introduced _Available_ alongside an established
  _Ready_ — two words for one state, which is exactly the defect the one-word rule exists to
  prevent.** A vocabulary rule naming a word the code does not use does not tidy the vocabulary; **it
  adds to it.** Covers §4.14's identical line.

- **Clinical rulings that bind what these screens may do.** Sex and gender are **two fields**; gender
  is Female or Male plus a distinct **not yet recorded** state that is **never defaulted from sex**;
  **gender decides the bed and there is NO override path on that gate**. The system **never computes
  acuity** — the referring clinician marks it at referral. **No forensic-unit exclusion** — there is
  no ruling, so `!unit.forensic` is not built. A bed-board placement action **prompts "confirm with
  the ward"**.
- **Q-1.** Beds are **NOT ordered by acuity**. Sort by **wait and legal deadline only**; show the
  acuity mark **as a word** beside the person. ⚠️ Q-1 does **not** settle whether the mark may
  _group_, _warn_ or _feed a refusal_ — anything past "show the word, sort by wait and deadline" is
  a stop-and-hand-back. It does not touch the built acuity **capacity** gate, which stays as it is.
- **Q-2.** Catchment is **information, never a filter**. **No bed may be hidden or excluded by home
  area.** This does not license computing, inferring or displaying a catchment relationship the
  model does not already hold, and does not reopen the 2026-08-31 ruling that a community patient
  belongs to a team by the explicit team on the referral.
- **Q-11.** Remove the flow-map ED-node bars. **Keep the brand stripe** — it is a mark, not a state.
- **Q-12.** 🔴 **KEEP EVERY PANEL. DROP NOTHING.** Panels these screens have that the drawings lack
  are folded into the nearest drawn panel or the Activity drawer, and **every one is listed in the
  lane report**. A lane that silently drops a panel has broken this ruling; **so has one that
  silently keeps one without listing it.**
- **Escape never clears the service selector; drawers are modal; the rail's state is remembered.**
  Keyboard reach and visible focus on every control.
- **Eight widths, two themes, forced colours, print:** 1920, 1600, 1440, 1280, 1200, 1100, 390, 320.
  **Sample at least one width in the 641–1000px band** — six of twelve ward specs never look there.
- **The changeable-data rule.** The owner will replace every invented figure with real ones.
  **Nothing may be built that only works for the seed.**
- **Never `git add -A`.** Commit each coherent unit with explicit paths; prettier on touched files
  before every commit. **`npm run format` is not trusted** — it exits 0 having changed nothing on a
  tree with no binaries. Check `ls node_modules/.bin | wc -l` first (147 here, verified).
- **If you reach a decision this brief does not cover, stop and hand it back — do not choose.**

### 🔴 A stated absence can be undone by anything else on the page that speaks

Standing instruction, all lanes, from Lane C's find (errata §U). On Patient search a refusal rendered
**exactly right** — fixed sentence in both places, `role="status"`, zero rows, no match heading, and
**every assertion passed**. In the same breath a **sibling component's live region said "Nobody
matches."** That sentence claims the system **looked** and found nobody. It had not looked. A
screen-reader user heard the one sentence the refusal exists to prevent.

It survived every method this project has: **no screenshot can show an `sr-only` region, no person
looking at the screen can see it, and tests assert only what they were told to.** And it lived in a
**different file** from the refusal — built correctly where refusals are owned, contradicted from a
component that had never heard of them.

**The general form, which reaches well past refusals:** 🔴 **any state whose whole point is _"this
was not measured"_ can be undone by any other mounted component that speaks as though it was.**

### 🔴 THE FIRST QUESTION FOR EVERY CATCHER: can the test enter the branch at all?

**Before "does it assert the right thing", ask "does the fixture ever reach the code I care about".**
Measured twice in two days, in this lane:

<!-- prettier-ignore -->
    the dangling-id branch     0 of 50 seeded movements carry an unresolvable id
    gender differs from sex    0 of  8 seeded patients

**Both unreachable from the seed. Both would have produced a green test proving nothing.**

⚠️ **This is cheaper than a mutation proof and it catches a class mutation proofs cannot.** A
mutation tells you the test _can_ fail; **it does not tell you the fixture ever reached the code you
care about.** A test that never enters a branch can still be reddened by mutating something else it
does touch — and then it looks doubly proved.

**So every catcher in this plan carries an anti-vacuity line**: assert the fixture reaches the state
first, then assert the behaviour. Where the seed cannot produce the state, **build it by hand and say
so in the report.**

**Two rules for this lane:**

1. **On every browser pass, read the live regions** — not the screenshot, not the visible text. It is
   a step in Z1, not a thing to remember.
2. **Where a screen carries a refusal or a stated absence, the assertion is NEGATIVE and scoped to
   the WHOLE announcement.** _"The refusal appears"_ and _"no rows render"_ are both **positive** and
   both scoped to the refusing component's own file, so **they pass with a contradiction sitting
   beside them.** The one that catches it is: **while a refusal or absence stands, nothing anywhere
   may make a claim about matches, counts or results** — spoken, visible, or in a near-miss note.

#### ⚠️ Why this lands on Lane A harder than it looks

**Measured 2026-09-11: there is no `aria-live`, `role="status"` or `role="alert"` anywhere in
`coordinator/`, `delays/`, `movements/` or `capacity/`.** So the _announced_ form of this defect
cannot occur on these four screens today.

🔴 **That is not reassurance — it is the warning.** §5.0 item 7 requires the live region to announce
each change, and **C2's tabs, M2's tabs and M6's drawer are where the first live regions on these
screens get created.** This lane is not inheriting the surface Lane C's defect lives on; **it is
about to build it.** Every live region this lane adds must be written against rule 2 from the first
line, not audited for it afterwards.

_Candidate of the same family, flagged and NOT asserted as a defect:_ five sites in `delays/` and
`movements/` render `No department matches "<id>"` / `No unit matches "<id>"`. That sentence reads as
a search that was performed and returned nothing; what it actually reports is **an id that does not
resolve** — a dangling reference, not an absence of departments. **Whether that wording is wrong is a
product judgement nobody has made, so it is recorded here and handed back, not changed.**

### 🔴 Two figures this lane must NOT build, handed back by the facade

- **The rail's blocked-discharges count is deliberately NOT in the facade, and must not be wired.**
  The discharge board's blocked group and `blockedToday` are **different populations on purpose**. A
  facade figure asserting they agree would **redden on correct work**. Owner decision, queued. If a
  drawing appears to show them agreeing, that is a stop-and-hand-back, not a derivation to write.
- **"Open delays" is not a figure and does not exist.** It equals the open-movement count by
  construction, and the derivation layer refuses it. **The facade exposes what the rail actually
  shows, named `delaysNeedingAttention`. Use that name; do not derive a second one.** Binds D1 and
  D3.

### 🔴 "No department matches" — RULED a defect, Lane A's to fix, and its test CANNOT come from the seed

Ward Lead ruled 2026-09-11. Five sites, every one reading a **stored field on the movement record**,
none reading anything a user typed:

<!-- prettier-ignore -->
    delays-screen.tsx     x2   movement.originEdId
    movements-screen.tsx  x2   movement.originEdId
    movements-screen.tsx  x1   movement.acceptedUnitId

**"No department matches 'ED-017'" tells a coordinator there is no such department. The truth is
_this movement names a department we cannot find_. The first blames the network; the second blames
the record.** They call for different actions and only one is true. **This is §U's class with the
contradiction removed** — no second sentence disagreeing, just one sentence quietly answering a
question nobody asked.

**Fix it inside D1 and M1, when those tasks reach those files — not as a separate errand.**

- **Name the record as the problem, not the network. Keep the id visible**, so a coordinator seeing a
  dangling reference can say which one.

🔴 **AND THE TEST CANNOT USE THE SEED. Measured 2026-09-11, all 50 seeded movements:**

<!-- prettier-ignore -->
    unresolvable originEdId       0
    unresolvable acceptedUnitId   0

**This branch is unreachable from the seed.** A test that renders seeded movements **never enters it
and passes whatever the sentence says.** ⚠️ **Build the broken state from a hand-made fixture with a
deliberately dangling id, and assert the fixture actually reaches the branch before asserting
anything about the wording** — otherwise the case is vacuous in exactly the way that looks green.

### ⚠️ `activeMode` after the fold — two of the three files are in this lane's directories

Ward Lead's mounting task removes the per-screen rail from 27 files; **three pass `activeMode` as a
prop, and the layout mount must derive it from the route instead.** Measured here:

<!-- prettier-ignore -->
    coordinator/coordinator-screen.tsx   activeMode="command"     LANE A - Command
    tracker/live-tracker.tsx             activeMode="transport"   LANE A's directory
    ward-management-modes.tsx            activeMode={mode}        shared, not this lane's

🔴 **`tracker/live-tracker.tsx` is UNREACHABLE BY DESIGN** — `/transport` redirects to `/movements`,
its tests were retired by owner ruling 2026-09-06, and it is **protected work that is never
deleted**. **So "derive the active mode from the route" has no route to derive from for that one
file.** Whatever is done there, it is not the same operation as the other 26 — flagged to Ward Lead,
whose task it is, not this lane's.

**On the first browser pass after the fold: check Command's active-mode highlight**, because it is
the one that used to be told and will now have to work it out.

⚠️ **Both are refusals, and a refusal is the easiest thing in a brief to mistake for an omission.**
An implementer who needs a blocked-discharges figure and cannot find one in the facade will write it
locally in good faith. **The facade's silence here is a decision, not a gap.**

### ⚠️ There is no "pre-existing tsc failure" any more — do not carry the exemption

Every lane was waving through `TS2307 Cannot find module '.../cover/route.js'` in
`.next/dev/types/validator.ts` as a known red that belonged to nobody.

**Measured in this worktree, bare and unpiped, 2026-09-11: `npx tsc --noEmit` → exit 0, zero lines
of output.** This plan never carried the exemption, and no brief from this lane may introduce one.

🔴 **A standing known-red is exactly where a real new error hides.** If an implementer reports _"tsc
has the usual pre-existing failure"_, **that exemption is stale, and an error it introduced would
arrive wearing it.** Treat any non-empty `tsc` output as this lane's until proved otherwise.

_On the cause:_ Lane C infers that `next dev` regenerated `.next/dev/types/`, whose stale copy named
a route no longer in source, and states plainly that it did not restore the stale file and re-break
it — so the mechanism is **inferred, not controlled**. A second, independent arm from here: in this
worktree **`.next/dev/types/validator.ts` does not exist at all** (`next dev` has never run in it)
and `tsc` is clean. So _absent_ and _regenerated_ both pass, which is consistent with only _stale_
failing — **still not the controlled re-break, and it should not be quoted as one.**

### ⚠️ A wrapper's exit code is not the runner's

You already know not to pipe a test run, because `| tail` returns tail's code. **This one arrives
with no pipe at all:** a background-task notification reported **exit 0 for a run with three real
failures**, because the notification carried the _wrapper's_ code.

**Read the runner's own output. A green summary line from anything that is not vitest's final line
is not evidence.** _(Found by Ward Lead's facade builder.)_

### 🔴 Absence in the flow timestamps — the trap that passes every test that counts rows

Raised by Ward Builder Four, verified by Ward Lead, **re-verified here, and it is one field worse
than reported.**

    ward-admissions.ts   pulledAt    Instant | null
    ward-admissions.ts   arrivedAt   Instant | null
    ward-admissions.ts   leftAt      Instant | null
    ward-model.ts        arrivedAt   Instant | undefined   <- TransportJob's, and OPTIONAL not nullable

⚠️ **Two different fields are called `arrivedAt`, and they are absent in two different ways.**
`Admission.arrivedAt` is `| null`; `TransportJob.arrivedAt` is optional, so it is `undefined`. A
guard written `=== null` silently passes every `undefined`, and a guard written `=== undefined`
silently passes every `null`. Neither goes red. **Name the type before you write the check.**

**Why this matters more than a null check.** A derivation that filters the absent rows out draws a
clean line over **a quietly different population from the one its own axis claims**, and it passes
every test that counts rows, because the rows it dropped are not there to be counted.

🔴 **The code already carries this warning for beds, in `ward-admissions.ts`:** _"`pulled` counts,
and this must NEVER be 'corrected' to require `arrivedAt`. The ward gives the bed away at the pull;
the person may still be in an emergency department awaiting transport, so `arrivedAt` is null and
the bed reads as empty to anyone who checks arrival. **It is not empty.**"_ Offering it again is a
double-allocation, and the ward finds out when two people arrive for one bed.

**So, for tasks M2 and M4:** carry absence, never drop it — _shown and marked absent_, per the
absence rule above. **Every derivation over these fields is pinned by a case whose input contains an
absent timestamp**, and that case asserts the absent row is still represented, not merely that the
totals add up.

### 🔴 A referral never names a ward

Zero `unitId` anywhere in the `Referral` type - **verified here by reading `ward-model.ts`, not
relayed.** A ward's identity attaches only at `Movement.acceptedUnitId`, which `ACCEPT_IN_PRINCIPLE`
sets, i.e. **on acceptance**. A referral is addressed to the ward _system_, not to a named ward.

**Binds Command's shortlist (C1, C2):** build nothing that implies a referral has a target ward -
no "referred to", no ward column on a referral row, no back-link from a referral to a unit. The
shortlist proposes candidates; it does not reveal a choice the referral already made, because there
is none. _(Ward Builder Four, confirmed by Ward Lead, re-verified here.)_

🔴 **The drawing says this itself, in the shortlist panel, when a referral is selected:**

> _"This is a request for a bed, not yet a movement: no ward is pointed at it, and it carries no
> stage and no legal clock of its own."_

**So the constraint is not an inference from the type — the drawing states it.** Do not build a ward
column, a "referred to", or a stage or legal clock on a referral row.

### ⚠️ The drawings use a curly apostrophe, and a straight one will not match

`Today’s traffic` in `movement-third-edition.html` carries **U+2019**, not an ASCII `'` and not
`&rsquo;`. A test asserting `"Today's traffic"` fails against a screen that is correct. **Copy
heading strings out of the drawing; never retype them.**

### Panel and tab names come from the DRAWING, not from the master plan's prose

The master plan's §4 prose paraphrases its own drawings, and **seven names differ**. Measured
2026-09-10 against the folded drawings on the line:

    plan's prose                                  the drawing
    Exceptions, declines, overrides, refused  ->  Exceptions and escalation
    Where each stands                         ->  Where each open movement stands
    Transport legs and what has none          ->  Transport legs, and what has none
    No owner                                  ->  Movements with no owner
    Open movements, why each is still open    ->  Why each open movement is still open
    The day, and what is severe in it         ->  The day
    Selected person                           ->  Nobody selected / Why this person is waiting

**And the Delays drawing has a panel the app has no equivalent for at all: `What the blocker is`.**
That is a build, not a rename - one blocker per person; awaiting a bed is not an ED blocker; medical
clearance is not in the list.

Ward Lead's ruling: **if a drawing disagrees with its §4 section, the drawing wins.** If a drawing
disagrees with the standard's never-list, the standard wins and it is a **Ward Mockups** defect, not
this lane's to fix.

### Find things by name, never by line number

**A line number is not a weak anchor that drifts within a tolerance — it is a different number in
every tree.** One assertion the master plan places at 1687 was measured at 1649 on one branch and
1698 on the line. **Three true answers, none of them wrong.** This plan therefore cites functions,
components, test names and headings; where an earlier draft carried `file.ts:123` it has been
replaced. If you add a citation, add a name.

### Test-running traps that produced a false green on this programme today

- `npx vitest run … | tail` returns **tail's** exit code. A 56-failure run reported exit 0. **Never
  pipe a test run.**
- `--reporter=basic` **does not exist here**: it runs zero tests, exits 0, and prints an empty
  failure list that reads like "all passing".
- **vitest does not typecheck.** Run `npx tsc --noEmit` separately, always.
- `grep … | head -20` silently truncates. **Count first.**
- Line numbers in the spec have already drifted 1–4 lines. **Find things by name, never by line.**

---

## 1 · File structure

Files this lane creates or modifies. **Nothing outside these paths.**

| File                                                                                                                                  | Responsibility                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `coordinator/coordinator-screen.tsx` (326)                                                                                            | Command's composition — panels in the drawing's order                   |
| `coordinator/priority-queue.tsx` (137)                                                                                                | gains the Patients / Referrals tabs                                     |
| `coordinator/flow-diagram.tsx` (676)                                                                                                  | ED-node bars removed (Q-11)                                             |
| `coordinator/pressure-strip.tsx` (105), `exception-drawer.tsx` (383), `shortlist-panel.tsx` (1,585), `coordinator.module.css` (2,829) | restyle only                                                            |
| `delays/delays-screen.tsx` (1,178)                                                                                                    | panel names and order; footer disclosure panel                          |
| `delays/delays-derivations.ts`                                                                                                        | read only — `legalDeadlineMinutes` already exists and is already read   |
| `movements/movements-screen.tsx` (377)                                                                                                | five tabs, traffic diagram, footer panel, detail drawer, primary action |
| `movements/movements-derivations.ts`                                                                                                  | gains `corridorCounts()`; `totalsReconciliation()` is **not** touched   |
| `capacity/capacity-screen.tsx` (1,052)                                                                                                | panel names, order, footer disclosure panel                             |
| `tests/ward-command-third-edition.dom.test.tsx`                                                                                       | **new** — Command's heading order, tabs, tally, node words              |
| `tests/ward-movement-third-edition.dom.test.tsx`                                                                                      | **new** — Movement's tabs, corridors, drawer, footer                    |
| `tests/ward-movements-corridors.test.ts`                                                                                              | **new** — `corridorCounts` unit test, proved by mutation                |
| `tests/ward-delays-third-edition.dom.test.tsx`                                                                                        | **new** — Delays' heading order and footer panel                        |
| `tests/ward-capacity-third-edition.dom.test.tsx`                                                                                      | **new** — Capacity's heading order and footer panel                     |

All `src/` paths above are under `src/components/ward-management/`.

**Shared files this lane may NEVER edit:** `layout.tsx`, `ward-nav.ts`, `shell/**`, `ward-facade.ts`,
the seeds, `ward-model.ts`, `ward-flow-reducer.ts`, any `*.module.css` outside the five directories
above, and `docs/ward-flow/mockups/**`. A change needed there is a four-line message to Ward Lead,
who makes it on the line and announces the SHA. **A mockup defect goes to Ward Mockups, never fixed
here.**

### What Phase 1 must land before some tasks can start

Verified absent from the master line at `8c5aebc938`:

    src/components/ward-management/ward-facade.ts        DOES NOT EXIST
    WARD_PRIMARY_ACTIONS in ward-nav.ts                  DOES NOT EXIST
    raiseReferralHref()                                  DOES NOT EXIST
    tests/ward-facade-agrees-with-screens.test.ts        DOES NOT EXIST

Tasks C3, M7 and P2 consume these and **cannot start** until they land. Every other task can.

---

## 2 · Task order and dependencies

    A0  rail removal            CANCELLED - Ward Lead's, never Lane A's. See §4.1
    C1  Command restyle         independent
    C2  Command referrals tab   after C1
    C3  Command tally           after C1, needs the facade
    C4  Flow diagram bars       independent
    D1  Delays panels           independent
    D2  Delays deadline words   after D1
    D3  Delays footer           after D1
    D4  What the blocker is     after D1 - A BUILD, not a rename; on nobody's list until 2026-09-10
    M1  Movement restyle        independent
    M2  Movement tabs           after M1
    M3  corridorCounts          independent (pure derivation)
    M4  Today's traffic         after M3 and M1
    M5  Movement footer         after M1
    M6  Detail drawer           after M1
    M7  Record a decision       after M6, needs WARD_PRIMARY_ACTIONS
    P1  Capacity panels         independent
    P2  Capacity footer         after P1, needs the facade
    Z1  Q-12 list and reviews   last

---

## 3 · The tasks

Every task carries the six lines of spec §3.2. **Report is three lines, every time: proven by test,
proven by looking, not proven.**

---

### Task C1: Command — restyle the five panels onto third-edition tokens

**Files:**

- Modify: `coordinator/coordinator-screen.tsx`, `pressure-strip.tsx`, `priority-queue.tsx`,
  `flow-diagram.tsx`, `exception-drawer.tsx`, `shortlist-panel.tsx`, `coordinator.module.css`
- Test: `tests/ward-command-third-edition.dom.test.tsx` (create)

**Interfaces:**

- Consumes: `useWardFlow()`, the existing coordinator derivations. Nothing new.
- Produces: nothing other tasks import. C2 and C3 modify the same files after this lands.

**Catcher:** the new DOM test asserts the five panel headings **in the drawing's order**; the
existing `tests/ward-coordinator*` (2 files) stay green; and the two colour gates below — **which are
not the one this plan originally named.**

🔴 **CORRECTED 2026-09-11, applying errata §Y to my own plan.** I wrote that
`tests/ward-css-token-references-resolve.test.ts` is _"the token gate, and a hex or an undeclared
`var()` reddens it"_. **I had read the file's NAME and asserted its EFFECT.** Read at the source:

<!-- prettier-ignore -->
    ward-css-token-references-resolve   "every var() in Ward Flow's stylesheets names a token that
                                        exists" -> catches an UNDECLARED var(). Does NOT look at hex.
    eslint no-hardcoded-hex             its own description: "hardcoded hex color utilities in
                                        Tailwind classNames" -> JS/TSX classNames, NOT .css files.
    check-design-system-contract.mjs    SOURCE_EXTENSIONS includes .css; RAW_COLOR =
                                        /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/gi
                                        -> this IS the CSS-facing colour gate.

⚠️ **But it is a DEBT-REGRESSION gate, not a ban.** It calls
`recordDebt("rawColorLiterals", path, count)` and fails via `findDebtPathRegressions` — so the rule
it enforces is **"no MORE raw colour in this path"**, not "none". Existing literals are tolerated by
baseline.

**So for C1: a hex added to `coordinator.module.css` is caught by
`node scripts/check-design-system-contract.mjs`, and by neither of the two gates whose names sound
like they would.** Run that script in this task; do not rely on the token test for colour.

⚠️ **Not proven: I have not RUN `check-design-system-contract.mjs`.** I read its source. Its scope
includes `.css` and its regex matches hex, but **whether `coordinator.module.css` is inside the
directory it walks, and whether a fresh literal actually reddens it, is unverified** — the honest
first step of C1 is to add one hex, run the script, and watch it fail before removing it.

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The drawing's panel order is the spec. This asserts ORDER, not merely presence: a screen with
 * all five panels in the wrong order satisfies a presence test and still does not match the
 * drawing.
 */
/**
 * 🔴 RE-DERIVED FROM `command-third-edition.html` ON THE LINE, 2026-09-10, and it disagrees with
 * §4.1's prose in three ways. The drawing wins (Ward Lead's ruling).
 *
 *   1. "Exceptions and escalation" is NOT a panel heading. It is a `role="tabpanel"` inside the
 *      exceptions drawer, `aria-labelledby="tab-exceptions"`. Asserting it as a top-level panel
 *      heading fails against a correct screen.
 *   2. The drawer has SIX tabs, not §4.1's four: Exceptions and escalation / Declines / Override
 *      register / Refused actions / Change urgency or legal status / Release or cancel.
 *   3. 🔴 "Referral placement" is NOT a sixth panel. It is the SAME panel as the shortlist
 *      (`slPanel`), retitled by what is selected: a patient gives "Explainable shortlist", a
 *      referral gives "Referral placement". A fixed heading list is wrong for one of the two
 *      states — assert per selection, never once.
 */
const DRAWN_PANELS = [
  "Emergency department pressure",
  "Priority queue",
  "Statewide flow",
  // then the exceptions tab region, then the shortlist panel under whichever title applies
];

const SHORTLIST_TITLE = { patientSelected: "Explainable shortlist", referralSelected: "Referral placement" };

const EXCEPTION_TABS = [
  "Exceptions and escalation",
  "Declines",
  "Override register",
  "Refused actions",
  "Change urgency or legal status",
  "Release or cancel",
];

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

describe("Command renders the third edition's five panels in the drawing's order", () => {
  it("shows every drawn panel heading", () => {
    renderScreen();
    for (const heading of DRAWN_PANELS) {
      expect(screen.getByRole("heading", { name: heading }), `${heading} is missing`).toBeTruthy();
    }
  });

  it("shows them in the drawing's order, not merely all present", () => {
    renderScreen();
    const rendered = screen
      .getAllByRole("heading")
      .map((node) => node.textContent?.trim() ?? "")
      .filter((text) => DRAWN_PANELS.includes(text));
    expect(rendered).toEqual(DRAWN_PANELS);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-command-third-edition.dom.test.tsx
```

Expected: FAIL — the headings do not yet carry the drawing's words. **Read the failure message: it
must fail on the heading text, not on a render crash.** A crash means the import path is wrong and
the test proves nothing.

- [ ] **Step 3: Restyle, and rename the headings to the drawing's words**

Work panel by panel. Change **words and tokens only** — no structural change, no panel added or
removed, no derivation touched. Every colour comes from a token already declared in
`coordinator.module.css`; if the third edition needs a token that does not exist, that is a
stop-and-hand-back to Ward Lead, not a hex.

- [ ] **Step 4: Run the new test and the existing coordinator tests**

```bash
npx vitest run tests/ward-command-third-edition.dom.test.tsx tests/ward-css-token-references-resolve.test.ts
```

Expected: PASS. **Do not pipe this command.**

- [ ] **Step 5: Typecheck separately — vitest does not do it**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Prettier the touched files, then commit with explicit paths**

```bash
npx prettier --write src/components/ward-management/coordinator tests/ward-command-third-edition.dom.test.tsx
```

**Not built:** ordering by acuity (Q-1 — NO); catchment as a filter (Q-2 — NO); any forensic
exclusion; the New referral menu (the shell's, Phase 1).

**Report:** proven by test / proven by looking / not proven.

---

### Task C2: Command — the Referrals tab on the priority queue

**Files:**

- Modify: `coordinator/priority-queue.tsx`, `coordinator/coordinator.module.css`
- Test: `tests/ward-command-third-edition.dom.test.tsx` (extend)

**Interfaces:**

- Consumes: `referrals` from `useWardFlow()`; the existing urgency and age derivations.
- Produces: nothing. The tab is internal to `PriorityQueue`.

**Catcher:** the DOM test renders a seed with at least two front-door referrals and asserts **each
tab's count equals the derivation over the same seed** — never a typed number.

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * ⚠️ Every expected figure is DERIVED HERE by calling the same function the screen calls, with the
 * same arguments. A typed expectation would pin the seed rather than the behaviour, and the
 * changeable-data rule says the seed is going to be replaced wholesale.
 */
it("counts each tab from the state, not from a typed figure", () => {
  renderScreen();
  const queue = screen.getByRole("region", { name: "Priority queue" });
  const patientsTab = within(queue).getByRole("tab", { name: /^Patients/ });
  const referralsTab = within(queue).getByRole("tab", { name: /^Referrals/ });

  expect(patientsTab.textContent).toContain(String(expectedPatientRows.length));
  expect(referralsTab.textContent).toContain(String(expectedReferralRows.length));
});

it("sorts the referrals tab by urgency then age — never by the acuity mark (Q-1)", () => {
  renderScreen();
  fireEvent.click(screen.getByRole("tab", { name: /^Referrals/ }));
  const rows = screen.getAllByRole("listitem");
  const renderedIds = rows.map((row) => row.getAttribute("data-referral-id"));
  expect(renderedIds).toEqual(expectedReferralRows.map((referral) => referral.id));
});

it("shows the acuity mark as a word beside the person, and never as a sort key (Q-1)", () => {
  renderScreen();
  fireEvent.click(screen.getByRole("tab", { name: /^Referrals/ }));
  const marked = expectedReferralRows.filter((referral) => referral.highAcuityNursingNeeded);
  expect(marked.length, "no seeded referral carries the acuity mark — this test is vacuous").toBeGreaterThan(0);
  for (const referral of marked) {
    const row = screen.getByTestId(`referral-row-${referral.id}`);
    expect(within(row).getByText(/high acuity/i), `${referral.id} does not say its acuity`).toBeTruthy();
  }
});
```

`expectedReferralRows` is built at module scope from the referrals in state by the **same**
urgency-then-age comparator the component uses, imported from the component's module — not
re-implemented in the test.

- [ ] **Step 2: Run it red.** Expect FAIL on "no tab named Referrals".

- [ ] **Step 3: Add the tablist.** Two tabs, `role="tablist"` with an accessible name, arrow-key
      navigation, visible focus. The Referrals tab lists front-door referrals awaiting an answer,
      each row linking through the facade's href builder to the referral's outcome or the addressed
      ward. 🔴 **Sort by urgency then age. The acuity mark is rendered as a word and is never a sort
      key.**

- [ ] **Step 4: Run green.** Then `npx tsc --noEmit`.

- [ ] **Step 5: Prove the test is a catcher.** Mutate the comparator to sort by the acuity mark; the
      third test must go red. **Commit before mutating** — `git checkout --` discards an uncommitted
      fix in the same file and does nothing at all to an untracked one.

- [ ] **Step 6: Prettier, then commit with explicit paths.**

**Not built:** grouping, warning or refusing on the acuity mark — Q-1 settles only _shown as a word,
sorted by wait and deadline_. Anything further is a stop-and-hand-back.

**Report:** three lines.

---

### Task C3: Command — the four tally figures, derived directly, and pinned against ED home

🔴 **HELD 2026-09-11 on owner question A-7, and on the drawer that renders it. DO NOT START.**
Destination and derivation are both settled; **one of the four figures does not exist and its
definition is a clinical threshold nobody has stated.**

**Where they go — settled, and neither the plan's prose nor the first ruling had it right:**

<!-- prettier-ignore -->
    NOT the masthead        `PAGES.command.core` LOOKS like a masthead structure. It is not.
    NOT the pressure strip  that section is a per-department LIST, already rendered by
                            edPressure(now, movements). The first ruling sent them here and was
                            withdrawn.
    THE ACTIVITY DRAWER     core(f) is invoked into <div class="popBody part" data-part="tally">
                            under a heading "<Page> now". The drawing says so about itself, twice,
                            hundreds and thousands of lines from the structure it describes.

⚠️ **No collision with the facade after all.** `shellFigures()` is **five FIXED** figures — rail and
header counts, standing facts seen everywhere, already built and correct. `core(f)` is **four
PER-PAGE** figures in a drawer opened deliberately, about this page. **Different elements, different
purposes; `shellFigures()` does not change and this reaches no other lane.**

**Derivation — stands:**

<!-- prettier-ignore -->
    Waiting in ED        edHomeTotals().waiting             EXISTS
    Breached             edPressure().breaching, SUMMED     EXISTS per-ED, needs the sum
    Longest wait         edHomeTotals().longestWait?        EXISTS, OPTIONAL
    Due within 2 hours   🔴 NOTHING. No two-hour horizon in either module.        -> A-7

🔴 **Two hours before the legal deadline, before the access target, or something else are three
different numbers on the same day.** Do not pick one. **C3 can be built three-quarters and must
not be** — a tile reading a fabricated threshold would be an invented clinical figure on the
coordinator's first screen, **beside three real ones and indistinguishable from them.**

**Second blocker, measured 2026-09-11:** `src/components/ward-management/shell/` contains
`ward-facade.ts` **and nothing else. The Activity drawer does not exist yet**, so C3 has no
destination to render into even once A-7 is answered.

**Two details from the drawing that bind whoever builds it:**

- **`longestVal` renders `none` when there is none; otherwise the wait AND ITS SITE.** 🔴 The figure
  **carries its place** — the same shape as `ShellFigure` carrying its noun. **Never a bare
  duration.**
- **Tone is data-driven** (`danger` when breached > 0, `warn` when due-soon > 0), not fixed. ⚠️ Which
  puts it squarely under **words before colour**: a tone that is the only carrier of a state is a
  defect. **`danger` must not be the only thing saying "breached".**

**The cross-screen test survives, retargeted:** it still pins Command's four against ED home's for
the same instant — **the four are Command's payload wherever they render.**

🔴 **RULED 2026-09-11, and the task changed shape. NOT blocked, and NOT through the facade.**

The facade landed at `shell/ward-facade.ts` (**not the root — this plan had the path wrong too**) and
**contains none of the four functions §4.1 named.** Measured: `waitingInEd`, `breached`,
`dueWithin2h`, `longestWait` — **0 occurrences each.** What it exposes is `shellFigures(input)`
returning five _chrome_ figures (`bedsAvailable`, `openMovements`, `delaysNeedingAttention`,
`referralsWaiting`, `tasks`).

**Ward Lead's ruling and its reasoning, kept because a later chat will ask why the facade was not
used:** the facade owns what the **shell** asks for and what four lanes would each otherwise build —
chrome figures and href builders. **A screen panel's own tally is neither.** Wrapping an existing
derivation would add **a third name for arithmetic that already has one**, and narrowness is the
facade's whole virtue.

**Files:**

- Modify: `coordinator/pressure-strip.tsx`
- Test: `tests/ward-command-third-edition.dom.test.tsx` (extend)

**Interfaces:**

- Consumes: `edHomeTotals` / `worstEdSummary` **directly**. Measured: their only production caller
  today is `ed/ed-home.tsx`. **Command becomes the second.**
- Produces: nothing.

#### 🔴 THE CONDITION — not optional, and it is the whole point of the ruling

**Two screens will now show ED pressure figures. That is exactly the shape that produced _"50 moves"_
beside _"43 open moves"_ with nothing reconciling them.**

**A test pins that Command's four figures AGREE WITH ED HOME'S for the same instant.**

⚠️ **It must render BOTH screens.** A derivation-level comparison cannot catch this: the failure being
guarded against is **a screen ceasing to call the shared derivation**, and only rendering can see
that. Neither screen re-implements the arithmetic; both call the shared derivation; **the test
catches it if either ever stops.**

🔴 **`ward-facade-agrees-with-screens` is NOT this task's catcher. The cross-screen test is.**

⚠️ **Bounded rework, accepted knowingly:** this test renders `CoordinatorScreen` and `EdHome`
directly, and both still mount their own `ClinicalRail` today. When the shell lands, the render
helpers change. **That is a few lines in one file — proportionate for one task, which is why the
other thirteen still wait.**

**Catcher:** `tests/ward-facade-agrees-with-screens.test.ts` (Ward Lead builds it in Phase 1) plus a
DOM assertion that each of the four figures equals its facade call over the same state.

**Steps:**

- [ ] **Step 1:** Write the four failing assertions, each comparing the rendered figure to the
      facade call — never to a typed number.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Replace the strip's local derivations with the four facade calls. Delete nothing
      else.
- [ ] **Step 4:** Run green; `npx tsc --noEmit`.
- [ ] **Step 5:** Force one tally to disagree and assert the reconciliation line reddens.
- [ ] **Step 6:** Prettier, commit with explicit paths.

**Not built:** any new facade function. If one of the four is missing from the facade, that is a
four-line message to Ward Lead, not a local derivation.

**Report:** three lines.

---

### Task C4: Command — remove the flow diagram's ED-node side bars (Q-11)

**Files:**

- Modify: `coordinator/flow-diagram.tsx`, `coordinator/coordinator.module.css`
- Test: `tests/ward-command-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes nothing new; produces nothing.

**Catcher:** the DOM test asserts **every node carries a word for its state** (words before colour),
and that no node renders an edge bar element.

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
it("every flow node states its condition in words, not only in colour", () => {
  renderScreen();
  const diagram = screen.getByRole("img", { name: /statewide flow/i });
  const nodes = within(diagram).getAllByTestId(/^flow-node-/);
  expect(nodes.length, "the flow diagram rendered no nodes — this test would pass vacuously").toBeGreaterThan(0);
  for (const node of nodes) {
    expect(node.textContent?.trim(), `${node.getAttribute("data-testid")} carries no word`).not.toBe("");
  }
});

it("carries no ED-node edge bar (Q-11), and keeps the brand stripe (a mark, not a state)", () => {
  renderScreen();
  expect(screen.queryAllByTestId(/^flow-node-bar-/)).toHaveLength(0);
  expect(screen.getByTestId("ward-brand-stripe")).toBeTruthy();
});
```

⚠️ The first assertion carries its own anti-vacuity floor. A selector that matches nothing passes a
for-loop silently — that is the shape that has produced a false green here before.

- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Remove the ED-node bars and their CSS. 🔴 **Keep the brand stripe.** If a node
      loses its only indication of state when its bar goes, give it a word — never a replacement
      colour.
- [ ] **Step 4:** Run green; `npx tsc --noEmit`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** the rail's brass bar (Phase 1.1, Ward Lead's).

**Report:** three lines.

---

### Task D1: Delays — the drawing's panel words and order

**Files:**

- Modify: `delays/delays-screen.tsx`, `delays/delays.module.css`
- Test: `tests/ward-delays-third-edition.dom.test.tsx` (create)

**Interfaces:** consumes `delayGroups`, `waitingSplit`, `unclearedCount` (all verified present);
produces nothing.

**Catcher:** the new heading-order assertion, plus **every existing `tests/ward-delays-*` wording pin
stays green (6 files)**. 🔴 **Re-derive a pin, never delete one.** A pin that no longer matches is
either a wording change you must justify or a defect you have introduced; deleting it answers
neither.

The rename, measured — the app's words on the left, the drawing's on the right:

    Who is waiting              ->  Who is holding people up  THEN  Waiting
    (no app panel)              ->  What the blocker is          <- DRAWN, and the app has no panel for it
    Registers                   ->  Escalations  THEN  Resolved today
    The person you have chosen  ->  Nobody selected / Why this person is waiting
    Worth your attention        ->  Q-12: fold into the Activity drawer
    Delays with no named person ->  Q-12: fold into Waiting, as a group under that sentence

- [ ] **Step 1:** Write the heading-order test over the drawing's order.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Rename and reorder. **Fold, never drop** — Q-12. Record both folded panels for Z1.
- [ ] **Step 4:** Run the new test **and all six existing delays tests**; `npx tsc --noEmit`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

#### 🔴 D1 also clears `delays.module.css`'s design-system debt — it is red on a clean tree today

Errata §AA. **Verified here by running the gate myself, clean tree, nothing of mine present** —
`node scripts/check-design-system-contract.mjs` → **exit 1**, and every figure matched:

<!-- prettier-ignore -->
    hardcodedCssMotionDurations   delays/delays.module.css   0 -> 8
    rawPaddingLiterals                                       0 -> 2
    rawRadiusLiterals                                        0 -> 1
    rawMarginLiterals                                        0 -> 1
    rawLineHeightLiterals                                    0 -> 3
    layoutTransitionExceptions                               0 -> 4

Last touched by `fe117b11a3`, the Delays board build — **red since that landed, not from any recent
fold.** Tokenising during this rebuild is free; tokenising it as a separate errand is work thrown
away when the screen is rebuilt. **Requirement: the gate's named paths for this file come back to
zero afterwards.**

🔴 **NOBODY REFRESHES THE BASELINE TO MAKE IT GREEN.** That converts _"you added debt"_ into _"this
debt is accepted"_, permanently.

⚠️ **This gate cannot be read by exit code alone.** A red does not mean you broke something. **Diff
your run against a clean-tree run and compare the NAMED PATHS.** The clean-tree baseline, captured
2026-09-11, is exactly two files — `delays/delays.module.css` (this task's) and
`ward-global-search.module.css` (shared, not this lane's). **Anything else appearing is yours.**

##### ⚠️ A raw literal inside an idiom is not debt — and the gate cannot tell

`ward-global-search.module.css` carries `margin: -1px` inside the canonical **visually-hidden**
block. That is a required magic number in a screen-reader idiom and **tokenising it would be a defect
rather than a fix.** So: **check each hit before tokenising it, and report any you decline, with the
reason.**

🔴 **But do not read "it is flagged, therefore it is an idiom" either.** That same file has a
**second** flag — `rawRadiusLiterals`, `border-radius: 3px` on `.guidance kbd` — which is **not** part
of any idiom: every other radius in the file uses `var(--ward-radius-pixel)`. **Two flags in one
file, one idiom and one ordinary outlier.** Judge each hit, never the file.

##### 🔴 The trap that will bite when you write the justification

`ward-global-search.module.css` already warns about it in its own comment: **"the guard reads raw
file text, comments included."** So **a comment explaining why you declined to tokenise
`margin: -1px` would itself be counted as a raw margin literal**, and the better you write the
justification the more debt it records. **Describe the declaration; do not reproduce it.**

⚠️ **BUT THE RULE HAS A BOUNDARY, and getting it wrong would make the finding unrecordable.**
Measured: the gate walks `path.join(process.cwd(), "src")` only, extensions `.css` / `.ts` / `.tsx`.

<!-- prettier-ignore -->
    a code comment in src/**            READ by the gate   -> describe, never reproduce
    this plan, the errata, any doc/     NOT read           -> quote the literal freely
    a commit message                    not a file at all  -> quote it freely

🔴 **So "never write the literal anywhere" would be wrong, and expensively so** — the errata could
not record _which_ declaration is forbidden, and an instruction that cannot name its subject is
unusable. **The constraint is on comments inside `src/`, and only there.**

##### 🔴 There is no exemption path — a declined hit can only be BASELINED

Errata §AB-1: for margin, padding and radius there is **no exemption mechanism at all**; only colour
and type steps have one, and `recordDebt` is called directly with no filter. **So a literal you
correctly decline to change can only be absorbed into the baseline** — and the baseline collapses two
states into one number:

<!-- prettier-ignore -->
    baselined because the literal is CORRECT and must never change
    baselined because nobody has got to it yet

⚠️ **Same list, same figure — and the natural action on a debt count is to drive it to zero.** So a
correct literal, once baselined, is indistinguishable from unfinished work and the next person will
"fix" it. **The gate cannot hold the distinction, so the report and this plan must.**

**Not built:** nothing owner-gated beyond Q-12. **Do not touch `ward-global-search.module.css`** —
shared, not this lane's, and its two flags are recorded here only so they are not mistaken for
yours.

**Report:** three lines.

---

### 🔴 The reconciliation sentence — COPIED from my drawings, and it is not what §B said

**Errata §B4 forbids composing it: copy each screen's own trailing clause from its own drawing.**
Search hub's clause is literally _"no event feed on this screen"_, and a builder composing from a
description of the sentence would put a last event on a screen that has none.

**So I copied it. All four of my screens build it identically:**

<!-- prettier-ignore -->
    "Invented figures, "
      + (problems ? N + " " + plural(N, "figure does", "figures do") + " not reconcile"
                  : "reconciled with each other")
      + ", as at " + NOW
      + (last !== null ? ", last event " + clock(last) + ", " + agoText(last)
                       : ", no event today")

**Four things my earlier draft got wrong, all of them the same error — describing the string instead
of copying it:**

1. 🔴 **There are TWO branches, not one.** The disagreeing form —
   _"Invented figures, 2 figures do not reconcile, as at …"_ — is the one that matters, and an
   assertion pinned only to _"reconciled with each other"_ **cannot see a screen whose figures
   disagree.**
2. **§B4a: the plural is a function of N.** _"1 figure does not reconcile"_ / _"2 figures do not
   reconcile"_. ⚠️ **A test pinning the plural passes on a two-problem fixture and fails on a
   one-problem one — and one problem is the commoner case.** Pin both.
3. **The trailing clause has two branches too**: `, last event <clock>, <ago>` or `, no event today`.
   My screens **do** have an event feed, so Search hub's clause never applies here — but that is
   something I checked, not something to assume.
4. 🔴 **The dot beside it is conditional and carries tone**: `danger` when figures disagree, `good`
   when they do not. The drawing's own comment says a **green dot over a failed reconciliation is
   the same class of defect as the "Live" claim** the ruling banned. Do not render a fixed tone.

#### ⚠️ And this sentence is the shared Activity drawer's, NOT a screen footer's

I nearly put it in D3, M5 and P2. **It is built in the drawer header, beside the service name and
the Close button** — the shell's, Ward Lead's, **not this lane's to render.** The screen footer
panels are different content entirely (see D3 below). **Do not duplicate the sentence into a footer;
a second copy is a second thing to disagree.**

### 🔴 The invented-figure checker walks PROVENANCE BLOCKS — and one of my three footers is invisible to it

Errata §V, read at `tests/ward-provenance-sentences-carry-their-own-marker.test.ts`:

<!-- prettier-ignore -->
    ROOT       src/components/ward-management
    HEADING    /invented|synthetic|placeholder|prototype boundary/i
    walk       find such a heading -> take the <p> blocks after it, to the next heading or </section>
    predicate  every sentence >= 25 chars in those blocks must disclose

**The layer is irrelevant — it reads source text, never renders.** What puts something out of reach
is **not being a `<p>` under a matching heading.** Applied to my three footers:

<!-- prettier-ignore -->
    Delays    "What is invented and what is real"   matches /invented/   -> WALKED
    Capacity  "Every figure here is invented"       matches /invented/   -> WALKED
    Movement  "What reconciles"                     matches NOTHING      -> NOT WALKED

🔴 **So M5's footer is not covered by that checker at all**, and my D3 catcher line _"the marker
test's reach extended to this file"_ was naive: **reach is per provenance block, not per file.**
⚠️ **Do not rename Movement's panel to make it match** — the drawing's word is `What reconciles`, and
renaming a screen to satisfy a checker is the checker choosing the product. **M5 needs its own
assertion instead, and its report must say the shared checker does not cover it.**

### ⚠️ Markers are not refusals — flag a bare figure, do not improvise a guard

Errata §U2, narrowing §U:

    A REFUSAL is a sentence that must be ALONE.
    A MARKER  is a sentence that must be TOGETHER with something.

§U's negative assertion works because **there is a contradiction to detect** — two sentences
disagreeing. 🔴 **A missing marker has none.** The figure travels into the live region, the marker
stays behind, and there is just **a number announced bare**. Nothing disagrees, so the negative
assertion finds nothing.

**Keep reading the live regions on every browser pass — that half stands and is the important one.**
Use the negative form for refusals and stated absences. 🔴 **If you meet a bare figure announced
without its marker, FLAG IT to Ward Lead and do not write a guard.** The positive-over-the-whole-
surface form that would catch it is **deliberately unwritten**: it is a guard whose strength is the
whole point, and it needs its own brief and its own adversarial pass.

---

### Task D2: Delays — check the legal deadline wording against what already ships

🔴 **THIS TASK IS NOT WHAT THE SPEC SAYS IT IS.** §4.2 task 2 says to wire `legalDeadlineMinutes`,
_"a derivation with no reader today"_. **It has a reader.** `delays-screen.tsx`, inside `DelayRow` calls it, renders
it as an urgent state, and `tests/ward-delays-legal-deadline.dom.test.tsx` proves it — a file whose
header explicitly says the deadline was never invisible everywhere.

**Files:**

- Modify: `delays/delays-screen.tsx` — **wording only, and possibly nothing at all**
- Test: `tests/ward-delays-legal-deadline.dom.test.tsx` — **read it before touching anything**

**Interfaces:** consumes `legalDeadlineMinutes(movement, now)`; produces nothing.

**Catcher:** `tests/ward-delays-legal-deadline.dom.test.tsx`, unchanged.

**Steps:**

- [ ] **Step 1: Read the shipping sentence and the drawing's, side by side.**

<!-- prettier-ignore -->
    ships now:  "{legal form name} passed its deadline 10 min ago"
                "{legal form name} due in {n} min"
    spec asks:  "Legal deadline passed 1h 10m ago"
                "No deadline recorded"

- [ ] **Step 2: RULED, 2026-09-10 - the shipping sentence wins, and not on a tie.**
      Ward Lead: _"Adopting the spec's wording drops which legal form is running - that is
      clinical information a coordinator acts on, and 'a deadline' and 'a Form 3B deadline' are
      not the same fact. A sentence that names less is not a tidier version of one that names
      more."_ **Change nothing.** The reasoning, kept because a later chat will meet this again: The shipping sentence **names the
      legal form**; the spec's drops it. Which legal form is running is clinical information, and
      losing it is a downgrade, not a restyle. Adopting it also reddens the dedicated test file
      above. **Four-line message to Ward Lead** naming both sentences and asking which the drawing
      means.

- [ ] **Step 3: SUPERSEDED by the ruling above. Kept only for the case where the drawing is
      later found to disagree with both sentences.** If Ward Lead ever reverses,, change the formatter in one
      place, run the dedicated file plus all six delays tests, and prove the file still catches by
      reverting the formatter and watching it redden.

- [ ] **Step 4: CLOSE THIS TASK AS "already built, verified, not changed".** ð´ **That is a
      COMPLETE OUTCOME and must be reported as one.** Ward Lead named the failure mode
      explicitly: _a lane quietly logging it as skipped._ Skipped and already-built are the same
      shape in a report and mean opposite things.

**Not built:** a second deadline derivation. There is one and it works.

**Report:** three lines — and the third line names this as handed back if it was.

---

### Task D3: Delays — the footer "What is invented and what is real" panel

**Files:**

- Modify: `delays/delays-screen.tsx`, `delays/delays.module.css`
- Test: `tests/ward-delays-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes the clock from `useWardFlow()`; produces nothing.

**Catcher:** the invented-figure marker test's reach extended to this file
(`tests/ward-provenance-sentences-carry-their-own-marker.test.ts`) plus a DOM assertion on the
sentence.

**Steps:**

- [ ] **Step 1: Write the failing test**

🔴 **THIS PANEL IS NOT A SENTENCE. Copied from `delays-third-edition.html`, it is three paragraphs
with derived counts embedded in the prose:**

<!-- prettier-ignore -->
    "Every figure here is invented"   the <N> people waiting, their waits, the blocker each is stuck
                                     on and how long for, the legal forms and their clocks, the wards
                                     asked and their reasons, the <N> escalations, the <N> people
                                     resolved today, and the medical clearance state
    "What is real"                   the <N> emergency departments, the hospital sites, the ward
                                     names and the four health services, from the repository's own
                                     tables; the five owners, the ten blockers and the three the
                                     screen calls severe
    "Two populations, kept apart"    people waiting are OPEN movements only, one blocker each,
                                     counted once; people resolved today are CLOSED movements, in
                                     their own register, NEVER added to the people waiting

⚠️ **`fPeople`, `fEsc`, `fRes` and `fEds` are spans the engine fills — four derived figures INSIDE
the disclosure paragraphs.** A hardcoded number here is a literal figure in the one panel whose
subject is that nothing is literal.

🔴 **AND THE THIRD PARAGRAPH MAKES A CLAIM ABOUT ANOTHER SCREEN — WHICH IS ALSO MINE:** _"The
Movement screen keeps closed movements on its stage board; this screen does not, and search here
refuses them."_ **If M1 or M2 changes how Movement treats closed movements, this Delays paragraph
becomes false and nothing goes red.** Both screens are Lane A's, so this is the lane's to keep true
— **name it in the M1 and M2 briefs, not only here.**

```tsx
it("carries all three disclosure headings", () => {
  renderScreen();
  const footer = screen.getByRole("region", { name: "What is invented and what is real" });
  for (const lead of ["Every figure here is invented", "What is real", "Two populations, kept apart"]) {
    expect(within(footer).getByText(new RegExp(lead)), `${lead} is missing`).toBeTruthy();
  }
});

it("derives the four figures inside the disclosure prose, rather than typing them", () => {
  renderScreen();
  const footer = screen.getByRole("region", { name: "What is invented and what is real" });
  // Each expected value comes from the SAME derivation the screen calls, with the same arguments.
  expect(within(footer).getByTestId("f-people").textContent).toBe(String(expectedWaiting.length));
  expect(within(footer).getByTestId("f-esc").textContent).toBe(String(expectedEscalations.length));
  expect(within(footer).getByTestId("f-res").textContent).toBe(String(expectedResolvedToday.length));
  expect(within(footer).getByTestId("f-eds").textContent).toBe(String(expectedEds.length));
});

it("never claims the figures are live or reconciled with reality", () => {
  renderScreen();
  const page = screen.getByRole("main").textContent ?? "";
  expect(page).not.toMatch(/\bLive\b/);
  expect(page).not.toMatch(/reconciled with reality/i);
});
```

- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Build the three paragraphs, **copied from the drawing, not composed**. Every
      embedded figure derived on each render. 🔴 **Do NOT put the Activity drawer's
      _"Invented figures, …"_ sentence in here** — it belongs to the shell's drawer, and a second
      copy is a second thing to disagree.
- [ ] **Step 4:** Run green; `npx tsc --noEmit` separately.
- [ ] **Step 5:** Prove the derived figures catch: force one to disagree with its derivation and
      watch the case redden. Commit before mutating; restore with `git show HEAD:<path> > <path>`.
- [ ] **Step 6:** Prettier, commit with explicit paths.

**Not built:** persistence of the demonstration (Q-8, recorded only). **Do not resolve the
Delays↔Movement coupling by changing Movement** — if the paragraph and the Movement screen disagree,
hand it back.

**Report:** three lines.

---

### Task D4: Delays — "What the blocker is" — 🔴 WITHDRAWN. THE PANEL WAS ALREADY THERE.

🔴 **THIS TASK WAS MY ERROR AND IT WAS FALSE WHEN I WROTE IT.** Measured 2026-09-11:

<!-- prettier-ignore -->
    the panel was added by   fe117b11a3, 2026-09-07, "the Delays board as the mockup drew it"
    present at               my branch point 8c5aebc938
    present at               ec102d210e — THE COMMIT IN WHICH I WROTE "the app has no equivalent at all"

**It is not a stub. It groups by `DELAY_OWNERS`, lists each cause with its count, marks severity, and
filters the screen on click.** There was never anything to build.

#### ⚠️ HOW I GOT IT WRONG, because the method is the transferable part

When I first measured the Delays panels I ran:

    grep -nE "Who is waiting|Registers|The person you have chosen|Worth your attention|no named person"

🔴 **A search for the names I already expected. It could only return what I already believed, and its
silence about everything else read as absence.** I then built a rename table from that list, and a
panel that was not in my search string became "a panel the app does not have".

⚠️ **For Capacity I happened to run `grep -noE 'title="[^"]+"'` — an ENUMERATION — and that one was
correct, all six panels.** Same file type, same session, two instruments: **the enumerating one was
right and the confirming one invented a task.**

**Rule taken from it: to establish what a screen HAS, enumerate. A targeted grep can only ever
confirm, and its silence is not evidence.** This is the same shape as the errata's own warning that a
literal grep of an HTML drawing cannot prove absence — **and I had read that warning.**

**Recorded as errata §G1 and broadcast to the other lanes on my claim. It needs retracting there.**

#### What, if anything, actually remains

**Not a build. At most a verification**, and its three constraints came from the same prose-reading
pass that produced the false claim, **so they must be re-derived from the drawing before anyone acts
on them**: one blocker per person; awaiting a bed is not an ED blocker; medical clearance is not in
the list. **Whether the shipped panel already honours them is UNMEASURED.**

---

**Everything below is the original task text, kept because the errata cites it and a retraction that
deletes its subject cannot be checked.**

**This is a BUILD, not a rename. Do not go looking for an app panel to rename into it — there is not
one.**

**Files:**

- Modify: `delays/delays-screen.tsx`, `delays/delays.module.css`
- Test: `tests/ward-delays-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes `movements` and the existing delay-cause derivations; produces nothing.

**Catcher:** a DOM test asserting one blocker per person, and asserting the two exclusions below by
name — each in its own case, so a single over-broad implementation cannot satisfy both.

🔴 **The three clinical constraints, from the drawing. These are the task; the panel is the easy
part.**

<!-- prettier-ignore -->
    one blocker per person      a person has ONE blocker, not a list. If the model can express more
                                than one, the screen still shows one, and WHICH one is a
                                STOP-AND-HAND-BACK, not a rule to invent.
    awaiting a bed is NOT an    it is the thing everyone on this screen is already doing. As a
    ED blocker                  "blocker" it is vacuous, and it would swamp every real blocker
                                beneath it.
    medical clearance is NOT    deliberately not in the list. Do not add it back because the model
    in the list                 happens to have a field for it.

⚠️ **The second and third are EXCLUSIONS, and an exclusion is invisible in a passing test unless
something asserts it.** A panel that renders every blocker the model holds passes _"the panel
exists"_ and _"each person has a blocker"_ while breaking both rulings. **Write the two negative
cases first.**

**Steps:**

- [ ] **Step 1:** Write the failing test: the panel exists; every listed person carries exactly one
      blocker; **a movement whose only blocker is awaiting a bed does not appear**; **a movement
      whose only blocker is medical clearance does not appear**. Build each negative case from a
      hand-built movement so it cannot go vacuous when the seed changes.
- [ ] **Step 2:** Run red — and check _why_. The two negative cases must fail because the row **is**
      present, not because the panel does not exist yet. 🔴 **A negative assertion passes trivially
      against a screen with no panel at all**, so build the panel before you trust them.
- [ ] **Step 3:** Build the panel. **Words before colour.** Absence is shown and marked, never
      dropped — a person with no recorded blocker is listed as having none, not omitted.
- [ ] **Step 4:** Run green; `npx tsc --noEmit` separately.
- [ ] **Step 5:** Prove the two negatives catch: let the exclusion admit the excluded blocker, watch
      each case redden, restore. **Commit before mutating**, and restore with
      `git show HEAD:<path> > <path>` — `git checkout --` is blocked on ward source paths by the
      protect hook.
- [ ] **Step 6:** Prettier, commit with explicit paths.

**Not built:** any ranking, grouping or escalation of blockers. The drawing shows a list; anything
that orders or prioritises it is a stop-and-hand-back.

**Report:** three lines.

---

### Task M1: Movement — restyle and rename the four list panels

**Files:**

- Modify: `movements/movements-screen.tsx`, `movements/movements.module.css`
- Test: `tests/ward-movement-third-edition.dom.test.tsx` (create)

**Interfaces:** consumes `journeyStages`, `transportLegs`, `transportCounts` (all verified present);
produces nothing.

**Catcher:** heading-order assertion; all ten existing `tests/ward-movement*` files stay green.

The app's four panels today, measured:

<!-- prettier-ignore -->
    Where each move has got to   (count: "{n} moves")
    Who is being carried         (count: "{n} of {m} open moves")
    Transport right now
    Every stage, at a glance     (count: "{n} moves")

- [ ] **Step 1:** Heading-order test over the drawing's order.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Rename and restyle. **Every `count=` stays derived** — they already are.
- [ ] **Step 4:** Run the new test and all ten movement tests; `npx tsc --noEmit`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** a second movement-detail page; any new reducer event.

**Report:** three lines.

---

### Task M2: Movement — the five tabs, each count derived

**Files:**

- Modify: `movements/movements-screen.tsx`, `movements/movements.module.css`
- Test: `tests/ward-movement-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes the existing movements derivations; produces nothing.

**Catcher:** each tab's count equals its derivation over the seed, **and the five reconcile with the
open count in words**.

The five tabs, **as the drawing writes them** — three differ from the master plan's prose:
_Where each open movement stands_ / _Transport legs, and what has none_ / _How long they have
waited_ / _Resolved today_ / _Movements with no owner_.

- [ ] **Step 1: Write the failing test**

```tsx
const TABS = [
  "Where each open movement stands",
  "Transport legs, and what has none",
  "How long they have waited",
  "Resolved today",
  "Movements with no owner",
];

it("renders five tabs, each counting from the state", () => {
  renderScreen();
  const tablist = screen.getByRole("tablist", { name: /movements/i });
  const tabs = within(tablist).getAllByRole("tab");
  expect(tabs.map((tab) => tab.textContent?.replace(/\s*\d+\s*$/, "").trim())).toEqual(TABS);
});

it("the five tab counts reconcile with the open count, in words", () => {
  renderScreen();
  const footer = screen.getByRole("region", { name: "What reconciles" });
  const sentence = footer.textContent ?? "";
  // The sentence's own numbers must sum. Parsed from the sentence, never typed.
  const figures = [...sentence.matchAll(/\b(\d+)\b/g)].map((match) => Number(match[1]));
  expect(figures.length, "the reconciliation sentence carries no figures").toBeGreaterThan(2);
});
```

- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Build the tablist over the existing derivations. Arrow-key navigation, visible
      focus, an accessible name. **Zero reads _none_, never `0`.**
- [ ] **Step 4:** Run green; `npx tsc --noEmit`.
- [ ] **Step 5:** Mutate one derivation so a tab count disagrees; the reconciliation test must
      redden. Commit before mutating.
- [ ] **Step 6:** Prettier, commit with explicit paths.

**Not built:** any new reducer event.

**Report:** three lines.

---

### Task M3: Movement — the `corridorCounts` derivation

**Files:**

- Modify: `movements/movements-derivations.ts` (add one exported function)
- Test: `tests/ward-movements-corridors.test.ts` (create)

**Interfaces:**

- Consumes: `Movement[]` and the existing `isOpen`.
- Produces:
  `corridorCounts(movements: Movement[]): CorridorCount[]` where
  `CorridorCount = { originEdId: string; acceptedUnitId: string; stage: MovementStage; count: number }`.
  **Task M4 renders exactly this shape.**

**Catcher:** a unit test over three hand-built movements, **proved by mutation**.

**Steps:**

- [ ] **Step 1: Write the failing test over hand-built movements**

```ts
import { describe, expect, it } from "vitest";
import { corridorCounts } from "@/components/ward-management/movements/movements-derivations";

/**
 * Hand-built, not seeded: the point is to fix the arithmetic against inputs whose answer is
 * obvious by inspection. The seed is going to be replaced wholesale (the changeable-data rule),
 * so a test that only holds for today's seed proves nothing about tomorrow's.
 */
const A = movement({ id: "M1", originEdId: "ED-1", acceptedUnitId: "U-1", stage: "accepted" });
const B = movement({ id: "M2", originEdId: "ED-1", acceptedUnitId: "U-1", stage: "accepted" });
const C = movement({ id: "M3", originEdId: "ED-2", acceptedUnitId: "U-1", stage: "in_transit" });

describe("corridorCounts", () => {
  it("counts two movements down one corridor at one stage as a single row of 2", () => {
    const rows = corridorCounts([A, B, C]);
    const oneOne = rows.find((row) => row.originEdId === "ED-1" && row.acceptedUnitId === "U-1");
    expect(oneOne?.count).toBe(2);
  });

  it("keeps different origins apart even when they share a destination", () => {
    const rows = corridorCounts([A, B, C]);
    expect(rows.filter((row) => row.acceptedUnitId === "U-1")).toHaveLength(2);
  });

  it("returns no row for a corridor nothing travels — an empty corridor is absent, not zero", () => {
    expect(corridorCounts([])).toEqual([]);
  });
});
```

- [ ] **Step 2:** Run red — "corridorCounts is not exported".
- [ ] **Step 3:** Implement it as a pure function. No `Date.now()`. No filtering by anything the
      model does not hold. 🔴 **No catchment inference** — Q-2. A corridor is origin ED → accepted
      unit, which the movement record already carries.
- [ ] **Step 4:** Run green; `npx tsc --noEmit`.
- [ ] **Step 5: Commit, THEN prove the test catches.** Mutate the grouping key to ignore
      `originEdId`; the second test must redden. Restore with `git checkout --` — which works only
      because you committed first.
- [ ] **Step 6:** Prettier, commit with explicit paths.

**Not built:** nothing.

**Report:** three lines.

---

### Task M4: Movement — "Today's traffic", the corridors diagram

**Files:**

- Modify: `movements/movements-screen.tsx`, `movements/movements.module.css`
- Test: `tests/ward-movement-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes `corridorCounts()` from M3.

**Catcher:** the DOM test asserts every corridor renders **its count as text**, and that the diagram
states its scale.

- [ ] **Step 1:** Write the failing test: every rendered corridor carries a text label; the diagram
      has an accessible name and a stated scale; SVG text is ≥ 10.5px.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Render the diagram over `corridorCounts`. **A stated scale** — a diagram whose
      widths mean nothing is a picture, not a figure. **Words before colour** on every node.
- [ ] **Step 4:** Run green; `npx tsc --noEmit`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** any corridor the model cannot derive. A corridor the drawing shows and the model
cannot produce is a stop-and-hand-back to Ward Lead, who extends the seed or asks the owner.

**Report:** three lines.

---

### Task M5: Movement — move the EXISTING reconciliation sentence into the footer panel

🔴 **THIS TASK IS NOT WHAT THE SPEC SAYS IT IS.** §4.3 task 3 / I-20 says the two figures have
nothing reconciling them. **They do.** `totalsReconciliation()` at `totalsReconciliation()` in `movements-derivations.ts`
builds the sentence, the `styles.reconciliation` paragraph in `movements-screen.tsx` renders it, and
`tests/ward-movements-derivations.test.ts`, the four cases from _"has a difference to explain at all"_ to _"TRACKS a changed population"_ tests it including a mutation. The screen carries
a 20-line comment recording the closed 2026-09-05 defect it exists to prevent — a movement that had
not proceeded rendering as a person still waiting for a bed, with a running clock.

**What is actually missing is the drawing's footer PANEL placement, not the sentence.**

**Files:**

- Modify: `movements/movements-screen.tsx`, `movements/movements.module.css`
- **Do not modify** `movements-derivations.ts`
- Test: `tests/ward-movement-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes `totalsReconciliation(movements)` — unchanged.

**Catcher:** `tests/ward-movements-derivations.test.ts` stays green **untouched**, plus a DOM
assertion that the sentence now renders inside the footer region.

**Steps:**

- [ ] **Step 1:** Write the failing test: the sentence renders inside a region named _What
      reconciles_, and the invented-figure sentence is _"Invented figures, reconciled with each
      other, as at &lt;time&gt;"_.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Move the existing `<p>` into the footer panel. **Do not write a second derivation.
      Do not inline the arithmetic.** If the footer needs a figure the sentence does not carry, that
      is a four-line message to Ward Lead.
- [ ] **Step 4:** Run the new test **and `tests/ward-movements-derivations.test.ts` unchanged**;
      `npx tsc --noEmit`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** a second reconciliation.

**Report:** three lines.

---

### Task M6: Movement — the per-movement detail drawer

**Files:**

- Modify: `movements/movements-screen.tsx`, `movements/movements.module.css`
- Test: `tests/ward-movement-third-edition.dom.test.tsx` (extend)

**Interfaces:** consumes the movement record and the existing derivations; produces nothing.

**Catcher:** the DOM test opens the drawer **by keyboard**, asserts focus is trapped, and asserts
**Escape closes it without clearing the service selector**.

Seven sections: Person, Journey, Which wards were asked, Escalation, Transport leg, What you can do,
Watch and flag. One link out — _Open the workspace_ → `/movements/[id]`, which Q-4 keeps.

- [ ] **Step 1: Write the failing test**

```tsx
it("opens by keyboard, traps focus, and Escape closes it without clearing the service", () => {
  renderScreen();
  const serviceBefore = screen.getByRole("combobox", { name: /service/i }).getAttribute("value");
  const row = screen.getAllByRole("button", { name: /open the detail for/i })[0];
  row.focus();
  fireEvent.keyDown(row, { key: "Enter" });

  const drawer = screen.getByRole("dialog", { name: /detail/i });
  expect(drawer).toBeTruthy();
  expect(drawer.contains(document.activeElement), "focus did not move into the drawer").toBe(true);

  fireEvent.keyDown(drawer, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: /detail/i })).toBeNull();
  expect(screen.getByRole("combobox", { name: /service/i }).getAttribute("value")).toBe(serviceBefore);
});

it("links out to the workspace with the identifier intact", () => {
  renderScreen();
  openFirstDrawer();
  const link = screen.getByRole("link", { name: "Open the workspace" });
  expect(link.getAttribute("href")).toBe(movementHref(firstMovement.id));
});
```

⚠️ The service assertion is the point of the Escape test, not a bonus: _Escape never clears the
service selector_ is a named constraint, and a drawer that closes correctly while wiping the
selector passes a naive close test.

- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Build the drawer, modal, focus-trapped, with the seven sections built from the
      movement record. The href comes from the facade's builder; **a route string typed into a screen
      is a defect.**
- [ ] **Step 4:** Run green; `npx tsc --noEmit`. Run
      `tests/ward-links-never-point-at-redirect-stubs.test.ts`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** a second movement-detail page — Q-4 keeps `/movements/[movementId]` as the
coordinator's workspace.

**Report:** three lines.

---

### Task M7: Movement — "Record a decision", the bar's primary action

**Files:**

- Modify: `movements/movements-screen.tsx`
- Test: `tests/ward-movement-third-edition.dom.test.tsx` (extend)

**Blocked on Phase 1:** `WARD_PRIMARY_ACTIONS` does not exist on the line at `8c5aebc938`.

**Interfaces:** consumes `WARD_PRIMARY_ACTIONS` from `ward-nav.ts` (Ward Lead's, read-only here).

**Catcher:** `tests/ward-event-reachability.test.ts` stays green; a DOM test dispatches one existing
event and asserts the list re-renders.

- [ ] **Step 1:** Write the failing test — the primary opens the drawer at _What you can do_ for the
      selected movement; one dispatch re-renders the list.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Wire it. 🔴 **Dispatch only events that already exist** — `ACCEPT_IN_PRINCIPLE`,
      `DECLINE`, `BOOK_TRANSPORT`, `RECORD_MOVEMENT_BLOCKER`. **A new action is a stop-and-hand-back
      to Ward Lead**, not a reducer edit: `ward-flow-reducer.ts` is a shared file this lane may never
      touch.
- [ ] **Step 4:** Run green; `npx tsc --noEmit`; run `ward-event-reachability`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** any new reducer event. **One primary action per panel** — the screen renders no second
primary.

**Report:** three lines.

---

### 🔴 Capacity's bed mix is blocked on an owner question — P1 and P2 build around it, not through it

The gender wiring **handed back before writing code** (2026-09-11, its own trigger). Verified here in
the model rather than taken on report:

<!-- prettier-ignore -->
    Admission        id, unitId, specialling, highAcuity, referralId | null, sex, + timestamps
                     -> NO patientId. Zero occurrences in the whole file.
    Patient          gender?: Gender   (optional - the "not yet recorded" third state)
    Unit.sexMix      Record<Sex, number>, a SEEDED LITERAL

**So an occupant carries `sex` directly, and can only reach `gender` through `referralId` →
`Referral.patientId` → `Patient`.** 🔴 **That chain is broken for every occupant: 0 of 259 link to a
person record.** _(Occupant figure Ward Lead's; the model reading is mine.)_

⚠️ **The sharper statement, and it is why the question is genuinely blocking rather than merely
awkward:** the seed's counts are keyed by a field the occupant **has** (`sex`), and the owner's
ruling needs one it **cannot reach** (`gender`). **A sex mix is derivable today. A gender mix is
not — not because the arithmetic is hard, but because the join does not exist.**

**And underneath that: nobody ever decided whether those invented counts MEAN sex or gender.** Queued
to Josh as **A-6, blocking**, with the cost of waiting stated — until he answers, a trans woman is
still placed by her recorded sex.

**What this means for P1 and P2:**

- **Render `sexMix` exactly as it is rendered today. Do not rename it, do not relabel it "gender
  mix", do not derive a second mix.** Ward Lead's day-one instruction stands: whether the bed mix
  becomes a gender mix is **a deliberate decision, not a rename — stop and hand it back rather than
  choosing.**
- 🔴 **If the Capacity drawing labels that mix with a gender word, that is a stop-and-hand-back, not
  a relabelling job** — the label would be asserting the very thing the owner has not decided.
- **Do not "fix" the missing link.** Adding `patientId` to `Admission` is a model change, a shared
  file, and the subject of an open owner question.

### Task P1: Capacity — the drawing's panel words, order and side placement

**Files:**

- Modify: `capacity/capacity-screen.tsx`, `capacity/capacity.module.css`
- Test: `tests/ward-capacity-third-edition.dom.test.tsx` (create)

**Interfaces:** consumes `unitCapacity`, `capacityBreakdown`, `networkTotals`, `bedKindGaps` (all
verified present); produces nothing.

**Catcher:** heading-order assertion plus **all fourteen `tests/ward-capacity-*` files green** — the
derivation-agreement and one-word-figure tests are the ones that bite. (Fourteen. The spec says
fifteen and is wrong; there is no missing file to look for.)

The app's six panels today, measured:

<!-- prettier-ignore -->
    Where the mismatch is        drawn
    Ready now                    Q-12 - recommend keeping as the first row of the side panel
    Bed map                      drawn
    Every ward in the network -> Wards
    Worth your attention         Q-12 - recommend the Activity drawer
    Beds freeing today           Q-12 - recommend the Activity drawer

- [ ] **Step 1:** Heading-order test over the drawing's order, plus an assertion that 🔴 **READY is
      the only word for a free bed** — and that **neither _Available_ nor _Unoccupied_ appears**.
      ⚠️ **Both of those are absent from `capacity/` today; the assertion exists to keep them absent,
      not to introduce one of them.** (R-6: this step previously named _Available_ as the required
      word, which would have put a second word on a state that already has one.)
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Rename, reorder, move the side panel into the drawing's place. **Fold, never
      drop** — record all three Q-12 panels for Z1.
- [ ] **Step 4:** Run the new test and **all fourteen** capacity tests; `npx tsc --noEmit`.
- [ ] **Step 5:** Prettier, commit with explicit paths.

**Not built:** "Hold a bed" — no such action exists in the drawing or the app, and the standard's §14
row naming it is stale (Q-10, Ward Mockups').

**Report:** three lines.

---

### Task P2: Capacity — the footer disclosure panel, "Reconciled to Command" derived

**Files:**

- Modify: `capacity/capacity-screen.tsx`, `capacity/capacity.module.css`
- Test: `tests/ward-capacity-third-edition.dom.test.tsx` (extend)

**Blocked on Phase 1:** needs the facade.

**Interfaces:** consumes the same `unitCapacity` sums Command prints, through the facade.

**Catcher:** `tests/ward-facade-agrees-with-screens.test.ts` for beds available, plus a DOM assertion
that the footer sentence is derived.

- [ ] **Step 1:** Write the failing test — the footer says _"Invented figures, reconciled with each
      other, as at &lt;time&gt;"_, and _Reconciled to Command_ is computed from the same sums Command prints, not typed.
- [ ] **Step 2:** Run red.
- [ ] **Step 3:** Build the panel. 🔴 **Derived, never typed.** The comparison goes in the check
      array so a divergence reddens rather than renders.
- [ ] **Step 4:** Run green; `npx tsc --noEmit`.
- [ ] **Step 5:** Force Capacity's total to disagree with Command's and assert the check reddens.
- [ ] **Step 6:** Prettier, commit with explicit paths.

**Not built:** persistence (Q-8).

**Report:** three lines.

---

### Task Z1: the Q-12 list, the whole-screen reviews, and the hand-in

**Files:** the lane report only. No source file.

**Steps:**

- [ ] **Step 1: Assemble the Q-12 list — every panel these four screens carry that the drawings do
      not.** Measured, complete as at `8c5aebc938`:

<!-- prettier-ignore -->
    Delays    Worth your attention           -> recommend the Activity drawer
    Delays    Delays with no named person    -> recommend folding into Waiting, as a group headed by that sentence
    Capacity  Ready now                      -> recommend keeping as the first row of the side panel
    Capacity  Worth your attention           -> recommend the Activity drawer
    Capacity  Beds freeing today             -> recommend the Activity drawer

🔴 **Command and Movement contribute nothing to this list** — every panel they carry is drawn. That
is a measured finding, not an omission, and it is stated so nobody reads a short list as an
incomplete one.

- [ ] **Step 2:** One **Opus** whole-screen review per screen, against the drawing and standard §10,
      before any SHA goes to Ward Lead.
- [ ] **Step 3:** Run both ward gates in this worktree, unpiped:

```bash
node scripts/run-ward-tests.mjs
```

```bash
node scripts/check-ward-expected-reds.mjs
```

- [ ] **Step 3a: 🔴 RUN THE WARD BROWSER JOURNEYS. NEITHER LOOP RUNS THEM, AND THERE IS A COMMAND.**

```bash
npm run test:e2e:ward-journeys
```

Measured 2026-09-11, because a "full suite" that excludes them is how a layout defect reaches a fold:

<!-- prettier-ignore -->
    run-ward-tests.mjs   prints its own exclusion: 12 Playwright ward journeys, vitest cannot run them
    verify:ui            -> test:e2e:pr -> --project=chromium --project=chromium-caring-contacts-seeded
                            --grep-invert "@quarantine|@mockup"
    the ward specs       live in project `chromium-mockups`, matched by mockupSpecPattern

🔴 **So `verify:ui` runs NO ward journey** — the ward specs are in a project it does not select, and
are additionally excluded by tag. **The twelve are outside both loops.** `test:e2e:ward-journeys`
(`--project=chromium-mockups ui-ward-`) is the command that runs them, and **this plan is the only
place in this lane that names it.**

⚠️ **These twelve are the ONLY automated coverage of this lane's screens in a real browser** — which
is the one instrument that can see the class no DOM test can reach: computed styles, media queries,
stacking, and the 641–1000px band. **Handing in without them means the lane's layout was checked by
eye alone.**

Which of the twelve touch this lane's screens (route mentions, **not** a claim about assertion
depth):

<!-- prettier-ignore -->
    Delays     ui-ward-chrome-header, ui-ward-management
    Movement   ui-ward-management, ui-ward-roles
    Capacity   ui-ward-discharges, ui-ward-management, ui-ward-morning, ui-ward-table-thresholds
    Command    every spec lands on the base ward-flow route, which IS Command - so "all twelve"
               overstates it. Route mentions are not coverage; do not report them as such.

- [ ] **Step 4:** Look at all four screens, by eye, at 390, 820 and 1440 in both themes, **plus one
      width in the 641–1000px band**. Screenshots into the report.
- [ ] **Step 4a: READ THE LIVE REGIONS on every one of those passes.** 🔴 Not the screenshot, not
      the visible text — the regions themselves. **A screenshot cannot show an `sr-only` region and a
      person looking at the screen cannot see it**, so this is the only pass that can catch a
      component contradicting a refusal or a stated absence. For each screen, dump every
      `aria-live` / `role="status"` / `role="alert"` node's text and check that **nothing anywhere
      claims a match, a count or a result while a refusal or an absence stands.**
- [ ] **Step 5:** Write the report: the Q-12 list, every hand-back, the three lines, and the SHAs.

**Report:** three lines.

---

## 3A · Additions beyond what the drawings draw — logged under §5.0(2), the owner's to veto

**§5.0(2) forbids quietly ADDING as firmly as quietly DROPPING.** Everything below is on the
screens and was **never drawn**. It is recorded here so the owner can veto any of it knowing it is
ours rather than the drawing's, and so an auditor comparing screen against drawing finds the
difference explained rather than having to discover it.

### A-ADD-1 · M2 — the three tab names become sort options, reworded; the heading carries the marking

**Ward Lead's addition, ruled 2026-09-11. Built at `1a70d55b3c`.**

The drawing gives the Movement list five tabs. The owner ruled against three of them — measured,
tabs 1 to 3 were **the same 43 people by id-set equality**, and _"three tabs implies three different
groups of patients, and a coordinator would reasonably read it that way"_. A fourth,
_Movements with no owner_, is unreachable: `owner` is a required field and never blank, **0 of 50**.

**So one region with sorting, and the drawing's three subjects survive as sort options:**

| Drawn as a tab                    | Built as                            |
| --------------------------------- | ----------------------------------- |
| Where each open movement stands   | By where it stands                  |
| Transport legs, and what has none | By transport leg, and what has none |
| How long they have waited         | By how long it has waited           |
| Resolved today                    | _(a tab, unchanged)_                |
| Movements with no owner           | _(dropped — unreachable, 0 of 50)_  |

**Section heading, which no drawing carries:**
_Every movement today — the N that have closed are marked_, with **N derived, never typed** (D-45c).

🔴 **Why the names could not be carried across unchanged: a TAB defines a POPULATION, a SORT defines
an ORDER.** They were population names because they were tabs; on a sort control they claim a
population the control does not change. **That is a category error whatever the words** — it is not
a problem with the word "open".

### A-ADD-2 · M2 — the region keeps closed movements, against what the drawing draws

**The drawing splits this region into five open-only tabs and demotes closed movements to two summed
figures below a divider; its detail drawer refuses a closed movement outright.** The app keeps all
fifty with the closed ones marked, per the owner's ruling of **2026-09-05 — "MARK IT, DO NOT FILTER
IT"**, made having been shown the `WF-008` row, the record and three options.

⚠️ **This is the app diverging from a drawing, so it is logged even though it PRESERVES a ruling
rather than adding to it.** **The drawing's stated reason, measured against the seed:**

| The drawing says a closed movement carries… | Measured         |
| ------------------------------------------- | ---------------- |
| no cause                                    | 7 of 7 carry one |
| no stage                                    | 7 of 7 carry one |
| no wait                                     | 7 of 7 carry one |
| no transport leg                            | 6 of 7 carry one |

**Four clauses, four false.** Its closing sentence — _"No open movement stands at Arrived"_ — is
also wrong about the app, whose closed movements sit at `arrived` **and** at
`accepted_awaiting_bed`.

### A-ADD-3 · M2 — the footer's precedence sentence changed, because the screen stopped having one order

**Was:** _"Sorted by wait, longest first — except an expiring legal authority, which outranks
everything."_ **True while there was one order; false the moment a reader picks another.**

**Now:** _"An expiring legal authority outranks every order above."_ 🔴 **And every order honours it
— `journeyStages` through `byUrgencyThenWait`, and `byLongestWait` explicitly.** **A precedence
sentence covering three orderings is only honest if all three apply it**; the first build of
`byLongestWait` did not, which would have made one sentence true under one order and false under
another on the same screen.

### A-ADD-4 · M4 — the Corridors strip renders ONE of the drawing's three kinds, and means something different by it

**Logged BEFORE building, on Ward Lead's instruction, because somebody comparing screen against
drawing will otherwise read a correct build as a defect.**

**The drawing's strip offers three toggles — `Carried` · `Refused` · `Unused`. The screen ships
`Carried` alone:**

| Drawn   | Built       | Why                                                                                                                                                                                                    |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carried | ✅          | 19 rows over 20 movements, derivable today.                                                                                                                                                            |
| Refused | ❌ deferred | Its 6 rows live on exactly the movements `corridorCounts` discards, and **`Decline` carries no `stage`** — see the model gap below. Trigger: **D-45 landing**, the fold of the last statistics screen. |
| Unused  | ❌ closed   | D-41. The drawing hand-declares **2**; its own stated rule yields **110** when applied to this data. Two authored corridors are fiction the day the owner replaces the invented figures.               |

### 🔴 AND _carried_ DOES NOT MEAN THE SAME THING IN THE TWO ARTEFACTS

|                           | population                                          | stage                               |
| ------------------------- | --------------------------------------------------- | ----------------------------------- |
| **the drawing's diagram** | movements that have **ARRIVED** (`arrived.forEach`) | its corridor objects carry **none** |
| **`corridorCounts`**      | movements **open and accepted**                     | groups **by stage**                 |

⚠️ **These are disjoint populations: an arrived movement is closed, and `corridorCounts` skips every
closed movement at its first `continue`.** **So the screen's corridor list and the drawing's picture
will not contain the same rows, will not contain the same NUMBER of rows, and neither is wrong.**
**Routed to Ward Mockups; recorded here so an auditor meets the explanation before the discrepancy.**

### ⚠️ THE MODEL GAP UNDERNEATH `Refused`, recorded as a model gap rather than papered over

**`Decline = { unitId; at; reason }` — there is no `stage`.** 🔴 **So a refused corridor has no honest
stage to report.** The available workaround — borrow the movement's CURRENT stage — **states as a
fact about the moment of refusal something that is only true of now**, and it happens to be safe on
today's two specimens (`WF-009`, `WF-017`) for a reason nothing enforces: **no movement in this seed
is both declined and open-and-accepted.** ⚠️ **D-45 changes the seed. A derivation whose correctness
rests on a property of a fixture we have already decided to replace is a defect waiting for a date.**

## 4 · Open questions — handed back, not decided

1. ✅ **ANSWERED 2026-09-10 - the `ClinicalRail` mounts are WARD LEAD'S, and A0 is CANCELLED,
   not blocked.** Ward Lead removes them in its own worktree during Phase 1, and lanes cut from
   the Phase 1 SHA - so by the time this lane touches those four directories the mounts are
   already gone from its base and **Lane A never edits those lines at all.**
   ⚠️ **Re-cut or merge from the Phase 1 SHA before starting any task in those four
   directories, or you reintroduce a mount that was removed.** The original question, kept
   because it is why the answer is what it is:
   ~~Who takes the `ClinicalRail` mount out of my four screens?~~ All four mount it today
   (`coordinator-screen.tsx`, `delays-screen.tsx`, `movements-screen.tsx`, `capacity-screen.tsx` —
   verified). §5.0 item 1 requires no screen to have a rail of its own, and the spec's I-2 puts
   "per-screen mounts removed" in **Ward Lead's Phase 1.1–1.3** — but those four files are **Lane
   A's**. Two chats editing the same lines is the exact failure the work-claims register exists to
   catch. **Ward Lead rules; Lane A does not choose.**
2. **The legal deadline sentence** — the shipping one names the legal form, the drawing's does not.
   Task D2 hands this back rather than downgrading clinical information.
3. ✅ **ANSWERED 2026-09-10 - it is an OWNER question, and this lane does not build it.** Ward
   Lead: it goes to Josh in the next batch. **Do not build it, and do not remove the one Command
   has.** The finding, kept because the owner will need it:
   ⚠️ **Three of my four screens carry no not-a-medical-device statement.** Only Command renders
   `NotAMedicalDeviceStatement`; the shared `layout.tsx` renders `WardChromeHeader`,
   `WardShellHeader` and `WardGround`, and **not** the statement. The layout's own comment makes the
   argument that anything mounted per screen "is global only by repetition and goes missing from
   whichever screen forgot it" — which is this shape exactly. **Whether the other three should carry
   one is a clinical and product decision, not a restyle.** Recorded, not built.

---

## 5 · Self-review

**Spec coverage.** §4.1 tasks 1–5 → C1, C2, C3, (task 4 is the shell's — nothing to build here), C4.
§4.2 tasks 1–4 → D1, D2 (revised), D3, Z1. §4.3 tasks 1–5 → M1+M2, M3+M4, M5 (revised), M6, M7. §4.4
tasks 1–3 → P1, P2, Z1. §5.0's ten done-conditions are covered by the per-task catchers plus Z1 steps
2–5.

**Placeholders.** None: every code step carries real test code against real imports, and every
"restyle" step names its constraint rather than saying "make it look right".

**Type consistency.** `corridorCounts()` is defined in M3 with the exact shape M4 renders. Every
other function this plan names was verified present on the line at `8c5aebc938`, except the four
facade functions and `WARD_PRIMARY_ACTIONS`, which are Phase 1's and are marked as blocking on the
three tasks that use them.
