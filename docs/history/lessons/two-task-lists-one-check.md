---
name: two-task-lists-one-check
description: An empty task-output file reads the same as finished and as never-started; twice I reported "nothing is running" while a task hung for hours
metadata:
  type: feedback
---

`ListAgents` reports SUBAGENTS ONLY. Background **shell** tasks are a separate list it never
shows. On 2026-09-01 I called `ListAgents`, saw nothing, and told the user "nothing is running" —
while a Bash task labelled _"Wait for the scout to report"_ sat in his UI with a stopwatch at
**3h 12m**. He answered by screenshotting his own screen.

The task was a wait loop — `until [ -s "$F" ]; do sleep 20; done` — polling for a subagent's
output file. That file was created at 18:47 and never received a byte: the agent produced no
transcript at all. The loop's only exit was success, so a dead agent became indistinguishable from
a working one, forever.

**Why:** two failures compounded. Reporting on a list I did not check made an unrunning system look
audited; and a wait whose only exit is success cannot report failure — the same defect class as
[[checks-that-cannot-fail]], which bit twice more the same night.

🔴 **IT HAPPENED AGAIN ON 2026-09-05, WITH THIS NOTE ALREADY WRITTEN, AND THE RECURRENCE IS THE
POINT.** The owner asked whether a background task was stale. I checked the two task IDs I happened
to remember, listed the `tasks/` directory, saw several **zero-byte** files, and told him _"nothing
is running — there's nothing to kill."_ He answered with a screenshot of his own UI: **one task,
`Bash`, 2h 46m 47s, still running.** Its output file was one of the empty ones I had just looked at
and dismissed. It hung on `cat > /tmp/probe.mjs` with no stdin — blocked on the very first command,
so it never wrote a byte.

⚠️ **THE NOTE ABOVE ALREADY SAID "a 0-byte output file is a dead dispatch, not a quiet one" AND I
STILL READ THE EMPTIES AS _FINISHED_.** Knowing the rule was not enough, because **an empty file is
absence-shaped evidence and absence is what "finished with no output" looks like too.** The two
readings are indistinguishable from the artefact alone; only the task's _status_ separates them.
Ward Lead has the same failure from the opposite direction (a wait loop on a dead agent, 3h12m) and
named the class: **absence-shaped evidence read as a completed state.**

⚠️ **AND THE DEEPER ERROR WAS THE POPULATION, NOT THE READING.** I checked _the IDs I remembered_.
A task I had forgotten could not appear in that check by construction, so the answer "nothing is
running" was unfalsifiable — see [[compliance-without-coverage]]. The owner's UI enumerates; my
recollection does not.

**How to apply:**

1. **Never poll for a subagent's completion.** The harness sends a completion notification on its
   own. The wrapper adds nothing on success and hangs forever on failure.
2. **Never say "nothing is running" from a list you assembled from memory.** Enumerate, or say what
   you actually checked: _"the two jobs I started have finished; I cannot list the rest from here."_
   A status claim is only as wide as its population.
3. **Resolve every empty output file before dismissing it** — `TaskOutput` with `block: false`
   returns `status: running` for a hung one and `No task found` for a finished or orphaned one. That
   status is the only thing that separates the two readings; the file cannot.
4. `ps -ef | grep -E "until|sleep"` finds shell waits, and a check for `vitest`/`node` processes
   catches a hung gate. Neither substitutes for step 3.
5. Any wait you do write gets a deadline and a loud timeout branch. **And never open a command with
   a bare `cat > file` that has no heredoc or pipe feeding it** — it blocks on stdin forever and
   produces exactly the zero-byte artefact this note is about.
6. When the user contradicts a status you just gave, assume the gap is in what you checked, not in
   what they saw — see [[observations-expire]] and [[assert-only-about-code-you-opened]].

## 2026-09-11 — an agent that spawned its own agents and returned a NON-RESULT that reads as a report

I dispatched two read-only Sonnet sweeps. One returned a detailed, verifiable finding. The other
returned, in full:

> _"I'll wait for the six background audit agents to finish before compiling the final report."_

🔴 **It had spawned six sub-agents of its own and stopped.** ~136k tokens, 29 tool calls, **zero
findings** — and the sentence reads like a progress note rather than the terminal output it was.
⚠️ **Worse, in a list of results it would sit beside a real one and look like work in progress
rather than work that never happened.**

**And I could not fix it: `SendMessage` was disabled in that session, so the agent could not be
asked to compile.** A dispatched agent that stalls is unrecoverable when there is no channel back.

**What to put in every sweep brief from now on:**

- 🔴 **"Do NOT spawn sub-agents. Report what YOU verified yourself."** Fan-out inside a fan-out
  turns one result into a join the parent cannot complete.
- **"An honest partial result with its scope stated beats a complete-looking one."** Say how far you
  got and how many of N you covered.
- **"Report ZERO findings plainly — an empty result is a useful result."** Without this, an agent
  with nothing to say invents structure or stalls looking for more.

⚠️ **And the parent's rule: a returned result that contains no FINDING is a failed dispatch, not a
clean one.** Read the result for whether it measured anything before reading it for what it says —
the same discipline as a test run that reports zero failures because it ran zero tests.

Related: [[a-clean-result-from-measuring-nothing]], [[verifier-output-is-ephemeral]],
[[gate-wrappers-mask-exit-codes]], [[subagent-model-split]].
