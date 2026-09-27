---
name: a-comment-that-asserts-an-absent-guard
description: 'A source comment saying "X is NOT prevented" is a claim about code elsewhere, and it rots silently when someone adds the guard — I published a finding from one that was two days stale'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2d57ae3e-f800-40ce-8184-f96d852a4bbe
  modified: 2026-09-17T13:43:58.294Z
---

**Drawing the Ward Flow journey map (17 Sept 2026) I published a finding reading "a revoked
examination does not stop a journey already moving — going en route, collecting the patient and
admitting them are all still allowed."** The source of that claim was a comment in
`RECORD_EXAMINATION` listing what is NOT guarded.

⚠️ **The comment was written 15 Sept (`489020f84a`, WLQ-4). A `PATIENT_COLLECTED` guard refusing
exactly that case landed 17 Sept (`2276378987`, owner answer 5) — in the same file, 1,300 lines
away.** Nobody updated the comment, because a guard's author edits the case they are guarding, not
every comment that ever described its absence.

**Why this shape is worse than an ordinary stale comment.** A comment describing what the code
beside it DOES is checked by the next person to read that code. **A comment asserting what some
OTHER case does NOT do has no reader who is positioned to notice it has become false** — and it
reads as unusually authoritative precisely because stating an absence sounds like someone went and
looked. See [[a-comment-that-predicts-an-edit-elsewhere]] and [[broken-and-never-worked-look-identical]].

**How to apply:**

- **A comment claiming an absence is a lead, never evidence.** Before repeating "X is not blocked",
  open X's own case and grep it for `reject`. It is two commands.
- **The tell is the grammar.** "is not prevented", "carries no guard", "nothing stops", "must stay
  reachable" — each names code somewhere else. Treat every one as unverified.
- **Check the dates when they disagree.** `git log -S` on the guard's message string against the
  comment's own commit settles it in one call, and tells you which way round the staleness runs.
- **Correct the width, not just the wording.** My finding was not wrong so much as _wider than the
  truth_: dispatch is genuinely unguarded, collection is not. Narrowing it honestly, and saying on
  the artefact that it had been drawn wider, keeps the remaining half credible — see
  [[a-partial-withdrawal-reads-as-a-careful-one]].

Related: [[observations-expire]], [[assert-only-about-code-you-opened]],
[[read-what-the-guard-reports-not-its-source]], [[a-declaration-is-not-an-effect]].
