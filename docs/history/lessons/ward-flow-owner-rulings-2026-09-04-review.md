---
name: ward-flow-owner-rulings-2026-09-04-review
description: "Five owner answers from the 2026-09-04 deep review, four of which reverse or extend earlier rulings — real tool, per-person login, direct admission, observation units, the legal clock"
metadata:
  node_type: memory
  type: project
---

**2026-09-04, asked directly with the consequences spelled out against each option.** The owner took
the HEAVIER option every time. Four of the five change decisions the team is currently building
against, so check these before trusting an older ruling.

| #   | Question                             | Answer                                                                                                                                                                                | What it reverses                                                                                                                                                                                         |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What is Ward Flow for?               | **A real tool, to be used**                                                                                                                                                           | see [[ward-flow-is-destined-to-be-a-real-tool]]                                                                                                                                                          |
| 2   | Where does the record live?          | **Owns the search AND the communication**; the bulky hospital DMR keeps its own copy. Lightweight and rapid is the point.                                                             | —                                                                                                                                                                                                        |
| 3   | How do people find out?              | **A live board people watch** — and _eventually_ a per-role notification setting on that board flagging everything that role must respond to. **No external alerting (no SMS/page).** | settles the "must be told" rulings as "must be visible, and flagged"                                                                                                                                     |
| 4   | How do people reach their own board? | 🔴 **PROPER LOGIN, PER PERSON**                                                                                                                                                       | Reverses "role is a build-time tag, not an identity" and "no viewer model". Today a ward's identity comes from the URL — change the id and you see another ward's patients, including who declined whom. |
| 5   | Direct community→ward admission?     | 🔴 **IT IS REAL — MODEL IT**                                                                                                                                                          | Reverses "every journey begins at an emergency department" and the dropping of community-origin journeys.                                                                                                |
| 6   | Observation units (MHOA/MHAU)?       | 🔴 **MODEL AS A PLACE A PATIENT CAN BE**                                                                                                                                              | New: neither ED nor ward. Changes what "time in ED" means.                                                                                                                                               |
| 7   | The statutory clock?                 | 🔴 **SHOW IT — it drives urgency**                                                                                                                                                    | Reverses "the examination clock is left alone". App must hold form type + start time.                                                                                                                    |

## ⚠️ What each one costs, so nobody treats them as small

- **Per-person login** brings authentication, an account per user, and an audit trail — and it is the
  only option that actually ENFORCES the ward-blindness ruling rather than displaying it.
- **Direct admission** adds a second way a journey can start. The referral-creates-the-journey model
  assumed one.
- **Observation units** are a real place: 6–10 beds, 24–72 h, at SCGH and Joondalup (MHOA), Fiona
  Stanley (MHAU), new at Bunbury; a coroner recommended one for Peel after a death in an ED overflow
  bed. A patient in one is neither "in ED" nor "placed".
- **The legal clock** is the highest-risk item in the app. Form 1A runs 72 h (144 in the country);
  3A is 24 h, extendable by 3B twice to 72 h total. ⚠️ **A wrong legal countdown is worse than
  none**, and it sits beside an existing rule that Form 4A/4C deadlines are typed by a human and
  never auto-filled — reconcile the two before building.

**Method note, because it is why these are trustworthy:** each was asked as a multiple-choice
question with the consequence written against every option, after measuring the current code rather
than reading a document. The URL-scoping finding came from reading the route, not from a doc.

Related: [[ward-flow-coordinator-overrides-everything]], [[ward-flow-referral-model]],
[[ward-flow-ledger-system]], [[prove-the-task-is-still-outstanding]].

## Second batch, 2026-09-04 — scope, users and the core job

| Question                               | Answer                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One coordinator or several?            | **One statewide now, several areas later.** ⚠️ Design the login so AREA SCOPING can be added without rework — it is coming.                                                   |
| Which patients?                        | 🔴 **PRIMARILY ADULTS.** Also older adult, forensic/secure, and youth.                                                                                                        |
| Where used?                            | **DESKTOP IS THE PRIMARY SCREEN** — coordinator desk and ward workstations. Phone must also work, but is secondary. Also read at a nurses' station, on a phone, and on paper. |
| The one job it must beat the phone at? | **BOTH** "show the whole state at a glance" AND "show why each person is stuck".                                                                                              |

🔴 **THE PRIMARY POPULATION IS ADULTS. Corrected by the owner 2026-09-04, against my own summary.**
I had written that the app "is for youth" because he mentioned his own service is youth 16–24. It is
not. **Adults are the primary population**; older adult, forensic/secure and youth are also in scope.

⚠️ **THE TRAP THAT CAUGHT ME: a clinician telling you which service THEY work in is not telling you
what the app is for.** He said "my system is for youth 16–24" meaning his own unit, and I read it as
the product's scope. One sentence, two possible subjects, and I picked the wrong one.

**Youth means 16–24** (units like **EMYU**, the East Metropolitan Youth Unit). **Under-16 paediatrics
goes to Ward 5A at Perth Children's Hospital and is OUT of scope.** Do not fold "child and
adolescent" into one cohort — the boundary is 16 and the two sides are different services.

⚠️ **DESKTOP-FIRST IS A CORRECTION TO WHERE EFFORT HAS GONE.** Substantial phone-chrome machinery
exists (a phone dock, scroll-hide chrome, `verify:phone-chrome`, phone-specific card lists). The
owner has now said the primary screen is desktop. Phone stays supported; it is not the design centre.

⚠️ **"BOTH" ON THE CORE JOB IS NOT A DODGE — IT IS TWO DIFFERENT OBJECTS.** The whole-state picture
is about BEDS; "why is this person stuck" is about BLOCKAGES. An app can hold both, but they want
different screens and the second is barely modelled today (blockers exist on bed releases, not on a
patient's journey).

## Third batch, 2026-09-04 — the bed picture, blockages, and direction

| Question                        | Answer                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where do bed numbers come from? | **Wards type it, and STALENESS IS SHOWN** — that is the main design. **Plus:** a future feed from the hospital system, and the owner has asked **what would be required to set that up** (an owed deliverable, not a decision). |
| How should "stuck" work?        | **ALL THREE — derived, free text, and a fixed list with a note.** ⚠️ And explicitly delegated: _"ground your response in the current layout and structure to create the best system / work it out."_                            |
| Bed identity?                   | **Counts, PLUS WHAT KIND** — broken down by the properties that change eligibility (female-appropriate, high-dependency), not per-bed records.                                                                                  |
| Path to real use?               | 🔴 **BUILD UNTIL IT IS UNDENIABLY BETTER, THEN APPROACH.** No pilot yet, no executive pitch yet.                                                                                                                                |

⚠️ **THE PATH ANSWER SETS THE PRIORITY ORDER AND IT IS NOT THE OBVIOUS ONE.** "Real tool" plus
"per-person login" could be read as "build authentication next". It should not be. Nothing about
login makes the tool _undeniably better_ at the two jobs he named; it is required before real
patients, not before real quality. **Sequence: make the two core views excellent, then the things a
real deployment demands.**

**Staleness is now load-bearing.** "Karri: 2 free, updated 4 hours ago" — the AGE of a number becomes
a first-class fact on every ward, and the app must never present a stale figure as current. This
converges with the existing ruling that a stale bed count is refusable with a recorded reason.

## Fourth batch, 2026-09-04 — and one of these REVERSES a hard non-goal

| Question                   | Answer                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What must it never do?     | _"It can never make a clinical decision on its own. **It can guide and give recommendations** that the final acceptance comes from the users."_ Plus: never show a bed that isn't there; never lose a person; never state something the record doesn't support. |
| Distance from home?        | 🔴 **TREAT DISTANCE AS AN ELIGIBILITY FACTOR** — not merely reported.                                                                                                                                                                                           |
| When is it hardest to use? | **Not sure — owner asked me to work it out.** (Owed.)                                                                                                                                                                                                           |
| Keep history?              | 🔴 **YES — "it is part of being real."** Retention, governance, and reconstructing a past state.                                                                                                                                                                |
| Youth pathway?             | **Youth follows the SAME flow pathway as adults and older adults.** Different unit eligibility, not a different journey.                                                                                                                                        |

🔴 **"IT SUGGESTS NOTHING" IS DEAD.** The project's stated non-goal — _"THIS BOARD RECORDS AND SHOWS.
IT SUGGESTS NOTHING (spec D4). No least-bad options, no ranking of wards the patient does not fit"_ —
is superseded. The new line is **advisory with human acceptance**: the app may guide and recommend;
it may never decide on its own.

⚠️ **THIS RESOLVES A CONFLICT THE DOCUMENTS COULD NOT.** Two same-day 2026-09-02 rulings appeared to
contradict each other — R1 _"Keep advising and let the clinician decide!"_ against _"the engine
should refuse, screen checks are not enough."_ They are **both true and not in conflict**: the engine
refuses an ineligible placement unless a reason is recorded, AND the app advises. One is a gate, the
other is guidance.

⚠️ **Distance-as-eligibility and recommendations pull the same way** — the app is now permitted to
express a clinical view. Every "we must not suggest" comment in the code is now stale and will read
as a live rule to whoever meets it next.

**History being in scope is the quiet one.** It is far easier designed in than bolted on, and it is
also the thing that answers a coroner and wins a business case.

## 🔴 THE BIGGEST STATEMENT OF THE SESSION — the app is a MATCHING engine, and "suggests nothing" was never right

Owner, verbatim, 2026-09-04, correcting me directly:

> _"Fix the suggest nothing principle... **this is incorrect!** I want it to use all the information
> it has to make accurate suggestions about what patients best fit the wards and the most effective
> and efficient way to match all patients with beds... I will implement full AI capabilities and
> smart capabilities later... but for now that is another future goal once the infrastructure is
> built."_

⚠️ **THIS IS NOT "ALLOW A HINT". IT IS A DIFFERENT PRODUCT SHAPE.**

- **Per-patient advice** — "which wards suit this person" — is wanted.
- 🔴 **AND SO IS GLOBAL MATCHING** — _"the most effective and efficient way to match ALL patients with
  beds."_ That is an assignment problem across the whole board, not a ranked list for one patient.
  Filling the best bed for the patient in front of you can be the wrong move for the ward round as a
  whole, and he is asking for the second thing as well as the first.
- **AI is explicitly a LATER phase**, gated on infrastructure existing first. Do not build it now;
  **do build so it can be added** — which mainly means the data and the decision points have to be
  real and complete.

**The boundary that survives:** _"It can never make a clinical decision on its own... the final
acceptance comes from the users."_ Recommend freely; never decide.

⚠️ **EVERY "we must not suggest" COMMENT IN THE CODE IS NOW WRONG AND WILL READ AS LIVE.** They are
written emphatically (`THIS BOARD RECORDS AND SHOWS. IT SUGGESTS NOTHING`, "no least-bad options",
"no near-miss computation") and a future session meeting one will obey it. They must be found and
corrected, not merely superseded in a document — this is the same failure mode as a comment that
enumerates what it covers.

⚠️ **And it changes what "counts, plus what kind" has to carry.** A matcher can only be as good as the
properties it can match ON — bed kind, sex-appropriateness, dependency level, distance from home
(now an eligibility factor), specialling capacity. The bed model is now the substrate for the
matching engine, not just a display.

## Fifth batch, 2026-09-04 — how the matcher must behave

| Question                         | Answer                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What makes a good match?         | **ALL FOUR: clinical fit and legal authority; distance from home/family; how long they have waited plus the legal clock; continuity — known to that service.** |
| Whose interest does it optimise? | 🔴 **SHOW THE TENSION RATHER THAN RESOLVE IT** — present best-for-this-patient AND best-for-the-board when they differ, and let the coordinator choose.        |
| How is a suggestion presented?   | **All three: always show the REASONING (never a bare ranking); always show ALTERNATIVES beside it; make accepting it a DELIBERATE act that never pre-fills.**  |
| What happens on override?        | 🔴 **Record it, AND use it to improve the matcher.**                                                                                                           |

⚠️ **"SHOW THE TENSION" IS THE MOST DEMANDING ANSWER HE COULD HAVE GIVEN, and it is the right one.**
It means the matcher must compute TWO answers — the best bed for the patient in front of you, and the
arrangement that places the most people well — and surface them when they disagree. A single ranked
list cannot express it. It also means the app never hides a trade-off inside a weighting.

**"Show the reasoning" constrains what the matcher may use.** Every factor must be explainable in one
clinical sentence. A weighting nobody can articulate is not permitted, which rules out an opaque
model even in the later AI phase — the explanation is not a feature, it is the safety mechanism
against automation bias at 3am.

**Overrides become training data**, and that is the concrete answer to _"what infrastructure must
exist before the AI phase"_: start recording human corrections against suggestions NOW, because it is
cheap today and impossible to backfill.

⚠️ **He did NOT choose "show what it does not know."** I would still recommend it; it is not his
ruling. Do not present it as one.

**Continuity needs history the app does not hold** — "known to that service" requires past admissions
per patient. That converges with his separate ruling that history is in scope.

## Sixth batch, 2026-09-04 — and the principle running through every answer

| Question                                      | Answer                                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sex vs gender identity?                       | 🔴 **ASK A CLINICIAN WHO WORKS IN THIS AREA.** A named external review, like the Aboriginal health review. **Do not design it.** |
| Does the matcher change the referral process? | **Both, but focus on "the matcher informs who to ask" NOW**, with matcher-proposed mode as a switchable option.                  |
| Patient history?                              | **Only what this app itself did** — _"however note that the infrastructure should be there to import past admissions."_          |
| Where will it run?                            | **Undecided, but it must be possible.** Flag any choice that would make hosting inside a health network hard later.              |

## 🔴 THE PRINCIPLE, and it is the single most useful thing to carry forward

> **Build the lightweight version now; design so the heavy version can be added without rework.**

He gave that answer FIVE separate times, in different words, and never once asked for the heavy thing
to be built now:

- one coordinator now, **area scoping later** — so build login to accept it
- wards type bed numbers, **hospital feed later** — and he asked what that would require
- history from this app only, **import later** — but the infrastructure must be there
- advisory matcher now, **proposed-allocation mode later** — as a switch
- **AI later**, once the infrastructure exists

⚠️ **THE FAILURE THIS GUARDS AGAINST IS BUILDING THE HEAVY THING NOW** — authentication, integration,
AI — none of which makes the tool _undeniably better_ at the two jobs he named. **And the opposite
failure is shipping something that has to be torn up** to accept them. Both are real; the answers
name the line between them.

**Two things go to named external reviewers, not to us:** sex/gender handling, and Aboriginal
cultural safety. Neither is a design task.

## Grilling round 1, 2026-09-04 — the stuck-patient model

| #   | Question                                      | Answer                                                                                                                                                                                                         |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What does "stuck since" measure?              | **Total time since the journey opened is the MAIN number**, with time-on-this-blockage secondary. _"the goal is to get into a bed."_ ⚠️ He inverted my emphasis — I proposed the pair with per-blockage first. |
| 2   | Can a patient have several blockages at once? | **YES — many at once, all listed.**                                                                                                                                                                            |
| 3   | System blocker vs human blocker?              | **BOTH SHOWN.** They answer different questions.                                                                                                                                                               |
| 4   | Who may record a blockage?                    | **Anyone, on any patient, ATTRIBUTED to them** — not restricted by role. Delay is often known by whoever is not holding the patient.                                                                           |
| 5   | Is there a "stuck" threshold?                 | **No invented threshold** — sort and shade by duration.                                                                                                                                                        |

🔴 **THIS OVERTURNS AN EXPLICIT 2026-09-01 RULING, and the code cites it.** `Movement.blocker`'s doc
comment reads: _"WHAT IS HOLDING THIS MOVEMENT UP, IN SOMEBODY'S OWN WORDS. FREE PROSE, AND THAT IS
LOAD-BEARING RATHER THAN AN OVERSIGHT. Owner ruling, 2026-09-01... do not derive it."_ He has now
asked for derived AND free text AND a fixed list. Latest decision wins (this project's own standing
rule) — but say so out loud rather than silently contradicting a cited ruling.

⚠️ **AND THE CODE ALREADY CONTRADICTED THAT RULING ANYWAY** — `STAGE_TRANSITION_BLOCKERS` stamps a
derived blocker at every stage transition. Ruled "do not derive", then derived.

## 🔴 "ACCESS BLOCK" — the real Australian threshold, and a correction I had to make mid-round

I advised against any time threshold, calling it "a target in disguise". **Wrong in an important
way: Australia already has one.** The Australasian College for Emergency Medicine defines **access
block as a patient still in an emergency department 8 or more hours after being ready for the next
step.** Published, clinician-owned, and the standard Australian term for exactly this wait.

> **Adopting a recognised external standard is a different act from inventing an internal one.**

Revised advice, which he accepted: no invented line, but **mark the ACEM 8-hour point and name it as
ACEM's.** ⚠️ I nearly talked him out of a real clinical standard because an inferred house rule
("this app shows no targets or benchmarks") had become my own assumption too.

**Facts worth keeping:** the module already holds **13 fixed reason lists** — a fourteenth must earn
its place. `BED_RELEASE_BLOCKERS` (8 members, discharge side) maps well onto the NHS 37-code mental
health discharge-delay list. **No WA taxonomy exists** that could be found; the one policy that would
hold it is dead-linked on the Chief Psychiatrist's site. Three real-world categories have nowhere to
go in this app: **funding/NDIS decisions, legal or tribunal proceedings, and staff shortages.**

## Grilling round 2, 2026-09-04 — all eight recommendations accepted

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Nine blockage kinds**: no suitable bed in the network · awaiting a ward's answer · awaiting the bed to be ready · awaiting staffing (specialling) · awaiting transport · awaiting medical clearance · awaiting a legal form or authority · awaiting funding or an external service · patient or family factors. **Cut rather than add.** "Coordinator still deciding" DELIBERATELY EXCLUDED — thinking is not a blockage and naming it invites the board to nag people doing their job. |
| 7   | **Kind REQUIRED, free-text note OPTIONAL, both together.** ⚠️ If the note can stand alone everyone uses it and nothing is ever countable.                                                                                                                                                                                                                                                                                                                                                 |
| 8   | **Two separate lists, kept deliberately** — discharge blockers (why a bed can't be freed) and movement blockages (why a patient can't reach one) mean opposite things. Wording should be visibly parallel.                                                                                                                                                                                                                                                                                |
| 9   | **Cleared blockages are KEPT, with the time each ran.** Gives "26 h: 4 awaiting a ward, 19 awaiting a bed, 3 transport" — the business case, the coronial answer, and the matcher's training data. Free now, impossible to reconstruct later.                                                                                                                                                                                                                                             |
| 10  | **The system clears only what the system set.** A human-recorded blockage is NEVER auto-cleared — the app cannot know the interpreter arrived.                                                                                                                                                                                                                                                                                                                                            |
| 11  | **Attaches to the JOURNEY, and is also recorded against the patient** — the patient link is what later gives "third time accommodation has held this person up", the continuity signal he wants in matching.                                                                                                                                                                                                                                                                              |
| 12  | **The view lists PEOPLE**, grouped by most significant blockage, others shown on the row. ⚠️ Group headings must count PEOPLE and say so, or the columns won't add up to the patient count and nobody will trust the screen.                                                                                                                                                                                                                                                              |
| 13  | 🔴 **Coordinator and author see the free-text note; wards see the KIND ONLY.** The kind is operationally necessary; the note is where clinical and identifying detail will land, and privacy cannot be retrofitted onto free text.                                                                                                                                                                                                                                                        |

## Grilling round 3, 2026-09-04 — accepted, with two amendments

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14  | 🔴 **ONE VIEW, BOTH DIRECTIONS** — patients waiting to arrive AND patients whose discharge is jammed, visibly separated. This is what makes it a BED FLOW view rather than a referral view: "4 waiting for a bed at Karri" beside "3 Karri patients blocked on accommodation" is cause and effect on one screen.                                                                                 |
| 15  | ⚠️ **REOPENED BY THE OWNER — PARKED, NOT DECIDED.** I recommended starting the access-block clock at medical clearance. He rejected the premise: _"sometimes ED doctors refer patients prior to medical clearance."_ So referral and clearance have NO FIXED ORDER, and no single event reliably marks "ready for the next step". **Design the clock start as changeable; do not hard-code it.** |
| 16  | **Each derived blocker carries one of the nine kinds and keeps its precise sentence as the note** — plus the owner's amendment: **the kinds must be EASY TO CHANGE AND EXTEND.** One named constant, one place, everything derived from it; adding a kind must not mean touching many files.                                                                                                     |
| 17  | **Empty list means nothing is blocking; the "No blocker" / "None — in transit" sentinels are deleted.** ⚠️ They are named in a constant other code tests against — delete together or the removal half-lands.                                                                                                                                                                                    |
| 18  | **Sort by total wait, longest first — EXCEPT an expiring legal authority, which is pulled to the top and marked.** A Form 1A running out in two hours outranks a longer wait with no clock, because one becomes unlawful and the other does not.                                                                                                                                                 |
| 19  | **Re-label the 50 seeded free-text blockers BY HAND**, keeping each sentence as its note. They are the closest thing to how a real coordinator writes; a rule would mislabel the awkward ones, and the awkward ones are the interesting ones.                                                                                                                                                    |
| 20  | **Its own route, and it prints.** Not a panel on the coordinator board — it is half the product's stated core job, and it is the page someone carries into a morning meeting.                                                                                                                                                                                                                    |

⚠️ **Q15 IS THE ONE TO WATCH.** I recommended a clock start that the owner's own clinical knowledge
falsified in one sentence. The ACEM standard says "ready for the next step"; the WA reality is that
the steps do not happen in a fixed order. **Any design that assumes referral follows clearance is
wrong.** Until it is settled: show total wait, and do NOT label anything "access block".

## Grilling round 4, 2026-09-04 — all accepted

| #   | Decision                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | 🔴 **RENAME TO KILL A COLLISION.** The patient side becomes a **DELAY**; **BLOCKER** stays for the bed side. Two fields were both called `blocker` — the code comments flag the confusion twice as a known hazard. The view is called **Delays**. **"Access block" stays reserved for its exact ACEM meaning** and never becomes a loose synonym. |
| 22  | **Most significant = the LONGEST-RUNNING one.** Any precedence over the nine kinds would be the app asserting that one kind of delay is worse than another — a clinical judgement, invented by us, and wrong for a patient two hours from a bed.                                                                                                  |
| 23  | **One entry per kind per journey**; a second occurrence updates the first. Otherwise "six people awaiting transport" can silently be four.                                                                                                                                                                                                        |
| 24  | **The author or the coordinator may remove a delay, and removal is RECORDED, never erased.**                                                                                                                                                                                                                                                      |
| 25  | **While the clock start is parked: show total wait, do NOT label anything "access block."** Quoting a published standard against the wrong start time is worse than not quoting it.                                                                                                                                                               |
| 26  | **Two sections on one page, ward names linked across both** — people waiting for a bed above, wards whose beds are not freeing below. Seeing the same ward in both halves is the moment cause and effect become visible.                                                                                                                          |

## 2026-09-04 later — Ward Flow is ON MAIN, and two corrections

**MERGED.** PR #2597, squash `0157ad2d6`. Verified by me, not relayed: `origin/main` carries **139
files** under `src/components/ward-management`. ⚠️ **The recorded standing rule was "Ward Flow is
never pushed"** — my own audit classified that as INFERRED, provenance unknown. It has now been
pushed and merged. Ward Lead reports the owner confirmed it directly.

🔴 **"IT SUGGESTS NOTHING" FORMALLY WITHDRAWN — ruling `R-2026-09-04-G`.** Four source files
corrected to DESCRIBE what the code does rather than INSTRUCT what it may never do. Three mentions
deliberately kept, and the discrimination is the good part: "a contested suburb suggests nothing" is
a different rule about catchment routing; "a suggestion is never a selection" is the boundary the
owner KEPT; and the escalation page's user-facing copy is still true until the feature exists, so
rewriting it would put a false product claim on screen ahead of the build.

## 🔴 "NOTHING IMPORTS IT" ANSWERS A NARROWER QUESTION THAN "IS IT SAFE TO DELETE"

I told the owner `wards/ward-overview.module.css` was a stylesheet no page uses, and that keeping or
deleting it was his call. **Wrong.** On `main`, three files reference it — including
`wards/ward-index.tsx`, the component whose card layout was built from it — and a test refuses its
removal. It was kept deliberately, pending a decision.

⚠️ **Ward Lead made the identical error and recommended deletion; the owner agreed.** Nothing was
deleted only because Ward Lead read the neighbouring file before acting. **Two of us reached the
same wrong answer from the same too-narrow question**, and it was one step from a deletion the owner
had approved on our advice.

**The question to ask is not "does anything import this" but "what would stop working, and what has
already been decided about it."**

Related: [[dead-code-deletion]] in AGENTS.md, [[prove-the-task-is-still-outstanding]],
[[assert-only-about-code-you-opened]].

## Grilling round 5, 2026-09-04 — accepted with eight amendments

| #            | Decision as amended                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 27           | One "awaiting a ward's answer" delay overall, wards named on it.                                                                                                                                                               |
| 28           | Live journeys in the main view; finished ones reachable separately.                                                                                                                                                            |
| 29           | Ward updates its numbers INLINE.                                                                                                                                                                                               |
| 30           | Staleness is displayed age only, never withdrawn.                                                                                                                                                                              |
| 31           | ⚠️ **AMENDED. Break the count by SEX and by LOCKED vs OPEN — not "high dependency".** Owner: _"High dependency is better referred to as Involuntary. I.e. I have locked and Open beds... In keeping with WA health approach."_ |
| 32           | Free prominently, total on the row.                                                                                                                                                                                            |
| 33           | ⚠️ **AMENDED.** Last number greyed WITH the time the ward last updated, **plus an affordance for the coordinator to request an update.**                                                                                       |
| 34           | Coordinator may correct a ward's number, attributed.                                                                                                                                                                           |
| 35           | ⚠️ **AMENDED.** On request NOW; **automatically later**, always with the option to select one or **search for others**.                                                                                                        |
| 36           | One answer when they agree; side by side with the reason only when they diverge.                                                                                                                                               |
| 37           | ⚠️ **AMENDED — THE TOP FEW**, not every ward. See the conflict note below.                                                                                                                                                     |
| 38           | Per patient now; whole-board later.                                                                                                                                                                                            |
| 39           | Name what would have to change.                                                                                                                                                                                                |
| 40           | ⚠️ **AMENDED — direct admission comes ONLY from a COMMUNITY TEAM.** Not a psychiatrist generally. Make that explicit.                                                                                                          |
| 41           | 🔴 **AMENDED — crisis/short-stay units (MHEC at RPH, MHOA at SCGH) are MODELLED AS WARDS**, not a third kind of place.                                                                                                         |
| 42–51, 55–58 | As recommended.                                                                                                                                                                                                                |
| 52           | ⚠️ **AMENDED.** Microsoft health-service SSO exists and is easy. **But start with GLOBAL accounts — one per ward, one per ED, one per community team** — with individual sign-up available for testing.                        |
| 53           | ⚠️ **AMENDED — just the CURRENT ward / ED / community team.** Not the wider service.                                                                                                                                           |
| 54           | ⚠️ **AMENDED.** Per-person is the goal; **for now the wards use shared location logins**, with per-person also available.                                                                                                      |

## 🔴 WARDS MAY REFER TO OTHER WARDS — owner emphasised it, and it is ALREADY BUILT

Owner: _"Short stay wards may need to refer a patient for a longer stay... ensure that wards also
have the ability to refer patients to other mental health wards."_

**Measured on `origin/main`: `RAISE_REFERRAL: ["ed", "community", "ward"]`.** The `ward` role can
already raise one. It is also an existing owner ruling from 2026-09-01 — itself a same-day reversal
of "no ward-to-ward referral, do not fix it". **Nothing to build; confirm it works end to end.**

## Three facts that settle the amendments

**Locked/open already exists and is called `Security`.** `export type Security = "Open" | "Secure"`,
carried on BOTH the unit and the movement. And `forensic` is a SEPARATE boolean on units — so the
model already keeps the two axes apart.

⚠️ **But "locked bed" and "involuntary patient" are NOT the same fact, and the owner's phrasing
merged them.** `Security` is a property of the BED; `LegalStatus` is a property of the PATIENT. A
voluntary patient can be nursed on a locked ward. **Break the bed counts by `Security`; check legal
status against it as eligibility.** Do not create a bed field called "involuntary".

**Crisis wards being wards resolves cleanly with ward-to-ward referral**: admission to MHEC/MHOA is a
REAL placement, and a patient needing a longer stay generates a NEW referral from that ward. That is
better than my "always a waypoint" answer, which would have left them invisible as admitted patients.

## 🔴 A MIXED LOCKED/OPEN WARD CANNOT BE REPRESENTED — structural model defect, found 2026-09-04

Owner, answering directly: _"Yes they do. For example **Ward 7 in Bentley is a locked/Open ward** so
some wards are a combination with a number of designated locked beds and open beds."_

**The model says a ward is wholly one or the other.** `security: Security` = `"Open" | "Secure"` on
the Unit — 16 Open, 7 Secure across 23 units. There is no per-bed designation and no count.

**And the eligibility gate turns on that single flag** (`ward-eligibility.ts:123`):

    pass: movement.security === "Open" || unit.security === "Secure"

⚠️ **SO A MIXED WARD RECORDED AS "Open" HIDES EVERY ONE OF ITS LOCKED BEDS** from every patient who
needs one. The gate is asymmetric: an Open patient passes everywhere, a Secure patient passes only a
wholly-Secure ward. The fixture already flattens Bentley into "BTY Adult Secure".

> **The model cannot express "four locked beds, sixteen open, two of the locked are free" — which is
> the sentence a coordinator actually needs.**

**This is not the count breakdown I proposed under Q31.** It is a structural change: security has to
become a per-bed-group property with counts, and the eligibility gate has to ask whether a SUITABLE
BED is free rather than whether the WARD is of a type.

## Also 2026-09-04

**Q62 amended:** a stale-bed update request flags on the ward — **and each ward page gets a
NOTIFICATIONS SECTION**, easy to see, carrying all important updates and requests. This is the
per-role flagging arriving concretely, and it is the first real notification surface in the app.

🔴 **STANDING STEER FROM THE OWNER, applies to everything:**

> _"the goal overall is to be incredibly user friendly and intuitive to use this app."_

Weigh every design choice against that. It is the counterweight to a model that keeps getting richer:
each new field is a thing somebody has to fill in at 3am.

## ⚠️ SIMPLE DOES NOT MEAN REDUCED — owner steer, 2026-09-04

> _"when designing it to be simple... ensure the actual functionality is not reduced and the design
> and style is not impacted. It still must be visually appealing and very functional."_

**This is the counterweight to the usability steer, and both are in force at once.** "Intuitive
enough for a stranger at 3am" must NOT be delivered by removing capability or flattening the visual
design. The target is a dense, capable, good-looking tool that happens to be obvious — not a simple
one.

⚠️ **Read against my own Q68/Q69 recommendations**, which could be taken as "strip the ward screen
back": they were about ORDER and DEFAULTS (what is seen first, what needs no training), never about
removing what a ward can do. Do not let "design for a stranger" become "design for a beginner".

Round 6 accepted in full: mixed wards represented by **locked/open COUNTS replacing the ward flag**
(one source per fact); designation changes are the ward editing its own numbers; the notifications
section carries only what needs a response and **clears by ACTING, never by dismissing**; a ward sees
what needs its answer before its own beds; and a ward's three routine acts — answer a referral,
update beds, record a delay — must work cold with no training.

## Final round, 2026-09-04 — accepted, and the grilling frontier is empty

| #   | Decision                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 70  | **History kept seven years**, longer for under-18s, matching adult medical records — unless a host's own policy overrides.                                                                                                                        |
| 71  | 🔴 **A bed figure means "you can fill today", everywhere.** The empty count is context, never the headline. Two screens currently disagree on this for the SAME number.                                                                           |
| 72  | **Synthetic locked/open splits, clearly marked** — do not mix real bed designations into an invented fixture; it all becomes real together or not at all.                                                                                         |
| 73  | **The test of "undeniably better": the owner uses it for a week against his own service and stops reaching for anything else.** He is the only person who can currently run that test, and it beats any checklist.                                |
| 74  | 🔴 **MIXED WARDS BEFORE DELAYS.** One eligibility line and two counts — a day's work — and it is the only outstanding item where the app gives a WRONG clinical answer rather than an incomplete one. Delays and the matcher both read that rule. |

⚠️ **STANDING RULE ON ALL SYNTHETIC DATA:** _"like anything for synthetic data... make it easy to go
back and change later."_ One place per value, clearly marked as invented, replaceable without
touching logic. This reinforces the project's existing discipline rather than adding to it — every
invented figure is already required to be listed so the owner can replace it.

**Grilling complete: 74 design questions plus ~25 direction questions, frontier empty.** What remains
can only be answered by building.
