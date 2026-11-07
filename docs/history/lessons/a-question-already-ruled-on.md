---
name: a-question-already-ruled-on
description: "Before asking Josh a question, search the ratified/decisions records for it — a question he has already answered costs his time and the matching answer hides the waste"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8d04697-d651-4023-a4c8-7226e9ed0591
  modified: 2026-09-18T15:26:34.705Z
---

**An open question in a draft is a claim about the decision record, and it is the claim nobody
checks.** Before putting a question to Josh, search the ratified tables and decision registers for
it. A brief that lists something as "open" is evidence somebody thought it was open, not evidence
that it is.

Measured 2026-09-18, Ward Flow. A community-team mapping document went to Josh with six questions.
**Four had already been ruled on** — all four Inner City spellings were covered by his 2026-09-05
alias ruling, sitting in `RATIFIED_SERVICE_ALIASES` the whole time. He answered, and his answer
matched the existing ruling.

🔴 **THE MATCHING ANSWER IS WHY THIS GOES UNNOTICED.** Nothing looked wrong afterwards: the
question was asked, an answer came back, the answer was correct, the work proceeded. **A
re-answered question and a newly-answered one are indistinguishable in the outcome** — the only
trace is the owner's time, which leaves no artefact. Had the two answers _disagreed_, somebody would
have investigated immediately; the agreement is what buries it.

**Why:** rulings are recorded in a place chosen for enforcement (a ratified alias table, a
decisions register, a guard's expectation line), not in a place chosen for browsing. Whoever drafts
the next question is reading the _subject_, not the _decision record_, so the ruling is one lookup
away and no step in the process makes that lookup happen. And this project's rule is explicit:
**settled questions stay settled**, and silence is not approval.

**How to apply:** treat "is this open?" as its own verification step with the same standard as any
other claim — grep the ratified/alias tables, the decisions register and the relevant guards'
expectation lines for the exact subject BEFORE the question is drafted, not after it is answered.
When several questions go at once, check each one separately; they were opened at different times.
If a question survives that check, say in the message where you looked, so the next person
inherits the search rather than repeating it.

Related: [[prove-the-task-is-still-outstanding]] (the same failure for assigned WORK rather than
questions), [[the-question-belongs-to-the-answer]], [[a-record-the-gate-never-consulted]],
[[a-correct-diagnosis-that-stops-the-inquiry]], [[ward-flow-coordinator-overrides-everything]]
