---
name: subagent-model-split
description: "Josh's standing rule: Sonnet 5 on high effort for safe subagent work, Opus reserved for review, judgement and high-risk implementation"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 436aeae1-07d3-453f-b85f-5ea70b3fe932
  modified: 2026-08-27T23:40:18.097Z
---

Decided by Josh on 2026-08-28, after learning that subagents silently inherit the session's model
unless a `model` override is passed on the Agent call — so an Opus session had been running every
implementer, reviewer and writer on Opus without that ever being chosen.

**The split:**

- **Sonnet 5, effort high** — safe work: mechanical or fully-specified tasks, registration wiring,
  regenerating generated files, formatting sweeps, docs edits, anything cheap to check and cheap to
  reverse.
- **Opus** — reviewers, spec and plan writers, and implementers on constraint-dense or clinically
  risky surfaces.

**Why:** every catch worth having in the Ward Flow autonomous session came from judgement, not from
code — a hollow test, a self-referential assertion, a brief that contradicted itself, a mutation that
was a no-op on its own fixture, a governance decision that drifted between approval and build. That
is where the tier difference shows. The mechanical work is verified by gates anyway.

**How to apply:** pass `model: "sonnet"` on the Agent call for safe work; omit it (inheriting Opus)
for review, planning and risky implementation. State which tier a dispatch is using when reporting,
so a cheap model is never mistaken for a vetted result. In this repo the constraint density is
unusually high — button wiring, design tokens, the one-composer rule, tap targets, the legal-figure
guard and the import-graph contract can all bind one edit — so when unsure whether a task is "safe",
it is not. Related: [[ward-flow-verification-lessons]], [[hand-picked-test-subsets-ship-red]].

**Now written up as a rule, 2026-08-29:** the deciding question is _if this subagent gets it wrong,
what tells me?_ — a gate catches it, so Sonnet; nothing catches it, so Opus. Full version, with the
always-Opus list and the effort caveat (effort is not settable on an Agent call, only in agent
frontmatter or a Workflow), lives in `C:\Users\joshs\.claude\development-system.md` §1, and the
binding summary is in the global CLAUDE.md. Related: [[parallel-chats-and-cross-chat-sync]].

## 2026-09-10 — how to brief a read-only agent so it CAN disagree with you

🔴 **A verification that can only agree with you is not a verification.**

**Measured:** I published _"no source or test file was touched"_, then dispatched a Sonnet agent to
verify the commit record. **It reported 171 commits where I had asserted none.** The brief was mine
and the range in it was wrong — I gave it a base that swept in hundreds of merged master-line commits.
**The agent did exactly as asked, and the answer contradicted its author's own published sentence.**

**It could only do that because of how the brief was written**, and this is the transferable part:

- **Ask for the RAW OUTPUT of a named command**, not for a conclusion. _"Run X and report exactly what
  it returns"_, never _"confirm that X returns nothing"_.
- **Forbid interpretation explicitly** — _"do not summarise or interpret; I need the raw facts"_. A
  brief asking an agent to _confirm_ something gets it confirmed; **a brief demanding raw output has
  somewhere to put a disagreement.**
- **State the expectation as a claim to be tested, not as context** — _"this should return nothing;
  report exactly what it returns — this is a claim I need verified, not assumed"_.
- **End every brief with** _"if you reach a decision this brief does not cover, stop and hand it
  back."_ The same run's second agent handed back two questions rather than guessing. **A subagent
  that returns QUESTIONS is doing the job; one that returns confident answers to questions it could
  not settle is the failure mode.**

⚠️ **And the value is not only in catching me.** That inventory agent **prevented a duplicate memory**
by reporting that a topic was already covered — an answer I did not want and would not have found.

**This is the control principle applied to a person you delegate to:** the check must be able to come
back wrong. See [[a-control-must-test-the-premise-not-the-measurement]],
[[a-correction-that-agrees-with-you]], [[a-measurement-is-scoped-to-what-it-measured]].
