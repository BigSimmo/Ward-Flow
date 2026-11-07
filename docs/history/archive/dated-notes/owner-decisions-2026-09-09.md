# Owner decisions — 2026-09-09

Recorded by Ward Lead as each decision is made, so it survives the chat it was made in. An owner
ruling that lives only in a conversation has been lost before on this programme.

---

## 1. The handover page is FULLY FILTERABLE, and the chip rule does not apply to it

**Decided:** 2026-09-09, by the owner, in the Ward Lead chat.
**Asked as:** may a handover scope EXCLUDE, unlike the standing rule that a chip highlights and
never hides?
**Answer, in his words:** _"Update the rule.... I want the handover to be a page that is completely
filterable... It is filtered rapidly based on Service, Ward, ED, Community, etc. Fully filterable
which is compact and dynamic and filters to show a clear handover list for me."_

### What this changes

The standing ruling — **"A CHIP HIGHLIGHTS. IT NEVER HIDES"**, recorded in `capacity-screen.tsx`,
`capacity.module.css`, `ward-board.tsx` and extended to `delays-screen.tsx` on 2026-09-07 — **does
not govern the handover page.** The handover filter narrows the population and excludes the rest.
That is its purpose: a handover for one ward exists so the other twenty-two are not read out.

### ⚠️ SCOPE OF THIS CHANGE, AND IT IS DELIBERATELY NARROW

**This applies to the handover page ONLY.** Capacity, Delays and the bed board keep the chip rule
unchanged. The owner was asked about the handover screen and answered about the handover screen;
nothing in his words asks for Delays to start hiding patients, and hiding a patient on a working
board is precisely the harm the original rule exists to prevent.

🔴 **If the owner intended the rule replaced everywhere, that is a much larger change and he should
say so explicitly.** Do not infer it from this entry.

### The conditions that survive from the original rule

The chip rule protected something real — that nobody is missed by being filtered out of view. On a
handover sheet that protection is carried differently, and these three are part of the ruling:

1. **The active filter is named on the screen and on the printed sheet, always.** Never a sheet that
   looks like the whole network but is not.
2. **The excluded count is stated, never silent** — "47 open movements are outside this filter". A
   reader must be able to tell a quiet ward from a narrowed view.
3. 🔴 **Anything urgent outside the filter is still named.** A breached legal deadline elsewhere
   appears as an "outside this filter" line. **A filtered handover must never be the reason a breach
   went unsaid.**

### The four filter dimensions, all VERIFIED against the live data

| Filter    | Backed by                                                                                | Status       |
| --------- | ---------------------------------------------------------------------------------------- | ------------ |
| Service   | `ward-sites.ts` — every site carries `service` (East Metro, North Metro, South Metro, …) | **verified** |
| Ward      | `Unit.id`, and `Unit.siteCode` for a whole site                                          | **verified** |
| ED        | `edById`                                                                                 | **verified** |
| Community | `communityTeamById`                                                                      | **verified** |

⚠️ `ward-place.ts` already resolves a place id against `units` / `edById` / `communityTeamById` and
returns `undefined` for one that does not exist. **Use that existing resolver rather than writing a
second one** — a place lookup written twice is how two screens come to disagree about what a place is.

### Two existing rulings this does NOT touch

- **The page reads LIVE** (OD-4, 2026-08-30). Do not reintroduce a freeze; the printed sheet is what
  holds still. The owner's own words then: _"There is no point of a stale handover."_
- **Every section states "None" rather than disappearing.** Under a filter this matters more, not
  less: **"None in this filter" and "None anywhere" are different facts and must read differently.**

### Still owed by this ruling

"Compact and dynamic" is a design instruction and is not yet a specification. The third edition's own
rule — one loud thing per screen, and here the sections are the loud thing — should decide whether
the filter is a disclosure, a strip, or a search-style control. That is a drawing question, not a
data question, and nothing about the four dimensions above waits on it.

---

## 2. An invented figure carries its own provenance — the heading is not enough

**Decided:** 2026-09-09, by the owner, in the Ward Lead chat.
**Asked as:** on the statistics screens, should a figure have to say it is invented in its own
sentence, rather than relying on a nearby heading to mark it?
**Answer, in his words:** _"the number should always carry that it's invented"_.

### What prompted it — a measured defect, not a design worry

`StatFootnote` renders groups of a **heading** plus a list of **items**. The heading says
_"Invented figures"_; the items are free prose. Ward Builder Two replaced the item
_"28 referrals is synthetic."_ with **"There were 28 referrals this period."** — an invented number
stated as measured fact — **and both guards stayed green.**

🔴 **So a screen whose entire purpose is to say these numbers are not real could state one as real,
and nothing failed.** The component's own doc comment already claims the property the ruling now
makes explicit: _"an invented figure is always named as such… rather than left to look real."_ **It
was true of the LIST and not of the ENTRY.**

### The rule

**Every item inside an invented-figures group must carry its own provenance marker.** The sentence
must be false-free when read alone — quoted, screen-read, copied into a message, or reached after
the heading has scrolled away. **A heading is context, and context does not travel with the
sentence.**

⚠️ **This is not a wording preference. It is the difference between a prototype that cannot mislead
and one that merely usually doesn't.**

### Scope — ASKED AND WIDENED, 2026-09-09, and then narrowed to the right reading

**Asked:** should this apply to every ward screen or stay on statistics? **Answer:** _"apply it
everywhere"_. Two readings of "everywhere" were then put to him, sized:

|               | what it means                                                                       | population           | screens change?               |
| ------------- | ----------------------------------------------------------------------------------- | -------------------- | ----------------------------- |
| **A — RULED** | every sentence **whose job is to disclose provenance** carries the marker in itself | **17 screens**       | no                            |
| B             | every rendered **figure** carries a marker                                          | 52 figure components | yes — a label on every number |

**He chose A:** _"A is fine"_.

⚠️ **A closes the measured defect everywhere it can occur.** The fault was a _disclosure sentence_
changing sides — naming a figure while the marker sat in the heading above it. B labels numbers that
were never at risk, on screens that already open with a banner saying everything on them is
invented, so it restates the banner 52 times and costs a coordinator scanning for a free bed.

🔴 **NOT A LICENCE TO DELETE THE BANNERS.** The page-level banner and the per-sentence marker do
different jobs: the banner is a blanket statement about the screen, the marker keeps one sentence
true when read alone. **A screen keeps both.**

See [[ward-flow-changeable-data-rule]]: every invented figure is due to be replaced with real ones,
so this population is large and moving.

### Status — the ruling is recorded, the code is NOT yet changed

**17 screens carry a page-level disclosure. Only the statistics footnote defect has been measured.**
The other sixteen are **unexamined against this ruling** — not known compliant, not known
defective. ⚠️ **Recorded so nobody reads "ruled" as "done"**, which is the same shape as
measured-and-sound versus never-examined elsewhere in this programme.

### How it must be guarded

A per-item assertion, not a per-page one: **each item's own text carries the marker**. The existing
guard passed because it read the group. ⚠️ **And the guard must be proved by the arm that found the
defect** — write a plausible measured-fact sentence into an item and confirm it reddens. A guard
that only checks the heading survives the exact mutation that produced this ruling.

---

## §3 — How far the invented-figure checker reaches. **Owner decision, 2026-09-10: leave it.**

**His words, verbatim, relayed by Ward Builder Four with no interpretation:**

> **"leave the reach at 2, keep what you built"**

**That was his whole message.** He separately told Ward Lead to proceed with the recommendation,
which was the same option. **Two channels, one answer, and they agree** — recorded because the
question reached him twice and the agreement is the only reason that cost nothing.

🔴 **AND THIS RULING DOES NOT CANCEL THE STATISTICS GUARD REPAIRS. Both are true at once.**

> **The reach stays at 2, AND the two statistics provenance guards still needed repairing.**

Read quickly, _"leave the reach at 2"_ says _stop all work on this ruling_. **It does not.** The
statistics repair was never a reach extension — it closed a guard that was **certifying
_"these figures are not invented, they are the current state of the network"_ as a disclosure**, on
the very component that produced the ruling. That repair landed at `bad20426c9`, before this ruling
arrived, and **nothing here retracts it.** ⚠️ A true statement with a false implication is not caught
by re-checking the statement; it is caught by saying the complement in the same breath.

**Asked, with the cost of each option measured rather than estimated:**

    1  LEAVE IT       2 screens automatically checked; the rest rely on a person noticing   ← CHOSEN
    2  WIDEN IT       reaches 35 blocks — and flags 42 of 63 sentences that are correct
    3  REWRITE 74     edit compliant screens so a checker can read them

**Option 2 fails structurally, not for want of cleverness.** A governance banner's first paragraph is
where this codebase puts its **safety** statement — _"This board is not a medical device"_, _"It
places nobody: a coordinator decides every placement"_ — and the provenance statement sits elsewhere
in the banner or is the badge itself. Widening the trigger therefore aims the marker requirement
squarely at the sentences whose job is not disclosure.

⚠️ **The figure that first justified this was about a different rule**, and had to be replaced before
the decision could stand: the original **44 of 58** measured a rule reading _every_ sentence in every
banner. The **42 of 63** above is a measurement of the actual proposal. **Right conclusion, wrong
evidence** — and it would have produced a confident wrong answer had the banner convention differed.

⚠️ **And the reach number needs its complement said in the same breath**, or it reads as an absence:

> The source-scanning guard reaches 2 files of 76. A **separate** DOM guard covers the statistics
> footnotes by a different mechanism. **Everything else is unguarded by either.**
> **The two are complementary — do not undo either.**

**What this decision does NOT cover, so nobody reads it as broader than it is:** it settles the
guard's REACH only. It says nothing about the guard's strength, which was found inverted twice on
2026-09-10 and repaired both times.

---

## §4 — The Command drawing's Activity panel. **Owner decision, 2026-09-10: make it honest.**

It read _"Live, reconciled 10:42"_ with a green dot, over figures that are entirely invented. Now
reads _"Invented figures, reconciled with each other, as at 10:42"_. Fixed at `60695b3906`, verified
in a browser rather than in the diff.

**"Reconciled" was kept because it is true** — the drawing computes whether its figures reconcile
with each other, and they do. **Only the claim of liveness was false.**

---

## Still with the owner — asked, not yet answered

Both are drawn on the Command screen and **neither exists in the software**, so anybody building from
that drawing would build them:

1. **Should beds be ordered partly by patient acuity?** The drawing does this. Ward Flow does not.
2. **Is the catchment rule real?** The drawing applies one. Ward Flow has none.

⚠️ **These are the two the mockup audit deliberately left untouched as owner-deferred.** A deferral
with no named un-deferrer is how the statistics row came to read as a live prohibition for a day
after the owner had personally lifted it. **The un-deferrer here is Ward Lead**, and this line is
the record of that.

---

## §5 — The two Command-screen behaviours. **Owner decisions, 2026-09-10.**

### Acuity — **BUILD IT, as drawn.**

⚠️ **This was put to him twice, and the first time I described it wrongly.** I told him the board
would _"rank one patient ahead of another based on how unwell they are"_ — a characterisation I took
from another chat's summary and did not check against the drawing. **It is false.**

**What the drawing actually does**, read from the source:

    acuityOk = !m.highAcuity || u.acuityInUse < u.acuityCeiling

**A staffing-capacity check.** Some patients need high-acuity nursing; wards have a limited number of
those places; the check asks whether one is free. **It scores nothing, ranks nothing, and orders
nothing** — the candidate list sorts by the human-set urgency tier and waiting time, exactly as
today, and the drawing explicitly refuses to return an acuity score to a search.

**So it is the same shape as "is there a bed" and "is an escort available", and overridable like
them** — only `allocatable_bed` and `specialling` are absolute in the drawing.

🔴 **Had he refused on the strength of what I first told him, he would have refused something
harmless.** An operational capacity check was escalated to the owner as a clinical-decision-support
question on an unverified summary. **Same shape as the Verifier's retraction the same afternoon, and
mine reached the owner.**

### Catchment — **BUILD IT AS A SOFT CHECK, to be changed when he confirms the data.**

**His words: _"I will confirm catchment data later so build it as a soft check that will be changed
later."_**

**What the drawing does:** `catchOk = u.service === m.homeService` — the ward's service area must
match the person's home service area, marked as a failed requirement otherwise.

⚠️ **Ward Flow already has catchment data, and it is used for a different question.**
`ward-catchment.ts` maps a suburb to a **community mental health team**, built from the owner's own
five catchment documents. **The drawing applies the idea to inpatient beds instead** — which ward a
person should be admitted to. **Those are not the same question**, and the second has no source
document behind it.

**So it ships as a NOTE, not a requirement:** _"this ward is South Metro; this person's home area is
North Metro"_ — information a coordinator reads, not a check they must override.

**The reason, and it is why the soft form is not a fudge:** if the convention is real, the note gives
the coordinator what they need. **If it is not, a note is harmless where a failed check is a wrong
instruction people learn to click past — and clicking past one check weakens every other check on
that screen.**

**To be revisited when the owner confirms the data. Ward Lead is the named un-deferrer.**

---

## §6 — 🔴 `main` is never touched. **Owner ruling, 2026-09-10, twice and emphatically.**

> **_"the ward flow line, not main"_**
>
> **_"never add to main... it must be Ward Flow!!!!"_**

    the ONLY ward destination   codex/task-ward-flow-live-state-20260831
    main                        OFF LIMITS — no merge, no fast-forward, no reset, no `branch -f`
    origin/main                 never pushed to, ever

### What happened, recorded because the ruling exists in response to it

Local `main` was fast-forwarded onto the ward line at `da185a9197`. **It was genuinely safe** — a
true fast-forward with nothing on `main` the ward line did not already contain, nothing rewritten,
nothing pushed, and one command to undo. **The owner reversed it immediately anyway**, which is the
answer to whether "safe" was ever the question.

**Reversed and verified here:**

    main before          da185a9197
    main after           ef582b110f   == origin/main
    ward line            unchanged, and still contains everything main briefly held
    origin/main          ef582b110f — untouched throughout

### 🔴 Why it happened, which is the part that must not recur

**Two chats asked him the same question within minutes and got opposite answers.** One was told to
proceed; one was told _"the ward flow line, not main"_. **Neither chat was careless and both reported
honestly** — the question shapes the answer, and he had no way to know he was being asked twice.

**The routing rule existed by then and I did not enforce it hard enough.** Owner questions go through
Ward Lead; a chat sends **the framing, not the question**. **A second chat asking is not a second
opinion — it is a second question**, and the two answers are both true of what was asked.

### Where the rule now lives

**`~/.claude/worktree-ownership.md`, at the very top** — the SessionStart hook reads that file into
**every chat, in every worktree, on every branch**. It is the only surface on this machine with that
property, which is exactly what a rule this absolute needs. ⚠️ **Not in a ward document**, because a
chat that has not read the ward documents yet is precisely the chat that would do this.

---

## §7 — Six decisions, 2026-09-10 evening

|                                  | Ruling                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activity wording**             | **Adopt _"Invented figures, reconciled with each other"_ everywhere.** The sixteen third-edition pages move off _"Synthetic snapshot at …, figures reconcile"_. Open item 7 is CLOSED. |
| **High acuity**                  | **The referring clinician marks it, at referral** — a recorded human judgement the board carries, exactly as urgency works. ⚠️ **The system working it out is ruled OUT.**             |
| **Repository**                   | **Stays PUBLIC for now.** Recorded as a decision, not a default.                                                                                                                       |
| **The 58 unwritten test files**  | **Those plans are superseded.** The three genuinely-uncovered, clinically-shaped items go on the board as ordinary work.                                                               |
| **Sex and gender**               | **See below — this one is a model change and needs its own section.**                                                                                                                  |
| **The three real-patient gates** | **DEFERRED.** None blocks building; all three block use.                                                                                                                               |

---

## §8 — 🔴 Sex and gender: two fields, and **GENDER decides the bed**

**Owner ruling, 2026-09-10, in his words:** _"Have sex please and for gender use that as what bed. I.e. male bed for female bed etc."_

**Read as:**

    sex       KEPT as a recorded fact on the person
    gender    a SECOND, SEPARATE field
    placement follows GENDER, not sex — a person's gender decides which bed they can go to

⚠️ **This is a substantive clinical and dignity decision and it closes P1 `#BAY1TY`.** It replaces the
single merged _"Sex / gender"_ field, which presented two different things as interchangeable, and it
answers the question the P1 said must not be answered by default: **placement follows gender.**

### What it means in the code

**Today:** one merged `sexOrGender` field a clinician reads; a separate `movement.sex` with exactly two
values driving `sexMix` and `sexDesignation`; **and nothing connecting them**, so correcting the
displayed value would not change where a person is placed.

**After:** `sex` and `gender` are separate fields. **Bed matching reads `gender`.** The ward side
already carries `"Undesignated"` as well as `"Female only"` / `"Male only"`, so the accommodation side
needs no change.

⚠️ **THE READING IS BEING CONFIRMED BEFORE THE MODEL CHANGES.** The instruction is short and the
consequence is the expensive half to undo. **What is NOT settled by it, and is not being decided by
default:**

1. **What values `gender` may take.** Two? Two plus a third? Free text? **The ruling says gender
   decides the bed; it does not say how many genders the field holds.** Building it as two values
   silently answers that.
2. **What happens when the two disagree and no matching bed exists.** A refusal, an override with a
   reason, or a coordinator judgement — Ward Flow already has all three shapes.
3. **Who records `gender`, and whether the person themselves is asked.**

**Building begins on what the ruling settles — two separate fields, placement following gender — and
stops at each of the three above.**

---

## §9 — Sex and gender: the three open points, ANSWERED 2026-09-10

**His words, verbatim:**

> _"1. Only two genders as it is for beds. I.e. male bed, female bed. 2. No... treat trans woman as a woman for gender. I.e. female bed 3. Clinician fills in gender if not already saved on patient profile."_

| Open point (§8)                                | Ruling                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **How many values may `gender` take?**         | **TWO — Female and Male**, matching the two kinds of bed.                                                                                                                                                                                                                                                               |
| **What happens when sex and gender disagree?** | **The question dissolves.** _"Treat trans woman as a woman for gender"_ — **gender IS the answer, and there is no disagreement to resolve.** A trans woman needs a female bed. If no female bed is free, that is the ORDINARY no-bed situation Ward Flow already handles — **not a special case, and not an override.** |
| **Who records `gender`?**                      | It lives on the **patient profile**. **The clinician fills it in at referral IF it is not already saved there.** So the referral form must show what the profile holds and let it be completed, never silently blank.                                                                                                   |

### 🔴 What this settles, and what a builder must NOT do with it

**SETTLED — build this:**

    sex       a recorded clinical fact on the person, SEPARATE
    gender    Female | Male, on the PATIENT PROFILE, completed at referral if absent
    bed       matched on GENDER. Never on sex.

⚠️ **NO OVERRIDE PATH FOR THIS GATE.** He did not create one and the reasoning above removes the
need: there is no conflict for a coordinator to adjudicate. **Do not add "place anyway with a
reason" to the gender gate on the grounds that nine other gates have one.** Placing a woman in a
male bed by override is exactly the outcome this ruling exists to prevent.

### ⚠️ The consequence a builder WILL hit, recorded rather than argued

**Two values cannot describe a non-binary person, and the referral form must still be submittable
for one.** The ruling fixes the values at two; **it does not say the field is always populated.**
So the model needs **"not yet recorded"** as a distinct state from Female and Male — that is what
point 3 requires anyway, since the clinician can only fill in what is missing if missing is
representable.

    gender: "Female" | "Male" | not yet recorded

**A patient with no gender recorded is not placed by the gender gate** — the gate cannot answer, and
saying so is the honest behaviour. **Do NOT default an unrecorded gender to the recorded sex.** That
would silently re-merge the two fields this ruling exists to separate, in the one case where the
difference matters most, and nothing would go red.

**This is not a re-opening of his ruling.** He was asked how many genders and answered two. **The
un-set state is a separate question he was not asked, and it is being resolved conservatively
rather than by default.**
