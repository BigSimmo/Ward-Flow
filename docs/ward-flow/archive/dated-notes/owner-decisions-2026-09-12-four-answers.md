# Owner decisions, 2026-09-12 — four answers

**Recorded by Ward Verifier, who put the questions and is not the chat that implements them.**
**The QUESTION AS PUT is recorded beside each answer, because an answer detached from its question
gets applied to a different one.**

⚠️ **Nothing here is implemented by me. All four are routed to Ward Lead.**

🔒 **Added 2026-09-12, Step 4: does this bind its own author?** No. Ward Verifier put these four
questions and records the answers; Ward Lead carries out all four, as the line above already says.
The four rulings bind Ward Lead and whoever Ward Lead assigns them to — not the chat that recorded
them.

---

## D-1 · Legal forms: split the list in two

**Asked:** the legal-forms screen sorts one list by time remaining. Every seeded form carrying a
deadline is a **4A transport or 4C transfer**; **1A examination, 3B detention and 3D carry none**,
and the sort key returns `Infinity` for a form with no deadline — so detention paperwork always
sorts below transport paperwork. **The deeper cause: `SELECTABLE_LEGAL_FORMS` carries no `dueAt`
for any code, deliberately — _"Forms record that they exist, never when they lapse"_ — so every
form a coordinator enters through the picker also lands at `Infinity`.**

### 🔴 CORRECTION TO MY OWN FRAMING ABOVE, added 2026-09-12 after Lane C measured it

**I wrote that because `SELECTABLE_LEGAL_FORMS` carries no `dueAt`, "every form a coordinator enters
through the picker also lands at `Infinity`". THAT IS TOO WIDE.**

**`ward-flow-reducer.ts:1134`, read today:**

    const capturedDueAt =
      chosenForm?.kind === "transport" || chosenForm?.kind === "transfer"
        ? event.draft.legalFormDueAt : undefined;

✅ **A coordinator entering a 4A or 4C WITH a due time typed does get a deadline.** 🔴 **What is true
is narrower and still the point: a coordinator's 1A or 3B can never carry one, because the reducer
writes a deadline for transport and transfer kinds only.** ⚠️ **So the group a form lands in is
keyed on what its RECORD holds, not on its code — which is the correct design, and my sentence
described a worse system than the one that exists.**

**Recommended:** split into two groups — forms with a real deadline, ordered by urgency; forms
without one, in their own group **making no claim about time**. Not a re-ordering of one list,
because that only changes which misleading answer a reader gets.

> 🟢 **OWNER: "Yes to your recommendation."**

⚠️ **Note for whoever builds it: the current sort cites the APPROVED DRAWING's own `legalSortKey`
(`docs/ward-flow/mockups/legal-forms-third-edition.html`, lines 8581–8599) as its source.** **So the
drawing specifies the behaviour being changed. This decision supersedes the drawing on that point,
and the drawing should be annotated rather than silently diverged from.**

🔴 **The success condition is that `Infinity` stops being load-bearing** — it is not a tidy default
for a missing value, it is the data model's refusal to record one, rendered as a position in a
ranking.

## D-2 · Raise the three unbindable table thresholds

**Asked:** three tables declare a minimum width below which they switch to a scrolling layout, each
set **at or below the table's own min-content width, so the condition can never occur.** They read
as protections and are not. **Measured at `f57435cd45`, 2026-09-12 00:39:**

    /statistics/compare  ward-statistics-compare-wards      560px vs min-content 563px   margin  3px
    /discharges          ward-discharge-table-blocked       480px vs min-content 490px   margin 10px
    /referrals           ward-referral-board-queued-table   480px vs min-content 516px   margin 36px

**Recommended:** raise each threshold above its table's real minimum, rather than narrowing the
tables, which would change three screens' appearance for no benefit.

> 🟢 **OWNER: "Yes to your recommendation."**

🔴 **RE-MEASURE BEFORE EDITING. These six numbers are pinned to `f57435cd45` and a lane was editing
`statistics/compare` when they were taken — a 3px margin is a coin, not a margin.** ✅ **The
instrument is `tests/ui-ward-table-thresholds.spec.ts`, which prints the list on every run; it is
one of the twelve now scheduled.**

## D-3b · The data-conditional absence sweep is DEFERRED

**Asked:** three instruments have now confirmed that checked-empty states name what they searched —
a 36-route render census, a blind 22-site source enumeration, and an action-reachable sweep (4
walked, 0 non-compliant, **VOID rather than falsified** because the population is under twelve).
**About ten absence sentences remain that no instrument can reach: they appear only when the SEED
differs — "No ward in the network reports a ready bed right now", "No referrals awaiting a
decision".** Reaching them needs deliberate, reversible seed perturbation. **A few hours.**

> 🟢 **OWNER: "Defer this as you recommend."**

⚠️ **A DEFERRAL WITH NO TRIGGER IS A DROP.** **Re-raise this when ANY of the following happens:**

1. **The seed is replaced with real figures** — the owner has said every invented figure will be
   replaced, and that is the moment these states change meaning.
2. **Any of the ~10 sentences is edited** for any reason, since nobody has ever seen it render.
3. **Before Ward Flow is put in front of a real bed coordinator.** 🔴 **This is the last population
   where a misleading absence sentence could still be hiding, and "nobody has looked" is the current
   state, not "it is clean".**

## D-4 · The deliberate sub-12px exception stands if its reasoning is sound

**Asked:** owner ruling D-3 (2026-09-10) forbids NEW sub-12px text. **Eight new sub-12px
declarations went in on 2026-09-12** because the build brief stated the 12px floor and then listed
the two below-floor tokens without marking them forbidden, while also saying _"match the idiom of
the screen you are editing"_. Most are being raised. **One is not: a lane deliberately kept 10px and
wrote its reasoning into the file.**

**Recommended:** read the reasoning and let it stand if it is sound — a blanket fix that erases
somebody's stated reason costs more than the inconsistency.

> 🟢 **OWNER: "Go ahead with your logical recommendation."**

⚠️ **INTERPRETATION, STATED SO IT CAN BE CORRECTED: I read "go ahead" as delegating the judgement
rather than reserving it** — Ward Lead reads the reasoning, lets the exception stand if it is sound,
and brings it to the owner only if it is not clear-cut. **If the owner meant to see it either way,
this line is where that correction lands.**

🔴 **And the exception must be recorded where the ratchet's future maintainer will find it, not only
in the file.** **Otherwise the next person raising sub-12px text removes it as an oversight.**

---

## What was NOT asked of the owner, and why

- **Wiring `scripts/ward-flow/check-text-size-floor.mjs`** — it implements D-3, has never run, and
  is not in `package.json`. ✅ **Not a judgement call.** Its two siblings
  (`check-source-control-chars`, `check-errata-freshness`) are equally unwired.
- **Pinning the per-file breakdown** so the ratchet enforces D-3's actual rule rather than a net
  total. **The data is already computed and discarded.** ⚠️ **One judgement DOES sit inside this and
  belongs to whoever wires it: the counter includes comment text by design, so a correct
  explanatory comment scores as a breach — and the author wrote down why special-casing comments
  would need its own test.**
- **The duplicate Legal Forms screen**, the `none` ruling closing with zero edits, and scheduling
  the twelve browser journeys (O-17.4, already approved).

---

## Outcomes, recorded after the fact

**D-4 · 🟢 THE DELEGATED JUDGEMENT HAD NO SUBJECT.** All eight new sub-floor declarations were
raised. **The one reported as "deliberately kept" is not a new declaration at all** — it is a
comment declining to fix a **pre-existing** `--text-3xs` in a screen the lane had not come to
rebuild, with the reason written at the rule. ✅ **That is D-3 being obeyed, not an exception to it:
the ruling grandfathers existing sizes on purpose and raises them screen by screen.**

🔴 **So "nothing survived; nothing to decide" is the answer, and no exception was manufactured to
give the delegation something to act on.** **The owner has seen this, which is what the
interpretation line above was for.**

**Arithmetic, reconciled from a tree that never saw the edits:** my committed tree measured **383
across 37 files**; the surviving comment is **1**; Ward Lead's post-repair figure is **384**.

### ⚠️ A retraction of my own, recorded because it was acted on

**I told Ward Lead the wiring commission had a third part — "compare `fileCount`, because a
departing file donates its whole count as headroom" — citing the drop from 39 to 37 files.**

🔴 **`fileCount` is not the swept population.** The script filters `count > 0`, so it counts files
**still carrying a sub-floor token**. **Measured: tracked ward stylesheets went from 62 to 66 over
the same period — the population GREW.** ✅ **39 → 37 is two screens correctly rebuilt to zero.**

🔴 **A `fileCount` equality check would therefore redden every time a screen is correctly cleaned** —
a guard firing on the work it exists to encourage, which is the exact failure the script's own
header cites as its reason for being a ratchet. **Retracted.**

✅ **The real hazard — a stylesheet renamed or moved OUT of the swept directory — is invisible to
`fileCount` either way, because a cleaned file and a departed file both simply stop appearing. The
per-file pin solves it properly, because it names files.**
