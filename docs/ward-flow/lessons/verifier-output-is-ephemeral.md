---
name: verifier-output-is-ephemeral
description: A reviewer role that correctly writes no files produces findings that exist only in chat and vanish with the session
metadata:
  type: project
---

Ward Flow's Verifier holds a detached pinned checkout and writes no file — correctly, because a
verifier that can move its own pin can answer about a different commit from the one it was asked
about, and that looks identical to a correct answer.

The unpriced consequence: **every verdict it produced existed only as a chat message.** Its full
2026-09-02 report — eight findings, three owner questions — reached the then-Ward-Lead not at all,
reached the owner only because he pasted it by hand, and survived solely inside a 20 MB session
transcript under `C:/Users/joshs/Backups/claude-work/`. One file away from gone. Rescued into
`docs/ward-flow/reports/ward-verifier-2026-09-02-rescued.md` at `e0cb8f0fe` by extracting line
10097's `attachment.prompt` as JSON, not by pattern-matching text.

**Why:** the role's integrity constraint (never move the pin) and its durability (write it down)
were treated as the same decision. They are not. Someone else can commit on its behalf.

**How to apply:** when a role is defined as producing no artefact, name who commits its output
before it starts. Ask for its findings as a message AND commit them verbatim the same hour —
verbatim including the parts later contradicted, because a rescued document that quietly corrects
itself stops being evidence of what was said. Extract from a transcript by parsing structure, never
by grepping prose. See [[ward-flow-coordination-state]] and [[relayed-numbers-lose-attribution]].

## 🔴 2026-09-12 — A DELEGATE THAT SUB-DELEGATES AND RETURNS A PROMISE

**I dispatched three Sonnet agents to survey 21 files each. One of them spawned four agents of its
own and finished with:**

> _"I've kicked off four parallel Sonnet survey agents… I'll compile the full report once they all
> report back — no need to do anything further right now."_

⚠️ **That is a status update, not a result — and the agent had already terminated when it arrived.**
🔴 **Its children's output goes nowhere I can read: a subagent's subagents report to IT, and it is
gone.** The 21 files were simply unsurveyed, and **the completion notification looked exactly like
the two that carried real work.**

### Why it is hard to notice

**A finished-looking notification with confident prose reads as success.** The tell is narrow:
**the result describes FUTURE work rather than containing findings**, and the phrase _"no need to do
anything further right now"_ is the giveaway — a completed survey has no "right now".

⚠️ **And this build has no way to resume a subagent**, so there is no cheap recovery: the only
remedy is re-dispatching the whole slice.

### How to apply

- **Put it in the brief:** _"Do this work yourself. Do not spawn subagents. Your final message must
  CONTAIN the completed analysis."_ ✅ And give the escape hatch that removes the incentive:
  **"if you run out of room, analyse fewer items and say which you did not reach — a partial survey
  that names its gap is useful, a promise of one is not."**
- **Read every agent result for CONTENT, not for tone.** A result that says what it _will_ produce
  has produced nothing.
- ⚠️ **Keep the input list.** I could re-dispatch instantly only because the file list was written to
  a scratch file first; reconstructing "which 21" from the transcript would have cost more than the
  survey.

Kin: [[two-task-lists-one-check]], [[controller-staging-claims-subagent-work]],
[[a-written-diagnosis-does-not-sweep]], [[broken-and-never-worked-look-identical]].

## 🔴 THE ROOT OF ALL THREE: THE STATUS FIELD IS NOT THE OUTCOME

One session produced three of these, and a peer named the common root rather than the third instance:

    a task output file of 0 bytes, status "completed", and nothing on disk
    an agent whose completion notification described work it WAS GOING to do
    a task I STOPPED that had already committed before I killed it

⚠️ **In all three the status field was the misleading part and only the CONTENT distinguished
them.** "Completed" covered a finished run and a run that never started. "Stopped" read as _nothing
happened_ when a commit had already landed — **and I was one action away from committing over it.**

**How to apply:** **never read a task's status as its result.** Open what it produced. ⚠️ **And after
stopping a task, check what it did before it died** — `git log`, `git status`, the output file —
because a killed task is the one people assume left no trace.
