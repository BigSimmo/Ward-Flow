# Somebody is on their way to an ED — what it would take, and what the screens say until it exists

**O-16.1. Written 2026-09-12 from the code in `D:/Worktrees/Database/ward-builder-two` at
`780222addd`.** Enumeration only. **Nothing here has been built, and this document does not ask for
it to be** — it exists so the decision is priced before anybody starts.

⚠️ **One claim in the underlying inventory was too wide and is corrected below.** A subagent
extraction reported _"no `eta`/`expectedArrival`/`arrivingAt` field anywhere"_. That is false as
written: the model carries forward-looking instants in two other places. The true claim is narrower
and more interesting, and it is in §3.

---

## 🔴 CORRECTION, SAME DAY — THIS IS NOT AN OPEN DESIGN QUESTION. IT IS ALREADY DRAWN.

**This document was written believing the design did not exist. It does.** Found while checking
something else entirely — the `Expected` tab in
`docs/ward-flow/mockups/emergency-department-third-edition.html`.

**The drawing carries NINE expected arrivals, `EX-01` to `EX-09`**, each of them:

```
{ id: "EX-01", ed: "rph-ed", given: "Perrin", family: "Ironbark", ageBand: "26 to 40",
  sex: "Male", eta: 675, source: "Police escort", legalForm: "Form 3D",
  note: "Detained in a public place, examination due on arrival." }
```

— and `expectedIn(edId)` **sorts them by `eta`**, not by when the referral was raised.

⚠️ **The drawing also already rules the clock semantics, in its own footnote, which is the part
nobody should now re-decide:**

> **Two different clocks.** Expected is measured forward to an arrival that has not happened.
> Everything else is measured back from arrival at the department. They are never ranked against one
> another…

And it gives the record its own identity series, deliberately: _"an expected arrival is EX-0x"_,
alongside `WF-0xx` for a movement, `EA-1xx` for an attendance and `RF-0xx` for a referral.

### What this changes, and what it does not

**Changes:** §2's _"what state"_ and the field-set question are settled by the drawing, not open.
`eta`, a free-text `source`, a `legalForm`, a `note`. And 🔴 **the EX-0x series is the drawing saying
this is its OWN record, not a field on `Referral`** — which contradicts this document's §4
recommendation. **The drawing wins; it is the owner's artefact and mine was an inference.**

**Does not change:** the producer question (§2, _who raises it_) — the drawing is a static fixture,
so nothing in it types an ETA either. That gap is real and survives. Nor does it change §3's
correction about where forward-looking instants exist in the model today.

✅ **And it CONFIRMS the finding this document said was worth acting on first, more sharply than the
document could:** the drawing sorts expects by expected arrival; the app sorts them by `raisedAt`.
**The two disagree, and the drawing is right.**

⚠️ **This correction sits here, at the top, rather than at the bottom, because a retraction that
travels separately from the claim does not travel at all.** Everything below was written before the
drawing was found, and §2 and §4 should be read through this section.

---

## 1. The concept already exists, and it is not new vocabulary

`edExpectsFor()` (`src/components/ward-management/ward-referrals.ts:296`) already answers _who is on
their way to this ED_. It filters referrals that have **not** arrived, whose destination is this ED,
for this purpose, in state `queued` or `accepted`. Its own doc comment quotes the owner:

> any patient referred to an ED, i.e. from community, who is not physically in the ED but on the way
> at some point is an expect

**So the state "somebody is coming" is already modelled.** The door between coming and here is
`Referral.inDepartmentAt`, read through `hasArrivedInDepartment()`. A declined ED addressing is
already excluded — _nobody is on their way to a department that said no_.

🔴 **This matters for the cost, and it cuts it sharply.** The expensive version of this work is
"invent a new pre-arrival record". That version is not required. `Referral` **is** the pre-arrival
record, and it already knows which ED, which purpose, whether the destination accepted, and whether
the person has since arrived.

---

## 2. What is actually missing — four answers

### What state

**Not a new collection.** Fields on the existing `Referral`, or on the ED arm of
`ReferralDestination`. Verified by opening `ward-model.ts`: every field the `Referral` type declares
is listed in §3.

### What event

**One, and it already has a sibling to copy.** Something of the shape `RECORD_EXPECTED_ARRIVAL`
(name not settled) carrying `referralId`, `expectedAt`, `role`, `now`. The nearest existing model is
`RECORD_LEAVE_BED` (`ward-flow-reducer.ts:2829`), which is _also_ "an expected future instant,
recorded by somebody who knows".

A second event is needed only if an expected time can be **revised** as well as first set. That is a
product question, not a technical one, and it is in §5.

### Who raises it

**Nobody in the app can, today.** The expect is created by whoever raised the referral — community,
crisis service, police, ambulance. The app has no screen belonging to any of them; a referral
arrives already raised. So either:

- the ED screen records it on their behalf ("ambulance rang, twenty minutes"), which is honest about
  who typed it but not about who knew it, **or**
- it is seeded and never edited, which makes it a fixture fact rather than a live one.

⚠️ **This is the real gap, and it is not a code gap.** The state and the event are cheap. The
_producer_ is missing, and a field with no producer passes every gate and shows on screen as a
legitimate absence — this repository has that failure written down already.

### What the screens say before the first one exists

**Verified by reading, not assumed:** `edExpectsFor()` returns a list sorted by `raisedAt`. Until an
expected-arrival field exists, an ED's expects are ordered by **when the referral was raised**, and
every screen showing them can only say _when this was referred_, never _when they get here_.

🔴 **So today the screens do not say "unknown" — they say something true about a different
question,** and a coordinator reading a list ordered by referral time may reasonably read it as
ordered by arrival. That is the thing worth fixing first, and it can be fixed with wording alone,
before any new field exists.

---

## 3. What is absent, precisely

**The correction.** The model _does_ carry forward-looking instants:

| Field                     | Where                     | What it means                  |
| ------------------------- | ------------------------- | ------------------------------ |
| `BedRelease.expectedAt`   | `ward-model.ts:1125`      | when this bed is expected free |
| `LeaveBed.expectedReturn` | `ward-model.ts:1198-1204` | when this patient comes back   |
| `LegalForm.dueAt`         | `ward-model.ts:290`       | when this form expires         |

**So "a future instant" is an established shape here, with three precedents.** What is absent is
narrower: **no forward-looking instant about a person who has not arrived.**

Every `Instant` on `Referral` is past-facing — `raisedAt`, `triagedAt?`, `inDepartmentAt?`, and
`medicalClearance.at`. The record can say when things have already happened to somebody. It has no
way to say when something is _expected_ to.

The rest of the absences, each verified against the declaring file:

- **`source` is a closed enum of six** — `REFERRAL_SOURCES`, `ward-model.ts:1243-1250`: `community`,
  `crisis_service`, `police`, `ambulance`, `inter_hospital`, `ed_medical`. A free-text source such as
  "Police escort" is not a member; `police` is the nearest, and it loses the escort.
- **No name on a referral, and that is deliberate, not an oversight.** `Referral` carries no
  `given`/`family`, and `ALLOWED_REFERRAL_FIELDS` (`tests/ward-referral-model.test.ts`) makes adding
  one fail both at compile time and at runtime. Names live on `Patient`; `Referral.patientId` is a
  pointer, never a copy.
- **`legalForm` exists on `Movement` only** — one declaration, `ward-model.ts:894`, confirmed by
  grep across the model. A movement does not exist until intake, i.e. after arrival. **But the
  vocabulary is free:** `SELECTABLE_LEGAL_FORMS` (`ward-legal-forms.ts:38-44`) already contains
  `{ code: "3D" }` exactly, and `legalFormName()` renders "Form 3D". Attaching a form to somebody who
  has not arrived is the part that is not free.

---

## 4. What it costs, in touch points

A new **field on `Referral`** is the cheap shape: the type, the fixture rows, and an entry in
`ALLOWED_REFERRAL_FIELDS` with a written justification — that guard exists precisely so a new field
on this record cannot arrive quietly.

A new **collection** is the expensive shape, and is not recommended: seven touch points across four
files (type field → fixture → clone in `seedWardFlowState` → id sequence → reducer case → context
type → context population), plus every enumeration in the table below.

A new **event** goes red in these places until it is complete, which is the system working:

| Enumeration                          | Where                                             |
| ------------------------------------ | ------------------------------------------------- |
| `EVENT_ROLE`                         | `ward-flow-events.ts` — compile error, not a test |
| hand-written `PERMISSIONS` duplicate | `tests/ward-event-permissions.test.ts`            |
| `candidateEvents()` traversal        | `tests/ward-legal-figure-guard.test.ts`           |
| `subjectId()` rejection routing      | `ward-flow-reducer.ts` — ⚠️ **silent** if omitted |

⚠️ **`subjectId()` is the one that does not protect you.** A new event with no case there falls to a
default that reads `event.movementId`, which is absent on anything not movement-shaped. The code's
own comment flags it. Everything else in that table fails loudly.

---

## 5. What is not mine to decide

1. **Who types the expected time.** The ED, on somebody else's word — or nobody, and it stays seeded.
   There is no third option until the app has a screen belonging to whoever is bringing the patient.
2. **Whether an expected time can be revised**, and whether the earlier one stays visible. One event
   or two.
3. **Whether an ED list ordered by referral time should say so, today, before any of this is built.**
   This one is cheap, is wording only, and does not depend on answers 1 and 2.

---

## Summary

    DID        Enumerated what "somebody is on their way to an ED" would cost, from the code rather
               than from the drawings. The concept already exists — `edExpectsFor()` answers it, and
               the owner's own words are quoted in that function. Nothing was built.

    ISSUE      Two, and the second is mine. (1) The underlying inventory claimed no expected-time
               field exists anywhere; too wide — three exist, just never about a person. (2) 🔴 **I
               wrote this whole document believing the design was an open question, and it is
               already drawn — nine expected arrivals, with times.** I found that afterwards, while
               checking something unrelated, which means the check I should have run first was
               "has this already been drawn". The recommendation below is rewritten as a result.
               The real gap survives both corrections: no screen in this app belongs to whoever
               knows the arrival time, so the field would have no producer, and today an ED's
               expects are ordered by when the referral was RAISED while the drawing orders them by
               arrival.

    GAPS       I did not open the ED screens to see what wording they currently put around an expects
               list — this is about the model and the ordering behind it. ⚠️ **The other gap I listed
               here — whether a mockup already draws an expected time — I then went and closed, and
               the answer was YES.** See the correction at the top: nine of them, with times,
               sources, legal forms and their own identity series. The remaining gap is that I have
               not reconciled the drawing's record against the model field by field.

    NEED       Who types the expected time — the ED on somebody else's word, or nobody and it stays
               seeded. Whether it can later be revised.

    RECOMMEND  Changed by the correction. Build to the drawing rather than re-deciding the shape:
               it already carries nine expected arrivals with times on them, gives them their own
               EX-0x identity series, and has ruled that the forward clock and the backward clock
               are never ranked against each other. My earlier advice — put the field on `Referral`
               — is withdrawn; the drawing says it is its own record. The one thing still genuinely
               open is who types the time, because the drawing is a fixture and nothing in it types
               anything.
