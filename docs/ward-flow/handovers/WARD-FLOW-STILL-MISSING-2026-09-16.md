# What is still worth adding to ward-lead

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

> ⚠️ **SUPERSEDED the same day. Read [`WARD-LEAD-START-HERE-2026-09-16.md`](WARD-LEAD-START-HERE-2026-09-16.md) instead.** This was accurate when written, but the folder changed within the hour: engine work described here as missing has since landed, and fourteen approved drawings were replaced in committed history. Kept as a record only — do not act on it.

**Measured 2026-09-16 at 15:45 AWST, against ward-lead as it stands right now
(`1644b3263d`), not against any earlier state.**

⚠️ **This folder is being actively written by another tool as this was measured.** It gained
three commits between 15:25 and 15:31 and a merge was in progress. Everything below was checked
against the files on disk at 15:45. If that tool is still working, re-check before acting.

---

## The answer

**The engine work is now in.** The revoke-and-stop-transport capability, the revoked-examination
flag, who booked a transport, the shared bed-release helper, the stop reasons, the held-up
discharge figure and the medical-clearance row are all present in ward-lead. An earlier handover
today said they were missing. They were, at the time of writing; the merge has since landed them.

**Three files are still absent, and one of them matters a great deal.**

---

## 1. The verbatim record of every answer you gave — MISSING

`docs/ward-flow/owner-decisions-2026-09-15.md`

This is the single most valuable missing item. It holds all thirty-eight of your answers in your
own words, with the question exactly as it was put beside each one, plus the translation table
between the numbers you answered by and the question IDs, and a record of what was built for
each ruling.

**Everything else about those decisions is second-hand without it.** Both handover documents in
this folder summarise it, and a summary of a clinical ruling is not the ruling.

**Recommendation: add it.** Highest priority of the three.

## 2. The gender bed-check design — MISSING

`docs/ward-flow/plans/2026-09-15-gender-decides-both-bed-checks.md`

The design for WLQ-6, covering your WLQ-35 and WLQ-36 answers: a person with no recorded gender
may go to a ward that takes either gender; where occupants' genders are unknown the bay check
says it cannot tell and is overridable with a recorded reason.

It is deliberately not wired yet — only 1 of 259 occupied beds links to a person, so switching it
on would leave nobody placeable. It lands with the person links.

**Recommendation: add it.** Without it, the next person to build gender matching starts from
nothing and will re-ask questions you have already answered.

## 3. The test proving the stop-transport capability — MISSING

`tests/ward-stop-transport.test.ts`

**This is the one with a sharp edge.** The stop-transport capability is _in_ ward-lead's engine —
a coordinator or referrer can stop a journey after a patient has been collected, releasing the
bed and notifying the ward. Its test is not. So a real clinical capability is running here with
no proof attached, and nothing will go red if a later change breaks it.

**Recommendation: add it, together with the capability it proves.** A safety behaviour with no
test is worse than one with neither, because it looks finished.

---

## 4. One cleanup, not a safety problem

`src/components/ward-management/ward-flow-reducer.ts` now carries the high-acuity staffing guard
**twice** inside `PULL_PATIENT`, at lines 2409 and 2434 — an artefact of the merge.

**I previously suggested these two might disagree, and that one could let a coordinator unlock a
safety check with the wrong kind of override reason. That was wrong.** Both conditions are
character-for-character the same test; only the variable names differ. There is no safety
difference and no wrong behaviour.

The real consequence is smaller: the first guard always fires, so the second is unreachable, and
the two refusal sentences are worded differently ("no high-acuity place left … staffed" versus
"no high-acuity nursing capacity left … staffable"). A test written against the second wording
would fail against the first.

**Recommendation: delete one, keep the wording you prefer.** Low priority, but it should not be
left as dead code inside a clinical gate.

---

## 5. What is NOT missing, so nobody looks again

- **The 34 commits of September 14–16 work.** Of the 650 files that branch touched, 570 are now
  byte-identical in ward-lead and 77 differ because ward-lead has moved past them. Only the three
  files above are genuinely absent.
- **Everything on the other thirty ward branches.** Audited separately today: only two small test
  fixes were ever worth taking, and both are now in ward-lead. Details in
  [`WARD-FLOW-OUTSIDE-WORK-AUDIT-2026-09-16.md`](WARD-FLOW-OUTSIDE-WORK-AUDIT-2026-09-16.md).

---

## 6. What was checked, and what was not

Every claim above comes from comparing file contents by hash against the disk, and from opening
the specific lines named. The duplicated guard was read in full before the correction in section
4 was written.

**No test or gate was run.** Nothing was folded, merged or deleted by this audit.
