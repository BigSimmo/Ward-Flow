# Owner decisions — the third-edition build round

**Identity owner: Ward Lead.** Nobody else numbers in this file. Questions are numbered as the
master build plan §7 numbers them (`Q-1` … `Q-13`); rulings that arrive outside that list get a
`D-` number issued here and nowhere else.

Master plan: `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md`
(branch `claude/wardflow-design-review-43df97`, tip `e9c6900e3e`).

---

## 🔴 READ THIS BEFORE CITING ANY Q-ANSWER: EVERY ONE OF THE THIRTEEN IS MY RECOMMENDATION

**Josh answered all thirteen with the words _"your recommendation"_.** Two carry additional words of
his own — Q-4's name (D-1) and the instruction to build communication (D-2). **Everything else in the
table below is a sentence I wrote, which he approved.**

⚠️ **WHY THIS MATTERS AND IS NOT A FORMALITY.** A lane meeting a Q-answer that conflicts with the
code **will read it as the owner's word and defer to it.** It has no way to tell his sentence from
mine wearing his approval. **That has already cost something:** Q-4 instructed the Patient screen to
show a person's current movement, which an existing privacy guard forbids — **and I had written Q-4
without reading that guard** (A-8).

🔴 **SO: if a Q-answer conflicts with the code, the first question is WHOSE SENTENCE IS IT — and only
Ward Lead can answer that.** Bring it rather than deferring to it.

⚠️ **The compounding shape, worth naming because neither party could have caught it alone:** I wrote
Q-4 about **which route owns the page** and had no reason to open a destructure guard. Lane C read
Q-4 as the authority on **what the page may show** and had no reason to doubt an answer arriving as
the owner's. **The guard's own text was the source for both of us, and neither read it — for two
different and individually reasonable causes.**

---

## The thirteen questions — ASKED AND ANSWERED, 2026-09-10 evening

**His answer, verbatim, to every one of the thirteen:** _"Your recommendation"_ — with a single
modification, on Q-4, quoted in place below.

⚠️ **"Your recommendation" is an answer, not a delegation.** Each row below records what was
actually recommended, because the recommendation IS the ruling now and a later chat must not have to
reconstruct it from a message. **Where a row says a thing is NOT settled, it is not settled by this
ruling and must be handed back, not inferred.**

| #        | The question, in one line                                | RULED                                                                                                                                                                                                       | What it binds        |
| -------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Q-1**  | May beds be _ordered_ by the clinician's acuity mark?    | 🔴 **NO.** Order by wait and legal deadline only. The acuity mark is **shown as a word** beside the person, never used as a sort key.                                                                       | Lane A — Command     |
| **Q-2**  | Does home area limit which ward a patient may go to?     | **NO — catchment is INFORMATION, never a filter.** No bed is hidden or excluded by where someone lives, until a real mapping exists.                                                                        | Lane A, lane C       |
| **Q-3**  | Two search screens — keep both?                          | **Keep both this phase.** Search hub is the entry point; Patient search is the person-first list. Revisit after real use, not on paper.                                                                     | Lane C               |
| **Q-4**  | Is Patient Now the person's page or the movement's?      | **The PERSON's page** (`/people/[patientId]`), showing the person's current movement inside it. `/movements/[movementId]` stays as the coordinator's workspace. ⚠️ **AND ITS NAME IS `Patient`** — see D-1. | Lane C, lane A       |
| **Q-5**  | Ten region teams, or sixty-five catchment teams?         | **The sixty-five**, every one marked as invented. The ten are retired when the owner supplies the real list.                                                                                                | Lane B, Phase 1.5    |
| **Q-6**  | Retire the 2026-09-06 header spec?                       | **YES.** The third-edition shell supersedes it; the shell's own test is the stricter replacement.                                                                                                           | Phase 1.2            |
| **Q-7**  | Where do clock / scenario / reset live?                  | **The Tools drawer, labelled _Demonstration_.** Nothing a demonstration needs is lost, and nothing reads as a real control.                                                                                 | Phase 1.1            |
| **Q-8**  | A reload wipes the demonstration — leave it?             | **YES, this phase.** Persistence is a separate decision with privacy consequences once the data stops being invented.                                                                                       | recorded only        |
| **Q-9**  | Are the 58 never-written test files still the plan?      | **NO — the figure is struck.** This plan's named catchers replace them. No lane writes any of the 58 by name.                                                                                               | recorded only        |
| **Q-10** | May the standard's index gain its seven missing screens? | **YES.** Delays, Bed board, Patient, Search hub, Ward statistics, Community team statistics, ED statistics. **Ward Mockups does it.**                                                                       | Ward Mockups         |
| **Q-11** | Rail brass bar, flow-map ED bars, brand stripe?          | **Remove the two bars. KEEP the brand stripe** — it is a mark, not a state, so the no-edge-bars ruling does not reach it.                                                                                   | Phase 1.1, lane A    |
| **Q-12** | Panels the app has and the drawings do not?              | 🔴 **KEEP EVERY ONE. DROP NOTHING.** Folded into the nearest drawn panel, or into the Activity drawer. ⚠️ The complete list is not yet known — see below.                                                   | every lane           |
| **Q-13** | Referral history — three prose blocks, or one?           | **The 2026-08-30 ruling stands: ONE story field, optional, last, never feeding eligibility.** Ward Mockups redraws.                                                                                         | Lane C, Ward Mockups |

### ⚠️ Q-12 is answered in principle and NOT in inventory

The **principle** is settled and is not re-openable: nothing is dropped. **The list is not.** Each
lane reports the panels its own screens carry that its drawings do not, and Ward Lead puts the
assembled list to the owner **once**, at the end of Phase 2. A lane that silently drops a panel
because "it wasn't in the drawing" has broken this ruling; so has a lane that silently keeps one
without listing it.

### ⚠️ What Q-1 does NOT settle

It rules out acuity **as a sort key** and rules in acuity **as a displayed word**. It says nothing
about whether a high-acuity mark may _group_ candidates, _warn_, or _feed a refusal_. It does not
touch the built acuity gate, which is a capacity check and stays exactly as it is. Anything beyond
"show the word, sort by wait and deadline" is a stop-and-hand-back.

### ⚠️ What Q-2 does NOT settle

Catchment is information. **This does not license a builder to compute, infer or display a
catchment relationship the model does not already hold**, and it does not reopen the 2026-08-31
ruling that a community patient belongs to a team by the explicit team on the referral, never by
home area. If the two ever appear to conflict on a screen, hand it back.

---

## D-1 — 🔴 The screen is called **Patient**, not "Patient Now"

**His words, 2026-09-10:** _"Your recommendation - But call this page Patient"_.

    screen name    Patient
    route          /mockups/ward-flow/people/[patientId]      (unchanged)
    drawing        docs/ward-flow/mockups/patient-now-third-edition.html

**What this binds:** the title the screen renders, the label in the rail and in every navigation
list, the accessible name, and the words any other screen uses to link to it.

⚠️ **The drawing's FILENAME is not renamed by a builder.** It is in `docs/ward-flow/mockups/**`,
which Ward Mockups owns, and renaming a byte-checked file mid-build breaks every reference to it.
Ward Mockups decides whether and when the file is renamed; until then the file is
`patient-now-third-edition.html` and the screen it draws is called **Patient**. A builder that finds
"Patient Now" inside the drawing's own markup routes it to Ward Mockups rather than editing it.

⚠️ **"Patient" is a common word and this ruling is about a PAGE TITLE, not about vocabulary.** It
does not rename `patientId`, `patientHref`, `ward-patients-seed.ts`, the `patients/` component
directory, or any existing identifier. Renaming those is not implied and is not authorised.

---

## D-2 — 🔴 Communication: BUILD IT. The system must be able to tell someone something.

**His words, 2026-09-10, quoting the plan's §7.1 item 1 back and adding the instruction:**

> _"Nothing in this system can tell anyone anything. The stated purpose is communicating bed
> decisions, and several of your rulings already require someone to be told something. There is no
> message, alert or inbox anywhere._
>
> _- Build and implement also"_

**This is a decision, not a question, and it is an ADDITION to the master plan**, which recorded the
absence as something the owner might be missing and explicitly placed it out of scope. It is now in
scope.

### Why it is not optional dressing

Several rulings already in force require a person to be told something, and today nothing carries
the message. The clearest is _"the referrer must be told when a pull is cancelled"_. A referrer who
is not told is not merely uninformed — **they go on believing a bed is coming.** Recording that
decision without delivering it is the failure mode the whole programme exists to close.

### What is settled by the instruction

    a message exists as a thing the model holds
    something generates it from decisions that already happen
    somebody can see the messages addressed to them
    it is built in this phase, not deferred

### ⚠️ What is NOT settled, and is Ward Lead's to rule on rather than the owner's

The plan's §7.1 item 2 — _"nobody is anybody"_ — was **not** answered, and a message needs a
recipient. **Ward Lead rules, and records here rather than asking again:** a message is addressed to
a **role at a place** (the referring clinician of referral X, the ward that holds bed Y, the
coordinator, the ED that sent the person, the community team named on the referral), and it is seen
when the viewer is in that role — the role switcher the app already has is the viewer. **No new
notion of a user, an account or a person-who-logs-in is created**, because that is a use-gate
question with privacy consequences and it was not asked.

**Cost if this ruling is wrong:** the addressing model is rework in one module, not across sixteen
screens, because every screen reads it through the facade. That is why it is safe to rule rather
than stall.

### Where it is built

**Phase 1, by Ward Lead, on the line — never by a lane.** It touches the model, the reducer and the
shell, all of which are shared files no lane may edit. Full contract in the plan addendum
`docs/ward-flow/plans/2026-09-1x-communication-addendum.md` (path claimed by Ward Lead).

---

## Standing rulings this round did NOT touch

Recorded so nobody reads a silence as a change:

- **Sex and gender** — two fields; gender is Female or Male plus a distinct _not yet recorded_
  state that is never defaulted from sex; **gender decides the bed; no override path on that gate**
  (2026-09-09/10).
- **Acuity is marked by the referring clinician at referral; the system never computes it**
  (2026-09-09). Q-1 above narrows only how it may be _ordered by_.
- **No coloured bar on any edge, no top highlight** (2026-09-09). Q-11 applies it to three
  survivors.
- **The third bed stage is _discharged_, never _released_** (2026-08-30).
- **The changeable-data rule** — every invented figure carries its own marker, and nothing may be
  built that only works for the seed.
- 🔴 **The three real-patient gates remain unstarted and DEFERRED** — medical-device
  classification, sex-and-gender as a _use_ gate, and the Aboriginal cultural safety review. **None
  of this build moves them, and none of it is progress towards them.** Two cannot be done by this
  team at all.
- 🔴 ~~**The narrow-width board question** — drop and stack, or scroll sideways and visibly show it —
  **is still open and still the owner's.** It was deferred, not answered, and nobody picks one as
  part of a repair.~~ **RETIRED 2026-09-11 — FALSE SINCE D-9, AND NOT STRUCK UNTIL TONIGHT.**
  **D-9 ruled it (scroll sideways, with the affordance as the missing thing), it was BUILT at
  `775ae2530e` and `b04e796a25`, and the guard was rewritten to match at
  `ui-ward-referrals.spec.ts:1144` — _"the referral board's tables may overflow only together with
  the scroll-sideways affordance"_.** ⚠️ **A summary at the top of a file is read far more often than
  a ruling six hundred lines down, so the stale line was the one in circulation: I told the owner
  three times tonight that this was the oldest open item and genuinely his.** ✅ **He then answered
  it as O-1 and chose what D-9 had already chosen — so O-1 is a RATIFICATION, not a new ruling, and
  the outcome never diverged.** **Found by Ward Verifier, which had relayed my stale claim to him and
  went back to the record. Struck rather than deleted: the wrong version is what a reader would
  otherwise re-derive.**

---

## ⚠️ Q-8 SCOPE LIMIT — added 2026-09-10 after a drawing's appendix was read

**Q-8 asked whether a page reload wiping the demonstration may stand this phase. The answer was
YES.** That answer is about **demonstration state** — the seeded movements, admissions and referrals
that are re-created on every mount.

🔴 **Q-8 does NOT extend to a half-written referral history.** A clinician's in-progress written
account of a patient is not demonstration state, and the two are only superficially alike.

**The hazard is that Q-8 reads as covering it.** A builder applying it there **silently discards a
written clinical account and has an owner ruling to point at.** The Raise a referral drawing's own
appendix sets the floor: _"Tolerable for three checkboxes, not tolerable for four paragraphs of a
risk note. Either the draft is held and the screen says so, or the screen warns before leaving. It
must not silently do neither."_

**Today the screen does neither.** Which of the two acceptable behaviours is built is **the owner's,
and it is queued for him.** Until he answers: **nobody cites Q-8 on this, and nobody treats the
current silence as sanctioned.**

Full context: `docs/ward-flow/drawing-appendices-2026-09-10.md`.

---

## D-3 — 🔴 The 12px floor is ADOPTED. Screen by screen, not as a sweep.

**Owner, 2026-09-10:** _"Go ahead with all your recommendations"_ — answering the text-size
recommendation in full.

### What it settles

    NEW ward code            never below 12px for HTML text. A smaller size is a
                             stop-and-hand-back, not a token choice.
    the 389 existing uses    raised SCREEN BY SCREEN as each of the sixteen is rebuilt.
                             NOT a sweep, and NOT a lane's tidy-up in passing.
    the invented-figures     raised on every screen NOW, ahead of its turn.
    notice
    the flow map             UNCHANGED. Its 10.5/11.5px stands — the standard already
                             names it, and every figure on it is repeated at 13.5px
                             beside it, so nothing is read there alone.
    the ratchet              built now: today's count may fall, never rise.

### Why the sweep was refused

389 declarations across 50 files would change layout everywhere at once. **Text that fits today
would stop fitting** — wrapped headings, clipped labels, overflowing counts — and this project
already carries layout defects no automated check catches. That trades a legibility problem that can
be seen for a breakage problem that cannot.

**Every screen is being rebuilt anyway.** A rebuild re-lays the screen out, so it absorbs the larger
text with its own layout checked in the same work. The cost is near zero at that moment and high at
any other.

### Why the invented-figures notice jumps the queue

🔴 **`.syntheticNotice` — the sentence saying the figures are invented — is currently set at the
smallest size on the page.** It is the one sentence the owner has most insisted on, and the least
legible thing on screen. **That inversion is fixed now rather than sixteen screens from now.**

### What was wrong before this ruling

Two type scales with two different floors: the standard says 12px and "nothing is set smaller"; the
app's tokens reach 10px and `check-type-scale.mjs` declares 10px the floor in its own comment. **A
builder obeying the brief and a builder obeying the linter were obeying different rules, and only
the linter was checked.**

⚠️ **Two honest counts exist: 389 across 50 files (Ward Lead) and 393 across 39 (Lane B), from
different sweeps. Neither is the ruling** — "no new ones" holds whichever is right, and the ratchet
pins whatever the real number is on the day it runs.

---

## D-4 · WARD LEAD RULING, not the owner's — the Access record's false assurance

🔴 **THIS IS NOT JOSH'S WORD. It is mine, made under his standing instruction of 2026-09-10 —
_"Go ahead with all your recommendations and co to use autonomously until all of this is built"_ —
and it is his to overturn.** It was queued to him as blocking question **A-5** and is being ruled
rather than waited on, because waiting leaves the false sentence in place and holds a lane.

### The finding, measured 2026-09-11

The Access record panel's header note reads, always and unqualified:

    Who looked, and when. Every search is recorded.

**It is in FIVE places, all of them drawings, and NONE of them `src/`:**

    docs/ward-flow/mockups/patient-search-third-edition.html:4932
    docs/ward-flow/mockups/third-edition-kit/inputs/buildsheet.html:5703
    docs/ward-flow/mockups/third-edition-kit/inputs/rail.html:7530
    docs/ward-flow/mockups/third-edition-kit/inputs/SHELL-SPEC.md:533
    docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md:1101

⚠️ **That changes what this is.** It is not a falsehood shipping to a clinician today — it is a
falsehood a lane is about to build FROM. Correcting the drawing costs one sentence; correcting the
built screen later costs the screen, its tests and whoever believed it in between.

### Why the sentence is false, and it is false in the direction that matters

Nothing in `src/` records a search. The built design is **deliberately session-only**, with a test
forbidding any storage. So _"Every search is recorded"_ promises an audit trail that does not exist
and is not intended to exist — and a promise of audit is exactly the assurance a clinician would
rely on when deciding whether looking is safe.

🔴 **The drawing already contains the honest version — and hides it in the state that stops being
shown.** Line 6193, the EMPTY state:

    Nothing searched yet this session. Every search run from the bar is recorded here with the
    role that ran it and when, and none is sent anywhere.

**Both facts are there — "this session", "none is sent anywhere" — and both vanish the moment the
panel has one row.** The qualification is attached to the only state in which nobody needs it.

### The ruling

**The header note becomes, in all five places:**

    Who looked, and when. Kept for this session only, and none is sent anywhere.

It keeps the drawing's voice, keeps both of its own facts, drops the one claim the build cannot
keep, and is **true read alone, with rows or without them**.

⚠️ **The empty state's sentence stays exactly as it is.** It is correct, and it says more than the
header can — it is not made redundant by this.

### Routing — and why it is not one chat's job

- **Ward Mockups owns `docs/ward-flow/mockups/**` and makes all five edits.** No other chat touches
  those files; that folder is outside every gate and a second editor there is how a fixed defect
  gets redrawn.
- **Lane C (Ward Builder Three) builds the corrected sentence**, not the drawn one. Its Task 7 was
  held on A-5 and is hereby released.
- 🔴 **Lane C must not wait for Ward Mockups to finish.** The sentence above is the authority; the
  drawing is being brought into line with it, not the other way round.

### What it costs if I am wrong

The screen would say less than the owner wanted it to say. **That is the recoverable direction.**
The other direction — building the drawn sentence and discovering later that nothing records
anything — is a false assurance about access to a patient's record, on a clinical screen, and it is
the kind this project exists to avoid.

⚠️ **If Josh wants the original claim to be TRUE rather than removed, that is a different and much
larger piece of work** — a stored, queryable access log, which the current design deliberately
forbids and which brings its own retention and privacy questions. **It is not a wording change and
must not be done as one.**

---

## D-5 · WARD LEAD RULING, not the owner's — gender reaches BOTH bed gates or neither

🔴 **Mine, not Josh's, under his standing instruction of 2026-09-10.** It answers a hand-back, and
it is his to overturn. Full build detail in the task 9 brief; the ruling itself is here because it
outlives the task.

### What was handed back, and it was handed back correctly

The model half of sex-and-gender is built: `Patient.sex` and `Patient.gender` are two fields, and a
standalone `genderEligibility()` exists that is **structurally** non-overridable — it is not a member
of `EligibilityGate` at all, so it cannot be added to the nine-gate override list by accident.

**It has no production caller, deliberately.** The implementer refused to wire it, because
repointing the existing `sex_designation` gate at gender **in place** would have made gender
overridable — the one thing the owner's ruling forbids. **That refusal was right.**

### The ruling

**TWO gates decide which bed a person may go to, not one. Both read gender.**

    sex_designation   the BED's designation   — "male bed for female bed", his own words
    sex_mix           the OCCUPANTS' mix      — who is already in the bay

### Why half of this would be worse than none of it

A trans woman: recorded sex Male, gender Female.

    designation reads gender  ->  a female ward ACCEPTS her.                     Correct.
    mix still reads sex       ->  sameSexOccupants = sexMix["Male"] = 0,
                                  so the gate passes only if allocatable > 1

**She needs two free beds where a cis woman needs one.** No error, no refusal naming a reason,
nothing red — a quietly higher bar, produced entirely by fixing one gate and not the other. ⚠️ **The
owner's ruling exists to prevent exactly that, and a partial fix manufactures it.**

### The limit on this ruling — where it stops and he starts

`Unit.sexMix` counts real occupants by sex. Counting them by gender requires the occupants to HAVE
genders, and **PT-007 deliberately has none** — recorded sex "Non-binary", which a two-value gender
field cannot represent.

🔴 **If the seeded occupants cannot be recounted honestly, the task hands back with the arithmetic
rather than inventing genders or defaulting them to sex.** That is the same ruling the seed task ran
under — _"link what is true, null the rest, invent nothing"_ — and the same refusal is expected here.

⚠️ **What I am NOT deciding, and nobody should decide by default: what Ward Flow does for a person
whose gender the two-value field cannot hold.** The owner ruled two values _for beds_. He has not
been asked what the system does for PT-007, and it is not inferable from what he said.
**That is a question for him, and it is now the standing one in this area.**

### D-4 ADDENDUM, 2026-09-11 — 🔴 the OTHER half of that sentence, found by Lane C after the fix

**D-4 fixed the DURABILITY claim. It did not touch the ATTRIBUTION claim, and that one is worse.**

Lane C built the ruled sentence correctly and then looked at the panel it sits on. **The panel
renders a role column per row, and the role is a hard-coded constant:**

    patient-search.tsx     const ACCESS_RECORD_ROLE = WARD_FLOW_ROLE_LABELS.coordinator
    ward-chrome-role.ts    "WARD FLOW HAS NO SIGNED-IN ROLE … the role IS the route you are on"
                           "IT IS A CHROME HINT, NEVER A PERMISSION"

🔴 **So the column can only ever print one value, and that value is not an identity.** Two different
people at the same browser produce identical rows. **A panel headed _"Who looked, and when"_ answers
"who" with a constant that names nobody.**

⚠️ **And D-2 forbids the fix that would make it true:** _"No new notion of a user, an account or a
person-who-logs-in is created."_ **This is not a gap to close by adding sign-in. The claim comes down
to what the system can actually say.**

**In fairness to whoever built it: the VALUE is correct.** `coordinator` is exactly what the route
derivation would return, and the choice was flagged rather than hidden. **The defect is the column's
MEANING, not its content** — which is why no test caught it and why it read as a judgement call.

### The ruling — both parts, and it is mine, overturnable

1. **The header note becomes:** _"What was searched, and when. Kept for this session only, and none
   is sent anywhere."_ — Lane C's wording, and better than mine. **It drops "who", which the system
   cannot answer, and keeps "what" and "when", which it can.**
2. 🔴 **The role column is REMOVED, not relabelled.** A column whose value is a source-level constant
   carries no information on any row; leaving it under a different label puts the same constant on
   screen wearing a new word. **Say in the code that it was removed because the system cannot
   distinguish who ran a search, and that it returns when it can.**

⚠️ **What this does NOT do:** it does not make the panel useless. _What was searched, and when_, kept
for one session and sent nowhere, is a true and useful thing for a coordinator to see. **It stops
claiming an attribution the prototype has no way to make.**

**If Josh wants a real "who", that is a signed-in user — which D-2 rules out for this build and which
brings its own retention and privacy questions. It is not a wording change and must not be done as
one.**

### D-5 MEASUREMENT, 2026-09-11 — the wiring task handed back, and the arithmetic is starker than I expected

**Task 9 stopped at D-5's own hand-back trigger before writing any code. That was correct.** What it
measured changes the shape of the problem:

    Unit.sexMix                 a SEEDED LITERAL on each unit — e.g. `{ Female: 9, Male: 9 }`
                                in ward-sites.ts. 259 people network-wide (128 F, 131 M).
    occupants -> Patient        ZERO of 259 resolve. `Admission` has NO `patientId` field at all.
    the near-link               `Admission.referralId` resolves for 10, and those 10 referrals
                                carry no `patientId` either.

🔴 **So a gender mix cannot be DERIVED from people, because nothing links a bed's occupant to a
person.** It is not a hard computation; there is no path at all.

### What that means, precisely — and it is narrower than "impossible"

**The two gates are not in the same position:**

    sex_designation   reads movement.sex / ward.sex — fields ON the movement.
                      CAN read gender today, once Movement carries it. Feasible.
    sex_mix           reads unit.sexMix[<key>] — and the KEY is just "Female" | "Male",
                      the same two values gender takes. The LOOKUP would work.

⚠️ **So the blocker is not arithmetic. It is that nobody ever decided what the invented mix numbers
MEAN.** They were invented as a count of women and men in a bay; **whether that is a count by sex or
by gender was never stated, because nothing forced the question.**

**Two ways round were considered and correctly REFUSED by the implementer:** inventing genders for
259 occupants, and starting every unit's gender mix at zero — which would silently raise the bar for
nearly every placement, network-wide, from day one. **It also declined to cherry-pick the safe-looking
half** (an unwired `gender` on `Movement`, or removing `sex_designation` from the override list while
it still reads sex, which would be an unauthorised regression). **All three refusals were right.**

### Where this leaves the owner's ruling — stated plainly

**His ruling is currently inert, and by my own D-5 it stays inert until he answers**, because
"both gates or neither" and only one of the two can be wired without deciding what the mix means.

⚠️ **The cost of waiting is real and must not be softened: a trans woman is still placed by her
recorded sex.** That is the exact defect the ruling exists to close. **It is queued as A-6, blocking.**

## D-6 · WARD LEAD RULING — "Not recorded" and "Not yet recorded" are BOTH used, deliberately

🔴 **Mine, not Josh's, under his standing instruction. Lane C's recommendation, adopted with its
reasoning intact — it asked twice and I owed it an answer.**

**Two forms on one screen needs a reason. There is one.**

    gender            "Not yet recorded"     the recording is EXPECTED AND PENDING — the owner's
                                             §9 ruling says the clinician completes it at referral,
                                             so the blank is a step not yet taken.
    the nine others   "Not recorded"         optional fields NOBODY IS OBLIGED TO FILL. Flat, and
                                             correct: there is no pending step to imply.

⚠️ **They are not synonyms and the difference is not stylistic.** _"Not yet"_ promises somebody will;
**saying it of a field nobody must fill invents an obligation**, and saying _"Not recorded"_ of gender
hides one the owner created.

**The gender form also matches two existing sources exactly** — the folded model's own comment, and
the gate's detail sentence: _"Gender is not yet recorded — this gate cannot determine whether X
accepts this patient."_ **A third phrasing on the screen would be the `TASKS_NOUN` defect again.**

**The reason goes in the code**, at the point the two forms diverge, so the next reader meets the
argument rather than an inconsistency.

⚠️ **The standard's §B rule 4 says "Not recorded" flatly, so it now under-describes gender. That is
Ward Mockups' file and is routed there — the standard is corrected, not the code.**

## D-7 · WARD LEAD RULING — the Patient screen SHOWS gender, and the addition is logged as an addition

🔴 **Mine, under Josh's standing instruction. Lane C proposed it, and it is right.**

**Task 9 renders gender as part of the identity panel.** The split between Tasks 9 and 17 becomes
**display versus completion**, not _nine fields versus the tenth_.

### Why

**The model now holds two fields where the drawing had one**, and the drawing predates the owner's
sex-and-gender ruling. **A patient page that shows `sex` and silently omits `gender` misrepresents
the record** — and _"the drawing does not show it"_ would be §5.0(2)'s dropping failure with a
justification attached.

⚠️ **And it is the field the owner ruled DECIDES THE BED.** A coordinator reading a patient page
without it is missing the fact that governs where that person can go — even though, today, nothing
consults it.

**It also matches the standing decision already made:** the person-screen label fix explicitly left
gender's display to Lane C's rebuild. **This is that rebuild.**

### 🔴 THE CONDITIONS, and the third is the one that is easy to skip

1. **"Not yet recorded" per D-6** where there is none — never blank, never an em-dash that reads as
   nobody having asked.
2. **Nothing on that screen may describe placement as gender-driven.** It is not, yet: no production
   caller, not in `ELIGIBILITY_GATES`, placement runs on `movement.sex`. **A-6 is with the owner.**
   ⚠️ **CORRECTED 2026-09-11 night — that sentence is TRUE and UNDER-SPECIFIED, and the
   under-specification cost a lane half a day.** **A-6 has two halves and only one is open.**
   ✅ **The JOIN half is CLOSED:** `patientId` exists, the default-deny guard exists, and
   `genderEligibility` NOW HAS PRODUCTION CALLERS — two in `patients/person-screen.tsx`, three in
   `ward-patients.ts`. 🔴 _**"no production caller" above has EXPIRED**_, and I was carrying it as
   current while telling a lane the opposite.
   🔴 **The CLINICAL half is OPEN and always was:** the bay-mix gate at `ward-eligibility.ts:208`
   still reads `movement.sex` and `sameSexOccupants`, and `:168` records that `sex_mix` is deliberately
   untouched. **Does the mix count people by sex or by gender? Nobody has answered that.**
   ⚠️ **A line that does not say WHICH half is how a closed question gets re-asked and an open
   one gets assumed closed. Tonight it did both, in the same hour.**
3. ⚠️ **THIS IS AN ADDITION BEYOND WHAT THE DRAWING DRAWS, AND §5.0(2) FORBIDS QUIETLY ADDING AS WELL
   AS QUIETLY DROPPING.** **Log it as a plan addition** — the same way the statistics link on Search
   hub rows was logged — so it is carried as Ward Lead's addition rather than as the drawing's, and
   the owner can veto it knowing it was never drawn.

**The drawing is not wrong. It is older than the ruling.** Ward Mockups may redraw it; that is not a
condition of building this.

## D-8 · WARD LEAD RULING — the announced marker says "invented NAMES", never "invented people"

🔴 **Mine, not Josh's, under his standing instruction. The implementer handed the wording back
rather than shipping it, saying "the wording is mine and needs your eye." That was the right call
and it is the reason this was caught.**

**Task 10 solved the hard half by shape: an announced figure carries its marker in the NOUN
("2 invented names found") instead of a following clause ("2 names found. These are invented.").
A typeahead re-speaks its whole sentence on every keystroke — a qualifier costs one word in
something that was going to be said anyway, where a second sentence doubles what the user hears
each time they type a letter.** ⚠️ **That part stands and is excellent. Only the noun was wrong.**

### The standard already has the word, and it is not "people"

    §8.6  the fixed results footer   "Names are invented."
    §8.5  the fixed disclaimer       "Every figure and name on this screen is invented."
    §8.3                             never invent "a person's name that could be mistaken for real"
    §8.4  "About persons"            no verdict about a person is ever drawn

**Everywhere the standard speaks about persons it attaches invention to the NAME. Never to the
person.** ⚠️ **On a bed board that is a matter of taste. On a patient search it is not** — §AJ
already recorded that this is _the one figure on that screen where a bare number is a claim about
human beings rather than about beds_. **"2 invented people found" makes the human beings the
invented thing; "2 invented names found" makes the record the invented thing, which is both true
and the house's existing sentence.**

### It closes a second defect nobody reported

**The SAME ternary already said _"invented names are one keystroke away"_ in its adjacent branch.**
🔴 **Two nouns for one population, on one element, three lines apart** — D-6's `TASKS_NOUN` shape.
**Fixed in the same stroke, rather than harmonised the wrong way by a later reader.**

### What does NOT change

**`invented tasks`, `invented results`, `invented names shown` all stand** — none is a human noun.

⚠️ **But standard §7.4 DRAWS the tasks sentence verbatim — "Tasks opened. 19 outstanding, notices
first." — with no marker.** **The app now says "19 invented tasks outstanding".** The divergence is
correct (§8.3: _every figure is invented_, and the page's two markers are both visual) **but the
standard now under-describes its own announcements. Routed to Ward Mockups, exactly as D-6's §B
rule 4 was: the standard is corrected, not the code.**

**The reason is in the code at the point it diverges, per D-6.** Applied `ef017d616d`.

## D-9 · WARD LEAD RULING — the referral board's table MAY scroll sideways; the missing thing is the affordance

🔴 **Mine, not Josh's, under his standing instruction. It reverses the obvious fix, so it is written
down before the work starts rather than justified afterwards.**

**Two columns of the queued referral table are off the screen at 641px — "Home region" and "Perth
Metropolitan" — and nothing on the screen says they exist.** A bed coordinator on a narrow screen
sees a table that looks complete and is not.

**The obvious repair is to make the columns fit. It is wrong.** Standard §5.8 names **a table
wrapper** as a thing that scrolls sideways inside its own container, and requires an inset shade at
the continuing edge plus a header count reading _"scroll sideways for the rest"_. **Never a frame,
never an arrow.**

**Fitting eight columns into 641px means either hiding a clinical column outright — which is the
defect being reported, committed deliberately — or dropping text below the type floor.**

### ⚠️ The condition, which is the whole ruling

**The test currently forbids any overflow at all. It is being rewritten, and rewriting a test so a
failing case passes is how a guard becomes decoration.** So the replacement must be stricter where
it counts: **overflow is permitted ONLY together with the shade AND the sentence**, and a table that
overflows without them must still go red. **Proven by two separate mutations, not one.**

🔴 **And a finding worth more than the fix:** the old assertion's failure message says the table
_"shows no sign of having more"_ while asserting nothing about signs. **A reader trusting that
message would believe the affordance was covered.** The message described the right defect and the
assertion measured a different one — and it read as thorough for exactly that reason.

## D-10 · WARD LEAD RULING — the overflow affordance is a SENTENCE first and a measured border second, not the standard's shade

🔴 **Mine. It overrides a line of the standard, so the reasoning is written in full.**

**An implementer stopped before building and handed this back rather than choosing. It was right to,
and my brief was the thing at fault: I quoted §5.8 verbatim — "an inset shade in edge-shade … Never
a frame, never an arrow" — without checking whether that mechanism was reachable where the table lives.**

### Three findings, each independently sufficient

1. 🔴 **`--edge-shade` does not resolve in the referral board's stylesheet.** It is declared once, in
   a closed third-edition token set composed into three shell-chrome files only; the board composes
   the second-edition layer. `var(--edge-shade)` there resolves to nothing **and the shadow silently
   does not paint.** ⚠️ **A fix that looks applied and is not is the worst outcome available here**,
   and it is the shape this project already has a name for — _declared somewhere is not resolvable here_.

2. 🔴 **This codebase has already rejected the shade TWICE, for accessibility, with reasons.**
   `ward-table.module.css` and `coordinator.module.css` both implement this exact affordance and
   both say, nearly verbatim, that a gradient _"degrades to nothing under `forced-colors: active` —
   the defect this design language has already shipped once."_ **Two independent reasoned decisions
   against, and my brief would have made a third pattern to contradict them.**

3. **The standard's own reference stylesheet uses the shade — but pairs it with a `forced-colors:
active` border fallback that neither ward implementation adopted.** So even the faithful reading
   requires inventing a pattern that exists nowhere in `src/`.

### The ruling

**The SENTENCE is the affordance. The border is its visual echo.**

- **Mandatory:** the section's own count — `Queued (n)` — carries _"scroll sideways for the rest"_,
  **true only while the table is genuinely overflowing at the current viewport.** ⚠️ **Never a
  static "this table can scroll" claim**, which would be false on a wide screen — the implementer's
  own point, and it is the difference between an affordance and a decoration.
- **Visual:** the existing measured `data-overflowing` border pattern, which survives forced colours.
  **A single edge cue is not "a frame"** — the standard's prohibition is on boxing the region and on
  arrows, and neither is what this is.

**The sentence is the half that works everywhere — forced colours, screen readers, print.** Ruling
for the shade would have bought a prettier cue that vanishes for exactly the users who most need to
be told there is more.

⚠️ **§5.8 of the standard is therefore corrected, not the code — routed to Ward Mockups, the same
disposition as D-6's §B rule 4 and D-8.** It should record that the shade requires a forced-colors
fallback, and that ward tables use the measured border.

### Also reported and worth carrying

**The target test and one neighbour are the only two of five in that file that do not wait for
React's streamed staging copy to clear before measuring.** One flake was observed and passed on
retry. **That is a documented flake risk sitting inside the test being rewritten** — it is fixed in
the same pass, not left for someone to rediscover as a mystery.

# 2026-09-11 — THE OWNER RELEASED THE WHOLE BLOCKED QUEUE

> **His words: _"Go ahead with all recommendations for 12 blockers."_**

⚠️ **THIS IS A DELEGATION, NOT AN ANSWER, AND THE DISTINCTION MATTERS WHEN THESE ARE CITED LATER.**
He has not stated a clinical position on any of the questions below. **Every ruling D-11 to D-15 is
MINE**, made under his standing instruction, exactly as D-4 to D-10 were. **A later reader must not
quote any of them back as "the owner decided".** The banner at the top of this file applies to all
of them.

🔴 **One of them — D-14 — I would still rather he read, and I say so in its own text.** Delegation
is not the same as the decision being unimportant, and the recoverable-direction test that makes the
others safe is weakest there.

## D-11 · A-1 — the half-written referral history WARNS, and is never stored

**The screen today does neither acceptable thing: it neither holds the draft nor warns before losing
it.** A clinician types a patient's history, navigates, and it is gone with no notice.

**RULING: warn before leaving. Do NOT persist the text.**

**Both options fix the reported defect; they differ in what they risk.** Holding the draft means
writing clinical free-text about a named person into browser storage on what is, in a real ward, a
SHARED COMPUTER — where the next user is a different clinician, or is not a clinician. ⚠️ **That
converts a lost-work annoyance into a disclosure**, and this project's rule is that failure degrades
conservatively.

**The warning must say what is actually true** — that the written history will be lost — **not
"changes may not be saved"**, which is the vague form that trains people to click through. **A
warning nobody reads is the same as no warning, and a warning that understates is worse than both.**

**Cost if wrong:** a clinician loses a draft they were explicitly told they would lose. Recoverable.

## D-12 · A-2 — the referrer is the RECORDED SOURCE, and a person only if the record carries one

**Question: who is "the referrer" for a referral arriving from a community team, the police, an
ambulance, a crisis service, or another hospital?**

**RULING: the referrer is the source the record already carries. A named person appears ONLY where
the record holds one, and otherwise reads "Not recorded" — the flat form, per D-6, because nobody is
obliged to fill it.**

🔴 **Never infer a person from a source type.** "Police" is not a referrer's name, and rendering it
in a field labelled as a person makes an organisation into an individual — which on a clinical
record is a fabricated attribution, not a formatting choice. ⚠️ **Same family as §8.3's "never invent
a person's name that could be mistaken for real".**

**Cost if wrong:** the screen says less than it could. The recoverable direction.

## D-13 · A-3 and A-4 — both resolve FOR THE CODE; the drawings change

**Two drawing-versus-code conflicts, one disposition, and the disposition is the one this programme
keeps reaching: the code is right and the standard is corrected.**

**A-3, bed numbering on board tiles.** The drawing puts a bed number on every tile; **the board
component refuses it by explicit design, in two separate comments.** 🔴 **The data does not carry a
per-tile bed number** — `Unit.blocked` is a COUNT, and which tile is blocked or held is recorded as
not knowable. **A number drawn on a tile would therefore be invented, on the screen a coordinator
uses to place people.** The component is right.

**A-4, the community accept/decline controls.** The drawing has them **disabled**; the app has none
and says in prose that the action is unavailable here. ⚠️ **A disabled control is a worse answer than
a sentence.** It shows a clinician a door, gives no reason, and leaves them to guess whether they
lack a permission, whether the patient is ineligible, or whether the feature is unfinished. **The
sentence says which.** The app is right.

**Routed to Ward Mockups. The drawings are edited; no code changes.**

## D-14 · A-6 and A-8 — ADD THE LINK, AND MAKE THE GUARD ENFORCE IN THE SAME CHANGE. Never one without the other.

🔴 **This is the ruling I would most like the owner to actually read, and I am recording that rather
than burying it.** The others are safe because their failure direction is recoverable. **This one's
is not symmetric: once a screen CAN cross-reference a person's movements, the guard is the only
thing that stops it, and a guard is a thing that can be weakened later by someone who does not know
why it is there.**

### The fact underneath both questions

**`Admission` and `Referral` carry no `patientId`. Nothing joins a bed's occupant to a person.**
A-6 and A-8 are that one absence seen from opposite ends: **the gender mix cannot be derived without
the join, and FD-23's privacy guard is written broadly BECAUSE of the same absence.** The guard's own
comment says the screen _"COULD not show referrals even if it tried"_ today, and that a narrower
guard _"would go quiet the day the link lands, which is precisely the day it is needed."_

### Why the link has to be added

**The owner has already ruled — his §8 and §9, carried into D-5 — that gender reaches BOTH bed gates
or neither.** ⚠️ **That ruling cannot be in force without the join.** A `sex_mix` gate needs to know
who occupies the other beds in the bay, and nothing can answer that today. 🔴 **So the present state
is not a cautious middle: it is the owner's clinical ruling built, tested, and inert** — the
_built, correct, tested and unreachable_ shape, on the one gate that decides whether a trans woman
needs two free beds where a cis woman needs one.

### The condition, and it is half the ruling

**FD-23's guard stops being satisfied by an absence and starts being enforced by a test, in the SAME
change.** It must actively refuse cross-referencing outside the permitted paths, and a test must go
red if the new link is used anywhere it should not be. **Neither half ships alone.**

⚠️ **A guard that passes today because the data cannot reach it is not a guard — it is a coincidence
with a comment.** The day the link lands is the day it becomes load-bearing, and that is the same
day. **This is the same both-or-neither shape as D-5, applied to privacy instead of placement.**

**Cost if wrong:** a larger diff and a guard stricter than strictly necessary — which is the
direction to be wrong in. **Cost if the halves are separated: a clinical prototype that can
cross-reference patients with nothing stopping it.**

## D-15 · A-7 — the figure NAMES ITS OWN CLOCK, or it does not ship

**"Due within 2 hours" — two hours before what? Neither the legal deadline nor the access target is
named anywhere, and no two-hour horizon exists in either module.**

**RULING: the tile never shows a bare "Due within 2 hours". The figure states the deadline it counts
against, and derives from a threshold the model ALREADY carries** — the access target and the legal
clock both exist. **"Within 2h of the access target" is a figure; "Due within 2 hours" is a riddle.**

🔴 **And if the model turns out to carry no two-hour horizon that can be honestly named, Command
ships THREE figures and an explicit not-available for the fourth.** ⚠️ **It does not ship a fourth
derived from a threshold chosen to make the tile look complete.** An invented clinical threshold on
the coordinator's first screen is exactly the defect this whole programme exists to prevent, and a
missing tile is not.

**This is §AH's shape again: the noun travels with the number.** A duration on a clinical screen
that does not say what it counts to is not a partial answer, **it is a different claim to every
reader.**

**Cost if wrong:** Command shows three figures and an honest blank. Recoverable, and visibly so.

## D-16 · WARD LEAD RULING — the unwired primary actions use §8.6's EXISTING sentence; nothing new is invented

**An implementer refused to wire this seam and was right. The reason it gave is the ruling's
starting point, and the answer turns out to be already written down.**

### The seam, as it actually is

🔴 **There are TWO DIFFERENT TYPES NAMED `WardPrimaryAction`.**

    ward-nav.ts            a five-kind discriminated union:
                             "new-referral"     carries a menu of three hrefs
                             "record-decision"  no href
                             "contact-team"     no href
                             "export-figures"   no href
                             "none"
    shell/ward-shell-types.ts   { id, label, href }

**Three of the five kinds have no destination.** ⚠️ **So resolving one into the other is not a
lookup — it requires inventing an href, which that file's own comment forbids in terms ("never a
hard-coded destination").** The implementer stopped there and said so in the type's own header.

### The ruling, and it is the standard's, not mine

**Standard §8.6 already answers this, for these exact controls:**

> _"A control that is drawn and not wired says so in its own words: 'Not wired in this prototype.'
> **Export the queue**, Sign out and the New referral flow all say it."_

🔴 **"Export the queue" IS "export-figures".** The house has already decided what an undestined
control does, and has already named one of these three while doing it.

**So: the bar renders all five kinds. `"new-referral"` opens its menu of three real hrefs.
The three without a destination render as controls that say "Not wired in this prototype." in
their own words when used. `"none"` renders no button.** ⚠️ **No href is invented, and the shell
type stops pretending every action has one** — its shape widens to carry a kind, not a bare `href`.

### ⚠️ Why this is NOT the disabled control I rejected hours ago in D-13

**D-13 ruled that a disabled accept/decline control is worse than a sentence, because it shows a
clinician a door and leaves them guessing which of three reasons it is shut.** **This is the
opposite shape: the control WORKS, and what it does is tell you plainly that this part is a
prototype.** The clinician learns the actual fact on the first press. **§8.6's pattern is a live
control with an honest answer; a greyed-out button is a dead control with no answer.**

## D-17 · WARD LEAD RULING — A-8: FD-23 wins. The Patient screen never shows where else a patient has been.

🔴 **Mine, under his standing instruction, and RULED ON THE CURRENT MECHANISM — not a permanent
clinical position of his. A later reader must not cite it as one.**

**`FD-23` says a ward may not see where else a patient has been. My own Q-4 recommendation told the
Patient screen to show a person's current movement. They conflict, and Lane C has had four tasks
blocked on the conflict.**

**RULING: the Patient screen shows neither a person's other movements nor their referral history
elsewhere, to anyone. Q-4 is narrowed to what FD-23 permits.**

### Why, in the order the reasons actually weighed

1. **The restrictive rule wins a genuine conflict on a clinical prototype.** ⚠️ **A screen that shows
   too little can be opened later. One that has shown a patient's movements to the wrong ward cannot
   be closed retrospectively.**
2. 🔴 **I looked for the role-scoped answer first and rejected it on evidence.** "Show it to the bed
   coordinator, who has that fact anyway, and not to a ward" is the attractive ruling. **Role DOES
   gate data in this codebase — `ward-sidebar-content.tsx` filters by it and the reducer refuses a
   ward acting outside its own unit — so the mechanism exists.** ⚠️ **But it is not enforced on the
   Patient screen, and ruling "coordinators only" without the enforcement would be a declaration
   with no effect behind it.** That is the §Y class, and writing one while ruling against it would
   be absurd.
3. **So the ruling costs nothing to enforce: it is what the existing destructure guard already
   pins.** The guard is not an obstacle to the ruling; **it IS the ruling, already built.**

### ⚠️ What it does to the four blocked tasks, and the distinction matters

**Build them WITHOUT the cross-reference.** **If a task's whole content WAS the cross-reference it is
not blocked, it is CLOSED BY RULING** — recorded as closed, never as deferred, because a deferral
with no condition has nobody to un-defer it.

**The door is not nailed shut. When role enforcement reaches that screen, D-17 is revisitable.**

## D-18 · WARD LEAD RULING — the referral query contract carries MODEL values; and `gp` is a question for the owner, not a mapping for me

**Lane C refused to make a two-character fix and was right. Verified here by opening both files.**

### The chain, and each link is worse than the one before

    shell/ward-facade.ts:314   export type ReferralSource = "ed" | "community" | "gp"
    ward-model.ts:1215         export type ReferralSource =
                                 community | crisis_service | police | ambulance |
                                 inter_hospital | ed_medical

🔴 **TWO EXPORTED TYPES, ONE NAME, DISJOINT EXCEPT FOR `community`.** The second instance of §BD's
shape found today, and this one is worse: **`WardPrimaryAction`'s two versions at least described the
same subject. These two are a route and a provenance wearing one name.**

**`ward-nav.ts` imports the FACADE's** and builds the three New-referral menu hrefs from it — so the
menu emits `source=ed` and `source=gp`, **values `REFERRAL_SOURCES` cannot hold.** My own master plan
line 226 wrote the contract the same wrong way.

⚠️ **AND THE FORM NEVER READS `source` AT ALL.** `referral-intake.tsx` reads `patientId` and nothing
else. **So today all three menu items promise a prefill that does not happen** — _an href is not an
arrival_, on the screen where "an answer nobody gave" is the defect `UNANSWERED_VALUE` exists to
prevent.

### The ruling

1. **The query contract carries `ReferralSource` values from the MODEL, verbatim.** `source=ed_medical`,
   never `source=ed`. **A contract that restates a union in its own words can drift from it; one that
   quotes it cannot.** My plan's line 226 is corrected, not the model.
2. 🔴 **The facade's three-value type is RENAMED and stops being called `ReferralSource`.** It is not
   a referral source — it is the route the raise was started from. **One name for two things is how
   this was invisible at every call site**, exactly as with `WardPrimaryAction`.
3. **The menu must not promise a prefill nothing performs.** Either the form consumes `source` — in
   which case it must be a model value — or the menu stops passing it. **Not both wrong at once.**

### 🔴 `gp` IS THE OWNER'S, AND IT IS NOT A NAMING QUESTION

**There is no GP source in the model. A GP referral is one of the commonest real routes into a
mental-health bed.** So either the contract is wrong, **or `REFERRAL_SOURCES` is missing a genuine
clinical pathway** — and that has a reducer, an eligibility path and a board column behind it.

⚠️ **I am not adding a seventh member to a clinical union to make a URL work.** Queued to him as a
domain question, separately from the naming fix above, which proceeds either way.

## D-19 · WARD LEAD RULING — "something is already open for this person" is PERMITTED; "where" never is

**Lane C built `duplicateSentence`, proved it, watched D-14's default-deny guard redden, and
REVERTED rather than widen the allowlist itself — having already assembled the argument for
widening it before the guard ran.** ⚠️ **Its own sentence is why this ruling exists: "the guard
disagrees with the PROCEDURE, not the conclusion, and the procedure is the part that protects
anything."**

### The question, exactly as asked

**May a screen that is not ward-scoped read `.patientId` across several of one person's referrals,
to say only THAT something is open and never where?**

🔴 **The existing allowlist entries are bounded by GRANULARITY — "one person's own single linked
referral, never a history across several." `duplicateSentence` reads across several. So this is a
real distinction and not a formality, and Lane C was right that it is on the wrong side of the line
as drawn.**

### RULING: permitted, and the bound moves from the READ to the DISCLOSURE

**What FD-23 protects is not how many records a derivation touches. It is whether a ward learns
WHERE ELSE a patient has been.** A place-free, ward-free, time-free boolean discloses no location.
**So the granularity bound is the wrong instrument here, and I am replacing it for this one entry
rather than stretching it.**

**Three conditions, all of them load-bearing:**

1. **The sentence says only THAT one is open.** Never where, never which ward, never when, never who
   raised it, never how many. ⚠️ **A count is a disclosure: "three open" narrows the patient's
   history far more than "one is open".**
2. 🔴 **The read is confined to the person the user has ALREADY NAMED on the form in progress.** It
   must not be reachable from a free search or a browse. **This is the condition that matters most
   and it is the one I nearly left out.** Without it the feature is a PROBE: type any name, learn
   whether that person is currently in a mental-health pathway. **The patient search already
   discloses that a person is known; "known AND currently open" is a real increment, and it must
   cost an action with its own record rather than a keystroke.**
3. **A test pins conditions 1 and 2**, so widening either goes red rather than passing review.

### Why permitted at all, stated so it can be argued with

**The harm prevented is concrete: a duplicate referral means two beds held for one person, two teams
working, and that person's care fragmented across both.** **The disclosure is bounded to somebody
the user is already acting on.** ⚠️ **If conditions 1 or 2 cannot be met, the answer is no, and the
feature does not ship — the conditions are the ruling, not a preamble to it.**

## D-20 · WARD LEAD RULING — the drawing wins; the vocabulary anchor was never the heading

**Lane B refused to rename "Accepted, pulled or en route here" → "Coming in" because
`ward-pull-vocabulary.dom.test.tsx` pins that heading in both layers, and handed it back. ⚠️ It also
supplied the argument AGAINST its own caution, which is what made this rulable in one pass.**

### Why I expected to uphold the refusal, and did not

**Its distinction was right in shape:** in the community case a heading LEVEL was incidental to the
property, so moving the query was re-aiming. **Here the wording looks like the property — the
suite's own name is "the ward screen says pull, never hold, about an incoming patient".**

🔴 **But I opened the file, and the property is not carried by the heading.** Fourteen tests:

    :83   getByRole("button", { name: "Pull a bed" }) on an accepted, still-awaiting movement
          -> "pull, about an incoming patient". SURVIVES the rename.
    :84   expect(card.textContent).not.toMatch(/hold/i)
    :121  the same negative, again
    :132  the placeholder's own not.toMatch(/held/i)
          -> "never hold". ALL THREE on cards and the placeholder. SURVIVE the rename.

    :89   the heading assertion
    :130  the heading's text asserted a second time
          -> the ONLY two the rename touches.

**So the vocabulary survives in the context the suite names, and the heading was a second copy of it
rather than its anchor.**

### The ruling

**Rename the heading to the drawn name. Re-point `:89` and `:130` at it. Leave `:83`, `:84`, `:121`
and `:132` untouched — those ARE the property.** ⚠️ **And write into the file that the anchor is the
button and the three negatives, NOT the heading**, so a later reader does not restore the heading
assertion "to be safe" and quietly re-pin a wording the drawing has moved past.

**The placeholder keeps its fuller wording — "No patient is currently accepted, pulled or en route"
— unless the drawing draws a different one.** 🔴 **That is deliberate: with the heading shortened to
"Coming in", the empty state becomes the one place that still tells a coordinator what the list
would contain.** The fuller vocabulary lands exactly where somebody needs the explanation.

⚠️ **Lane B must verify the drawing actually renames this heading and does not also rename the
placeholder. I am ruling on its report; I have not opened the drawing.**

## D-20-REVISED · the drawing renames BOTH, so neither side is taken whole

🔴 **D-20 as written rested on the placeholder surviving. Lane B opened the drawing — which I had
not — and it renames both. The ruling is re-made, not patched.**

    drawing  <h2 id="comingH">Coming in</h2>
             "Nobody has been accepted to this ward and nobody is on the way.
              Absence here means none, not that none was asked for."
    app      <h2>Accepted, pulled or en route here</h2>  (+ a disagreeing aria-label)
             "No patient is currently accepted, pulled or en route to {unit.name}."

⚠️ **Lane B's measurement is the ruling's substance: the drawing's empty state is not a trim, it is a
DIFFERENT CLAIM and a weaker one.** The app names three states a coordinator distinguishes —
accepted, pulled, en route. The drawing names two and folds "pulled" into "on the way". **A pulled
bed and a patient en route are not the same thing on this screen, and that same drawing's own body
text says so elsewhere.**

**Taken whole, the drawing removes "pulled" from the panel in every layer and every state.**

### 🔴 BUT THE DRAWING HAS SOMETHING THE APP LACKS, AND IT IS HOUSE DOCTRINE

> _"Absence here means none, not that none was asked for."_

**That is this project's own absence discipline, written into an empty state — the distinction
between "nobody is coming" and "we did not ask". The app's sentence does not make it.** ⚠️ **Ruling
for the app whole would throw that away, and it is the better half of the drawing.**

### THE RULING: take the heading, take the drawing's second sentence, keep the three states

    heading        "Coming in"                       the drawing's, both layers together
    empty state    the app's three states, carrying the drawing's absence sentence

**Neither side is taken whole, because each is right about a different thing.** 🔴 **The composed
empty-state sentence is WORDING NOBODY DREW and is logged as such under §5.0(2).**

**And the drawing is corrected to match: its empty state should name three states, not two.** Routed
to Ward Mockups, so the two converge rather than staying split.

⚠️ **Both layers move together.** Lane B has found a third heading/`aria-label` pair on this screen
that already disagrees. Whatever is rendered, both carry it.

### What this does to the guard, which is more than re-pointing two lines

**Lane B is right that this is not the edit D-20 described.** `:129` finds the placeholder by text
and BRANCHES on it, falling back at `:130` to asserting the heading. **If both strings move, both
arms of that if/else point at nothing.** **Rewrite the branch against the new strings; leave `:83`,
`:84`, `:121` and `:132` untouched — those are the property and always were.**

## D-21 · WARD LEAD RULING — tasks 10 and 12 are CLOSED, not deferred, and not built as callerless modules

**Lane C applied D-17, found 9(b) and 9(c) had no remainder once the cross-reference was removed,
and then recommended closing 10 and 12 rather than building the pure modules they would leave
behind. Adopted, on all four of its reasons — and the third is mine turned back on me correctly.**

1. **Neither would have a caller.** The only screen that was going to call `patientJourney` and
   `handoverSummary` is the one D-17 closed. 🔴 **This repository already carries two P1 clinical
   safeguards whose only callers are their own tests.** Building these adds a third, with a green
   suite vouching for it.
2. **Task 12's catcher stops existing.** Its whole proof was _"the copied text equals the rendered
   summary"_. With nothing rendering it, there is no catcher — and by this project's own rule, no
   catcher is a defect in the brief, not a reason to proceed.
3. 🔴 **Task 12's Coordinator/Ward toggle IS role-scoping.** D-17 says role enforcement does not
   exist on that screen, and that ruling "coordinators only" without it would be a declaration with
   no effect. ⚠️ **A toggle would be exactly that declaration, wearing a control — and worse than
   the ruling I declined to write, because a user can SEE it and would believe it.**
4. **It may duplicate Lane A.** `stageChanges` is already rendered by `delays-screen.tsx` and
   `ward-management-console.tsx`; a third traversal is the drift task 12's own catcher existed to
   prevent.

**Recorded CLOSED BY RULING. Not deferred — a deferral with no condition has nobody to un-defer it.**

**The two pure modules go to whoever owns a screen that legitimately holds a movement, if that
screen ever wants them. They are not built on spec.**

## D-22 · SHAPE 2 — the landmark label and the heading stop being two strings

**Asked by Lane B, deferred by me to the structural fold, and it should not have waited on that
fold — the answer does not depend on it.**

**Two survivors:**

    aria-label "Withdrawn referrals"                  <h2>Withdrawn from {unit.name}</h2>
    aria-label "Overrides recorded against this ward" <h2>…against {unit.name}</h2>

**RULING: point the landmark at its own heading with `aria-labelledby`, and delete the
hand-written string.**

🔴 **The question as posed — is a generic label over a name-interpolating heading correct? — is the
wrong question, and answering it either way leaves the defect.** Both sites hold **a hand-written
region name and a visible heading that must agree, with nothing forcing them to.** That is the
same shape Lane B independently diagnosed in A4 hours later: two places that must match, and no
mechanism making them.

**Choosing better wording leaves two strings. `aria-labelledby` leaves one.** ⚠️ **And it dissolves
the generic-versus-interpolated question rather than settling it** — the landmark simply IS the
heading, whatever the heading later becomes, **including after the structural fold into _The record
for today_.** A shape that cannot break beats a check that notices it broke.

**The reason it is not merely tidier: a screen-reader user hears the landmark name and then the
heading, so today those are two different names for one region** — an inconsistency invisible to
sighted review, to screenshots and to every gate, which is the `a-refusal-contradicted-in-an-invisible-channel`
channel exactly.

⚠️ **CAVEAT, AND IT IS LOAD-BEARING: if either site's `h2` is conditional, absent in an empty
state, or rendered by a different component, this must NOT be forced — flag it and that site is
ruled separately.** An `aria-labelledby` pointing at an element that did not render leaves the
landmark with **no name at all**, which is worse than a mismatched one. **The repair's failure mode
is silent and is the same shape as `declared-somewhere-is-not-resolvable-here`.**

**Consequence: C-6, the structural fold, no longer carries a landmark-wording decision.**

## D-23 · The bed board passes an empty leave-bed list into three capacity figures, and says nothing

**RULING: `board/ward-board.tsx` either passes real leave beds, or it says in words that leave beds
are excluded from these figures. It may not keep doing neither.**

    780:  const leaveBeds = [] as const;
    782:  headlineAvailable(unit, admissions, bedReleases, [...leaveBeds], now)
    792:  constraintSentence(unit, admissions, bedReleases, [...leaveBeds], now)
    827:  capacityBreakdown(unit, [...bedReleases], [...leaveBeds], now)

**Which of the two is the implementer's call from the code. If leave beds are genuinely not a
concept on that board, the sentence is the honest answer and the cheaper one.**

🔴 **`capacityBreakdown` itself is not to be touched.** It is read by Capacity, Ward and Statistics,
and whether an empty leave-bed list is correct at those call sites is a separate question nobody
has asked. **A shared derivation's correctness is per-call-site.**

⚠️ **Measure before building:** if no unit in the seed carries a leave bed, the figure is correct
today and wrong only for data that does not exist yet — which makes the sentence the right answer
rather than merely the cheap one. Full reasoning: errata §CA.

## D-24 · The raw `1.2` line-height — token it, and accept that community no longer matches

**RULING: `.screenName` uses `--ward-leading-tight` (1.15). The comment above it is rewritten to
say what is true: this heading uses the canonical tight token; `community.module.css` has not been
migrated and still carries a raw `1.2`.**

**Lane B was right not to "just fix it" — the fix was a decision.** The two costs, weighed:

- **The mismatch is the smaller cost.** 1.15 against 1.2 on a single-line heading is a difference
  nobody will see, and the two headings never appear on the same screen.
- **The false comment is the larger cost**, because it is read as a rule and it is wrong: it says
  "Tokens only" directly above a raw literal.

⚠️ **And the consistency the comment claimed was never real.** Copying a raw literal from
`community.module.css` did not make the two files consistent — **it made them identically
non-compliant**, both counting against `rawLineHeightLiterals`. **Community's `1.2` is a defect
too. It is simply not Lane B's file today**, and is logged as an open row rather than fixed across
a lane boundary.

## D-25 · Command's `deadlineLine` sentence is not built — and this DEFERS the R-5 question rather than answering it

**RULING: the drawing's three-branch deadline sentence is not built until `withDeadline` exists as
a real derivation.**

    r.waiting === 0        "Nobody waiting here"        derivable
    r.withDeadline > 0     "N deadlines being met"      🔴 no such field, nothing computes one
    otherwise              "No deadline recorded"       derivable

🔴 **Building the two derivable branches does not leave a gap — it makes the third branch FALSE in
every case the missing one would have caught.** A department meeting its deadlines falls through to
_"No deadline recorded"_. **An unbuildable middle branch is a guard on the branches below it.**
Full reasoning: errata §CL.

⚠️ **THE QUESTION THIS DOES NOT SETTLE, stated so nobody cites D-25 as having settled it:** R-5
forbade _"No deadline recorded"_ on **Delays**, where the subject is a PATIENT with no legal
deadline and silence is the honest answer. On **Command** the subject is a DEPARTMENT where no
waiting patient has one. **Same words, two different claims, two different screens** — and the app
renders nothing in both places today. **That becomes decidable when `withDeadline` exists. D-25
buys the time; it does not spend it.**

**Lane A refused to build the string on a ruling made about a different subject, and was right to.**

## D-26 · `edPressure` becomes a projection of `edHomeSummaries` — the two screens stop being able to disagree

**RULING: `edPressure` is redefined as a projection of `edHomeSummaries`, keeping its own name, its
own exported shape, and its own worst-first sort.**

**This retracts BOTH earlier rulings on the question** — §AG (_"Command derives from
`edHomeTotals`/`worstEdSummary` directly"_) and R-1 (_"Command derives from `edPressure()`"_).
**Both were mine, a day apart, and neither asked whether the two derivations were the same
computation. They are:** identical population, identical `waiting`, identical clamped
`longestWaitMinutes`, independently written, with one file's comment already noting it _"mirrors
`edPressure`'s own clamp exactly"_.

🔴 **§AG's CONDITION survives and is the point: Command and ED home must not be able to disagree
about one department.** ⚠️ **But the cross-screen test it asked for would assert that two faithful
copies agree — it passes by construction and has never discriminated.** And this function has
already produced that exact hazard once: its own doc comment records _"two panels on one screen
disagreeing about one department, and no test could see it."_

**So the condition is satisfied structurally rather than asserted.**

✅ **Safety of the change:** `breaching` filters `open`, and `EdSummary.open` is already kept with a
comment saying it exists so a caller need not re-filter. `EdPressure`'s public type does not change,
so its eighteen call sites are untouched. **`tests/ward-pressure.test.ts`'s seventeen assertions
stay exactly as written and are the proof the projection is faithful — not one may be edited, and a
red one means the projection is wrong.**

**Sequencing: D-26 lands before C3's pressure-strip work, so the strip is built on the joined
derivation rather than migrated onto it afterwards.** Full reasoning: errata §CK.

## D-27 · The word for a free bed is READY — and the ruling is about the WORD, not the identifier

**RULING: _Ready_ is the only word a coordinator reads for a free bed. Neither _Available_ nor
_Unoccupied_ may appear as user-visible text.**

**This replaces the master plan's §4.4 and §4.14 done-when, which said _"Available is the only word
for a free bed (never Unoccupied)"_.** 🔴 **Neither word exists anywhere in the capacity module.**
The bed states are `"ready" | "held" | "blocked" | "occupied"`, labelled _"Ready"_, _"Held — not
offered"_, _"Blocked — out of service"_, _"Occupied"_. **A vocabulary rule naming a word the code
does not use does not tidy the vocabulary — it ADDS to it**, which is the defect the rule exists to
prevent.

⚠️ **THE CLAUSE THAT MUST TRAVEL WITH IT, found by Lane E: `available` DOES exist five times — as a
`data-state` attribute value and a CSS selector** (`bedChip[data-state="available"]`,
`diagramBedChip[data-state="available"]`). **It is an internal state token nobody reads.**

🔴 **So the next person who checks this ruling with a grep will find `available` in the codebase and
conclude the ruling was wrong.** And a vocabulary guard written as a naive grep over the module
**would go red on correct code** — `a-guard-that-blocks-its-own-purpose`. **The ruling is about the
rendered word; the identifier is out of scope and stays.**

**Lane A has already fixed this in its own plan (`99c2124a23`), with its assertion written so that
it keeps _Available_ and _Unoccupied_ ABSENT rather than introducing one of them — plus a note that
both are absent today, so nobody later reads the assertion as a migration target.**

## D-30 · `Unit.forensic` is a WARD flag, and every rendered string says so

**RULING: the rendered word is WARD. Five strings changed, in one commit, deliberately crossing two
lanes' files because a half-fix here creates a fresh contradiction.**

    hub-screen.tsx:738        pill "Forensic bed"                    -> "Forensic ward"
    ward-eligibility.ts:204   "${unit.name} is a forensic bed …"     -> "… a forensic ward …"
    ward-eligibility.ts:205   "${unit.name} is not a forensic bed"   -> "… not a forensic ward"
    ward-eligibility.ts:482   same, the referral path
    ward-eligibility.ts:483   same, the referral path
    ward-model.ts:439         the doc comment that seeded all five

🔴 **The two eligibility strings are the clinical half, not the pill.** They are the gate detail a
coordinator reads when a ward is not offered: _"Broome Adult Secure is a forensic bed and is never
offered as a destination."_ **That reads as one excluded bed. It is a six-bed ward, all of it
excluded** — a coordinator weighing whether to push for a place was being told a smaller thing than
is true.

### 🔴 The correction already existed in the same file, 204 lines from the defect

**`hub-screen.tsx:942`, in the screen's own governance comment:** _"…it called Broome's forensic
ward a forensic BED, which is a whole-ward flag covering six beds. Those claims are omitted or
corrected rather than softened."_

**Somebody found this exact defect in the mockup's footer, named it precisely, stated the correct
fact, and corrected the disclosure prose — while the badge two hundred lines above kept saying
"Forensic bed".** ⚠️ **Which is why the build plan records it as already fixed. It is HALF true, and
that is what let it stand: a partial fix with an articulate write-up is more convincing than no fix
at all.**

### The trap that makes this a ruling and not a rename

🔴 **`coordinator/shortlist-panel.tsx:167` maps `forensic` to "Forensic history" — a fact about a
PATIENT.** A sweep over the word turns a person's history into a claim about a ward. **One word, two
subjects.**

✅ **`referrals/referral-match.tsx:650` renders the bare word `Forensic` — no noun, so no scope
claim, so it cannot be wrong in either direction. That is the pattern to copy where space is tight.**

### Scope, stated so the remainder is not read as a miss

**Explanatory prose in about twenty comments and test titles still says "forensic bed", deliberately
untouched** — it spans four lanes' files and rewriting it would be the cross-lane sweep this ruling
forbids. **`ward-model.ts` is the authority; that prose is stale, not competing.** A read-only sweep
confirmed **zero rendered occurrences remain** and enumerated the residue by owning area.

⚠️ **Two stale test assertions were found by that sweep and NOT by me** —
`ward-screen-eligibility-warning.dom.test.tsx:105` and `ward-screen-eligibility-warning.test.ts:70`,
both pinning the old wording. **I had grepped the tests, seen a count of two against those files, and
not opened them.** Acting on a count again, in the same session in which I wrote the rule against it.

## D-32 · D-6 is restated: ONE WORDING PER STATE, and the states are named

**RULING: D-6's "two permitted forms" is replaced by "one wording per state, and these are the
states." No call site changes.**

**A read-only assessment read every non-comment render site for the fourteen absence forms. Its
finding is that the code is already right and the RULING was wrong:** every state has exactly one
wording, and each is a form already in use. **D-6 as written is true of the person screen and reads
as a repository-wide cap that six correct strings already breach.**

⚠️ **So the reconciliation is to the decision, not to the code — which is the opposite of what I
expected and the reason the job was worth doing.** Had anyone acted on D-6 as written, they would
have merged states that differ in what a coordinator does.

**Two of the fourteen forms do not exist as rendered strings at all:** _"Nothing attached"_ is quoted
in two comments recording that it was REJECTED, and _"Not known"_ appears only in comments and seed
prose — the rendered string is _"Suburb not known"_, which is **an accepted answer, not an absence.**
🔴 **Both were in my inventory because a grep counted comments as call sites** — the third instance
of that today.

**The eight states, each with one wording and a distinct coordinator action:** nobody was obliged to
record it (_Not recorded_) · a required step not taken (_Not yet recorded_) · nobody reported the
figure to this screen (_Not tracked here_) · an action on this movement not started (_Not yet
requested_) · a hypothetical row where nothing is owed (_Not yet booked_) · a question unanswered
(_Not assessed_) · computable but too thin to publish (_Not enough data to compute_) · recorded but
not re-confirmed this session (_Not confirmed since this page opened_).

**Three forms leave the inventory entirely because they are not absences:** _Not eligible_ is a
computed verdict a coordinator overrides with a reason; _Not stated_ is **a recorded patient answer**
in the Aboriginal and Torres Strait Islander category set, where merging it would overwrite a
person's actual answer with a claim that nobody asked; _Nothing to chase_ is a stated consequence of
closure.

## D-33 · "Nothing outstanding" does three jobs, and only one of them may keep the words

**RULING: the words belong to the RECORDED ANSWER. The two computed emptinesses must say something a
reader cannot mistake for a ward's finding.**

    a ward's recorded finding on a bed release   ward-model.ts:1093, seeded ward-movements.ts:1214
    "every check passed" on the attention rail   ward-management-console.tsx:1551
    an empty list placeholder                    ward-tasks-drawer.tsx:155

🔴 **The first is a clinical assertion a ward made. The third is a list being empty.** ⚠️ **And
`ward-discharge-dates.ts:34-42` exists specifically to stop a derived release defaulting to that
value, because blank there means NOBODY LOOKED — so the codebase already treats this string as
load-bearing data in one place while using it as furniture in two others.**

**This is the same axis D-6 already reasoned about for _Not stated_ against _Not recorded_: a
recorded answer and a computed emptiness must never share a form.** A coordinator who cannot tell
them apart cannot tell "the ward says there is nothing outstanding" from "we have not heard from the
ward".

⚠️ **I am NOT choosing the replacement wording.** The two sites belong to different lanes, and the
console's all-clear already carries a body sentence doing the honest work — _"That is the checks
passing, not a guarantee that nothing is wrong"_ — so the fix may be as small as the heading.
**Each owning lane proposes wording that satisfies the property; anything that changes what the
screen CLAIMS comes back to me.**

## D-34 · A hypothetical destination row may not use obligation vocabulary at all

**RULING: the network's shortlist row stops reaching for an absence wording. Nothing is owed on that
row, so it must not render a form from the "somebody must act" family — including _Not yet booked_.**

**The problem, as measured:** _"Not yet requested"_ (`ward-derivations.ts:458`, `ed-screen.tsx:644`)
means **book transport now**; _"Not yet booked"_ (`ward-management-network.tsx:186`) means **this is
a candidate ward and nothing pertains to it.** ⚠️ **Two strings a glance cannot separate, denoting
opposite obligations.**

🔴 **And the history proves the hazard is live, not theoretical:** the comment at
`ward-management-network.tsx:170-178` records that using the FIRST wording here previously labelled
**the wrong ward** as awaiting transport.

**Choosing a third absence wording would be the wrong fix — it would still put the row in the
obligation register and rely on a reader distinguishing three near-identical phrases.** The row's
truth is about SCOPE, not about a missing value: transport is not a fact about a ward that has not
accepted anybody. **The owning lane proposes wording on that basis and brings it back, because it
changes what the row claims.**

## D-31 · The plan's disposition — delete one half, re-derive the other

**RULING, adopting Ward Builder Four's recommendation after it measured 124 claims across all sixteen §4 sections: 61 true, 33 false, 26 partly (±3 on its own dual-verdict caveat).**

🔴 **The finding that decides it is not the ratio. It is that the plan's errors are sorted by cost in exactly the WRONG direction.**

    STOPS A BUILDER — all cheap        SHIPS — all expensive
      a phantom identifier               a ruling the plan reverses, rebuilt AS COMPLIANCE
      a route that 404s                  a "keep" with nothing to keep
      a wrong "Reads" list               correct wording replaced with worse
      a task that is already built       a catcher that cannot catch its task
                                         "not built" that is false of the model

⚠️ **So a builder's experience of this plan is that it is a bit sloppy and self-correcting — and that impression is manufactured by the harmless half being the loud half.** A plan that visibly catches itself twice a day earns trust it has not got.

**DELETE, do not correct: every line count, every file line-number citation, every route path, every "Reads" list, every link-in/link-out inventory.** **A plan that does not state a line count cannot state a wrong one**, and every one of these has a live authority one grep away. Correcting them buys a day of accuracy and re-rots — six of six were wrong within a week.

**RE-DERIVE from the code, claim by claim: every "App today", every Task, every "not built", every "keep", every named catcher, every panel wording.** These are the silent half.

**Plan v2's acceptance condition, and it is a PRECONDITION rather than advice:** _every "comes from" claim must name a file that actually contains the symbol, checked mechanically._ 🔴 **Four attributions of one module to three wrong screens is the hypothesis confirmed, not a suspicion.** ⚠️ **And v2 carries MORE risk than v1 if the class survives: v1 has a known-bad reputation and gets checked; a second edition reads as freshly measured.**

## D-35 · The ED pressure strip does not narrow to the selected service, and #6 is CLOSED

**RULING: the strip shows the whole network. The drawing's empty-state sentence is not built — not deferred, closed.**

**Lane A refused the build and measured why; verified independently before accepting:**

    ward-sites.ts:745       allEmergencyDepartments() => wardSites.flatMap(...)   static, unfiltered
    pressure-strip.tsx:35   no scope prop, no service prop, zero filter hits

**`pressure.length` is a constant 8.** An ED with nobody waiting still renders — _"No patients waiting"_. **The list is empty only if the network has no departments at all.**

**The clinical reason the strip stays network-wide:** the service selector scopes _what you are managing_, and **ED pressure is the thing a coordinator most needs to see from OUTSIDE their own service** — a patient waiting at another service's ED is precisely the one who may need a bed in yours. Narrowing it would hide the pressure that generates the referrals.

✅ **`WardFlowShell.visible` already filters the QUEUE and not the departments, so this ratifies a line somebody had drawn rather than inventing one.**

⚠️ **Consequence: item 1 (the service name inside the site code) is NOT the same question and is unblocked** — the card is always shown, so that is a labelling change, not a scoping one. Full reasoning: errata §CM.

## D-36 · _Referrals into this ward_ / _into the team_ — PRESENTATION, with a condition

**RULING: presentation work for Lane E, NOT a new question.** `statistics-derivations.ts` already exports `referralToBedJoin` and the decline derivations; a referral count into a ward is the same fact the referral board renders, aggregated.

⚠️ **CONDITION: confirm the derivation answers the DRAWING's question before building.** If the drawing wants referrals _received_ and the derivation counts referrals _that reached a bed_, those are different denominators — **and it becomes a new question, which is mine.**

## D-37 · _Clinically ready, not yet gone_ — PRESENTATION, and the heading must name its subject

**RULING: presentation. `readyToLeaveCannot` exists.**

🔴 **Carry the ruling that already governs the word: "ready" means two different things in this domain — a ready BED and a patient ready to LEAVE — and a guard on the word cannot tell them apart.** **The section heading names its subject explicitly or it does not ship.**

## D-38 · _People currently in a hospital bed_ on community team statistics — an aggregate that identifies at small N

**RULING: the count may be shown only where it cannot single somebody out. Below that threshold the screen states that the figure is too thin to publish, using the existing "not enough data to compute" form.**

**D-17 is not what this turns on.** D-17 forbade the Patient screen showing where else a patient has been — a claim about **one identified person**. A count across a team is an aggregate and is legitimately useful to a community team.

🔴 **But the count identifies at small N.** A team with four open cases, one of whom is in hospital, renders **"1"** — and to anyone who knows that team's caseload, that is the person named. ⚠️ **An aggregate is only an aggregate above a threshold, and a small-caseload community team is exactly where this screen is thinnest.**

✅ **The existing wording is right for a reason beyond convenience: "computable but too thin to publish" is this case exactly rather than an approximation of it**, and it is a state the app already has a ruling behind (D-32, state 7).

🟢 **THE THRESHOLD IS FIVE. The owner's word, verbatim, 2026-09-11 evening: "five".**

**He was asked to set a second number of a kind he had already set once, rather than to invent a policy.** The precedent is `MINIMUM_EFFECTIVENESS_SAMPLE = 5` (`ward-derivations.ts:1658`), whose own ruling reads _"below `MINIMUM_EFFECTIVENESS_SAMPLE` a measure reads 'Not enough data to compute'"_.

**So: fewer than five in the group → the count is suppressed, the screen renders `Not enough data to compute`, AND THE DENOMINATOR IS STILL SHOWN.** ⚠️ **The denominator is not decoration.** `ward-management-modes.tsx:235` records the pattern — _"the screen says 'from 1 of 27' beside 'Not enough data to compute'"_ — **and without it a community team cannot tell a deliberately withheld figure from a broken one.**

🔴 **IT IS A NAMED EXPORTED CONSTANT BESIDE ITS CITATION, NEVER A LITERAL AT THE CALL SITE** — for the same reason `MINIMUM_EFFECTIVENESS_SAMPLE` is one. **A privacy threshold hard-coded where it is used is a number nobody can find when it needs changing.**

⚠️ **THIS LINE EXISTS BECAUSE LANE D REFUSED TO BUILD THE NUMBER FROM A MESSAGE.** D-38 was committed before the owner answered, so the rule was citable and the threshold was not — and it declined to take the most consequential value on the screen from a relay. **It was right: this number decides when a patient becomes identifiable from an aggregate, and the screen must read it from the record rather than from any chat's memory of a conversation.**

## D-39 · _Contacts_ and _Time to first contact_ — HELD, build neither

**RULING: held pending a contradiction Ward Builder Four is measuring.**

**The drawings put _"Contacts are not recorded in this prototype"_ on the same screen as a panel named _Time to first contact_.** ⚠️ **Two panels about contacts — one denying they exist, one promising a measurement of them.** Anything built there inherits the contradiction.

🔴 **And the substantive claim is TRUE with a false-presence trap under it:** no `contactedAt`, `firstContactAt` or `contactRecord` exists anywhere — **but `ward-model.ts:982` carries `escalation?.contact`, an escalation's contact PERSON.** A builder checking the claim with a grep reads it as false. Same for `catchment`, which appears across six community modules: **what is not built is INFERRING TEAM MEMBERSHIP from catchment, which is an owner's ruling, not an absence of code.**

## D-40 · An empty check array never claims reconciliation — on either shell surface

**RULING: `reconciliationSentence([])` returns "No reconciliation is available for this page yet." with a NEUTRAL tone, and `hubReconciliationLine` gains a third state for the same fact. Built and mutation-proved 2026-09-11.**

### What was on screen, on every ward route

```
layout.tsx:103            <WardRail checks={[]} />        the sole layout under mockups/ward-flow
ward-rail.tsx:268         <WardReconciliationLine … />    UNCONDITIONAL
ward-reconciliation-line  problems.length === 0 ? "Invented figures, reconciled with each other"
hub-screen.tsx:311        hubReconciliationLine(0)        a hardcoded zero
```

🔴 **A positive assurance that the figures AGREE, produced by checking nothing** — and `open` defaults to true, `.railCheck` carries no `display` rule at any width, so it was **plain visible text in the rail**, not screen-reader-only. **On `/mockups/ward-flow/hub` it appeared TWICE: the rail's and the hub's own.**

⚠️ **In an app whose governing rule is that an absence is stated in words and never implied, this is the rule inverted: a reassurance manufactured from the absence of evidence.**

### 🔴 Three things that make this worse than a bug

**1 · The owner had already refused a fold over the identical defect in the sibling.** `ward-bar.tsx` was repaired for exactly this shape and carries the reasoning in its own words: _"an empty `checks` array is not the same fact as 'every check passed' — it is the fact that nothing was reconciled at all, and this bar must never present the two as identical."_ **The rail then shipped it.** ⚠️ **And the bar fix's own test file recorded the rail as _"untouched by this fix and out of this brief's scope"_ — A SCOPE LINE, NOT A DESIGN ARGUMENT, and it is what let the identical defect stand next door.** I wrote that fix and did not ask which siblings shared the shape.

**2 · Nothing under `src/` builds a `WardReconciliationCheck[]`.** So the agreeing branch was **unreachable in production** and the empty branch was **the only sentence this component ever produced in the running app.**

**3 · 🔴 EVERY EXISTING TEST PASSED A NON-EMPTY ARRAY.** `ward-shell-third-edition.dom.test.tsx` renders with `OK_CHECKS` or `FAILING_CHECKS` and defaults to one of them. **The one array the app actually passes was the one array nothing covered.** ⚠️ **A suite can be large, green, and complete over every input except the only one production uses.**

### The signature carried the defect, which is why the hub needed a type change

**`hubReconciliationLine(problems: number)` cannot distinguish "every check passed" from "no check ran" — one word, two states, in a parameter type.** It now takes `number | null`. ⚠️ **A sentinel number would have hidden the same collision one level up.** The disagreeing branch is KEPT, as the screen's own note instructs.

✅ **Proved by mutation: removing the guard reddened three assertions including the cross-surface property test. `tests/ward-reconciliation-empty-checks.test.ts` is the guard, with an anti-vacuity floor on the POPULATION — it fails if either surface leaves the suite.**

**Still open and now Phase 1's: standard §8.7 — how a screen supplies its checks. Until that lands, the neutral sentence is the only one any ward screen shows.**

## D-41 · `corridorCounts` is extended, and its POPULATION changes

**RULING: one derivation, three kinds. `corridorCounts` stops being a group-by over movements that happened and becomes an enumeration of corridors that could exist, each with what happened on it.**

🔴 **"Grow a `kind`" understates it and the understatement is the finding.** The function is a group-by: every row it can emit has at least one movement in it. **A never-used corridor has ZERO movements — it is not a row with `count: 0`, it is a row the loop never visits.** ⚠️ **You cannot obtain an absence from a group-by, and no field added changes that.** The drawing requires them: its own self-check fails with _"no never-used corridor is drawn"_.

✅ **Extending rather than adding a second derivation is Lane A's reasoning and it is right: a second derivation over the same movements is the two-copies shape D-26 just removed from `edPressure`.**

⚠️ **`refused` must be MEASURED before it is built.** The loop's two `continue`s (`!isOpen`, `acceptedUnitId === undefined`) discard exactly the rows a refusal would live in. **And a referral is never addressed to a named ward (see D-42), so if corridor refusals rest on "this ward was asked and declined", that fact may not exist.** **An invented refusal on a corridor diagram is a claim that a ward said no to a place it was never asked about.**

**Also ruled: build the drawing's thin-range branch, because the drawing's own threshold classifies this seed as too flat for width alone** — `thicknessAlone = maxJourneys − minJourneys >= 4` is FALSE at `2 − 1 = 1`. 🔴 **Build it because the threshold says so, not because the diagram was judged flat: a judgement expires when the seed changes; a threshold re-evaluates itself.** **Lane A's generalisation, kept: words-before-colour applied to WIDTH.**

## D-42 · _Referrals into this ward_ renders bare counts. No share.

**RULING: accepted and declined as bare counts, no share and no percentage, and the section says in its own words that a referral is not addressed to a ward so a share cannot be computed.**

**The drawing asks for an accepted SHARE. A share needs referrals RECEIVED as its denominator. That denominator does not exist:**

    ReferralDestination, psychiatric_ward arm    no unit id
    ReferralAddressing.acceptedUnitId?           the unit that ANSWERED, never the one addressed
    statistics-claims-register.ts:251            "acceptedUnitId is the ONLY field that can name a unit"

⚠️ **NOT the "not enough data to compute" form** — that means computable-but-too-thin. **This is not computable at all, and D-32 forbids one wording for two states.**

### 🔴 The asymmetry, and it is aimed at a family that shares a layout

    psychiatric_ward      → no identifier   "Referrals into this ward"   NOT derivable
    emergency_department  → edId            "Referrals into this ED"     derivable
    community_team        → teamName        "Referrals into the team"    derivable

**Three near-identical titles on three sibling screens. Two presentation, one impossible.** ⚠️ **"One build, three variations" makes reasoning by analogy the natural and efficient thing to do — and reasoning by analogy from either sibling ships a percentage with an invented denominator.** **A shared layout invites the assumption of a shared model, and the model is where they differ.**

**The model change — addressing a referral to a named ward — touches FD-21 and the intake form and is the owner's. It goes to him as a question, not into a queue.**

# OWNER ANSWERS, 2026-09-11 night — eleven items, in his words

**Put to him as a consolidated list with one recommendation under each. His replies are quoted
verbatim below; where he wrote "your recommendation", the recommendation he was agreeing to is
reproduced in full so nobody has to reconstruct what he approved.**

## O-1 · Narrow widths — SCROLL SIDEWAYS, and show that it does · 🔴 A RATIFICATION, NOT A NEW RULING

🔴 **READ THIS FIRST: THIS QUESTION WAS ALREADY ANSWERED, BY D-9, AND I ASKED HIM ANYWAY.** D-9 ruled
scroll-sideways under his standing delegation; it was BUILT at `775ae2530e` and `b04e796a25`; and the
guard was rewritten to match at `ui-ward-referrals.spec.ts:1144`. ⚠️ **The standing summary at the top
of this file still said the question was open, and a summary is read far more often than a ruling six
hundred lines down — so the stale line was the one in circulation.** **I told him three times tonight
that this was the oldest open item and genuinely his.**

✅ **He chose what D-9 had already chosen, independently, so the outcome never diverged and the code
needs no change.** **Found by Ward Verifier, which had relayed my stale claim to him and then went
back to the record.**

**His word: _"your recommendation"_, to:**

> **Scroll sideways, with a visible sign that there's more.** Stacking changes what a coordinator can
> compare at a glance, which is the point of a table.

**RULED. Content does not drop and stack at narrow widths. It scrolls, and the screen says so.**

⚠️ **The finding under it, fully characterised: ONE column, ~17px, at 641px ONLY — 700, 760 and 820
are clean.** ✅ **And it had been open longest of anything on the programme, specifically so that
nobody folded it into a repair.**

## O-2 · "Not a measurement" means three things — THREE PHRASINGS

**His word: _"your recommendation"_, to:**

> **Three separate phrasings, one per meaning.** A coordinator who learns the phrase on one screen
> currently learns the wrong thing for the other two.

**The three facts, each measured, each currently sharing one phrase:**

    never recorded              the prototype keeps current state only; no history was ever kept
    recorded, then destroyed    one shared field is overwritten by five different acts, so a start
                                and an end cannot both survive
    present but unlinkable      the records exist and the join cannot run

🔴 **Each sentence explains its own reason immediately after, so none of them is lying today.** ⚠️
**That is exactly what makes it survivable and invisible — and why it would still be there in a
month.** **Ward Lead drafts the three and brings them back.**

## O-3 · The six community questions — BRING THEM SOON

**His word: _"Bring to me soon"_.** **Ward Lead verifies each is still live against the code first —
two of the last four brought to him were already answered — then puts them as one list with a
recommendation under each.**

✅ **CLOSED 2026-09-17** (records housekeeping, `docs/ward-flow/owner-answers-2026-09-17.md` item 62):
brought and answered as `WLQ-20` (`owner-decisions-2026-09-15.md` ~:122), "Yes As you recommend" —
"the owner's O-3 / O-12.3 request." Four community questions were reconstructed and evidenced, not
six; three answered in that list; the fourth carried forward as `WLQ-34`.

## O-4 · Referral addressing — HE ASKED WHAT IT MEANS

**His word: _"What do you mean by referral name a ward? What view is this referring to?"_**
**ANSWERED BACK TO HIM, not ruled. Nothing is built on it.**

## O-5 · 🔴 WHO MAY READ A REFERRAL AFTER IT IS SENT — A SUBSTANTIVE RULING, IN HIS OWN WORDS

> **"Once a referral is sent, It can be read by the team who sent it until that referral is either
> closed or accepted etc. I.e. ED Team hub or CMHT team hub or ward etc all can see it until it is
> responded to"**

**This answers Lane C's C3, which had been carried all week as never-asked and which its own drawing
marked _"needs an answer before a real patient, not before it is built"_.**

**What it establishes, read carefully rather than paraphrased:**

1. **The SENDING TEAM retains read access after sending** — not only the receiving ward.
2. **Access is bounded by the referral's LIFECYCLE, not by a clock.** _"until that referral is either
   closed or accepted"_ — **a state, never a retention period in days.**
3. **The parties are named as SURFACES, not as people:** _"ED Team hub or CMHT team hub or ward"_.
   ⚠️ **That is consistent with the model, which has no signed-in user** — and with D-29, which
   removed a `role` column from the access record because it would have named nobody.
4. **"all can see it until it is responded to"** — **the access is concurrent, not exclusive.**

⚠️ **WHAT IT DOES NOT SAY, and must not be read as saying:** it does not rule on who may read a
DECLINED referral after the decline, nor on how long a closed one remains readable, nor on whether a
team that never sent and never received it may read it. **Those are not asked and not answered.**

🔴 **AND IT LANDS ON A LIVE GAP.** `ward-flow-reducer.ts:1024` resolves a decline's addressee ONLY
for `source === "ed_medical"`; a COMMUNITY referral that is declined resolves to nobody, because a
referral records `originSiteCode` — a hospital — and never the community TEAM that sent it. **So
"the team who sent it" is a party the model cannot currently identify for community referrals.**
⚠️ **His ruling describes an access model the data does not yet support, and that gap is the same one
as D-42's: a referral does not record who sent it or who it was sent to.**

## O-6 · Handover is a seventeenth screen — YES, AND IT WAITS

**His word: _"Yes and await specificaztion"_.** **Handover is a build item. It is NOT scheduled until
the provenance-marker brief exists and has had its adversarial pass** — because one of its tasks has
a done-when nobody can evaluate until then.

## O-7 · The design-system contract gate — EXEMPT THOSE FILES

**His word: _"yes to Your recommendation"_, to:**

> **Exempt those files.** A check that fails on correct work teaches people to ignore it.

🔴 **The finding behind it: the design system has NO generic scale for spacing or line spacing.** A
mechanical enumeration of the three shell stylesheets returned, for nearly every violation, **NO
SUITABLE TOKEN** — so the gate was red on work that could not be made green by substitution.

⚠️ **TWO THINGS THE EXEMPTION DOES NOT COVER, and both must still be done:** the one GENUINE
substitution (`transition: width 0.18s` → `--duration-base`, identical at 180ms) should be taken
because it costs nothing; and **`999px` against the canonical `9999px` is a DECISION, not a
substitution** — same shape as D-24's raw `1.2` against the canonical `1.15`, where the values differ
and the difference is a ruling.

## O-8 · Three deletions in other sessions — APPROVED, with one KEPT

**His word: _"Yes to your recommendation"_, to:**

> **Approve the folder, the images and the duplicate. Keep the broken file** — it's the only copy of a
> specific broken state.

🔴 **THE SESSIONS MUST HEAR THIS FROM HIM, NOT FROM WARD LEAD.** ⚠️ **A relay of his approval was
refused by a lane tonight and the refusal was right: an override that exists because a PERSON must
decide cannot be armed by a message from an agent.** **Recorded here as the record; each session asks
him directly.**

## O-9 · The check-list mechanism — BUILD IT THIS PHASE

**His word: _"Yes to your recommendation"_, to:**

> **Build it in the current phase — the shell already solves this exact shape for screen readers.**

**Standard §8.7's contract is UNIMPLEMENTED and not prop-drillable: screens render as `{children}`
BELOW the bar and rail, so a screen is a descendant of the shell and cannot hand anything upward.**
✅ **`announceToWardShell` (`ward-live-region.tsx:69`) is a module-level pub/sub solving the same
topology in the same shell, and is the pattern to copy.**

⚠️ **Until it lands, every ward screen says _"No reconciliation is available for this page yet."_ —
honest today, and a DIFFERENT kind of wrong the day a screen has checks and still cannot say so.**

## O-10 · The 18-against-21 route gap — LEAVE IT

**His word: _"Yes to your recommendation"_, to: leave until someone needs the number.** ⚠️ **Recorded
as known-open, with the observation that it WIDENS to 17-against-21 if `/handover` leaves the list.**

## O-11 · The queued housekeeping records — ONE DEDICATED PASS

**His word: _"Yes to your recommendation"_, to: one dedicated pass when the build round settles.**
**Needs a fresh-base branch and the cross-worktree lock, so it is a deliberate job and not a
spare-moment one.**

## O-12 · Four more owner answers, 2026-09-11 late — in his words

**Put to him as "everything blocking you need from me", four items, one recommendation each.**

### O-12.1 · The deletion in another chat — HE HAS GIVEN IT DIRECTLY

**His word: _"Check I did this with the chat"_.** ✅ **He has told Ward Builder Four himself, in its own
conversation.** 🔴 **Ward Lead's job here is to CHECK, never to relay.** **That chat refused my relay
twice and refused the written record too, on the grounds that an override existing because a PERSON
must decide cannot be armed by an agent quoting them. It was right both times.**

### O-12.2 · ✅ THE COMPOSED EMPTY STATE STAYS — and it is owner wording now

**His word: _"Go ahead with your recommendations"_, to:**

> **Keep it.** It says the true and careful thing.

**The sentence, rendered today on every ward with nobody incoming:**

> _**"No patient is currently accepted, pulled or en route to X. Absence here means none, not that
> none was asked for."**_

🔴 **Nobody drew it. It was composed during a build and went live making a clinical distinction on his
behalf — that an empty list means genuinely none, rather than that nobody looked.** ⚠️ **From here it
is OWNER-APPROVED WORDING, not a builder's composition to reword in passing.**

### O-12.3 · The six community questions — HE IS WAITING ON THEM

**His word: _"Bring these 6 questions"_.** **They exist in exactly one chat's conversation and nowhere
else. Requested back from Lane C in the form: one plain sentence, VERIFIED STILL LIVE with the file
and line re-read, one recommendation.** ⚠️ **Two of the last four brought to him were already answered
by earlier work. That is the failure this form exists to stop.**

✅ **CLOSED 2026-09-17** (records housekeeping, `docs/ward-flow/owner-answers-2026-09-17.md` item 62):
he is no longer waiting — see `O-3` above, answered as `WLQ-20`.

### O-12.4 · ✅ THE VISIBLE LAYER GETS WORDS — a standing rule, not a one-off

**His word: _"Go ahead with your recommendations"_, to:**

> **Make the visible layer match** — the dot gets words. Your own standard already says colour is
> never the only carrier of a state.

**The specimen: the Activity button announces _"Activity, reconciliation not available"_ to a screen
reader, while a sighted reader sees only _"Activity"_ and a coloured dot carrying no words.**

🔴 **THE GENERAL SHAPE, and it is the part that must travel: an `sr-only` layer that says MORE than
the visible layer.** ⚠️ **It reads as generosity, it is an asymmetry nobody chose, and it is invisible
to tests, to screenshots AND to eyes at the same time — which is why it survives.**

🔴 **AND IT CREATES A THIRD STATE FOR EVERY SUCH SWEEP.** **Not agree / disagree, but:**

    AGREE       visible and invisible say the same thing
    DISAGREE    they say different things
    ONE SILENT  the invisible layer states something the visible layer does not say at all

⚠️ **A two-state sweep returns the silent case CLEAN. The §U sweep was re-briefed on this before it
ran.**

## D-43 · Ward Lead ruling — the bed board's ordinal contradiction is a LANE TASK

**Surfaced by Ward Verifier, which declined to route it by default and asked. Correct.**

**The shape: `ward-board.tsx:673` states the component's own rule** — _"an `Admission` records the ward
and NEVER a bed … nothing here may number a tile … nothing in this component ever has an ordinal to
print"_ — **and the markup wraps the tiles in an element whose whole job is to assert an order.**

**RULED: a lane task. Not an owner question, not merely an errata entry.**

- **Not the OWNER's:** ⚠️ **nothing in it needs a clinical, product or privacy judgement. It is a
  contradiction between two things this repository owns.** **Taking it to him spends his attention on
  a question we can answer better than he can.**
- **Not merely ERRATA:** **errata records what we learned; this has a checkable end state and somebody
  can reach it.**

🔴 **THE INSTRUCTION MATTERS MORE THAN THE ROUTING: it must NOT be repaired by swapping the tag.**
**Two readings need opposite repairs — either the markup claims an order the tiles do not have, or the
tiles ARE ordered and the COMMENT is the false thing.** ✅ **Same discipline the owner put on us
directly tonight: a failure is diagnosed before it is "fixed" by loosening the assertion.**

✅ **Severity carried honestly: `aria-posinset` and `aria-setsize` have ZERO occurrences in the ward
module, so the version that reaches a person — a screen reader announcing "item 3 of 20" over a
seed-ordered list — does not exist in this codebase.** **Honesty work, not clinical risk.**

🔴 **STRUCK 2026-09-11 night — THE SENTENCE ABOVE IS FALSE AND IT WAS LOAD-BEARING. Left
standing rather than deleted, because the reading that made it true is the one somebody will re-derive.**

⚠️ **An `<ol>` supplies position IMPLICITLY.** **A list item in an ordered list has an ordinal
whether or not anybody typed `aria-posinset`, and assistive technology may announce it.** **So "item 7 of
20 over a seed-ordered list" is not absent from this codebase — it is exactly what the bed grid is.**

🔴 **The defect in the measurement, named by the lane that made it and then repeated by me:
MEASURING A MECHANISM AND REPORTING A PROPERTY.** **A search for two attribute spellings stood in for
"does anything announce a position here", and the census of the ordinal class never counted `<ol>`
elements at all.**

✅ **What survives, and only this: nothing VISIBLY numbers a tile, and no EXPLICIT position
attribute exists in the module. Both true. Neither sufficient.**

⚠️ **It reached this file through me. The lane reported the narrow fact; I widened it into a
reassurance and wrote the wide version down.**

🔴 **AND A SECOND CORRECTION, ON THE CORRECTION ITSELF — measured after the strike above was
written, by the same lane, and it stops the repair from becoming its own defect.**

**The redone census found FOURTEEN ordered lists in the ward module. FOUR OF THE FIVE in
`ward-board.tsx` are HONEST, and two are exemplary — ordered AND saying so in visible prose:**

    destinations   "Expected within N days, soonest first."
    people         "Every occupant of this ward, soonest expected out first; anyone with no
                    date set is last."

✅ **Only the bed grid was making the claim falsely.** 🔴 **So the finding is NOT "`<ol>` is a
defect class in this codebase." It is "`<ol>` is a CLAIM, and one list was making it falsely."**
⚠️ **A blanket correction would redden four correct usages and teach the next reader to reach for
`<ul>` reflexively.**

⚠️ **The nine ordered lists outside `ward-board.tsx` are LISTED AND NOT ASSESSED.** **Several are
plainly chronological by name — a timeline, an activity feed, an audit list — and the lane refused to
characterise them from their names, because that is the move that produced the false reassurance in
the first place.**

✅ **And the fix asserts `<ul>` rather than removing the list: a grid of `div`s would lose the tile
count a screen reader gets for free, and that count IS information the data supports. Unordered, not
unlisted — pinned so nobody "finishes" the job by stripping the semantics.**

## D-44 · The community scope note is reworded and the comparison panel stays

**Ruled earlier; wording approved as Lane D proposed it, with the panel titles bolded.**

🔴 **The change nobody thought to ask for is the one that decides it: the note names both panels by
their RENDERED TITLES.** ⚠️ **_"Every count below"_ is unfalsifiable; _"every count in **This team, in
figures**"_ can be checked against the screen.** **A scope claim that names no panel cannot be wrong,
which is why it cannot be right either.**

✅ **And _"unless the figure says otherwise"_ was cut for the right reason: it makes the claim
unfalsifiable rather than merely wrong — worse, not better.**

## D-45 · 🔴 THE SEED DECISION — the fixture gains BOTH, as ONE change, after the statistics screens

**Ward Lead's, under delegation. Promised twice before the first statistics screen shipped and not
delivered either time. Made now.**

**RULED: the seed gains the high-acuity referral AND more person links, as one change, and it happens
AFTER the last of the four statistics screens folds.**

### Why they are one decision and not two

**Both are the same question — _does the fixture exercise the arm the code supports?_** ⚠️ **Deciding
them separately would be deciding one question twice, and would take two re-baselines where one will
do.**

**The measurements underneath, none of them mine:**

    total seeded admissions                            267
    occupied beds, by the repo's own bedIsOccupied()   259
    of those, patientId NON-NULL                         1   and it resolves
    of those, patientId null                           258   99.6%

🔴 **The 258 nulls are DELIBERATE — the seed says so in its own words: one link exists so the
default-deny guard's anti-vacuity floor has a specimen, "deliberately not more".** ⚠️ **Anyone finding
258 nulls and reporting "the join is broken" would be wrong, and it is the obvious reading.**

⚠️ **And it INVERTS the changeable-data rule.** **That rule guards against building what only works
for the seed. Here the hazard runs the other way: a feature that WORKS and whose seed makes it look
EMPTY.** **A screen built on the link renders "not recorded" for 258 of 259 beds — a property of the
fixture that reads as a property of the software.**

### The sub-rulings, because the trigger is the half that usually rots

- **D-45a · One change, one commit, one re-baseline.**
- **D-45b · The trigger is a CHECKABLE EVENT: the fold of the last of the four statistics screens.**
  ⚠️ **NOT "when the build round settles". A deferral conditioned on a mood has nobody to un-defer
  it, and this one has already been deferred twice by exactly that mechanism.**
- 🔴 **D-45c · From now, no new ward test may assert a seed-derived count as a LITERAL. It computes
  the expectation from the seed.** ✅ **This is what makes D-45 cheap — and it stands whether or not
  D-45 ever fires.** **It is already true of roughly twenty test files, which is precisely why the
  suite stayed green through the community count going 65 → 64 while four prose comments did not.**
- **D-45d · The person links must LEAVE a population of nulls.** **The default-deny guard needs its
  negative case as much as its floor. A realistic mix, nowhere near all.**
- **D-45e · The high-acuity referral must FIRE the gate's interesting arm, and the test proving it
  must assert the ARM, not a count.**

### What it unblocks, named so nobody waits on it again

- **Lane A's P1 and P2** — build against the seed as it is; write assertions so D-45 cannot invalidate
  them.
- **Lane B's Bed board done-when** — ⚠️ **_"the board shows who is in the bed"_ is NOT buildable
  against this seed.** **Write the done-when against the MECHANISM; D-45 fills the population later.**
- **Lane C's D-5, gender at both gates or neither** — ✅ **no longer blocked by an absent join. Blocked
  by an absent POPULATION, which is what D-45 fills.**
- **Lane D's statistics baselines** — **take them COMPUTED and D-45 costs nothing; take them as typed
  numbers and D-45 invalidates the whole tier.**

**Ward Lead owns un-deferring it. It is written here, in the errata and in the plan's §10 rather than
in a chat message, because a ruling that lives in one conversation is a ruling that evaporates.**

## O-13 · Three owner rulings, 2026-09-11 late — and one of them replaced a ruling of his that rested on a false claim of mine

**His word: _"Yes to your three recommendations for the blockers above"_.** **The recommendations he
was agreeing to are reproduced in full, so nobody has to reconstruct what he approved.**

### ⚠️ FIRST, THE WITHDRAWAL THAT PRECEDED THEM — O-2 IS DEAD

🔴 **O-2 ruled that three facts shared the phrase _"not a measurement"_ and ordered three separate
phrasings. THE PREMISE WAS FALSE AND IT WAS MINE.**

**A ward-wide sweep found that phrase in rendered JSX EXACTLY ONCE:**

    community-screen.tsx:164     "This team's figures ARE NOT A MEASUREMENT."
                                 the only true instance — an absence
    ward-screen.tsx:285          "...demonstration data, NOT A MEASUREMENT OF THIS WARD."
                                 a PROVENANCE disclaimer. The charts DO render values.
    statistics-screen.tsx:818    "...one value repeated, NOT A MEASUREMENT OF HOW LONG BEDS TAKE..."
                                 a caveat about a DISPLAYED average. A real number renders.

⚠️ **Three sentences share three words. They do not share a meaning, and two of the three are not
absences at all.**

🔴 **The lane grouped by substring; I turned the grouping into a ruling and put it to the owner
without asking the one question that costs nothing — _are these three sentences about the same KIND
of thing?_** **The lane's own sweep, commissioned against its own finding, is what caught it. No
draft reached him and nothing was built.**

### O-13.1 · ✅ _"none"_ KEEPS ITS TRUE-ZERO MEANING; THE OTHER SCREENS SAY WHAT THEY SEARCHED

**The collision, which has TWO OF HIS OWN DATED RULINGS INSIDE IT:**

    statistics-compare-screen            owner 2026-09-05     a true zero renders as the DIGIT 0
    capacity-derivations / bed-map /
    delays-screen                        owner 2026-09-05/06  a true zero renders as the WORD "none"
    community / ED home / patient
    search / delays tab counts                                "none" = a CHECKED-EMPTY population

**His word, to:**

> **Keep "none" for the true figure, and change the other screens to say what was searched** — "No
> teams found in this area" rather than a bare "none". **A sentence that names what was looked for
> cannot be mistaken for a count somebody reported.**

⚠️ **A reader who learns on Capacity that _none_ is a ward's own reported figure, then meets _none_
on the community screen, has no signal that the guarantee is weaker there.**

🔴 **THE SITE LIST ABOVE HAS A FALSIFIED MEMBER. STRUCK 2026-09-11 night. THE RULING STANDS; THE
INSTANCE LIST DOES NOT.**

**The row reading _"delays tab counts"_ is WRONG. Lane A enumerated every bare `none` its four
screens can render — all five are counts of DEFINED POPULATIONS, not search results:**

    delays-screen.tsx:488        escalatedRows.length    open movements carrying an escalation
                                 closedToday.length      movements with a closure dated today
    priority-queue.tsx:138-139   referralsCount          referrals awaiting a decision
    priority-queue.tsx:174       patientsCount           open movements
    capacity-screen.tsx:469      shortfalls.length       of gapRows.length

✅ **And the decisive evidence is the screen's OWN SHIPPED WORDS, which assert the opposite
classification about the very population the ruling named:**

> _**"Nobody has been escalated today. That is a count, not a gap."**_

⚠️ **There is also a PRIOR standing rule carried verbatim in three screens' citations —
`priority-queue.tsx:135`, `:172` and `bed-map.tsx:206`: _"Absence and zero (rule 2): 'none', never a
bare '0'."_** 🔴 **So `none` at those sites is a ruling already made, not an unexamined default — and
applying this one there would have reversed it on ONE screen while leaving it standing on two,
which is how two honest screens come to disagree.**

🔴 **HOW IT HAPPENED, because it is the third instance in one night of a single shape: the
four-site list came from ONE lane's sweep of ITS OWN family — what somebody found, not an
enumeration.** ⚠️ **Ward Lead wrote that exact caution to Ward Verifier in the same hour, and let the
ruling go to the owner naming specific screens anyway.**

✅ **What the owner ruled on — that _"none"_ means a reported true zero on some screens and a
checked-empty population on others, under two of his own dated rulings — is a real collision and is
untouched.** **A module-wide enumeration with three pre-registered classes plus a NOT-ONE-OF-THESE
bucket is establishing the true population, with Lane A's five sites as its independent negative
control. NOBODY EDITS A `none` UNTIL IT REPORTS.**

### O-13.2 · 🔴 THE PERSON DISCLOSURE IS KEPT, AND THE RULE IS NOW WRITTEN DOWN

**`search/record-preview.tsx:307-309, 336-339` already walks movement → referral → patient and
renders a FULL DISPLAY NAME, a UMRN, and a link to that person's whole record.**

⚠️ **I told a lane this was a question about something a future task might introduce. It ships
today.** 🔴 **_"Nobody has ruled on it"_ is a very different sentence when the thing unruled-on is
already running.**

**His word, to:**

> **Keep it, and write the rule down as: a coordinator sees who the patient is wherever they are
> SELECTING or ACTING ON that person.** **Coordinating a bed for someone you cannot identify is not
> possible, so this is the tool working.** **The real control is who can open the tool at all — and
> that is worth stating so nobody later "tightens" it into uselessness.**

✅ **The existing boundary, which is real and is NOT a ruling:** a default-deny guard over every file
under `ward-management/**`, an allowlist asserted at **exactly 7** entries, of which only
`record-preview.tsx` and `patient-typeahead.tsx` render anything — and `patient-typeahead` starts
from an already-known person. **The rule above is what that guard was always implementing without
anybody having said so.**

### O-13.3 · ✅ ONE TAB WITH SORTING, PLUS THE SEPARATE FOURTH

**Measured on the seed at `NOW_ANCHOR`, by the lane that was about to build all five:**

    Tab 1  Where each open movement stands     43
    Tab 2  Transport legs, and what has none   43   a two-way split of the SAME 43
    Tab 3  How long they have waited           43   id-set equality with Tab 1: IDENTICAL
    Tab 4  Resolved today                       7   genuinely disjoint
    Tab 5  Movements with no owner               0   UNREACHABLE — `owner` is required and never blank

**His word, to:**

> **One tab with sorting, plus the separate fourth.** **Three tabs implies three different groups of
> patients, and a coordinator would reasonably read it that way.**

🔴 **Tab 5 was dropped separately as a FACT, not a preference — `owner: string` is required on every
`Movement` and is never blank: 21 hand-authored use three named owners, 30 generated assign
`index % 2`. Zero of fifty.** ⚠️ **Same shape as D-35: a drawing's panel compared against the app's
absence, with nobody asking whether the state can OCCUR.**

## D-46 · A guard that fails whenever the machine is busy

**Four tests went red on the line and the cause was measured, not assumed.**

    a test with a hard-coded 300,000 ms timeout   recorded duration 671,106 ms
    ward-mutation-harness-reachable                45,291 ms failing / 11,626 ms idle
    all four failureMessages                       literally "Error: STACK_TRACE_ERROR"

🔴 **A timer cannot overshoot its own limit by that margin unless the process is starved.** ⚠️ **And
`STACK_TRACE_ERROR` is vitest-internal bookkeeping captured at REGISTRATION time — so vitest itself
had lost the real cause. There was never an assertion message to read.** ✅ **An uncontended run of
the same tree: `388 ran · 4620 collected · 4545 passed · 75 skipped · 0 failed`.**

**The machine at the time: 100 node processes, 7.6 GB free of 34.2, 20-plus concurrent worktrees.**

🔴 **RULED: heavy runs are staggered from here.** **And Lane D's sentence is the finding that
outlives the incident: _"a guard that fails whenever the machine is busy trains everyone to read its
red as noise."_**

⚠️ **A correction that belongs here because it travelled three hops:** I relayed _"~34 s against a
30 s limit"_ from a peer without measuring it, three lanes accepted it, and one restated it back to
me as established. **The figure was wrong in both halves.** **Nobody was careless. The number simply
had no attribution attached to it after one hop.**

## O-14 · 🔴 THE PER-PERSON LIST IS SUPPRESSED ON D-38's OWN THRESHOLD — replaced, never shortened

**His word: _"Go ahead with your recommendation"_, to:**

> **Hide the list on the same rule, and replace it with the same "not enough data" sentence rather
> than showing a shorter list.**

**The question, as Lane D put it after verifying it live:** **on a community team's statistics page,
may a per-person list of that team's patients currently in a hospital bed be shown at all — with
ward, site and days — or does D-38's suppression apply to the LIST as well as to the COUNT?**

**What the drawing actually shows, read at `statistics-community-third-edition.html:5094`:**

> **People currently in a hospital bed** — _"The ward, the site and the health service of each bed
> are read from the network's own ward table… The references are this page's own and stand for
> people, never for a record number."_

**Four ROWS, each a reference standing for a person, with a ward, a site, a health service and a day
count.** ⚠️ **Not the aggregate D-38 ruled on.**

### 🔴 THE TWO REASONS, and the second is the one that is easy to miss

**1 · A LIST OF FOUR IS STRICTLY MORE IDENTIFYING THAN THE NUMBER 4.** **D-38's own reasoning is
that a team with four open cases showing "1" names that person to anyone who knows the caseload.**
🔴 **A row adds which ward, which site, and how long. If a count of one identifies, a row
certainly does.**

**2 · THE OBVIOUS IMPLEMENTATION IS THE DANGEROUS ONE.** ⚠️ _**A list that shortens as the team gets
smaller identifies hardest exactly where D-38 says the risk is greatest.**_ **A one-row list on a
four-patient team names that person completely.** ✅ **So below the threshold the list is REPLACED
by the suppression sentence — never truncated, never paginated, never "top 3".**

### What it binds

- **The same threshold governs both. One number, not two.**
- **The denominator is kept and shown, exactly as D-38 requires of the count.**
- 🔴 **No shortened list, in any form.** **A guard should make the shortened form unspellable rather
  than merely tested against — the same shape as Task 1's union, where only the measured arm carries
  a value.**

✅ **Verified live before it was asked: the phrase does not appear in `statistics-community-screen.tsx`
at all. The section is UNBUILT, so nothing shipped either way and there is no rework.** ⚠️ **D-39
already holds two neighbouring sections; this was a third parked at zero cost.**

### ✅ And the question was put in the lane's own framing, unchanged

**Lane D verified it, established D-38 does not reach it, found the section unbuilt, and wrote the
sentence that decided it — _"if a count of one identifies, a row certainly does"_.** 🔴 **Ward Lead
changed nothing in it. That is the shape an owner question should arrive in.**

## O-15 · ✅ TWO RULINGS, 2026-09-11 late — the 12px floor holds with no uppercase exception, and the mismatch still leads

**His word: _"Yes to your 2 recommendations"_.** **Both reproduced in full below.**

### O-15.1 · 🔴 THE 12px FLOOR HOLDS. NO UPPERCASE EXCEPTION. Three things move now; the rest waits for D-3.

**His word, to:**

> **Keep the 12-pixel floor with no uppercase exception — but change only two things now: the Delays
> columns and Command's tier and score, because those are the ones somebody makes a decision from.**
> **Everything else is already scheduled for rebuild, and raising sizes on a screen we are about to
> redraw means doing it twice.**

#### ⚠️ AND WARD LEAD'S OWN ASSUMPTION WAS WRONG, which is why the enumeration was commissioned

🔴 **I told a lane the 10px headings were probably fine because they are uppercase eyebrows — a
normal typographic device.** **The standard has NO uppercase exception. It states the 12px floor FOUR
TIMES, and uppercase is a TREATMENT at t-0/t-1, never a licence to go smaller.** ⚠️ **I reasoned from
typographic convention instead of reading the standard, on a question about the standard.**

#### The measurement that made the question askable

**Read in a BROWSER with `getComputedStyle`, not from CSS — 31 distinct screens, every internal link
followed, one instance of each dynamic family:**

    sizes below the floor    exactly two: 10px and 11px. NOTHING smaller, anywhere.
    10px    174 visible groups · 1,873 elements · 47 uppercase · on 31 of 31 SCREENS
    11px     61 visible groups · 1,118 elements ·  9 uppercase
    aside    25 invisible groups (sr-only or collapsed), set aside rather than counted

🔴 **AND THE HALF THAT MAKES IT CLINICAL RATHER THAN TYPOGRAPHIC: THE DECISION-CARRYING TEXT IS AT
10px.** **Delays' four columns — reason, profile, "nothing recorded for", wait — at 43 rows each;
Command's tier and score at 43 each; 138 bed chips on the diagram and 130 on Network; ED referral
state and outstanding items; two whole statistics tables.**

⚠️ **And the invented-figures governance banner is 10px on 23 of 31 screens.** **D-3 named
`.syntheticNotice` for "now"; this is the same sentence in a different class, still 10px.**
🔴 **RULED: D-3's "now" REACHES IT. The sentence telling a reader the figures are invented is not a
place to sit at the floor's floor.**

#### What is built now, and by whom

    Delays' four columns              Lane A      10px -> the floor
    Command's tier and score          Lane A      10px -> the floor
    the governance banner             Lane A      10px -> the floor, per the ruling above
    everything else at 10px / 11px    HELD        rebuilt at its screen's own rebuild, per D-3

⚠️ **Nobody else changes a size. A lane that inherits 10px on a screen it is building leaves it and
says so.**

### O-15.2 · 🔴 THE CAPACITY SCREEN LEADS WITH THE MISMATCH. His 2026-09-07 order stands; the drawing loses.

**His word, to:**

> **Keep your 7 September order — the mismatch leads.** **Your reasoning still holds: the subtitle
> says the page exists to show where beds fall short, so putting the picture above that question
> buries it.**

**The collision, and THE SPLIT is why the question was answerable:**

    his 2026-09-07 words   "the best thing from a design choice is to put the visual diagram
                            above the table"                   ✅ SATISFIED BY BOTH ORDERS —
                            the bed map already sits above the network table
    the half in conflict    what the screen LEADS with         🔴 he agreed the mismatch leads;
                            the drawing leads with the bed map

✅ **Lane A split those before holding.** **Without the split this would have reached him as a false
either/or, and he would have been asked to choose between two things he had already reconciled.**

**Reading order stands: mismatch → Ready now → the bed map → the network table.**

✅ **The RENAME shipped independently and is unaffected** — _"Every ward in the network"_ → _"Wards"_.
⚠️ **And the scope word was checked BEFORE it was dropped, not after: _"in the network"_ survives
because the panel's own count says it — _"N wards in the network, M matching"_.** **Had it not, the
rename would have removed the only word distinguishing a network table from a local one, and nothing
would have gone red.**

### 🔴 O-15.3 · THE STANDING REQUIREMENT THIS PRODUCED — an artefact lists what binds it

**Third screen in one night where a drawing contradicts a ruling made AFTER the drawing was
conceived:**

    M2   drawing drops closed movements    reverses "MARK IT, DO NOT FILTER IT"   2026-09-05
    P1   drawing leads with the bed map    reverses "what the screen leads with"  2026-09-07
    M4   drawing's corridors are ARRIVED   disjoint from the derivation's         —

⚠️ **The drawings were made 9–10 September; two of those rulings are from the 5th and 7th.**
🔴 **This is NOT carelessness. A drawing has no way to know what was ruled while it was being drawn,
and NOTHING CHECKS.**

✅ **RULED, and it generalises past drawings: ANY ARTEFACT THAT WILL BE BUILT FROM MUST LIST THE
DECISIONS THAT BIND IT.** **A contradiction then appears at drawing time rather than at build time,
three lanes later, after somebody has written a plan against it.**

## O-16 · ✅ NINE ANSWERS, 2026-09-11 late — and the first one reshapes every screen still to be built

**He was asked for every decision outstanding across seven chats, with a recommendation on each.
He answered all nine.** ⚠️ **He took eight recommendations and REVERSED one — and modified the
first into something better than what was offered.**

---

### O-16.1 · 🔴 THE APP GROWS. AND EVERY GROWTH COMES TO HIM FIRST, BY NAME.

**His words, verbatim:**

> **The app grows but you notify me what needs to grow**

⚠️ **WARD LEAD RECOMMENDED THE OPPOSITE** — that the drawings shrink to what the model can record,
each gap written down by name rather than stubbed. **He overruled it, and the modification is the
half that matters: growth is approved IN PRINCIPLE and each instance is approved INDIVIDUALLY.**

**The question this answers had arrived four separate ways in one evening, from three different
chats, and nobody had seen it was one question:**

    four drawer actions     "Chase the ward" · "Add to a shortlist" have NO reducer event;
                            "Record an override" is not standalone; "Watch and flag" has NO
                            watchlist and NO hold anywhere in WardFlowState
    FD-5                    no withdrawal event exists, so a referral abandoned by the referrer
                            stays `queued` forever — one figure permanently nought, another
                            permanently inflated
    the community close     nothing records a team CLOSING somebody, so "cases opened" has no
                            counterpart and the drawing ties a tile to a population that does
                            not exist
    the no-history limit    5 departed admissions network-wide, ~18 wards with zero discharge
                            record — every over-time statistics section unbuildable

🔴 **THE STANDING RULE THIS CREATES, binding on every lane:**

    ✅ DO      when the model cannot record something a drawing shows, ENUMERATE what it would
               need — what state, what event, what it touches, what it costs — and route it to
               the owner through Ward Lead. 🔴 If you cannot size it, say UNSIZED. A number
               nobody measured is worse than an admission.
    ❌ DO NOT  add a field, an event or a state on your own judgement, however obvious.
               "The app grows" is a ROUTE THROUGH HIM, never a standing licence.
    ❌ DO NOT  stub. A section heading over nothing reads as a category that exists and happens
               to be empty — this app is destined to be a tool somebody opens, where that is a lie.

---

### O-16.2 · ✅ THE DELAYS ROW — RAISE ALL FOUR COLUMNS. One size on the row is accepted.

**Recommendation taken.** `.personWait` · `.personMeta` · `.personCause` · `.personSince` all move
to `var(--text-xs)`.

⚠️ **THE COST WAS PUT TO HIM EXPLICITLY AND HE ACCEPTED IT.** **The Task 3 audit — recorded at
`delays.module.css:517` — measured 402 of ~610 text nodes on that screen at one size and one weight,
and built three ranks to fix it. Raising these four makes all five elements 12px, so SIZE stops
carrying any rank.** ✅ **Two of the three channels survive: mono and weight 600 on `.personId`, and
two ink steps.**

🔴 **THE RANK CHECK IS NOW MANDATORY, not optional.** **After the change `.personCause` must still
differ from `.personMeta` on some MEASURED channel.** ⚠️ **Without it the raise trades a legibility
defect for a hierarchy one and nothing says so — the 2026 defect re-found from the other direction.**

✅ **And one worry turned out to be imaginary: `.personSince`'s comment claims it is "smallest of
the three mono figures" and it is JOINT-smallest with `.personWait`. The file promises a three-step
mono ladder and implements two, so there is no size distinction there to lose.** **Correct that
comment in place — describe the old claim, do not spell it.**

---

### O-16.3 · 🔴 SHOW THE PATIENT'S NAME. HE REVERSED WARD LEAD'S RECOMMENDATION.

**His words: _"Yes show the patient name."_** ⚠️ **Ward Lead recommended NO, on the ground that a
name in one panel where the rest of the app deliberately withholds it is how inconsistency becomes
a leak. He said yes. His call, clearly made, and it stands.**

✅ **So ruling ② wins over D-14 on the Movement drawer: it MAY follow the patient link and show the
name.**

🔴 **THE GUARD THAT REFUSED LANE A BY NAME NOW DEFENDS A SUPERSEDED RULING.** ⚠️ **It must be
UPDATED, never bypassed and never self-allowlisted — Lane A was right to refuse both.** **Change
what it defends, cite O-16.3 and this date in its message, and make it red on the OLD behaviour.**
**A guard left arguing against the owner is worse than no guard: the next reader takes its message
as current policy.**

⚠️ **AND A FACTOR THAT MUST BE RECORDED AT THE RENDER SITE, because it is true now and will stop
being obvious: the seed is synthetic, so this costs nothing today. The moment real data reaches
this app, showing a name here becomes a live privacy decision needing its own review. It is NOT
grandfathered by tonight's ruling.**

---

### O-16.4 · ✅ THE THREE SECTIONS STAY VISIBLE. Not tabs.

**`Coming in` / `Going out today` / `Since yesterday` remain three visible sections.**
🔴 **Reasoning: tabs hide whether a section has anything in it — and this is the 2026-09-05
"MARK IT, DO NOT FILTER IT" ruling arriving in different words.**

---

### O-16.5 · ✅ NO `Occupied` WORD ON AN OCCUPIED TILE

⚠️ **RECORDED WITH ITS WEAKNESS: Ward Lead recommended this having never seen that screen, and told
him so.** **The tile already shows occupancy by showing who is in it, and the grid is dense.**
✅ **Lane B was told to re-open it cheaply if the tile is ambiguous in a way a relayed description
could not carry.** **A ruling made on a relayed description is the kind that should be revisitable.**

---

### O-16.6 · ✅ FIVE COMMUNITY DECLINE REASONS, AS THEIR OWN LIST

**Not by stretching `REFERRAL_DECLINE_REASONS`.** 🔴 **Lane D measured ZERO overlap between the
seven existing bed-placement concepts and the five the drawing wants — not one of the seven fits.**

✅ **A community team declining a referral and a ward declining a bed are different acts; one shared
list forces both into wording that fits neither.** ⚠️ **Put the zero-overlap measurement in a
comment beside the new list, or the next reader sees two similar lists and helpfully merges them.**

---

### O-16.7 · ✅ "Funding or plan decision pending" — ADDED

**A real reason a discharge stalls, with nowhere to record it today. Ruled in.**

---

### O-16.8 · ✅ REFUSAL MESSAGES USE THE EXISTING STAGE LABELS — and the awkward sentences are reworded

**Both halves answered yes.** **The eleven refusals stop printing the raw identifier and use
`stageCopy`'s labels, which a coordinator already reads on seven screens.**

🔴 **DO NOT INVENT A SECOND VOCABULARY.** ⚠️ **The rewording is of the SENTENCE AROUND the label,
never of the label. A mid-sentence variant would be D-32's defect — two wordings for one state —
arriving dressed as a fix.**

✅ **And this question SHRANK before it reached him, because Lane C proved the labels already
existed rather than asking what the stages should be called.** **The rule that caught it: prove a
QUESTION is still open before spending the owner on it. A question can be stale exactly the way a
task can, and a stale question costs more — he answers it, and the answer contradicts the code.**

---

### O-16.9 · ✅ THE TWO SCRATCH FILES MAY GO

`b3-probe.json`, `tests/zz-b3-probe.test.ts`. ⚠️ **Recorded because the record was WRONG: Ward Lead
carried these as a BLOCKER for hours. They blocked nothing. Lane B corrected it.** 🔴 **"With the
owner" and "blocking" are two different states, and conflating them put a piece of litter in front
of him at the same weight as a screen decision.**

---

### 🔴 WHAT WAS DELIBERATELY NOT PUT TO HIM, and why — because an unasked question looks identical to an unanswered one

    the ED "Expected" list    two definitions with near-identical names — a forward-looking arrival
                              clock vs a referral-based list. HELD until Lane B measures both
                              populations and their overlap, so he gets numbers rather than an
                              abstraction. The same discipline that made O-16.6 decidable.
    the two type scales       the old `--text-*` vs the third edition's closed `--t-N`. Asked of
                              Design System first: did anyone ever decide the screens migrate? If
                              nobody did, it comes to him. ⚠️ Not his until it is established that
                              it is not already answered.
    Q-12 / A3's print half    ⚠️ NOT ASKED because Ward Lead could not state it precisely enough to
                              be worth his time. Recorded as UNASKED rather than pending, which is
                              the honest state. Lane B asked to state it in two sentences.
    the 35 mockup commits     owed or superseded — Ward Lead's to establish, not his to decide.

## O-17 · ✅ TWELVE APPROVALS, 2026-09-12 — _"Yes to all recommendations"_, and one of them is an action HE must take, not one I can relay

**He was given every outstanding blocker with one recommendation each, and approved all of them.**
⚠️ **Two entries on the list he was shown were STALE — he had already answered them in O-16 and
Ward Lead's record had not caught up. Lane D found that by being two commits behind, not because
anybody told it.** 🔴 **A status claim about somebody else expires the moment they act, and this
one caught the chat whose job is keeping the record.**

---

### O-17.1 · ✅ TWO TYPE SCALES — screens migrate at their own rebuild, never as a sweep

**Design System's recommendation, approved in its own words.** 🔴 **And the half that made it a
decision rather than an aesthetic: MIGRATION IS BLOCKED ON A MECHANISM NOBODY HAS BUILT.** `--t-N`
is scoped to `.wardShellTokens`, composed by three shell files only; `--t-0` on a screen resolves to
nothing, the declaration becomes invalid at computed-value time, and `font-size` falls back to
INHERITED — which is BIGGER, so a broken token reads as success.

⚠️ **He approved "yes, and somebody must first make the token reachable from a screen root", not a
rename.** **The mechanism is NOT commissioned; nobody builds it until a screen rebuild needs it.**

### O-17.2 · ✅ THE HANDOVER PRINT SHEET — contents approved, and RE-USE the existing page

**Q-12 closed, both halves.** The sheet carries that ward's bed census, the movements pointed at it,
today's confirmed figures and any discharge flag, and nothing identifying beyond what that ward's
screen already shows. 🔴 **And it re-uses `/mockups/ward-flow/handover` pre-scoped to that ward
rather than drawing its own: a second sheet is a second thing to keep truthful as the app changes,
and the two will drift.** ✅ **So A3's print half is a WIRING task, not a new surface.**

### O-17.3 · ✅ STANDING PERMISSION to remove one's own test probes

**Lane B's reasoning carried it: vitest's `include` is `tests/**` only, so a probe CANNOT live in a
scratchpad. The litter is STRUCTURAL, not carelessness.**

⚠️ **Recorded as a GENERAL permission for future probes. It does NOT retroactively arm the two
files under O-17.6 — those are a specific request the owner is answering directly.** 🔴 **A general
yes swallowing a specific pending question is the same collapse this file records at O-17.6, run in
the other direction.**

### O-17.4 · ✅ SCHEDULE THE TWELVE BROWSER SPECS — run once now, then before every fold

🔴 **THE ARGUMENT, and it is Ward Verifier's: the runner PRINTS "vitest cannot run them; use
verify:ui" on every single run and names all twelve — and a warning that fires every time is
indistinguishable from a banner.**

⚠️ **What made it urgent rather than tidy: FIVE committed ward browser instruments exist, all five
in the excluded twelve, and a lane was one command from building a sixth.** **They are unrun AND
UNFINDABLE — unfindable precisely BECAUSE unrun, since anybody searching reasons from what
executes.** ✅ **Ward Lead's own search missed all five and reported "nothing exists".**

**COMMISSIONED WITH A PRE-REGISTRATION, because a first run of twelve unrun specs is otherwise
uninterpretable: what `verify:ui` actually runs, what it needs, and WHICH REDS ARE EXPECTED —
written down BEFORE the run, not classified after it.**

### O-17.5 · ✅ THE REFUSAL MESSAGES — (a) and (b) now, (c) scoped separately

    (a)  the 11 stage interpolations            BUILD NOW
    (b)  a guard that FAILS on a raw identifier  BUILD NOW, and BEFORE (c) — a guard that stops
         in any refusal message                  regrowth while a long job proceeds is worth more
                                                 than the same guard at the end, and it makes (c)
                                                 auditable
    (c)  the ~70 static sentences                🔴 ITS OWN BODY OF WORK. 6–10 commits, DAYS.

🔴 **LANE C'S SENTENCE IS THE ARGUMENT AND IT IS WHY (c) IS NOT A SWEEP:** _removing underscores
makes a sentence READABLE; it says nothing about whether it is TRUE — and the first refusal sentence
read closely was lying._ ⚠️ **Each of the ~70 hangs off a guard whose reachable population is not its
condition. A find-and-replace would preserve every false one while making them look reviewed.**

**When (c) is commissioned it wants the owner on the wording of the common shapes: D-32 rules one
wording per state, and seventy sentences is a vocabulary, not a chore.**

### O-17.6 · 🔴 THE TWO SCRATCH FILES — HE AGREED TO TELL LANE B HIMSELF. THAT IS NOT THE SAME AS HAVING TOLD IT.

**Lane B twice refused to delete them on Ward Lead's relay, and was right twice.** ✅ **Its rule:
permission that exists because a PERSON must decide cannot be armed by an agent quoting them.**

🔴 **The recommendation he approved was _"tell that team yes, in your own words."_ So he has agreed
to speak to it. Writing "he approved it, go ahead" would collapse exactly the distinction Lane B
refused — and would do so while holding a recommendation that says not to.**

⚠️ **AND THE FACTS CHANGED AFTER HE ANSWERED.** He approved something described as low-priority
housekeeping; Lane B then measured that `tests/zz-b3-probe.test.ts` fails `ward-test-discovery` on
every full run. ✅ **Ward Lead verified the blast radius: UNTRACKED, never committed on any branch,
present in no other worktree. It reds Lane B's sweep and nobody else's** — so nothing is urgent and
waiting costs nothing. **Lane B's own escalation ("a red on the tree everyone's greens are measured
against") was retracted by Lane B as a true local fact written at the width of a shared one.**

### O-17.7–.10 · ✅ Four non-decisions, recorded so they are not re-asked

**A capacity panel's check-list mechanism (becomes an O-16.1 growth proposal) · a movements feature
waiting on D-45 · an ED task waiting on D-18's staleness check · two lanes' work waiting on a fold.**
**None needed a ruling; all four clear themselves.**

### O-17.11 · ✅ FD-5 APPROVED — AS A FIELD, NOT A FIFTH STATE

**Lane D's recommendation, and its measurement is what carried it:**

🔴 **There is exactly ONE switch over `addressing.state` in `src` and it carries no `never` guard.
So a fifth state buys almost no compiler help: every `=== "queued"` site silently keeps its old
meaning and a withdrawn referral goes on counting as open, green all the way.** ✅ **A field changes
nothing by default and makes each of the eight call sites an explicit opt-in.**

⚠️ **THE CODEBASE'S LACK OF EXHAUSTIVE SWITCHES IS WHAT MAKES THE SAFER-LOOKING OPTION THE DANGEROUS
ONE.** That sentence is the ruling's reason.

**Sized: one field, one event, one derived function whose 22 callers inherit it, eight call sites at
one line each, one seed specimen minimum.** 🔴 **APPROVED WITH ITS LIMIT STATED, not as "small":
the MECHANISM is sized; the CLASSIFICATION of the eight is half a day of reading nobody has done.**

### O-17.12 · ✅ FIX `check-ward-expected-reds.mjs` — it printed "undefined failing" and then said OK

**Lane D refused to treat that OK as a measured zero, on the grounds that the line could not count.**
🔴 **A reporting bug that says OK over an uncounted population will eventually say OK over a real
red.** ✅ **Ruled: fix the count AND floor it — if the number is not a number, the tool REFUSES
rather than passes.**

---

### 🔴 THE ONE ITEM STILL REQUIRING THE OWNER'S OWN HAND

**O-17.6. Everything else is delegated and running. That one needs a line from him, to Lane B, in
Lane B's own chat — and no amount of approval given to Ward Lead can substitute for it.**

---

## O-18 · ⏳ QUEUED FOR THE OWNER — five questions raised while he was away, each with one recommendation

**Nothing here blocks the fourteen screens; all fourteen are in motion or measured. These are
decisions that will be WRONG to make without him, so they wait.** ⚠️ **Each carries a
recommendation, because a question offered without one is a menu, and he has asked twice not to be
given menus.**

### O-18.1 · `referralState()` has a fourth value nothing produces

**The function can return a fourth state. No code path writes it.**
⚠️ **A field with no producer passes every gate and shows on screen as a legitimate empty.**
✅ **RECOMMENDATION: delete the fourth value.** 🔴 **But NOT as dead code** — the deletion rule here
requires proving nothing reaches it, and "nothing imports it" is never sufficient. **Measure what
would have to change for it to become reachable first; if that answer is "one line in a reducer",
it is an unfinished feature and deleting it loses the intent.**

### O-18.2 · 🔴 A three-way naming collision on withdrawal

    WITHDRAW_REFERRAL              the coordinator withdraws it
    RECORD_REFERRER_WITHDRAWAL     the referrer withdrew it, we are recording that
    withdrawnAt                    the instant, on the record

**Three names, two actors, one word.** ⚠️ **"One word covering two states that differ in what
somebody must DO" is a recorded defect class in this project, and this is a live instance.**
✅ **RECOMMENDATION: rename by ACTOR, not by verb** — whatever the pair becomes, the name must say
_who withdrew_, because that is the distinction a coordinator acts on. 🔴 **Do not resolve it by
merging the two events; they have different consequences.**

✅ **CLOSED 2026-09-17** (records housekeeping, `docs/ward-flow/owner-answers-2026-09-17.md` item 62):
`WLQ-23` first answered "yes" to this recommendation but was built on a wrong premise — it described
`WITHDRAW_REFERRAL` as the coordinator's act when it is the referrer's — so nothing was built and the
question was re-asked as `WLQ-37`. `WLQ-37` (`owner-decisions-2026-09-15.md` ~:243): "The two
withdrawal event names stay as they are. Closes `WLQ-23` and `O-18.2`." **No rename happens.**

### O-18.3 · The out-of-area screen wants two primary actions

**The drawing gives the screen two equally weighted primary actions. The design standard allows
one.** ✅ **RECOMMENDATION: one primary, and the second demoted — and the owner picks WHICH,
because the answer is clinical, not visual.** ⚠️ **Whoever picks it should know the built screen's
current primary is already wired; demoting the wrong one silently changes what a coordinator reaches
for under time pressure.**

### O-18.4 · Three table thresholds are unreachable

**Three thresholds in a table cannot be hit by any data the app can produce.**
✅ **RECOMMENDATION: keep them and mark them as deliberately unreachable with the reason**, rather
than deleting or "fixing" the data to reach them. 🔴 **An unreachable branch is not merely dead — it
can hold a WRONG EXPECTATION that becomes live the day the data changes, and this repository has
one recorded instance of exactly that.**

### O-18.5 · ✅ ANSWERED BY MEASUREMENT — no decision needed, recorded so it is not re-asked

**He asked which of the statistics screens and Ward answer are separate builds versus upgrades.
Four were measured rather than guessed:**

    statewide statistics   🔴 EXISTS. DO NOT REBUILD.
    ward answer            🔴 EXISTS, and the BUILT screen is far MORE capable than the drawing —
                           it carries PULL_PATIENT, the whole bed-release lifecycle, an override
                           register and a suburb/team panel that the drawing never shows. A
                           rebuild-to-drawing would delete all of it.
    ward and ED compare    UPGRADE in place — building now
    service statistics     UPGRADE in place — building now

⚠️ **And `discharges` joins them: the drawing was REPRODUCED FROM the built screen by its own
admission. Nothing to build, and a rebuild would lose the phone card layout, a clinical-safety
sentence, and the subtitle.**

🔴 **So three of his fourteen turned out to be "already built, do not touch" — and every one of the
three would have LOST content had it been built as drawn.** ✅ **That is the build contracts earning
their cost: each was caught by reading the code before building, not after.**

---

## O-19 · 🔴 TWO QUESTIONS WITHDRAWN FROM O-18 BEFORE HE SAW THEM — the codebase already answered both

⚠️ **Recorded rather than silently deleted, because a question raised and then dropped is a decision somebody made, and the reasoning should survive.**

### O-19.1 · ✅ WITHDRAWN — Legal forms did NOT need a model decision

**Lane C measured that `LegalForm` is `{ code; kind?; dueAt? }` and concluded nothing records that a
code is inherently expiry-less — so "1A never has one" and "this 4A's is unpopulated" were the same
check. It recommended a named constant encoding the owner's 2026-08-23 instruction. I agreed and
queued it for him.**

🔴 **BOTH OF US WERE WRONG, AND THE ANSWER WAS IN THE REDUCER.** `ward-flow-reducer.ts:1139`:

    chosenForm?.kind === "transport" || chosenForm?.kind === "transfer" ? event.draft.legalFormDueAt : undefined

**And its own comment forecloses the fix we proposed:**

> ⚠️ **SELECTED BY `kind`, NOT BY A SECOND LIST OF CODES… A hardcoded `["4A", "4C"]` here would be a
> THIRD COPY of that pair, and this file already carries a comment about what a second copy does.**

🔴 **So the recommended remedy would have created the third copy that comment exists to prevent.**
✅ **The distinction Lane C needed is carried by `kind`, and `kind` is authoritative because the
reducer is what decides whether a deadline may be captured at all.** ⚠️ **The type told us the field
was optional; it did not tell us the field was load-bearing. Reading a type is not reading a rule.**

### O-19.2 · ✅ WITHDRAWN — "Add a patient" is NOT the referral act

**Queued as a possible collision with the referrals work. Measured by what each DISPATCHES, which is
the test that a previous withdrawn task failed to apply:**

    add a patient      ADD_PATIENT        creates a bare person record — number, DOB, name
    raise a referral   RECEIVE_REFERRAL   source, destinations, urgency. A different payload.
    referral board     creates no patient at all

✅ **And a route already existed at `/mockups/ward-flow/people/new` with a mature, tested form.**
**One sentence settles it: this screen creates the person record a referral must POINT AT, and
nothing else in Ward Flow can create one.**

---

## O-20 · ⚠️ A NEAR-MISS OF MINE, recorded because the class keeps recurring

**I grepped `code: "4A"` across `src/`, counted entries that appeared to carry no `kind`, and was one
message away from reporting a live clinical defect — a Form 4A rendering as though it structurally
never has a deadline.**

🔴 **The grep was matching lines whose `kind` sat on the NEXT line.** ✅ **Opening the four seed
entries showed every one carries both `kind` and `dueAt`. There is no defect.**

⚠️ **Counting hits instead of opening lines — the third instance in two days, and the first that was
mine.** **It was caught only because the finding was serious enough to verify before relaying, which
is not a mechanism. The mechanism is: a count is never evidence; the opened line is.**

---

## O-21 · ⏳ FIVE THINGS WAITING ON THE OWNER, 2026-09-12 — two decisions and three commissions

**Nothing here blocks the programme. The line is green at 420 files handed in, 420 run, 4,817
passed, 0 failed, and backed up.** ⚠️ **Each carries one recommendation.**

### O-21.1 · 🔴 A DELETION HE MUST AUTHORISE — and it is the only thing actually blocked

**Two Legal forms screens exist because Ward Lead assigned the screen to a lane AND dispatched an
agent for it. Both built it. Different paths, so they did not conflict** — 🔴 **identical work
produces no conflict, which is why duplicated effort is invisible by construction.**

**The better design won on measurement and the losing copy must go:**

    src/components/ward-management/legal/        a screen, its derivations, its stylesheet
    src/app/mockups/ward-flow/legal/             its route

⚠️ **It is no longer cosmetic. Four registry contracts assert that routes on disk match routes
registered, so the unregistered duplicate reddens seven tests.** 🔴 **What is lost: three files
written that day plus the route. Nothing references them — the lane verified that itself rather
than taking it from Ward Lead. The work survives in git history either way, and its one valuable
idea is already built and mutation-proved in the surviving screen.**

✅ **RECOMMENDATION: authorise the deletion.** 🔴 **AND THE LANE WAS RIGHT TO REFUSE IT TWICE.** Its
sentence is the standard: _"the tests are red" is not consent, and a deletion performed to make a
gate green is precisely the pressure the rule exists to withstand._ **Ward Lead wrote "the one
deletion I am authorising" and had no standing to; that was withdrawn.**

#### ✅ RESOLVED — the owner authorised it in his own words, 2026-09-12

**Authorisation:** _"Yes delete it"_, given directly to the lane after the loss was spelled out to
him in full. Backed up first (`~/Backups/claude-work/2026-09-12T023616Z`, 6,156 files, both
unpushed ward branches included), then removed under the documented override. Commit `ea5bca9591`.

🔴 **ONE CLAIM ABOVE WAS WRONG, AND IT IS THE KIND WORTH LEAVING VISIBLE RATHER THAN QUIETLY
EDITING.** _"Nothing references them"_ was false: a suite imported the losing copy's
derivations, so the deletion was five files, not four. **The error is instructive in the same
direction this record already argues.** The lane wrote that sentence from a search for PRODUCTION
importers and reported it as a claim about references in general — a measurement scoped to one
population, stated at the width of all of them. **A test file is a reference.** It was found only
because the deletion was re-verified from scratch at authorisation time rather than executed from
the record that recommended it.

**What the re-verification established that the original recommendation had not:**

    35 cases against 9          the surviving side's coverage exceeds the deleted side's outright,
                                and includes BOTH properties this record cares about - the split
                                reads the record rather than the form code, and neither group is
                                ordered against the other
    one export, no counterpart  the deleted side computed the scope sentence's three figures; the
                                surviving screen derives that sentence itself, so carrying the
                                helper across would have been a SECOND copy of one sum
    the fifth red was real      the deleted stylesheet composed no root, so it reached no print
                                reset; its themed text would have printed unreadable. Four of the
                                seven reds were registry bookkeeping. This one was a defect, and
                                deleting the page is the honest repair for a page that should not
                                exist rather than a print block added to keep it alive

**All seven reds cleared. 230 cases green across the four registry suites and both surviving
legal-forms suites; `tsc` clean.**

#### 🔴 CORRECTED 2026-09-12, AND BOTH FIGURES ABOVE WERE WRONG WHEN FIRST WRITTEN

**This record first said _40 cases against 11_. Measured: the deleted suite had NINE `it()` calls
and had nine from birth (`git log --follow` shows one prior version); the surviving pair returns
`Tests 35 passed (35)`.** ⚠️ **40 is reachable only by silently counting a third file the
sentence does not name and which is not the surviving side of the deleted screen.**

✅ **The comparison it was making survives unharmed** -- 35 against 9 is a wider margin than 40
against 11, not a narrower one -- **which is exactly why nobody would have checked it.** 🔴 **A
figure that flatters the conclusion it supports is the one least likely to be audited**, and this
one sat in the permanent owner record, which exists to be re-read.

⚠️ **Found by an adversarial review the owner authorised over the body of work, not by any
gate.** Six false claims, zero code defects, every gate green throughout. **The commit message of
`ea5bca9591` carries the wrong figures too and cannot be amended; this record is the correction,
and it is here rather than only in a channel because a retraction that lives in a message does not
travel.**

⚠️ **Do not run Prettier over this file to tidy it.** A format pass rewrites every `*emphasis*`
marker to `_emphasis_` and reflows ~158 lines, which buries the one edit that matters under a diff
nobody can read. No gate parses this document — the ten test files citing it do so in comments — so
the formatting carries no contract, only legibility.

### O-21.2 · ✅ WHICH LEGAL FORMS DESIGN — already built, confirm or overturn

    kept      three row shapes (breached · deadline unrecorded · structurally clockless), and the
              two kinds NEVER ordered against each other
    rejected  ONE list ordered by time remaining, with every deadline-less form at `Infinity`

🔴 **The rejected ordering put every Form 1A and 3B — the authority to hold a person — BELOW every
transport and transfer form, on a list whose own heading says it is ordered by time remaining.**
**All four seeded deadlines are on logistics; none is on a detention form.**

✅ **RECOMMENDATION: keep what is built. This is for confirmation, not permission.**

### O-21.3 · 🔴 WIRE THE D-3 GATE — it enforces his own ruling and runs nowhere

**`scripts/ward-flow/check-text-size-floor.mjs` implements D-3 (2026-09-10, no new sub-12px text).
Zero `package.json` references, no test, no CI job.** ⚠️ **Control: the same query against
`check-type-scale` returns a hit, so the probe finds wiring where wiring exists.**

    1  wire it
    2  pin the PER-FILE breakdown, not the total — the data is already computed and discarded
    3  compare `fileCount` — printed, never compared, so a rename donates its whole count
    4  widen the population beyond `src/components/ward-management/` — a new ward screen in a new
       top-level folder is invisible to it, and one was created on 2026-09-12

🔴 **One judgement to STATE rather than solve: the counter reads comments deliberately, so
documenting the rule breaches it.** **Special-casing comments needs its own test proving the script
still catches a declaration disguised as one.** ⚠️ **Measured: eight new sub-floor declarations were
added in one night and the ratchet still printed "Not risen", because its baseline carries slack.**

✅ **RECOMMENDATION: commission all four. "Wire the gate that exists" is an hour; "write a gate" is
a day, and the second is what would have been commissioned without the control above.**

### O-21.4 · ⏳ THE SCANNER-FLOOR SURVEY — in flight, result due

**Can each guard tell UNSCANNED from PASSED?** 🔴 **A guard on the on-call screen was not passing —
it was never reading the text, because sub-headings put the prose outside its scan region. It would
have looked green for ever.**

⚠️ **Scope, stated because three boundary corrections were needed to find it: 63 ward test files
that walk a population by `readdirSync`/`globSync`. NOT `git ls-files` walkers (34 across the repo),
NOT `scripts/` (53).** **The survey reports on populations that silently EMPTY; populations that
silently FILL are a declared uncovered sibling.**

✅ **RECOMMENDATION: receive the ranked list; do NOT authorise a blanket fix.** 🔴 **Sixty-three
floors at once is unreviewable, and a floor on the WRONG population is worse than none — it reports
healthy while the thing it watches is empty.**

### O-21.5 · ⏳ THE CLINICAL-TEXT CENSUS — scoped, deliberately not started

**Which small text is chrome and which is clinical.** 🔴 **10px on a legend is a style choice; 10px
on a bed count is a safety question, and the token is identical in both.**

✅ **RECOMMENDATION: his call, and the lane's reason is why — a classifier deciding what counts as
clinical text is a clinical judgement wearing a measurement's clothes.** ⚠️ **Its asymmetry is
stated first in the scope: calling chrome clinical is cheap; calling clinical text chrome removes a
bed count from the list he reviews, and the omission is invisible.**

---

## O-22 · ✅ THE THREE THRESHOLD QUESTIONS — answered by the owner DIRECTLY, in the Settings lane's own chat

⚠️ **RECORDED HERE, NOT DECIDED HERE.** He was given the three questions with the measurement behind
each and answered _"Yes to your recommendations"_. 🔴 **So the recommendations ARE the ruling, and
they are written out below rather than referred to — a ruling that exists only as "yes" to a message
in another chat is a ruling nobody can look up.**

### O-22.1 · 🔴 NOT ADDED — the two thresholds the drawing lists and the app does not have

**The drawing's own note against them reads _"No owner recorded. Nobody has approved this figure."_**
🔴 **A number that changes a colour with nobody's name against it is precisely what this table exists
to EXPOSE. Adding two more would be self-defeating.**

### O-22.2 · ✅ PUBLISHED — the one the app HAS and the drawing omits

**The legal-form deadline tint.** ⚠️ **It was tinting a screen while appearing in no table of
thresholds — the inverse of O-22.1 and the more dangerous direction: an unlisted threshold is a
colour change nobody can account for.**

### O-22.3 · ✅ ADDED — a state per row, and it is MEASURED rather than written

🔴 **Two of the three states look identical to anybody using the app — nothing is ever amber — and
they need opposite responses.** ⚠️ **A hand-written state column would be a second source about the
first, and its going stale would be invisible for the same reason: a row saying "nothing reaches it"
and a row that is simply WRONG both render as no amber anywhere.**

✅ **Each row is measured against the same data the threshold is read against, and pinned in BOTH
directions** — clock +1 year turns the legal-form row live with nobody editing the table; clock −1
year stops the access target firing. 🔴 **A state that can only ever say one thing would prove
nothing.**

✅ **And nothing re-derives a threshold: a table about where numbers live must not become a second
place one lives.**

### O-22.4 · ⚠️ NOT RULED ON — a conditional recommendation he did not have to take, held in case he revisits

**If he ever wants one of the two declined thresholds: take the LONG-WAIT one first and leave the
referral mark.** **The sidebar already flags delays and blocked discharges, and a third mark
competing with those makes all three easier to ignore.**

🔴 **He has not ruled on this. It is a recommendation sitting unused, not a decision, and it is
recorded separately so a later reader cannot mistake it for one.** ✅ **The lane flagged this
distinction itself rather than folding the conditional into the approval.**
