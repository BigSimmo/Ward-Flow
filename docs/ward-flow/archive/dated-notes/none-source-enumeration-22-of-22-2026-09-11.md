# The `none` ruling, re-derived blind: 22 of 22, zero edits — and the risk is inverted

**Ward Verifier, 2026-09-11, written at Ward Lead's instruction before the six-way fold.**
**The render half is `none-census-rendered-2026-09-11.md`; this is the source half, and it is the
one the ruling turns on.**

---

## 1 · The question, and why it needed a blind instrument

The owner's ruling: **"none" keeps its true-zero meaning; a screen that checked and found nothing
must name what it searched.** The ruling shipped with a list of sites said to need that wording.

⚠️ **Ward Lead's caution, which is the reason for everything below: that list came from one lane
sweeping its own family. It is a record of what somebody found, not a population.**

## 2 · 🔴 THE FIRST ATTEMPT WAS CONTAMINATED BY ME, AND ITS ANSWERS ALL LEANED ONE WAY

**I put the ruling's four named sites into the enumeration brief as context.** **They came back as
answers** — and every additional row the brief produced pulled in the same direction as the four.

> 🔴 **An enumeration told what it is looking for reproduces it, directionally. The output was not
> noise; it was agreement, which is the failure that looks most like success.**

✅ **Fixed by blind re-derivation. The replacement brief named NO family, NO ruling, NO expected
class, and forbade pattern-hunting.** Three batches — **8, then 7, then 7 = 22** — each requiring
**row-level provenance**: _derived from the code I opened_ or _inherited from the brief_, with any
**inherited row treated as void.**

⚠️ **Ward Lead's running count of the remainder said "the remaining fourteen"; it was seven.**
**Corrected at the time. A count is the part nobody can verify by reading.**

## 3 · 🟢 THE RESULT

    sites re-derived blind        22
    NON-COMPLIANT found            0
    sites requiring an edit        0

**Every one of the twenty-two is one of:**

1. **A plain count** — a figure, where a nought is a measured zero and the screens already say so.
2. **An unreachable branch** — most sharply `escalation-board.tsx`, whose own header reads
   _"THIS COMPONENT IS UNREACHABLE… `/escalation` redirects to `/delays`."_ ✅ **Independently
   corroborated by my render census, which produced no `none` on `/escalation` because the route is
   a redirect. Two instruments, two methods, one answer.**
3. **A static fixture** — a list that cannot be empty because nothing can empty it.
4. **A site already governed by an existing owner ruling** (§4).
5. **A genuine checked-empty state that ALREADY names what it searched.**

## 4 · 🔴 THREE PRIOR RULINGS OR REPAIRS ON THIS EXACT CLASS WERE ALREADY IN THE CODE

**All three re-read from the files today, not recalled.** ⚠️ **The paths in my earlier relays were
abbreviated and two line numbers had drifted; these are the current ones.**

**`src/components/ward-management/coordinator/priority-queue.tsx:135` and `:172`** — a PRIOR OWNER
RULING requiring the very thing the new ruling proposed changing:

> _"Absence and zero (rule 2): \"none\", never a bare \"0\"."_

**`src/components/ward-management/ward-management-modes.tsx:92–107`** — the repair, with its own
incident written beside it:

> 🔴 _"UNTIL 2026-09-04 BOTH SENTENCES NAMED FOUR KINDS AND THE MAP HELD SIX… the empty state still
> said none of those four \"has been recorded yet\" — **a false statement of fact about a patient's
> record** on any movement whose stage had been corrected."_
>
> _"`auditKindLabels` is a TOTAL `Record` over the union, so the compiler forced whoever added the
> two kinds to add their labels. **Nothing forced the paragraph. The compiler is inside the
> definition of \"the code\" and the rendered sentence is not** — which is why a heavily-guarded
> codebase keeps producing this class. **Deriving the sentence moves it to that side.**"_

**`src/components/ward-management/handover/handover-page.tsx:515`, implemented at `:526`** — the
owner's 2026-09-09 decision, which is **strictly more than the new ruling asked for**:

> _"\"None in this filter\" and \"None anywhere\" are different facts and must read differently"_ —
> rendering `None in this filter — N elsewhere in the network.`

🔴 **Three people had already been right, in three screens, each with the reasoning written in
beside the code. None was consulted before the ruling was drafted. That is the failure — not that
the code was wrong.**

## 5 · 🔴 THE STANDARD THIS PRODUCES, WHICH IS MORE THAN THE RULING CONTAINED

> **An absence sentence must name what was searched — and it must name it FROM THE SAME SOURCE THAT
> DEFINES THE POPULATION, never from a hand-written list beside it.**

⚠️ **The second clause is the half the ruling did not contain and the code already knew.** _"Name
what you searched"_, written by hand, **goes stale the moment the population grows** — which is
precisely the 2026-09-04 incident: four named, six searched, and a false statement about a patient's
record. ✅ **`ward-management-modes.tsx`'s `auditKindsOr` is the worked example; `handover-page.tsx`
is the better one, because it names the scope as well as the population.**

**RULED (Ward Lead, tonight): `none` closes with ZERO edits and becomes a standard binding NEW work.**

## 6 · 🔴 THE RISK IS INVERTED

> **The danger is not that these screens mislead a coordinator. It is that somebody edits twenty-two
> correct sites on the strength of a list, and breaks three prior rulings doing it.**

⚠️ **And a find-and-replace over the word — the obvious way to apply the ruling — would rewrite
ordinary English.** The render census measured **twenty-five of the twenty-seven distinct sites** in
this module to be prose or labels rather than figures: _"None of them is about a person"_, _"1 ward
asked, none has accepted"_.

## 7 · Two exemplars worth keeping

- **`statistics-service-screen.tsx:224`** — `serviceSites.map(s => s.name).join(", ") || "none
recorded"`. **Executed, not reasoned about:** `0 sites → "none recorded"`, `1 blank name → "none
recorded"`, 🔴 `2 blank names → ", "` — **truthy, so the guard never fires and a bare comma
  renders.** ✅ **But measured against the data: all five `HEALTH_SERVICES` have sites (4/4/5/3/1 of 20) and no site name is blank, so NEITHER arm is reachable today.** ⚠️ **The count and the list
  share one sentence, so the blank-name case would read _"recorded at 1 hospital … none recorded"_ —
  self-contradicting mid-sentence, while the 0-site arm would read correctly. **The fallback is right
  on the arm it cannot reach and wrong on the arm it can.**
- **`ward-flow-reducer.ts` → `officer-screen.tsx`** — `subjectId()` falls back to the string
  `"none"` and renders it in `<strong>` **where a record name belongs**. 🔴 **A live user-facing
  defect of the opposite kind, found as a by-product and routed at the time.**

## 8 · 🔴 WHAT WOULD OVERTURN ALL OF THIS, AND NOBODY HAS LOOKED

**My census was a RENDER. These twenty-two were SOURCE reads.** ⚠️ **Neither instrument walks a
state reached only by an ACTION** — a search that returns nothing, a declined referral, a blocked
submit. **The §U sweep's own enumeration counted ~340 absence strings across ~75 files; the render
saw 52 occurrences of 16 distinct strings. The gap is unwalked, not clean.**

🔴 **If this class exists anywhere, that is where it is. It is commissioned as the next task, to be
run on the folded line with the same blind-brief discipline, and it is better founded than the task
that produced this result — because it is the one population where the ruling's premise has never
been tested, rather than the one where it has now failed twenty-two times.**

## 9 · Provenance of this record

**All twenty-two rows were derived by subagent briefs (Sonnet, extraction) under the blind
discipline above, with inherited rows void; the classification and every conclusion here are mine.**
**The three prior-ruling quotes in §4 and the four executions in §7 were re-derived from the files
today.** ⚠️ **The full row-by-row table lives in the relay to Ward Lead; this record carries the
method, the classes, the named exemplars and the limits, and does not reconstruct that table from
memory.**
