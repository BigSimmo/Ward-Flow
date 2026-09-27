---
name: controller-staging-claims-subagent-work
description: "Never write to a worktree a subagent is working in — three instances in one session, each time because my own change felt too small or too urgent to count"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4f18cd31-6a33-4c8c-adaa-ba332e583ab7
  modified: 2026-09-05T22:28:49.014Z
---

🔴 **THE RULE, AND IT IS NOT THE ONE THIS ENTRY OPENED WITH FOR ITS FIRST YEAR: COMMIT WITH A
PATHSPEC — `git commit -- <paths>` — ALWAYS, IN ANY WORKTREE.** Not only when an agent is live in it;
you generally cannot tell. **Staging by name protects nothing**, because `git commit` with no
pathspec commits the WHOLE INDEX, including whatever another session staged into the shared index
before you. Two sessions hit that in two days after following this entry's original advice — details
in the two corrections at the foot of this file.

The outcome to avoid, stated as an outcome so a third mechanism cannot slip past it: **a commit whose
message is false about its own contents.** `git add -A`, `git add .`, `git commit -a` and a bare
`git commit` over a shared index are four doors to it, and there will be a fifth.

On 2026-08-25 a ledger commit of mine (`15559437f`, "record Task 6b review outcome; file the CI
database-suite gap") also carried **23 lines of the implementer's SQL migration change**, which was
sitting uncommitted in the shared working tree at that moment. The message said nothing about it. The
implementer found it and disclosed it; its own commit table was one commit narrower than reality
through no fault of its own.

**Why:** the controller and its implementer share one working directory. Every wildcard the controller
types can claim whatever the implementer has not yet committed. The damage is not lost work — the
content was correct and committed — it is a **commit whose message is false about its contents**, and
a review boundary that no longer matches what anyone believes it contains. In a programme whose whole
discipline is "the artifact must not assert something untrue", that is the exact failure being fought,
introduced by the person policing it.

**How to apply:**

1. `git add <explicit paths>` for controller commits. Every time, not only when you suspect an agent
   is mid-edit — you generally cannot tell.
2. `git status --porcelain` before staging, and treat any path you did not touch as someone else's.
3. If it happens: **do not rebase to fix the message** while an agent is live in the tree — that risk
   is larger than the wrong message. Record it in the durable ledger where a reader will look.

This is the sibling of [[concurrent-agent-worktree-destruction]] and
[[worktree-sweep-destroys-live-work]] — same hazard (shared mutable tree, concurrent writer),
different door. Those are about destroying an agent's work; this is about silently absorbing it.

## Third instance, 2026-08-26 — and the exemption I keep granting myself

A second worktree's implementer found `npm run lint` red on the shared branch, in a file belonging to
neither task. I verified it, fixed it, and **committed it into the branch a live implementer was
working in.** The fix was correct and the failure was genuinely blocking. It was still the third time
in one session that I have written into a running implementer's tree.

The three instances, and what each felt like at the time:

1. `git add -A` swept an implementer's uncommitted work into my ledger commit — _"it's just docs."_
2. Two implementers dispatched into one worktree — _"the overlap lever worked last time."_
3. This one — _"it's blocking and it's one line."_

**The pattern is not carelessness about the rule. It is that I keep finding a category the rule
obviously does not cover, and the category is always "my change, right now".** Small, urgent, or
mine — none of those is an exemption, and each felt like one.

**What made this instance recoverable rather than expensive:** the implementer's mutation discipline
asserted `git diff --quiet` clean on **both sides of every mutation**, so it detected the interference
instead of silently absorbing it. _"I only know because the discipline asserts cleanliness instead of
assuming it."_

**How to apply:** if a fix is genuinely urgent while an implementer is live, **do it in a different
worktree, or wait.** A branch is not a shared editing surface while someone is running mutations
against it — the whole point of a mutation is that the tree's exact bytes are the evidence.

## 🔴 THIS ENTRY FAILED ON 2026-09-05 BECAUSE IT NAMED ONE MECHANISM AND THERE ARE TWO

I read this file at the start of the session, followed it, and hit the exact outcome it warns about.

**`git add -A` is not the only route. `git commit` with no pathspec commits the WHOLE INDEX.** So
staging single files by name — which is what this entry's rule implies is safe — protects nothing if
the implementer has already staged its own work: your `git commit -F <message>` takes its files too,
under your message and your authorship.

What it cost: two commits on the Ward Flow master line whose messages describe one file each and
which contain fourteen and four. The `WardTable` primitive and five module migrations are attributed
to me. Content correct, record wrong; fixed with a note
(`docs/ward-flow/archive/dated-notes/commit-provenance-2026-09-05.md`) rather than a history rewrite, because three
sessions merge that line and a rewritten shared base costs more than a wrong byline.

**The habit that actually works: `git commit -- <paths>`.** It limits the commit to what you name
regardless of what else is staged. For a NEW file, `git add` it first — `git commit -- <path>` alone
errors with _"pathspec did not match any file(s) known to git"_, which is a safe failure but a
confusing one at 5am.

⚠️ **And the general lesson is about this store, not about git.** _A lesson recorded against one
mechanism does not transfer to a second._ I avoided the named wildcard, felt protected by having
done so, and never asked what else could produce the same outcome. When writing an entry here, name
the OUTCOME to avoid, then the mechanisms as examples — never only the mechanism. Related:
[[a-property-that-does-not-discriminate]], [[a-guard-that-pins-the-old-wording]].

## ⚠️ AND IT DID NOT STOP THE NEXT READER EITHER — 2026-09-06, Ward Verifier

Twenty minutes after Ward Lead wrote the section above, I committed with `git commit -F -` and **no
pathspec**, having staged eight files by name. Harmless this time — I am the only session in this
worktree and `git show --stat` confirms exactly those eight — but the entry had already been
corrected, and I still did the thing it corrects.

**Why it missed me: the remedy is the last line of the third section, under two long sections whose
subject is `git add -A`.** I recognised "am I about to `git add -A`?" as the question this file asks,
answered no, and stopped reading. **A correction appended to the end of an entry inherits the
salience of the entry's opening, not of the correction.** When an entry's rule changes, the change
belongs in the first paragraph — or the entry needs splitting, so the new mechanism is not filed
inside a heading that names the old one.

**The habit, stated once, at the top of what I do:** commit with `git commit -- <paths>`, always, in
any worktree, whether or not another agent is live in it. A rule with a live-agent precondition
requires me to know something I generally cannot check.

---

## 🔴 2026-09-07: THE NOTICE SAID "COMPLETED" AND THE AGENT WAS STILL WORKING. I COMMITTED ITS BUG.

This memory says never write to a worktree a subagent is working in. **It did not fire, and the
reason is worth more than the rule: I had positive evidence the agent was done.**

```
task-notification   status: completed   result: "Waiting for the background verification to complete."
task-notification   status: completed   result: "Waiting for the verify:phone-chrome gate to finish."
task-notification   status: completed   result: "Waiting for the final verify:phone-chrome result."
task-notification   status: completed   result: <the actual report, 88 minutes later>
```

⚠️ **`completed` means the agent's turn ended, NOT that its task is done.** An agent that stops to
wait on a long gate emits exactly the same notice as one that has finished. **The harness even says
so — "a task-notification fires each time this agent stops" — and I read the status word instead.**

**What it cost:** I staged its files by name and committed them at `eef64e3aa`. It was mid-flight; it
went on to discover its own first fix was wrong — a sticky identity column **wider than the total
scroll distance**, permanently hiding the data it existed to protect — and corrected it two commits
later. **So a commit of mine carries a defect its message does not mention.** Nothing was lost, and
that is luck rather than method.

⚠️ **It also misattributed my commit to a peer session**, inferring an owner from a commit appearing
over its work and picking a name it had seen in traffic. **An agent whose work is committed under
someone else's message will name a culprit, and it will be the wrong one.**

### The tell, and the check

- **Read the RESULT text, never the status word.** A result that says "waiting for…" is an agent
  that stopped, not one that finished. Both arrive as `completed`.
- **A finished agent's report names what it did.** If the result contains no verdict — no test line,
  no file list, no conclusion — the work is still open regardless of the status.
- 🔴 **And the standing rule needs its trigger restated: not "while the agent is running" (which I
  believed was false) but "until the agent has handed back a report you have read".**

Related: [[two-task-lists-one-check]], [[verifier-output-is-ephemeral]],
[[a-clean-negative-that-measured-nothing]], [[observations-expire]].
