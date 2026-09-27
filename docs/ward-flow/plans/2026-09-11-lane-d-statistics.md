# Lane D — the statistics family: foundation and constraints

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` to implement
> the per-screen tasks once **§10** is filled in. Steps use checkbox (`- [ ]`) syntax.
>
> 🔴 **THIS DOCUMENT IS PART ONE OF TWO.** It carries the constraints that bind all four screens, and
> **§9 is the measured section map**. The per-screen tasks are **§10** and are **not yet written**.
> **Do not infer a task from this document; there are none in it yet.**
>
> ⚠️ **This header said "§9" for the tasks until the map landed and took that number.** **A pointer
> that was correct when written and wrong an hour later is the commonest defect this lane has
> measured — and it was in this document, about this document.**

**Goal:** rebuild four statistics screens to their approved drawings without any screen stating
something it cannot support.

**Architecture:** the derivations already exist and the sections mostly do not — this is
presentation work over a settled data layer, with one exception (`dailyFlow`) that is genuinely new.
Each screen keeps one owner for each fact it shows.

**Tech stack:** Next.js App Router, React 19, TypeScript strict, Vitest (unit + DOM), Playwright (E2E).

**Spec:** v2 §6.13–§6.16, plus `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md`
§4.13–§4.16 **as corrected by** `docs/ward-flow/plans/2026-09-10-master-plan-errata.md`.
🔴 **The master plan's §4.13–§4.16 carry four measured errors listed in §3 below. Read the errata
before the plan, not after.**

---

## 1 · Global constraints

Every task's requirements implicitly include this section.

- **Design tokens only.** No hex, no `color-mix`, no shadow inside a panel, no coloured bar on any
  edge, no top highlight. Nothing under 12px in HTML; **SVG text ≥ 10.5px** — this one binds hardest
  on charts. One primary action per panel.
- **Words before colour.** Every state carries text; colour only reinforces a word already present.
  **A chart whose only signal is colour fails this.**
- **Derived, never typed.** Every count, tile, line, tag and reconciliation line is computed from
  state on every render. **A literal figure in JSX is a defect.**
- **Vocabulary.** **discharged**, never _released_. **Ready**, never _Available_ and never
  _Unoccupied_ — ruled once for §4.4 and §4.14 together. A community patient is a team's by the
  explicit team on the referral, never by home area.
- **Privacy — FD-23.** A team sees the decline reason **for its own referrals only**. ⚠️ An aggregate
  that reveals another team's decline reasons breaks a privacy rule, and it passes every test that
  only counts rows.
- **Sex and gender are two fields.** Gender decides the bed; no override on that gate; _not yet
  recorded_ is a distinct third state and is never defaulted from sex. ⚠️ **A statistics page that
  buckets by sex while the operational screens match on gender is a figure whose unit nobody can
  state.**
- **The system never computes acuity.** The referring clinician marks it at referral.
- **The changeable-data rule.** The owner will replace every invented figure with real ones.
  **Nothing may be built that only works for the seed.**
- **Primary bar action** on all four routes is _Export the figures_. A screen never renders a second
  primary.
- **Eight widths, two themes, forced colours, print:** 1920, 1600, 1440, 1280, 1200, 1100, 390, 320.
  Sample at least one width in the 641–1000px band.

---

## 2 · 🔴 The browser tier says nothing about content. Write this into every task.

Measured by Lane E and carried here verbatim, because it changes what "green" means:

| spec                                     | what it asserts                                    |
| ---------------------------------------- | -------------------------------------------------- |
| `ui-ward-statistics-compare.spec.ts:38`  | the **Compare** screen — **not one of these four** |
| `ui-ward-statistics-journey.spec.ts:100` | reachable and readable on a phone                  |
| `ui-ward-statistics-journey.spec.ts:138` | same, second case                                  |
| `ui-ward-statistics-journey.spec.ts:151` | same, third case                                   |

🔴 **Across all four of this lane's screens the browser tier asserts that they load and are readable
on a phone, and nothing about what they say.** The 28 Vitest files / 412 cases carry the entire
content load.

⚠️ **A restyle that breaks a figure, a heading or an absence-wording is caught by the unit suites or
not at all. Never quote a green browser run on these screens as vouching for content.**

---

## 3 · The four measured errors in the master plan's own §4.13–§4.16

Each with the command that shows it. **These are corrections to the document this lane was briefed
from; they are not open questions.**

1. **§4.15 calls Community team statistics a "Restyle". It is a BUILD.**
   `grep -cE 'WardPanel title=|<h2' src/components/ward-management/statistics/statistics-community-screen.tsx` → **3**
   `grep -c '<h2' docs/ward-flow/mockups/statistics-community-third-edition.html` → **12**
   (Lane E counts 7 content sections; either count leaves four to nine sections that do not exist to
   be restyled.) The screen is **245 lines** against ward's **628** and ED's **634**.

2. **§4.16 misattributes `edHomeSummaries` to `statistics-ed-screen.tsx`.**
   `git grep -c edHomeSummaries -- src/components/ward-management/statistics/statistics-ed-screen.tsx` → **0**.
   It lives in `ed/ed-home-derivations.ts` and `ed/ed-home.tsx` — the multi-department ED hub, a
   different screen. 🔴 **Fourth instance of that one module being hung on a screen that does not
   import it. Grep every sourcing line before believing it.**

3. **§4.14's "Not built: anything acuity-related" is false of the MODEL.**
   `git grep -c cuity -- src/components/ward-management/ward-model.ts` → **12**.
   True of the screen only. **"Not built on the screen" and "not built at all" are different claims.**

4. **All four routes need the `/mockups/ward-flow/` prefix.**
   `git ls-tree -r --name-only HEAD -- src/app/statistics | wc -l` → **0**.
   Real routes: `src/app/mockups/ward-flow/statistics/{,ward/[unitId],community/[teamId],ed/[edId]}/page.tsx`.

**And one claim that is right, against the pattern:** `dailyFlow` is **genuinely new** —
`git grep -l dailyFlow -- 'src/**'` → nothing. ⚠️ §4.3's `corridorCounts` was described the same way
and already existed. **Same word, opposite truth, two sections apart. Check each, every time.**

---

## 4.0 · 🔴 RETRACTION — MY "THREE FACTS SHARE ONE PHRASE" CLAIM IS FALSE, AND O-2 WAS RULED ON IT

**I claimed states 4, 5 and 6 all render _"not a measurement"_ for three different facts. A ward-wide
search found that phrase in rendered JSX EXACTLY ONCE. I have re-read all three sentences myself:**

| where                                 | the sentence                                                                       | what it actually is                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `statistics-community-screen.tsx:164` | _"This team's figures **are not a measurement**."_                                 | ✅ **state 6.** The only true instance.                                                           |
| `statistics-ward-screen.tsx:285`      | _"Both charts below are demonstration data, **not a measurement of this ward**."_  | 🔴 **a PROVENANCE disclaimer.** The charts render values — generated ones. Not an absence at all. |
| `statistics-screen.tsx:818`           | _"it is one value repeated, **not a measurement of how long beds take to fill**."_ | 🔴 **a caveat about a DISPLAYED number.** A real average renders. Not an absence at all.          |

🔴 **Three sentences share three words. They do not share a meaning, and two of the three are not
absences.** ⚠️ **I grouped them by substring and inferred a common state from it.**

**That is the bare-word error, committed by me, in the plan that warns about it.** The marker guard's
own note says it exactly: _"a topic word names a SUBJECT, so a bystander clause carries it for free"_
— _"This prototype shows that four beds are ready"_ passed on `prototype`. **Here _"not a
measurement"_ was carried by a sentence about demonstration data and by a sentence about a degenerate
average, and I read both as absences.**

⚠️ **AND IT TRAVELLED.** **O-2 was ruled on this claim and is being drafted for the owner.** 🔴 **If
O-2 exists to give three phrasings to three facts that share one wording, it is aimed at something
that does not exist in that form. Ward Lead must re-aim or withdraw it.**

### 4.0.1 ✅ What the sweep found INSTEAD — and it is a real collision, worse than the one I invented

🔴 **The word `none` means two different states, under two dated owner rulings pointing opposite
ways:**

| file                                                                            | ruling                    | a reported, correct ZERO renders as                                     |
| ------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `statistics-compare-screen.tsx`                                                 | owner, 2026-09-05         | the digit **`0`** — rendering it as "none" was ruled wrong and reverted |
| `capacity-derivations.ts` (`countCellText`), `bed-map.tsx`, `delays-screen.tsx` | owner, 2026-09-05 / 09-06 | the word **`"none"`** — rendering it as `0` was reverted too            |

**And elsewhere — community, ED home, patient search, delays tab counts — `"none"` means state 2, a
checked-empty population.**

⚠️ **So a reader who learns on the capacity screen that _none_ is a ward's own reported figure, and
then reads _none_ on the community screen, has no signal that the guarantee is weaker there.**
**Nothing in the rendered text distinguishes them; only the surrounding sentence does, where there is
one.**

### 4.0.2 Two candidate states the six do not cover

- **Withheld pending an owner decision** — `statistics-screen.tsx:475-482`: _"This figure is withheld
  pending an owner ruling. It is not that no ward declines, and not that declines go unrecorded —
  both happen, and both are in the data right now."_ 🔴 **Nothing is undefined, unrecorded, destroyed,
  unlinkable or too thin. The data is there and publication is blocked on policy.**
- **Blocked by a value outside the known vocabulary** — `statistics-decline-reporting.ts:57-62`,
  reused **verbatim at three call sites**: _"a total computed without that reason would be lower than
  the truth rather than uncertain."_ ✅ **Note the good practice: one wording, three sites, not
  redrafted per screen.**

### 4.0.3 What survives

✅ **The taxonomy stands — all seven states exist and were confirmed independently.** ✅ **Task 1's
union is unaffected: it types the states, and the states are real.** ⚠️ **What does not stand is my
instance, and the ruling built on it.**

---

## 4 · 🔴 The absence vocabulary — six states, and they must stay six

**Do this before any screen, or each screen invents its own.** Measured across the family:

| #   | state                                                    | how it must render                                                 | precedent                                               |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| 1   | **measured nought**                                      | `0` — a true and correct answer                                    | `ward-statistics.ts`                                    |
| 2   | **measured empty**                                       | a state word: _none_, _none named it_                              | `statistics-community-screen.tsx:157`                   |
| 3   | **cannot be formed** — 0 of 0 is undefined, not zero     | worded, flagged `unmeasured`, **never a nought and never a dash**  | `cannotBeFormed()`, `statistics-compare-screen.tsx:332` |
| 4   | **never recorded** — no history is kept                  | worded, with the reason                                            | `statistics-ward-screen.tsx:285`                        |
| 5   | **structurally unmeasurable** — recorded, then destroyed | worded, with the mechanism                                         | `statistics-screen.tsx:338`                             |
| 6   | **join broken** — present but unlinkable                 | worded, with the count                                             | `statistics-community-screen.tsx:164`                   |
| 7   | **below the minimum sample** — computable, suppressed    | `Not enough data to compute`, **with the denominator still shown** | `ward-management-modes.tsx:248`                         |

🔴 **States 4, 5 and 6 all currently render the phrase _"not a measurement"_, and they are three
different facts** — _never recorded_ · _recorded but structurally destroyed_ · _recorded and
unlinkable_. Each explains its own reason in the sentence that follows, so none of them is lying
today. ⚠️ **That is exactly what makes it survivable and invisible: a reader who learns the phrase on
one screen learns the wrong thing for the other two, and the explanation that saves each one is
local to it.**

**The job is NOT to pick one wording.** It is to:

- keep the six states distinct;
- give states 3–6 a **structured representation** in the shape of `cannotBeFormed()` rather than
  bespoke prose per screen;
- **stop _"not a measurement"_ carrying three meanings.**

⚠️ **`Not enough data to compute` is a bare JSX literal in one span on a screen this lane does not
own** — there is no shared component, no helper and no exported constant
(`grep -rn 'export const.*Not enough data\|NOT_ENOUGH_DATA' src/` → none). **If this lane needs it in
more than one place it becomes a shared thing, not a second literal. Copying a literal between
screens is how this family came to have several wordings.**

### 4.1 Suppression is decided at the render, never in the derivation

Carried verbatim from `ward-management-modes.tsx:238`, because it is the reasoning and not just the
rule:

> _"It is decided HERE and not in `effectivenessNumbers`, deliberately. Suppressing in the derivation
> gutted five unit tests that exist to prove the median arithmetic … they feed it two and three
> movements on purpose. **A publishing rule enforced inside the calculation stops the calculation
> being testable at the sizes it is interesting at.** The derivation computes; this decides what a
> reader is shown."_

### 4.2 A suppressed figure still shows its denominator

`ward-management-modes.tsx:235` renders **"from 1 of 27"** beside _"Not enough data to compute"_ —
_"which is what makes the absence informative rather than merely blank."_

⚠️ **This matters more here than it does there.** A community team shown _"not enough data"_ with no
denominator cannot tell a **suppressed** figure from a **broken** one — states 7 and 6, which this
section exists to keep apart.

---

## 5 · The limits panel, and the thing it cannot do

`statistics-community-screen.tsx:221` renders _"What this page cannot see"_, naming the count of
admissions belonging to no team, out of the total, and saying:

> _"That absence is invisible by construction: the counts above look exactly as they would if those
> people did not exist."_

**Propose it as the pattern for all four screens.** It is the best whole-screen absence artefact in
the repository and the other three have nothing like it.

⚠️ **But a limits panel is a SECOND PLACE by construction — the figures are above and the limit is
below.** Contrast `hub-derivations.ts:120`, where the `" (placeholder)"` suffix travels **inside the
value**, _"at the point of the claim, on every screen that renders the name, without a second
disclosure that can drift out of step with the first."_

🔴 **So: the panel is the right pattern for a whole-screen limit, and a per-figure claim still wants
its marker on the figure. Those are two different jobs and the panel only does one of them.**

**The evidence for why this distinction is load-bearing** — every marker failure measured on this
programme is a screen holding a figure in one place and its provenance in another:

| case                        | shape                                                     | outcome                       |
| --------------------------- | --------------------------------------------------------- | ----------------------------- |
| Community statistics (§7)   | a refusal in one panel, the same figure bare in a sibling | **two sources, they drifted** |
| §U (Lane C, Patient search) | a correct refusal, contradicted by a sibling live region  | **two sources, they drifted** |
| Search hub (closed)         | the marker travels inside the value                       | **one source, cannot drift**  |

---

## 6 · Rulings that bind these screens

- **D-36 — _Referrals into this ward / into the team_.** Presentation, **conditional**: confirm the
  derivation answers the drawing's question. Referrals _received_ and referrals _that reached a bed_
  are different denominators; **if they differ it becomes a new question and goes back to Ward Lead.**
- **D-37 — _Clinically ready, not yet gone_.** The heading must name its subject, because _ready_
  means a ready **bed** and a patient ready to **leave**.
- 🟢 **D-38 — _People currently in a hospital bed_ (community). BUILDABLE. The threshold is FIVE and
  it is on the record.** The count shows only where it cannot single somebody out — a four-case team
  with one person in hospital renders "1", and to anyone who knows that caseload that is the person
  named.

  **Verified at `58f145ecf6`:** `git grep "THE THRESHOLD IS FIVE"` resolves in
  `docs/ward-flow/owner-decisions-2026-09-1x.md`, with the owner's word quoted and
  `MINIMUM_EFFECTIVENESS_SAMPLE = 5` (`ward-derivations.ts:1658`) named as the precedent.
  **Read the number from there, not from this plan** — a plan is a second copy and second copies
  drift, which is the same argument as the marker brief's §2.

  **Build:** below five, suppress the count, render `Not enough data to compute`, **and keep the
  denominator** — `ward-management-modes.tsx:235`'s _"from 1 of 27"_ pattern (§4.2). ⚠️ **Without the
  denominator a team cannot tell a withheld figure from a broken one — states 7 and 6 of §4.**

  🔴 **A named exported constant beside its citation, never a literal at the call site** — the ruling
  now says so itself: _"a privacy threshold hard-coded where it is used is a number nobody can find
  when it needs changing."_

  ⚠️ **Kept because it is the transferable half:** for several hours the rule was citable and the
  number was not, and this plan said so rather than hard-coding a relayed value. **The ruling now
  records why it carries its own number.** **A privacy threshold is the worst value on a screen to
  take from a message, and "the rule is committed" is not "the whole ruling is committed".**

- **D-39 — _Contacts_ and _Time to first contact_.** **HELD, build neither**, pending §7.
- 🔴 **D-42 — _Referrals into this ward_ is ruled.** **Bare accepted and declined counts. No share, no
  percentage.** A share needs referrals _received_ as its denominator and **a referral is never
  addressed to a named ward**: the `psychiatric_ward` destination arm carries no unit id, and
  `acceptedUnitId` names the unit that **answered**. The section says so in its own words.
  ⚠️ **NOT the _"Not enough data to compute"_ form — that means computable-but-too-thin. This is not
  computable at all, and one wording may not serve two states.**
  🔴 **The trap:** `emergency_department` carries `edId` and `community_team` carries `teamName`, so
  **both sibling sections with near-identical titles ARE derivable.** **Reasoning by analogy from
  either sibling ships a percentage with an invented denominator. A shared layout invites the
  assumption of a shared model, and the model is where they differ.**
- **No high-acuity demand panel.** The seed never requests high-acuity nursing: nine seeded referrals
  all `false`, and the only `true` in `src/` is the intake form's own radio handler. **A panel
  counting high-acuity demand reads a hard zero for every ward, permanently** — true of the seed and
  uninformative about anything else. The seed decision sits with Ward Lead.

---

## 7 · 🔴 A known contradiction on this lane's own screen — settle before touching it

`statistics-community-screen.tsx`:

- **Panel _This team, in figures_** refuses to call the figure a measurement when the join cannot
  run: _"A zero above would be a confident answer over a question that was never asked."_
- **Panel _Where this team sits_** then prints the same figure as a bare number, with
  `aria-current="true"` on this team's row, **no caveat**.
- `communityMembershipResolution(admissions, team, referrals)` is called **for the viewed team only**
  (line 97). `allTeams` (line 99) computes every other team's counts and **never computes their
  resolution**. **The structural gap is real.**
- **Nothing tests any of it:** no test names `community-compare`; no test names
  `ward-statistics-community-not-computable`; the only DOM test for this screen is the chooser.

### 7.1 🔴 CORRECTION — this section first said something the render disproved

**I wrote:** _"the same number is a refusal on one page and a bare count on another, and the
difference is only which team you opened."_ **That is WRONG and the correction is measured, not
argued.**

`community-derivations.ts:385` — `admissionsWithUnresolvableReferral(admissions, referrals)` takes
**all** admissions, not the team's. And line 384 returns early: **a team with members is never
not-computable, even while other records are broken.**

🔴 **So the trigger is GLOBAL. One dangling referral anywhere flips every memberless team at once —
measured at 62 of 64, including `albany`, which has no connection to the broken record.** **The page
and the table therefore can never disagree about WHICH teams are computable: they are all computable
or none are.**

⚠️ **What survives is smaller and still worth fixing: the page SAYS the state and the table does
not.** Rendered today — **not-computable on 0 of 64, measured-empty on 62, members on 2, and zero
caveat wording anywhere in the comparison table.** **Every figure in that table is truthful today.**

**So build it as: the comparison table carries the resolution state, or says it is not checking.**
**Not per team** — the trigger is global, so per-team resolution is a more expensive way to compute
one boolean.

**Severity, measured in the browser:** the guard sentence's top is at **629px** and the comparison
panel's at **706px** in a 900px viewport. 🔴 **Twenty-nine pixels of gap — the sentence and the
figure it disclaims are in one screenful with no scrolling. Source adjacency turned out to be visual
adjacency.**

⚠️ **The lesson for this lane, and it binds every task below:** a static read gives honest
co-mounting and cannot give severity. **The half I could not reach is the half that moved.** **Do not
upgrade a "cannot determine" to a verdict because you are the one who needs the answer.**

🔴 **What the render did NOT establish:** anything about screen readers or keyboard reach.
`visible` is geometry and computed style. **Whether that sentence is ANNOUNCED, and in what order
relative to the table, is a separate question and is unanswered.**

### 7.1.1 🔴 SHARPER — THE REFUSAL NAMES A ZERO, AND THE ZERO RENDERS FOUR LINES ABOVE IT, IN THE SAME PANEL

**My §7 and §7.1 both looked at the wrong panel. The primary defect is inside _This team, in figures_
itself.**

    line 124   <td data-testid="…-value-admitted">{lists.currentlyAdmitted.length}</td>   UNCONDITIONAL
    lines 162-170  the refusal: "A zero above would be a confident answer over a question
                   that was never asked."

**Measured by me, and the zero is PROVABLE, not merely possible:**

    community-derivations.ts:384   if (ours.length > 0) return { state: "members" };
                                   → "not-computable" implies ours.length === 0
    community-derivations.ts:280   const currentlyAdmitted = ours.filter(bedIsOccupied);
                                   → a SUBSET of ours, so provably 0 in that state
    the cell's surrounding block   ZERO references to `resolution` — no gate at all

🔴 **So whenever the refusal renders, the cell above it renders `0` — the exact figure the refusal
says must not be trusted. The refusal points at it by name and it is displayed anyway.** ⚠️ **All four
rows are subsets or siblings of `ours`, so all four cells read `0` in that state.**

**And a reader stepping cell by cell — a screen reader, a table scan, a copied row — meets the zero
without the paragraph.** **The paragraph is four lines below in source and below in reading order; it
is not attached to the cell.**

✅ **THIS IS THE BRIEF'S CENTRAL CLAIM, CONFIRMED ON THIS LANE'S OWN SCREEN.** The caveat is a second
place; the cell is the value; they disagree — **and this instance is worse than the four in the
brief's §1 table, because the second place explicitly names what it is disclaiming and the disclaimed
thing renders regardless.**

**So the fix changes:**

|                      | I had planned                                            | what it must be                                                                                               |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| primary              | make the **comparison table** carry the resolution state | 🔴 **make the FIGURES TABLE stop rendering a disclaimed zero**                                                |
| the cell in state 6  | a `0` with a caveat below                                | **a worded absence IN THE CELL** — `cannotBeFormed()`'s shape (§4 state 3/6), never a nought and never a dash |
| the comparison table | carries the state                                        | **still true, and still second in order**                                                                     |

⚠️ **This is the §4 taxonomy doing its job: a broken join is state 6, and state 6 does not render as a
nought. The screen currently renders state 6 as state 1 and apologises underneath.**

### 7.2 Two defects handed to this lane with the render, neither chased by its finder

1. **The guarded sentence's singular branch does not agree with itself.**
   `statistics-community-screen.tsx:164` renders _"1 admission carries a referral **that point at** no
   referral held here"_. The plural branch is correct; the singular is not. **One word, and it is on
   the sentence whose whole job is to be read carefully.**

2. 🔴 **TWO DIFFERENT 71s EXIST IN THIS LANE'S WORK AND THEY ARE UNRELATED.** The marker brief's
   **71 marker call sites** is an AST count of places rendering a figure. The **71** below is a doc
   comment about **team name strings**. ⚠️ **Anybody quoting a bare "71" has a coin-flip on which.**
   **Always qualify it.**

   🟢 **RESOLVED — THE NUMBER THAT SHIPS IS 64.** Measured by executing the production code itself
   (`communityTeamOptions()` and `COMMUNITY_TEAM_PAGES` imported and run from this checkout), and
   independently cross-checked by replaying the split/normalise/group logic over the raw 537-row
   catchment table. **Both methods returned 64.**

   **Why the comment says 71/65:** it was written 2026-08-31 and was correct then. On 2026-09-06 a
   data typo was fixed — two suburbs routed to `"Midalnd"`, a transposed misspelling naming no real
   place — and that commit's own message records `COMMUNITY_TEAM_PAGES 65 → 64`. ⚠️ **The comment is
   one commit stale, not wrong by formula: the six duplicate-spelling pairs it describes are real and
   still measure exactly as it says.**

   🔴 **FOUR PRODUCTION COMMENTS STILL SAY 71/65** — `referral-destination-options.ts:171-172`,
   `community-teams-table.tsx:47-54`, `community-home.tsx:79`, plus older seed and model comments.
   ⚠️ **Roughly twenty test files assert against the length computed LIVE, never a literal — which is
   why the suite stayed green through 65 → 64 while the comments did not.** **A test that computes its
   expectation from the code cannot catch a comment that states it.**

   **What this screen uses:** `COMMUNITY_TEAM_PAGES.length`, computed live — **never a typed number,
   and never `COMMUNITY_TEAMS`**, which is the unrelated ten-entry region placeholder table belonging
   to the Search hub. **It is already rendered live at `statistics-community-screen.tsx:77` in a
   user-facing sentence, and it drives the 64 rows of the comparison table.**

   ⚠️ **O-1 binds that table directly: 64 rows is the widest thing on any of these four screens, and
   at narrow widths it must scroll sideways AND SAY SO.**

   **Historic note, kept because it is the transferable half:**

   ⚠️ **`communityTeamOptions()`'s doc comment says _"71 distinct strings for 65 clinics"_ and the
   function returns **64**.** **Three numbers, and at most one of them describes what ships.**
   🔴 **This is on this screen's own data path** — the comparison table iterates
   `COMMUNITY_TEAM_PAGES`, so whatever that count really is, it is the denominator of every row in
   it. **Measure it before building the table; do not carry the comment's number into a sentence.**

---

## 8 · Baseline — record before a line moves

**Use Lane E's baseline at `57e9d81543`. Do not re-derive it.** Justification, measured:

```
git merge-base --is-ancestor 57e9d81543 <line>   → NOT an ancestor (diverge 2 and 2)
git log --oneline 57e9d81543 --not <line>        → two MERGES OF THE LINE INTO Lane C's branch
git diff --name-only 57e9d81543 <line>           → 3 files, ALL under docs/, ZERO src, ZERO tests
```

⚠️ **"Not an ancestor" says the trees diverged; it does not say by what.** Stopping there would have
cost a re-derivation for two documentation commits. **`differs` is not `differs in anything that
matters`.**

| tier                                      | collected | passed | skipped | failed                     |
| ----------------------------------------- | --------- | ------ | ------- | -------------------------- |
| offline ward suite                        | 4606      | 4531   | 75      | 0 — 386 handed in, 386 ran |
| statistics suites (28 Vitest files)       | 412       | 412    | 0       | 0                          |
| `tsc -p tsconfig.typecheck.json --noEmit` | —         | —      | —       | exit 0                     |
| `ui-ward-statistics*` (2 specs)           | 4         | 4      | 0       | 0                          |

🔴 **EXPIRY CONDITION.** This baseline holds only while no source or test file diverges between the
two trees. **D-30 and D-40 are in flight.** Re-run all three commands above before quoting it again;
when it fails, **say the baseline expired** rather than treating it as a problem.

⚠️ **The runner never prints a skipped line.** It closes _"OK — all 386 handed-in file(s) ran, 4531
test(s) passed."_ **The 75 exists only by subtraction. Record `collected / passed / skipped / failed`
per tier or the skipped count is lost.**

⚠️ **Use `tsconfig.typecheck.json`, never bare `npx tsc --noEmit`** — the base config reads stale
`.next/` route types and reports errors that do not exist in source.

---

## 9 · The section map

**Measured by an AST-free but comment-checked read of all four drawing/built pairs. This is the input
§10's tasks are written from.**

| screen                    | drawn | built | same | renamed | **absent** | built-only |
| ------------------------- | ----- | ----- | ---- | ------- | ---------- | ---------- |
| Statistics (top)          | 11    | 14    | 1    | 0       | **10**     | 13         |
| Ward statistics           | 11    | 15    | 1    | 6       | **4**      | 7          |
| Community team statistics | 12    | 4     | 0    | 1       | **11**     | 3          |
| ED statistics             | 15    | 14    | 0    | 4       | **11**     | 8          |

🔴 **Only Ward statistics is a restyle.** Six of its eleven drawn sections exist under other names —
_Beds now_ → _Bed capacity right now_, _Occupancy over the window_ → _Occupancy and readiness over
time_, _Clinically ready, not yet gone_ split across two built subsections. **The other three screens
are builds.**

⚠️ **The top Statistics screen is a build too, and §4.13 does not say so.** **Ten of eleven drawn
sections are absent** — no headline band, no _Flow over time_, no per-ward, per-ED or per-team ranking
table, no _Referrals for a bed_ — **against thirteen built-only panels that the drawing does not
have.** **Q-12 binds all thirteen.**

### 9.1 🔴 A CONTRADICTION BETWEEN Q-12 AND THE DRAWING — this needs a ruling, not a build decision

**The community drawing's own rendered scope note says:**

> _"A fixed period view of this team's own numbers, **not a comparison against any other team**.
> Every count below belongs to this team and to this reporting window … and never to the network."_

**The built screen has `WardPanel title="Where this team sits"` at line 181 — a table of every team's
figures.** **Q-12 says keep every panel; §4.15 Task 4 says keep this one, last.**

🔴 **So building the drawing faithfully and obeying Q-12 produces a screen that renders a sentence
saying it is not a comparison, directly above a comparison.** ⚠️ **That is the §U shape, and it would
be BUILT IN rather than drifted into — a contradiction shipped on day one by following two correct
instructions.**

### 9.1.1 🟢 RULED — D-44: keep the panel, reword the note

**The note's purpose survives a carve-out; the panel's does not survive deletion.** The note exists to
stop a reader taking this team's counts for network counts — **that job is done by naming which
figures are the team's, not by denying a comparison exists anywhere on the page.** And Q-12 is the
owner's ruling while the drawing is an artefact that has been the stale one three times this week.

🔴 **A carve-out, not a softening. A note saying "mostly not a comparison" is worse than the
contradiction, because it is vague where the current one is merely wrong.**

**PROPOSED WORDING — awaiting Ward Lead's one-line ruling. Not to be built until then.**

> A fixed period view of this team's own numbers. Every count in **This team, in figures** belongs to
> this team and to this reporting window, never to the network. **Where this team sits** is the one
> panel that is network-wide, and it says so in its own words: it shows every team the referral form
> can name, so this team can tell whether its own numbers are unusual. It is a read only view:
> nothing here opens a case, accepts a referral or books a contact.

**What it changes from the drawing's note, and why each:**

| change                                            | reason                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| drops _"not a comparison against any other team"_ | it is the false half — the page does compare                                                                                 |
| names the two panels by their **rendered titles** | a scope claim that names no panel cannot be checked against the screen                                                       |
| replaces _"unless the figure says otherwise"_     | ⚠️ that is a vague escape hatch — it makes the claim unfalsifiable, which is worse than the carve-out it was standing in for |
| gives the comparison's **reason**                 | a reader who knows why the exception exists can tell whether it has grown                                                    |
| keeps the read-only clause verbatim               | it is true and unrelated                                                                                                     |

⚠️ **`Where this team sits` already carries its own note** — _"Every team the referral form can name,
in the order that form offers them — never a ranking, and never a subset."_ **The wording above points
at it rather than repeating it, so there is one description of the comparison and not two that can
drift.**

🔴 **This panel now has TWO rulings against it and they build in order:** D-44 says it may exist; the
§7 resolution-state question says what it must carry. **Do not build the second before the first is
confirmed.**

### 9.2 Other findings from the map that change a task

- 🟢 **RULED — ED's _"A department is not a ward"_ RENDERS.** The claim — _a department has no beds,
  no capacity, no length of stay_ — exists **twice in `statistics-ed-screen.tsx` and both are inside
  `/** */` comments**, so a reader never sees it. **The drawing has it as an `h3` and that is right: a
  claim that prevents a category error belongs on the screen, not in the file.** ⚠️ **Fourth instance
  this week of a correct statement living where only a builder reads it.**
- 🔴 **ED's drawing is ONE page with a tab switcher over all eight departments; the built route is
  per-department.** Six of the drawing's ten headings are filled by script into empty `<section>`
  elements. **This is structural, it reaches the route table, and it is WARD LEAD'S — recorded here
  and deliberately NOT resolved in this plan.**
- **Community: two drawn sections exist as single table ROWS, not sections** — _Discharges from
  hospital into this team's care_ → the row _"Discharged into the area"_; _People currently in a
  hospital bed_ → the row _"In a bed, or holding one"_. ⚠️ **The drawn version of the latter is a
  table of named people with ward and site. D-38 governs it and the named-people form is not what
  D-38 permits.**
- **Ward and Community both move the subject's name from an `h2` into the dynamic `h1`** — and the
  drawings' generic titles (_"Ward statistics"_, _"Community team statistics"_) **appear nowhere in
  the built screens.**
- ⚠️ **Neither Statistics nor Ward nor Community renders a provenance section.** The drawings each
  carry one — _"What is invented and what is real"_, _"What this page is, and what is invented"_,
  _"What is invented, and what is real"_. **All three are ABSENT.** 🔴 **That is the marker brief's
  subject, on three of four screens, and it is why the brief goes before the screens.**

---

## 10 · Tasks — tranche 1

**Scope of this tranche, stated so it is not read as the whole plan:** the shared absence vocabulary,
and the two community-screen repairs that depend on it. 🔴 **Tranche 2 — the thirty-two absent
sections — is written when tranche 1 lands, not before, because tranche 1 decides the shape every one
of them renders an absence in.**

⚠️ **Do not infer a tranche-2 task from §1–§9.** A task here names its files, its interfaces, its
failing test, the command that runs it, and its commit — or it is not a task.

**Run one test file with:** `node scripts/run-vitest.mjs run <path>`
**Iterate with:** `npm run test:focused -- --files <paths>`
**Typecheck with:** `npx tsc -p tsconfig.typecheck.json --noEmit` — ⚠️ **never bare `tsc --noEmit`; the
base config reads stale `.next/` route types and reports errors that do not exist in source.**

---

### Task 1: the absence vocabulary, as values

**Why first:** §4 measured six states plus the minimum-sample case, three of which render the same
phrase for three different facts. **Every section in tranche 2 renders at least one of them.** Build
the vocabulary once or each of the thirty-two invents its own — which is how this family came to have
several wordings for one state.

**Files:**

- Create: `src/components/ward-management/statistics/statistics-absence.ts`
- Create: `tests/ward-statistics-absence.test.ts`

**Interfaces:**

- **Produces:** `type StatisticsFigure`, and the constructors `measured(value)`, `empty(words)`,
  `cannotBeFormed(words)`, `neverRecorded(words)`, `destroyed(words)`, `unlinkable(words)`,
  `belowMinimum(words, denominator)`; plus `figureText(figure)` and `isUnmeasured(figure)`.
- **Consumes:** nothing.
- 🔴 **The structural guarantee later tasks rely on: a non-measured figure has NO numeric field, so a
  caller cannot render it as a number.** This is §3.1 of the marker brief applied to absence — the
  state travels inside the value rather than in a paragraph beside it.

- [ ] **Step 1: write the failing test**

```ts
// tests/ward-statistics-absence.test.ts
import { describe, expect, it } from "vitest";

import {
  belowMinimum,
  cannotBeFormed,
  destroyed,
  empty,
  figureText,
  isUnmeasured,
  measured,
  neverRecorded,
  unlinkable,
} from "@/components/ward-management/statistics/statistics-absence";

describe("a statistics figure carries its own state", () => {
  it("renders a measured nought as a nought, because zero is a true answer", () => {
    expect(figureText(measured(0))).toBe("0");
    expect(isUnmeasured(measured(0))).toBe(false);
  });

  it("never renders an unmeasured state as a nought or a dash", () => {
    for (const figure of [
      empty("none"),
      cannotBeFormed("no outcomes yet"),
      neverRecorded("never recorded"),
      destroyed("the start is overwritten by the act that ends it"),
      unlinkable("the join cannot run"),
      belowMinimum("Not enough data to compute", "from 1 of 27"),
    ]) {
      expect(figureText(figure)).not.toBe("0");
      expect(figureText(figure)).not.toBe("—");
      expect(isUnmeasured(figure)).toBe(true);
    }
  });

  it("keeps the denominator on a suppressed figure, so a withheld figure is not a broken one", () => {
    expect(figureText(belowMinimum("Not enough data to compute", "from 1 of 27"))).toContain("from 1 of 27");
  });

  it("gives the three facts that share 'not a measurement' three distinct kinds", () => {
    const kinds = [neverRecorded("a"), destroyed("b"), unlinkable("c")].map((f) => f.kind);
    expect(new Set(kinds).size).toBe(3);
  });
});
```

- [ ] **Step 2: run it and watch it fail**

Run: `node scripts/run-vitest.mjs run tests/ward-statistics-absence.test.ts`
Expected: **FAIL** — `Cannot find module '.../statistics-absence'`.
⚠️ **A pass here means the module already exists; stop and find out why before writing it.**

- [ ] **Step 3: write the module**

```ts
// src/components/ward-management/statistics/statistics-absence.ts

/**
 * 🔴 A FIGURE CARRIES ITS OWN STATE, AND AN UNMEASURED ONE HAS NO NUMBER TO RENDER.
 *
 * Six states were measured across this family (plan §4) and three of them rendered the same phrase
 * — "not a measurement" — for three different facts: never recorded, recorded then destroyed, and
 * present but unlinkable. Each explained itself in the sentence that followed, so none was lying,
 * which is exactly what made the collision survivable and invisible.
 *
 * ⚠️ The union below is the fix, and it is structural rather than editorial: only `measured` has a
 * `value`, so a caller CANNOT render an unmeasured state as a number. The community screen rendered
 * a broken join as a nought and apologised four lines below it; this type makes that unspellable.
 */
export type StatisticsFigure =
  | { readonly kind: "measured"; readonly value: number }
  | { readonly kind: "empty"; readonly words: string }
  | { readonly kind: "cannot-be-formed"; readonly words: string }
  | { readonly kind: "never-recorded"; readonly words: string }
  | { readonly kind: "destroyed"; readonly words: string }
  | { readonly kind: "unlinkable"; readonly words: string }
  | { readonly kind: "below-minimum"; readonly words: string; readonly denominator: string };

export function measured(value: number): StatisticsFigure {
  return { kind: "measured", value };
}
export function empty(words: string): StatisticsFigure {
  return { kind: "empty", words };
}
export function cannotBeFormed(words: string): StatisticsFigure {
  return { kind: "cannot-be-formed", words };
}
export function neverRecorded(words: string): StatisticsFigure {
  return { kind: "never-recorded", words };
}
export function destroyed(words: string): StatisticsFigure {
  return { kind: "destroyed", words };
}
export function unlinkable(words: string): StatisticsFigure {
  return { kind: "unlinkable", words };
}

/**
 * ⚠️ The denominator is REQUIRED, not optional. `ward-management-modes.tsx:235` renders "from 1 of
 * 27" beside its suppression, "which is what makes the absence informative rather than merely
 * blank" — and on a community team page it is what lets a reader tell a WITHHELD figure from a
 * BROKEN one. Those are states 7 and 6 and they must never look alike.
 */
export function belowMinimum(words: string, denominator: string): StatisticsFigure {
  return { kind: "below-minimum", words, denominator };
}

export function isUnmeasured(figure: StatisticsFigure): boolean {
  return figure.kind !== "measured";
}

export function figureText(figure: StatisticsFigure): string {
  if (figure.kind === "measured") return String(figure.value);
  if (figure.kind === "below-minimum") return `${figure.words} ${figure.denominator}`;
  return figure.words;
}
```

- [ ] **Step 4: run it and watch it pass**

Run: `node scripts/run-vitest.mjs run tests/ward-statistics-absence.test.ts`
Expected: **PASS**, 4 tests.
Then: `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0.
⚠️ **Vitest does not typecheck. Run both, always.**

- [ ] **Step 5: commit**

```bash
git add src/components/ward-management/statistics/statistics-absence.ts tests/ward-statistics-absence.test.ts
git commit
```

---

### Task 2: the community figures table stops rendering a disclaimed zero

**Why:** §7.1.1. The cell renders `{lists.currentlyAdmitted.length}` unconditionally; the paragraph
four lines below says a zero there would be _"a confident answer over a question that was never
asked"_. When the refusal renders, that zero is **provable** — `communityMembershipResolution` returns
`members` early when the team has any, and `currentlyAdmitted` is a filter of that same set.

**Files:**

- Modify: `src/components/ward-management/statistics/statistics-community-screen.tsx` (the four
  `<td>` cells in _This team, in figures_, around lines 122–148)
- Create: `tests/ward-statistics-community-unlinkable.dom.test.tsx`

**Interfaces:**

- **Consumes:** Task 1's `StatisticsFigure`, `measured`, `unlinkable`, `figureText`, `isUnmeasured`.
- **Produces:** nothing new for later tasks.

- [ ] **Step 1: write the failing test**

```tsx
// tests/ward-statistics-community-unlinkable.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";

/**
 * 🔴 A BROKEN JOIN IS NOT A NOUGHT. The screen used to render one and apologise below it — and the
 * apology names the nought it is disclaiming, so a reader stepping cell by cell met the figure and
 * never reached the sentence.
 */
describe("the figures table, when the join cannot run", () => {
  it("renders no nought in any figure cell while the not-computable sentence is showing", () => {
    renderWithUnlinkableAdmissions();

    expect(screen.getByTestId("ward-statistics-community-not-computable")).toBeInTheDocument();
    for (const id of [
      "ward-statistics-community-value-admitted",
      "ward-statistics-community-value-expected",
      "ward-statistics-community-value-discharged",
      "ward-statistics-community-value-other",
    ]) {
      expect(screen.getByTestId(id).textContent?.trim()).not.toBe("0");
    }
  });

  it("still renders a nought when the join RAN and the answer really is none", () => {
    renderWithMeasuredEmpty();

    expect(screen.queryByTestId("ward-statistics-community-not-computable")).toBeNull();
    expect(screen.getByTestId("ward-statistics-community-value-admitted").textContent?.trim()).toBe("0");
  });
});
```

⚠️ **`renderWithUnlinkableAdmissions` and `renderWithMeasuredEmpty` are written against this repo's
existing ward-flow test harness — copy the provider setup from
`tests/ward-statistics-community-chooser.dom.test.tsx`, which already mounts this screen.** 🔴 **The
second case is the control: without it this test passes on a screen that renders words for
everything, including a true nought — which would break §4 state 1.**

- [ ] **Step 2: run it and watch BOTH cases fail for the right reasons**

Run: `node scripts/run-vitest.mjs run tests/ward-statistics-community-unlinkable.dom.test.tsx`
Expected: the first case **FAILS** (the cell renders `0`); the second case **PASSES** already.
🔴 **If the first case passes before the change, the fixture is not reaching the not-computable state
— fix the fixture, not the assertion.**

- [ ] **Step 3: change the four cells to carry a figure**

Compute each cell as a `StatisticsFigure` rather than a number: `measured(n)` when
`resolution.state !== "not-computable"`, and `unlinkable("the join cannot run for these records")`
when it is. Render `figureText(figure)` and set `data-unmeasured={isUnmeasured(figure) || undefined}`.
⚠️ **Do not delete the explanatory paragraph — it carries the count of unresolvable records, which the
cell cannot.** **It stops being the only place the state is stated; it does not stop being useful.**

- [ ] **Step 4: run both cases, then the screen's existing suite, then typecheck**

Run: `node scripts/run-vitest.mjs run tests/ward-statistics-community-unlinkable.dom.test.tsx` → PASS
Then: `npm run test:focused -- --files src/components/ward-management/statistics/statistics-community-screen.tsx`
Then: `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0.
⚠️ **The browser tier asserts nothing about what this screen says (§2). These unit runs are the whole
proof.**

- [ ] **Step 5: commit**

---

### Task 3: D-44 — the scope note carves out the comparison

**Approved wording (Ward Lead, unchanged from the proposal in §9.1.1), bold on the panel titles:**

> A fixed period view of this team's own numbers. Every count in **This team, in figures** belongs to
> this team and to this reporting window, never to the network. **Where this team sits** is the one
> panel that is network-wide, and it says so in its own words: it shows every team the referral form
> can name, so this team can tell whether its own numbers are unusual. It is a read only view:
> nothing here opens a case, accepts a referral or books a contact.

**Files:**

- Modify: `src/components/ward-management/statistics/statistics-community-screen.tsx`
- Create: `tests/ward-statistics-community-scope-note.dom.test.tsx`

- [ ] **Step 1: write the failing test** — pin the sentence verbatim, and pin that it names both
      panels by their rendered titles:

```tsx
it("names both panels by the titles that render, so the claim can be checked against the screen", () => {
  renderCommunityScreen();
  const note = screen.getByTestId("ward-statistics-community-scope-note");
  expect(note.textContent).toContain("This team, in figures");
  expect(note.textContent).toContain("Where this team sits");
  expect(note.textContent).not.toContain("not a comparison against any other team");
  expect(note.textContent).not.toContain("unless the figure says otherwise");
});
```

🔴 **The two negative assertions are the point.** _"Not a comparison against any other team"_ is the
false half. _"Unless the figure says otherwise"_ is worse than false — **it makes the claim
unfalsifiable, which is why it goes.**

- [ ] **Step 2: run it and watch it fail** — the note does not exist under that test id yet.
- [ ] **Step 3: render the note** with `data-testid="ward-statistics-community-scope-note"`, the
      titles in `<strong>`.
- [ ] **Step 4: run it, the screen's suite, and the typecheck.**
- [ ] **Step 5: commit.**

---

### 🔴 D-45 — the seed decision, and the clause that binds every test in both tranches

**RULED: the seed gains the high-acuity referral AND more person links, as ONE change, AFTER the last
of the four statistics screens folds.**

- **D-45a** — one change, one commit, one re-baseline. Both are the same question: _does the fixture
  exercise the arm the code supports._
- **D-45b** — ⚠️ **the trigger is a checkable EVENT, not a mood: the fold of the last of the four
  screens.** **Not "when the round settles" — a deferral conditioned on a feeling has nobody to
  un-defer it.**
- 🔴 **D-45c — NO NEW WARD TEST MAY ASSERT A SEED-DERIVED COUNT AS A LITERAL. Compute it from the
  seed.** **This binds every task in tranche 2 and it stands whether or not D-45 ever fires.**
- **D-45d** — the person links must leave a population of nulls; the default-deny guard needs its
  negative case as much as its floor.
- **D-45e** — the high-acuity referral must fire the gate's interesting arm, and the test proving it
  **asserts the arm, not a count**.

⚠️ **What D-45c means here concretely:** **take the statistics baselines COMPUTED and D-45 costs this
lane nothing when it lands; take them as numbers typed into a file and D-45 invalidates the whole
tier.** ✅ **It is already true of roughly twenty ward test files — which is exactly why the suite
stayed green through the team count going 65 → 64 while four prose comments did not.**

🔴 **Tranche 1 already complies and the distinction is worth stating, because it is easy to get
backwards:** Task 2's `toBe("0")` asserts a **rendering shape** over a **hand-built fixture with no
admissions** — the nought is a property of that fixture, not of the seed. **A literal is only
forbidden where the seed is what produces it.**

⚠️ **And §8's baseline table is a HISTORICAL MEASUREMENT, not a test assertion.** It stays as numbers
**because it carries its SHA and its expiry condition** — a record of what was true at a named commit
is not a claim about what the seed contains now.

## 11 · Tranche 2 — the community screen, one screen at a time

**Scope: the community screen only.** ⚠️ **The other three screens' tranches are written when this one
lands.** 🔴 **"One screen at a time with proof at each step" is a ruling, and writing four screens'
tasks now would be writing three screens' guesses.**

**Its section map (§9): 12 drawn, 4 built, 11 ABSENT. This is a build.**

### 11.0 🔴 The order, and why the provenance section goes FIRST

**The drawing's _"What is invented, and what is real"_ is ABSENT — and it is absent on three of the
four screens in this family.**

✅ **It goes first, ahead of every figure section, and the reason is the marker brief's own finding:**
**every figure this screen gains between now and the end of tranche 2 is a figure that will need its
provenance.** ⚠️ **Building six figure sections and then adding the provenance is the two-place
pattern by construction — the figures land first and the disclosure catches up, which is exactly how
all four cases in the brief's §1 table began.**

🔴 **And it is cheap now and expensive later: the sections do not exist yet, so nothing has to be
retrofitted.**

### 11.0.1 🔴 CORRECTION — §11.1's "buildable" COLUMN IS WRONG. FOUR OF THE FIVE NEED MODEL WORK.

**I wrote §11.1 an hour ago calling five sections buildable. A derivation survey falsifies four of
them, and I have verified the load-bearing claims myself.**

| section                                | I said          | it actually is    | the missing thing                                                                                                                                                                             |
| -------------------------------------- | --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caseload** + case age                | buildable       | 🔴 **MODEL WORK** | **no community case has an open/close lifecycle.** `community-screen.tsx:192`: _"NOTHING IN THIS MODEL RECORDS A TEAM CLOSING SOMEBODY: no team discharge, no episode end, no closing date."_ |
| **Referrals into the team**            | buildable       | ⚠️ **PARTLY**     | the tally is buildable; the **decline-reason table is not** — see below                                                                                                                       |
| **Where referrals came from**          | buildable       | 🔴 **MODEL WORK** | `REFERRAL_SOURCES` is `community, crisis_service, police, ambulance, inter_hospital, ed_medical`. **No GP. No self or family. No another community team.**                                    |
| **Discharges into this team's care**   | buildable       | ⚠️ **PARTLY**     | the count exists and is already rendered; **first contact within 7 days needs contact events the model has none of**                                                                          |
| **People currently in a hospital bed** | mechanism built | ⚠️ **PARTLY**     | every fact exists — `unitById`, `siteByCode`, `daysInBed` — but 🔴 **its suppression denominator is the caseload total, which is row 1, which does not exist**                                |

🔴 **AND THE CASELOAD GAP IS DEEPER THAN A MISSING FIELD.** `admissionBelongsToTeam` keys off
`Admission.referralId`, **so a team's membership is only ever visible through a hospital bed.** ⚠️ **A
community team's real caseload is overwhelmingly people who were never admitted. The model cannot see
them at all.** **That is not a derivation nobody wrote; it is a population nothing records.**

### 11.0.2 🔴 A DRAWN FIGURE THAT CAN ONLY EVER BE A FABRICATED ZERO

**The drawing's decline table carries _"Withdrawn by the referrer before assessment: 0"_, and its own
prose insists this is a real measured nought rather than an absence.**

**Verified in `ward-model.ts:1486`: a referrer withdrawing is _"an act by a person … **which has no
event yet**"_ (FD-5).**

🔴 **So that row cannot become non-zero by any action a user can take. It is zero BY CONSTRUCTION, and
the drawing asserts it is zero BY MEASUREMENT.** ⚠️ **That is precisely the distinction this lane's
whole absence taxonomy exists to keep — state 1 against states 3 to 6 — appearing inside an approved
drawing.** **Do not build that row. It is a hand-back.**

**And the four other decline reasons are no better:** `REFERRAL_DECLINE_REASONS` is
`no_suitable_bed, age_band_not_provided_here, sex_designation_unavailable, secure_bed_unavailable,
belongs_to_another_service, referred_elsewhere, another_reason` — **every one a bed-placement
concept.** **None can express _outside the catchment_, _needs inpatient care_, _client declined_ or
_already open to another team_.**

### 11.0.3 What this means for the screen

✅ **Genuinely buildable now:** the provenance section (**done**), and the hospital-bed list **once its
denominator question is answered**.
⚠️ **Buildable with a new but ordinary derivation:** the referrals tally — received, accepted,
declined, still open — over fields that exist. The pattern already exists **privately** as
`communityAddressingFor`; it needs exporting, not inventing.
🔴 **Everything else is a hand-back**, and the honest description of this screen is **not "a build"
but "a screen whose drawing is ahead of the model".**

⚠️ **I called it a build in §3 and in §9 and I was right that it is not a restyle — but "build" still
understated it.** **Three of its sections need facts the system does not record.**

### 11.1 What is buildable, held, and blocked

| drawn section                                             | state                               | why                                                                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What is invented, and what is real**                    | ✅ **BUILD FIRST**                  | marker brief adopted; §3.1 costed at 71 call sites                                                                                                                               |
| **Caseload**, and _How long each open case has been open_ | ✅ buildable                        | `referrals` + `admissionBelongsToTeam` exist                                                                                                                                     |
| **Referrals into the team**                               | ✅ buildable                        | ⚠️ **D-42's trap: `community_team` carries `teamName`, so unlike the ward arm this one IS derivable.** **Do not reason by analogy from §4.14 — the model is where they differ.** |
| **Where referrals came from**                             | ✅ buildable                        | `Referral.source` — ⚠️ **and `gp` is gone from the facade's union (D-26 follow-up); read the model's six, not the facade's**                                                     |
| **Discharges from hospital into this team's care**        | ✅ buildable                        | exists today as the row _"Discharged into the area"_; **promote to a section, do not duplicate**                                                                                 |
| **People currently in a hospital bed**                    | ⚠️ **mechanism BUILT, section not** | O-14's `peopleInBeds` is committed; the section that calls it is not                                                                                                             |
| **Time to first contact**, _The same cases, grouped_      | 🔴 **HELD — D-39**                  | the model holds no contact records                                                                                                                                               |
| **Contacts**                                              | 🔴 **HELD — D-39**                  | same                                                                                                                                                                             |
| generic h1 _"Community team statistics"_                  | ✅ **do not build**                 | the built h1 is the team's name, which is better; §9 records it                                                                                                                  |

### 11.2 Task A: the provenance section

**Files:** modify `statistics-community-screen.tsx`; create
`tests/ward-statistics-community-provenance.dom.test.tsx`.

**Consumes:** `MINIMUM_PUBLISHABLE_SAMPLE` is NOT involved. `figureText`/`isUnmeasured` are.

🔴 **The done-when is the marker brief's §5, and it is the first screen to be held to it.** **Every
invented figure the screen renders must be reachable only through a value carrying its own
provenance, the marker must reach every layer the figure reaches, and no sibling may contradict it.**

⚠️ **What this task must NOT do: satisfy itself by adding the section and stopping.** **A provenance
section is a whole-screen limit (§5 of the plan) — it is _permitted as well, never instead_.** **The
four figures already carry their state from tranche 1; the six sections to come must too.**

- [ ] **Step 1: write the failing test** — pin that the section renders, that it names what is
      invented **by naming the figures**, and 🔴 **a negative: that it does not claim anything is real
      that the screen cannot show is real.** The drawing's own list is the reference: _"Every figure
      here is invented… What is real: East Metropolitan Health Service and the other three health
      services, the hospital sites, and the ward names… read from the network's own ward table at
      render time rather than typed here."_
- [ ] **Step 2: run it, watch it fail** for a missing section, not for a missing string.
- [ ] **Step 3: render the section**, deriving the invented-figure list from what the screen actually
      renders rather than typing it. ⚠️ **A hand-typed list of figures is a second source and goes
      stale the first time a section is added — which is six times in this tranche alone.**
- [ ] **Step 4: run it, the screen's suites, and the typecheck.**
- [ ] **Step 5: commit.**

### 11.3 🔴 Before Task B: two things that are NOT mine

- **The `none` census** must return before any new section renders an absence word. ⚠️ **Six sections
  are about to be written and every one of them has an empty state.**
- **O-2's replacement** — the three phrasings, if the retraction leaves any to write. **I do not
  invent them.**

### After tranche 1

**Re-run the statistics tier against the then-current line and record
`collected / passed / skipped / failed`** (§8), **then write tranche 2 from §9's section map.**
⚠️ **Ward Lead owes the seed decision before any screen ships, and O-2's three phrasings before the
three states that share _"not a measurement"_ are worded on any screen.**

---

## 10 · Traps that have produced a false green or a false finding on this work

Each was measured, not imagined. **All six greps below returned a clean number; none returned an
error.**

| shape                  | instance                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **case**               | `grep 'not enough data'` → 0 hits. The string is `Not enough data to compute`. **A false absence that nearly cost a section.**                                                                   |
| **comment vs render**  | `cannot see` matched four files and **renders on one**; three were prose about the code. `withoutComments()` exists in the marker guard for this reason.                                         |
| **name vs definition** | `movementVerdict` returned two hits and is defined nowhere — a rebuttal comment and a local variable sharing the word.                                                                           |
| **word vs subject**    | `contact` is in the model as an **escalation's contact person**, nothing to do with patient contacts. `catchment` is in six modules while _catchment-derived membership_ is deliberately absent. |
| **exit codes**         | `grep -c` with no match exits **1** and silently truncates a `&&` chain. A pipe returns the **last** command's status: `vitest …                                                                 | tail` reported exit 0 on a 56-failure run. |
| **truncation**         | `grep …                                                                                                                                                                                          | head -20` cuts silently. **Count first.**  |

- `--reporter=basic` **does not exist here** — it runs zero tests, exits 0, and the empty failure list
  reads as green.
- **Vitest does not typecheck.** Run the typecheck separately, always, with the config named in §8.
- **`npm run format` exits 0 when prettier is absent.** Zero files changed is the tell; check
  `ls node_modules/.bin | wc -l` first.
- **Plan line citations have drifted up to 11 lines. Find by name, never by line.**

---

## 12 · 🔴 The §7.0(2) divergence register — what this lane does NOT build as drawn, and why

⚠️ **§7.0(2) of the plan of record forbids quietly DROPPING as much as quietly adding:** _"nothing
dropped silently, nothing kept silently."_ **Every line below is a place where the approved drawing
and the model disagree, and the disagreement is recorded here so the owner can veto a decision he
never saw drawn.**

⚠️ **NUMBERING, because the citation will otherwise look wrong.** Ward Lead's rulings cite **§5.0(2)**,
which is the FIRST edition's number. In the plan of record
(`2026-09-11-third-edition-build-master-plan-v2.md`, read at `f2420d8cd4`) the same definition of done
is **§7.0**, and item 2 is the same rule. Both citations mean this rule.

### D-1 · The community decline table's _"Withdrawn by the referrer before assessment: 0"_

- **Drawn as:** a row in the decline breakdown, and the drawing's own prose insists the nought is a
  measurement rather than missing data.
- **Measured:** `ward-model.ts` records that a referrer withdrawing **has no event** (FD-5). So the
  row is nought **by construction** and cannot become anything else, no matter what any clinician does.
- **Built as:** the `never-recorded` arm of `statistics-absence.ts`, not as `measured(0)`.
- **Whose call:** 🔴 **Ward Lead's ruling, 2026-09-11 — not the owner's.** Its reasoning: a drawing
  asserting that a construction is a measurement is stating a **fact about the data**, and a drawing
  does not get to do that. **The owner may veto; this entry exists so he can veto it knowing it was
  never drawn this way.**
- **The general finding, which is the sharper half:** ⚠️ **the absence taxonomy's central distinction
  appeared INSIDE an approved drawing, argued in the drawing's own prose.** The drawing does not
  merely print a nought — **it insists the nought is measured.** That is the defect stated
  confidently, which is the hardest kind to see.

### D-2 · The ward screen's _"Where a discharge went — not tracked here"_

- **Drawn as:** a disclaimer inside the Discharge planning panel.
- **Measured false, all three lines read directly:** `Admission.leavingDestination` is declared
  (`ward-admissions.ts:540`); the vocabulary has eight members including
  `discharged-to-the-community`, `transferred-to-another-psychiatric-ward` and
  `moved-to-residential-care`; and the seed **populates it on every departure**
  (`ward-admissions-seed.ts:399`).
- **Built as:** 🔴 **omitted. The line is not reproduced, and the drawing is not silently corrected
  either.** Ward Mockups holds it as a drawing defect.
- **⚠️ AND A PROPOSAL THAT IS NOT A BUILD.** The field exists and is populated, so a _"where
  discharges went"_ breakdown is now **possible**. **It is recorded as available and deliberately NOT
  built** — adding beyond the drawing is the same rule in the other direction. It is the owner's to
  want.

### D-3 · The ward screen's _"Funding or plan decision pending"_

- **Drawn as:** the largest row of the _Clinically ready, not yet gone_ reason table (2 of 4 patients
  in the drawing's own example data).
- **Measured:** `BED_RELEASE_BLOCKERS` (`ward-change-reasons.ts`) holds eight members and this is not
  one of them. 🔴 **The exclusion is deliberate and recorded in that file's own comment:**
  _"Guardianship and financial arrangements stay excluded ... Adding any further entry remains a
  recorded product decision, never an implementer's convenience."_
- **Built as:** ~~the eight blockers the model holds. **The ninth is not added.**~~ 🟢 **SUPERSEDED —
  see the ruling below. The ninth IS added and has been since `9520f1cf08`.**
- **Whose call:** ~~⚠️ UNRULED. Put to the owner directly and to Ward Lead; neither has answered
  at the time of writing.~~ 🟢 **RULED BY THE OWNER, O-16.7, 2026-09-12:** _"A real reason a
  discharge stalls, with nowhere to record it today."_ `"Funding or plan decision pending"` is now the
  ninth member of `BED_RELEASE_BLOCKERS`, and the vocabulary's own comment was amended in the same
  commit because _"Guardianship and financial arrangements stay excluded"_ had become half false.
  **No component changed** — the reason table generates one row per member, so an owner decision
  became a row on every ward page by being added to a list.

- 🔴 **AND THIS ROW STOOD SAYING "UNRULED" FOR ELEVEN HOURS AFTER THE RULING SHIPPED, WHICH IS THE
  ENTRY'S REAL LESSON.** The register is the artefact whose whole job is to tell the owner what this
  lane did NOT build as drawn. **A row that still says his own decision is outstanding does not merely
  go stale — it argues, in his own register, against a call he already made.** ⚠️ **The
  divergence register has no gate: nothing recomputes it, nothing can go red on it, and it is written
  in exactly the confident voice that makes a reader trust it without checking.** Corrected here in
  place rather than rewritten, because the correction is the useful half. **A register entry should
  be closed in the same commit as the code that closes it; this one was not, and only a full-suite
  sweep looking at something else found it.**

### D-4 · Every over-time section on every screen in this family

- **Drawn as:** today / this week / this month counts, seven-day tables, thirty-day trends.
- **Measured:** the prototype persists no history. `ward-flow-provider.tsx` seeds fresh state on
  every reload; the seed holds **five departed admissions across the whole network**, the oldest
  about 43 hours old, leaving roughly eighteen wards with **no discharge record at all**.
- **Built as:** 🔴 **not built. A hand-back, not an implementation gap.** A derivation over
  `arrivedAt` / `leftAt` today would be true-by-construction and almost entirely nought — the
  emptiness is a property of the prototype, not of the fixture, and a reader cannot tell those apart.
- **⚠️ The strongest evidence is that this lane is not the first to reach it.** The codebase's own
  author already handed back the identical gap for the occupancy chart, in words that describe these
  sections exactly (`statistics-demonstration.ts`): _"It keeps no history: nothing here remembers what
  yesterday's occupancy was, **or how many people arrived last Tuesday**."_ **A hand-back that finds
  the same hand-back already written elsewhere is not a coincidence; it is the shape of the limit.**
- **Whose call:** Ward Lead is taking the **general** version to the owner — every over-time section
  on every statistics screen, one limit, heard once rather than met four times as four hand-backs.

### The two conditions every partial section must satisfy

Where a section is built to its buildable half, the unbuilt half is subject to both of these, and
**the second is the one that will be got wrong**:

1. 🔴 **The correct ARM, never a generic absence.** _"No history is persisted"_ is a different state
   from _"this field does not exist"_, which is different again from _"below the publishable
   threshold"_. **The seven states exist precisely so these are not one sentence.**
2. 🔴 **THE SENTENCE MUST NOT READ AS A MEASUREMENT OF THE WARD.** ⚠️ _"Nothing this month"_ and
   _"we cannot compute this month"_ look identical to a coordinator and **mean opposite things** —
   one is a quiet ward, the other is a limit of the prototype. **Name the limit, not the ward.**
