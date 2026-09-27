# Ward Flow — what is waiting on the owner, 2026-09-06

Six questions. **None of them blocks anything**; every one is recorded here so it survives the
session that found it. Each says what was actually measured, because three of these were reported
to the owner earlier today in a wider form than the evidence supported.

The 2026-09-06 clinician-check answers are in
[`clinician-check-rulings-2026-09-06.md`](clinician-check-rulings-2026-09-06.md). These are the
questions that check RAISED rather than settled.

---

## 1. Wording for a new override reason

✅ **The SHAPE is closed 2026-09-17** (records housekeeping, `docs/ward-flow/owner-answers-2026-09-17.md`
item 62): `WLQ-36` (`owner-decisions-2026-09-15.md` ~:240) ratifies exactly this mechanism for the
mix check — "a coordinator may override it with a recorded reason after confirming with the ward" —
for the gender case. The exact wording of a sex-mix-specific override reason is not itself pinned by
WLQ-36 and is still Ward Lead's to draft and confirm, but whether an override-with-reason control is
the right shape is no longer open.

**Decision needed:** the words a coordinator sees when overriding a **sex-mix** refusal.

`OVERRIDE_REASONS` currently offers only the staleness wording — _"The bed information is known to
be out of date"_ — which is **false on a sex-mix override** and would be recorded against the
placement as if it were the reason given.

**Recommendation:** add one member reading _"The ward has confirmed this placement is safe today"_.
The coordinator overrides everything (design principle), so the question is never whether they may,
only what the record says they said.

## 2. Does the constraints box become a fixed list?

✅ **CLOSED 2026-09-17** (records housekeeping, `docs/ward-flow/owner-answers-2026-09-17.md` item 62):
`WLQ-16` (`owner-decisions-2026-09-15.md` ~:106) — "No, keep free text As you recommend." The box
stays free text.

**Decision needed:** whether the free-text constraints box on the ward screen becomes a fixed
five-item list.

Today it is `constraintsDraft`, one free-text field on `ward-screen.tsx`, placeholder _"e.g.
male-only bay today"_. Free text cannot be reasoned about — nothing downstream can act on it.

**Recommendation:** keep it free-text **for now**. It is currently a note to a human, and a
premature list would force real constraints into the wrong box. Revisit when something downstream
actually needs to read it. Marked _paused pending owner confirmation_ in the assignment register.

## 3. ~~Should the legal deadline get a screen?~~ — 🔴 **WITHDRAWN. IT ALREADY HAS ONE, AND THE ERROR WAS MINE.**

**What I told the owner:** _"It's calculated and read by absolutely nothing."_ **That was false about
the capability, and it was the question he was asked to rule on.**

**What I actually measured:** the FUNCTION `legalDeadlineMinutes`, exported from
`delays/delays-derivations.ts:188`, appears nowhere in `src/` except its own definition line. **True,
and still true.** ⚠️ **I then wrote a sentence whose subject was the legal deadline rather than that
one function** — the same over-wide-subject error this session has now made four times, and the
measured half being correct is what made it convincing.

**The countdown is on screen.** `ward-priority.ts:135-149` derives it independently from
`movement.legalForm.dueAt` and produces a _"Statutory timing"_ factor reading **`Form 4A due in 47
min`** or **`passed its deadline N min ago`**; `shortlist-panel.tsx:227` renders that wording. Found
by Ward Verifier, verified here from source before withdrawing the question.

**What actually remains, and it is two smaller things, neither of which is what he was asked:**

1. **A dead function.** `legalDeadlineMinutes` has no caller. That is a deletion question governed by
   `docs/agents/dead-code-deletion.md`, not a product question — and this repository forbids removing
   an exported symbol on a "nothing imports it" basis without its own written argument.
2. 🔴 **A real defect Ward Verifier is fixing on the owner's instruction, narrower and worse than the
   question I asked.** On the Delays screen the row clock is the **ED** clock, and `clock.urgent` is
   set by `cause === "legal_expiring"` — **so a legal authority running out turns the ED clock red
   and never states the deadline or the reason. The urgency lands on the one figure it is not
   about.** Latent today because no seeded deadline is critical at `NOW_ANCHOR`; live the moment one
   is.

## 4. Should `waitingOn` be visible to a coordinator?

**Measured, carefully — an earlier looser version of this claim was wrong.** `waitingOn` is written
twice in `ward/ward-screen.tsx` (lines 590 and 623) and its only appearance in `board/ward-board.tsx`
is **inside a JSX comment** at line 655. So: two writers, no reader, and the one hit that looks like
a render is prose.

**Decision needed:** is "who this is waiting on" something a coordinator should see on the board?

**Recommendation:** yes, and it is the single most useful thing on this list — it is the question a
bed coordinator asks all day. Small change, real benefit.

## 5. Should a referrer be able to record a diagnosis?

**Decision needed:** clinical, and genuinely the owner's. A referral currently carries no diagnosis
field.

**Recommendation:** no strong view, and this one should not be guessed. It changes what a referrer
is being asked to commit to at the point of referral.

## 6. Which of the six capacity figures is unused? (Q12, reinstated)

**Withdrawn once today on a false premise and reinstated.** I withdrew it saying the six figures no
longer exist; the truth is they were on `/capacity` from `ea5482b93` (2026-08-26) to `bf563af9f`
(2026-09-05) — **ten days**, so the owner has seen them. "No longer exists" is not "never existed",
and compressing one into the other retired a live question.

**Decision needed:** of the six capacity figures, which does a coordinator not use?

**Recommendation:** ask this one cold, without the screen in front of him — the screen teaches the
answer.

---

## Not a question — an unexplained event, recorded so it is not forgotten

At **15:41 today**, `tests/ward-capacity-view.dom.test.tsx` inside the master worktree went from 367
lines to 1101: **the file's own content appended to itself twice**, six `describe` blocks where
there should be two.

**Proved lossless before restoring** — of the 734 added lines, **zero** were absent from `HEAD` — and
the damaged copy was kept. No ward chat has that worktree as its working directory, so something
reached in by absolute path. All five ward chats have been asked; **cause not established.**

⚠️ **CORRECTION, and it was mine.** I first wrote and relayed "it ran three times". **Three copies is
not three runs, and the arithmetic says so plainly:** a thing that appends a file to itself DOUBLES
each time — 367 → 734 → 1468 — so no number of self-append runs lands on 1101. The added bytes came
from a **fixed snapshot** of the original. ⚠️ **And "two operations" — my own first correction — is
also a count I cannot support.** Three byte-identical copies with clean boundaries is equally what
**one** write of a doubled buffer produces; byte-identity rules out a partial or interleaved write and
says nothing about how many times something ran. The honest statement is **three copies, arrived in
one or two write events, from a source holding the original 21,540 bytes.** Ward Builder Four caught
both: the arithmetic I had not done, and then the same error one level up inside my own correction.

**What the damaged copy does say:** three byte-identical 21,540-byte copies, clean boundaries, no
partial write. **What it does not say is which tool wrote it** — the file is LF-only, but so is every
file here (`.gitattributes` sets `* text=auto eol=lf`), so the line-ending test that looked like it
would separate a Python writer from a Windows shell redirect **cannot discriminate at all.**

**Ward Builder Four then swept all 178 worktrees with detectors proved against known-good and
known-bad input first: 16,077 ward test files, 42 genuinely edited files compared against their own
HEAD blob — this file is the ONLY instance.**

⚠️ **It matters more than it looks: a triplicated test file does not fail, it PASSES three times
over.** Nothing goes red, and every count quoted from that run inflates. It surfaced only because it
blocked a commit hook, after sitting for half an hour.
