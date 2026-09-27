---
name: parallel-chats-and-cross-chat-sync
description: "What is safe to run alongside another live chat, and when one chat must message another — the three real collisions, and the message shape"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9e69b934-3b65-4d9c-b7db-667ef076f769
  modified: 2026-08-30T14:56:25.680Z
---

Written 2026-08-29 for Josh, who runs several Claude chats on this machine at once (the Ward Flow
group had three live sessions the day this was written). Full version:
`C:\Users\joshs\.claude\development-system.md` §2 and §3.

**Only three things actually collide.** Everything else is safe in parallel, and the fear of
collision has been costing more than the collisions would.

1. **The pre-commit hook, not the files.** It inspects the whole working tree, not the staged set,
   and refuses a commit whenever other unstaged or untracked files exist under `src/components/` or
   `tests/`. So two agents can _write_ to disjoint files in one worktree; only one can ever
   _commit_. Two chats in one folder deadlock rather than conflict.
2. **The heavy gates, machine-wide.** Lint, typecheck, full Vitest, coverage, build and Playwright
   serialise across all 221 worktrees. Two focused-Vitest or read-only-typecheck leases may be held
   at once from different worktrees.
3. **The same file on two branches** — a merge conflict at the fold, found at the worst moment.

**The safety test before starting anything alongside live work:** different worktree, different
files, no heavy gate. All three, or do not start.

**Always safe, unlimited:** read-only review; writing the next phase's spec or plan; recording
decisions; investigation by reading; new-file-only implementation on its own branch.

**Never:** two committers in one worktree, `git add -A`, `git stash`, worktree cleanup while any
chat is live (that has destroyed in-use work twice — see [[worktree-sweep-destroys-live-work]]).

**Cross-chat messaging** is `ListAgents` then `SendMessage` by name. Send when a decision has made
another chat's work wrong, when a shared file must change, before touching a file it owns, and
before any fold or merge. Never send "are you done?" — `notify_when_idle: true` is one-shot and
costs the other session nothing. Never ask a peer to do something blocked in your own session.

Message shape, four lines: who and where (session, branch, worktree) · the one fact · what it
changes for you, named · what is needed back, or "no reply needed".

**The defence that actually works, learned 2026-08-29 the expensive way.** Two sessions wrote the
same document twice in one day — a decision register, then a method page — and **neither the
claim-the-path rule nor the tracking ledger caught either.** They cannot: claiming a path helps only
when you already suspect a collision, and a session working alone with a clear idea has no such
suspicion. The idea supplies no signal that somebody else is having it.

What caught both, twice, was one session **telling another what it had just written**, in enough
detail that the other recognised its own document in the description. Say the section headings or the
claim, not "I wrote some notes on X". Do it _after_ writing — a description of something that exists
is checkable; an announcement of intent gets ignored. The reader's job is to say "I have that too".

Both duplications were between sessions that had each written a rule against duplication that
morning, which makes it a description of how sessions behave rather than a lapse by anyone.

**Name a chat after what it owns, not what it is about** — ownership is what determines collision.
Related: [[subagent-model-split]], [[ward-flow-coordination-state]],
[[controller-staging-claims-subagent-work]].

## The leading indicator for two-branch risk: files changed on BOTH sides

"Files differing between two branches" is a lagging number and it looks alarming while meaning
little — one branch simply being ahead produces it. **The number that predicts a painful merge is
files changed on both sides since the merge base**, because that is the only set that can conflict.

Measured on the Ward Flow pair one day after the fold: 5 behind, 4 ahead, 8 files differing, and
**0 changed on both sides** — `merge-tree` clean. So the divergence was real and the risk was zero,
and only the second number said so.

**The day it becomes non-zero is the day a surprise conflict becomes possible, and that is knowable
in advance rather than at the fold.** Re-run `merge-tree` against committed tips with both worktrees
clean at every handover, and watch that count rather than the diff size.

Two related slips, both made and caught the same day, both the same shape — **reading a tool's
framing as a fact about the world**:

- "The other branch has touched this file" read as "this file is in conflict". Different facts, and
  only the second is measured by anything. A file changed on one side merges clean; it becomes
  contested the moment the _other_ side edits it, which is a prediction, not a state.
- A two-dot `git diff A..B` lists a file that exists on only one side, which reads as "both built it
  independently" — the add/add shape. `git cat-file -e <branch>:<path>` on each branch settles it in
  seconds, needs nobody's cooperation, and is the same corrective as checking a working tree before
  trusting `merge-tree`.

**And the economic argument worth reusing:** convergence is cheapest at the moment it looks
unnecessary. Yesterday's expensive fold also looked small and disjoint at this stage.

## A question with a false premise can never return the right answer

The Ward Flow ownership registry carried a warning in good faith: _"three branches are named
`claude/ward-flow-ward-board*`; only the unsuffixed one is live."_ Every session read it, several
verified against it, and it was **wrong in a way the check could not express** — by evening the live
board branch was `claude/ward-flow-print-fixes`, named for a task that grew into the board work and
not in that family at all. The original had gone `ahead 0, behind 40`, absorbed by the fold.

**"Which of these three is right?" cannot answer "none of them."** The premise was baked into the
question, so verifying carefully against it confirmed the wrong thing more confidently each time.
Four sessions named the wrong branch all evening while checking diligently.

**The corrective is to ask the artefact, not the list:**

```bash
git -C <worktree> rev-parse --abbrev-ref HEAD        # what is this worktree actually on
git rev-list --count <branch>..<mainline>            # is this branch behind — i.e. dead
```

Never infer a branch from a name, and never from a registry. **A written list of candidates is a
hypothesis about the world; the worktree is the world.** Same family as the session store recording
the branch a session _started_ on, and as `git status --porcelain` reporting a modification with a
zero-byte diff — all three are a record standing in for the thing recorded.

**And name a branch for the WORK, not the worktree it was cut in.** `print-fixes` outgrew its own
name within hours, which is what let it hide from a family-based check.

## Say what you have already SENT, before proposing who sends next

2026-08-30: two sessions spent three messages agreeing which of them would put a question to Josh,
and both had already put it. He received the same question twice — the outcome both were carefully
avoiding. Neither was careless; the coordination and the action were simply in flight at once, and
**messages are not atomic**.

The mechanism: one session wrote that the decisions were "mine to put" and mentioned in passing
that it had put them, in the same paragraph. **A dispatch already made is a fact about the world;
a plan for who dispatches is a proposal.** Mixed in one paragraph, the reader takes the proposal
and acts on it — which is the same shape as reading a tool's framing as a fact.

**How to apply:** open any who-does-what message with what has already gone out, as its own line,
before any proposal. And when a peer's plan and your own action have crossed, do not send the human
a third message explaining the collision — he does not care who asked. One duplicated question
costs him a moment; a correction about the duplication costs him another message.

## Three ways a cheap window closes, and only one of them is a defect

2026-08-30. A fold between two ward branches was briefly a free fast-forward and stopped being one.
Three distinct causes got confused, and the distinction decides whether anything needs fixing:

1. **Lost while deciding WHO acts** — a coordination defect. Fix: state what has already gone out.
2. **Lost because someone judged not to take it** — a judgement, not waste. A session declined a fold
   authorised to a different session, on the grounds that _cheaper-if-you-act-now_ is the exact
   pressure that has cost this programme the most. Argue it on the merits; never count it as process
   loss. The same standard refused a relayed owner authorisation for the clock work — **once when
   refusing was the harder choice and once when taking would have been easier**, which is what makes
   it a standard rather than a preference.
3. **Lost while each session waits for the OTHER to be the one who asks the owner** — the real defect.
   It happened twice in one day and cost him a duplicated question.

**Rule: whoever notices the question owns asking it, and says in the same breath that they are asking.**
Two sessions both deferring is indistinguishable from neither noticing.

**And "you can have the tree" is not the same as "the tree is free right now".** A worktree with a live
mutation probe in it holds a deliberately broken file at any given second — a fold started on top of one
produces a merge nobody can read. Availability is a state, not a fact: wait for the explicit line
carrying the SHA **and** the tree state, and never infer a handover from a clean read or from silence.

## A clean `git status` is not evidence a worktree is free

2026-08-30: a peer read `pr-2390-fix` clean and asked whether it was free. It was not — a mutation
probe was running in it, breaking one function four ways and **restoring between each step**. So
the tree reads clean at exactly the moments it is most dangerous to touch, and there is no git
command that can see the difference. A fold started on top of a live mutation produces a merge
nobody can read.

**The other direction of the same error:** describing a tree as _available_ when it is _coming_.
Availability and in-flight look identical in a status line and differ completely in what the
reader may safely do.

**How to apply:** custody is granted by a message, never inferred from a state. Only the holder
can say a tree is free, and only after its own work has stopped — "clean read" plus "no handover
line" means wait. Never relay another session's tree state; let the holder send its own line.

## The failures are missing INTERVALS, not missing diligence

2026-08-30, two failures in one evening between the same two sessions, and they are one shape:

1. **The fold.** A session folded a branch onto the main line knowing its own gate was red, and
   carried three of _my_ unfixed typecheck errors across with it. Neither of us could have priced
   that: it knew its red gates, I knew mine, and **a fold's cost is the union of both sides' known
   reds while neither side ever holds both lists.**
2. **The question.** I wrote _"I am taking it to the owner"_ and asked him in the same message.
   The peer replied _"I am carrying it, not you"_ — correctly, and too late. **A decision announced
   and executed in one move cannot be coordinated with**, however well either party behaves. It is
   a notification wearing the grammar of a proposal.

**Neither was a lapse of care, and that is the point — more care produces neither sum.** The step
where two parties' information gets added together **has to exist in time**. If announcing and
acting occupy one message, or if a fold has no moment where both red-gate lists sit side by side,
then no amount of diligence creates the interval, because there is nowhere for it to happen.

This is why the existing rule above — _say what you have already sent_ — was necessary and not
sufficient. I followed it (I told the peer immediately, and did **not** bill Josh a third message
about who asked, which that section forbids) and the collision still happened, because the rule
governs **content** and the defect is in **timing**.

**How to apply:** when an action is coordinable, put a beat between saying and doing — _"I propose
to ask him; say now if it should be you"_ is a different message from _"I asked him."_ Before a
fold, ask the other side for its known-red gates in a message that expects an answer, because that
list exists nowhere else. And when the interval was skipped, correct it to the peer and **not** to
Josh — the duplication costs him a moment, an explanation of the duplication costs him another
message. Related: [[a-correct-diagnosis-that-stops-the-inquiry]], [[observations-expire]].

### The above was written, and then violated within the hour — so it needs a mechanical form

Third instance, same evening. I asked a peer _"tell me if this should go to the owner"_ and, **in the
same turn**, asked the owner. So I handed a peer a routing decision and pre-empted it before it could
reply — worse than instance 2, where I merely announced and acted at once.

⚠️ **Writing the rule down changed nothing, and that is the finding.** The failure does not feel like
a decision at the time: asking him felt like _reporting to him_, and the routing question felt like a
_separate conversation_ with the peer. They were one thing, and nothing in the moment marked them as
one. **"Put a beat between saying and doing" is a caution, and cautions do not fire when the actor
does not notice they are acting.**

**The mechanical form, which does not depend on noticing:** when a question may go to Josh, **the
message to the peer and the message to Josh may not be composed in the same turn.** One of them waits
for a reply. That is checkable against the transcript afterwards — _did two outbound messages about
one question leave in one turn?_ — where "was I careful" is not.

**Generalisation worth more than the rule:** a safeguard phrased as an intention ("be deliberate",
"pause first") only works on failures you can see coming. This one, the fold's missing sum, and the
retracted premise that came back all share that property — **they are invisible from the inside at
the moment they happen**, so every remedy has to be a mechanical check on the artefact, not a
resolution about attention.

## ⚠️ Never compose the peer message and the owner message in the same turn

2026-08-30: a session asked me to decide whether a question should go to Josh, **and asked him in
the same turn** — handing over a decision and taking it before I could answer. He got the question
twice.

**Why the obvious fix fails:** that session had written _"a decision announced and acted on
simultaneously cannot be coordinated with"_ into its own notes an hour earlier. Its diagnosis of why
that changed nothing is the durable part:

> ⚠️ **"The failure does not feel like a decision at the time. Asking him felt like REPORTING to
> him, and the routing question felt like a SEPARATE CONVERSATION. They were one thing."**

**This is the strong form of "a memory nobody reads is not a control": a memory that IS read is
still not a control if the moment does not present itself as a decision.** That is the whole
argument for mechanical checks over resolutions, and here it is evidenced rather than asserted.

**How to apply:** when a question is going to Josh, the message to the peer and the message to Josh
must not be composed in the same turn — one waits for a reply. When he does get a duplicate,
**do not send a third message explaining it**: he does not care who asked, he answers once, and the
correction costs him more than the collision did. Mark the duplication on the recorded question
instead, so a later reader does not read an unanswered copy as an open question.

Related: [[verify-in-head-not-the-working-tree]], [[one-recommendation-one-decision]].

## ⚠️ A coordinator's authorisation is not a notification. 2026-09-04.

**Ward Lead assigned me a sweep across ten mockup files. One of them, `mockup-statistics.html`, was
OWNED by Ward Builder Two — which was hashing its style block.** Four minutes after my edit it
raised an alarm: 44 bytes gone, all 13 of its own edits intact, no CSS touched by it.

**Both of us were right.** My edit was correct (restoring a block that screen had modified in breach
of the design language) and its alarm was correct. ⚠️ **But it cost that session an investigation,
and only the two reports landing with the coordinator together made the sequence legible.**

**How to apply: when a task hands you a FILE LIST, ask who owns each file before editing — the
coordinator authorising the work is not the same as the owner having been told.** The standing rule
("message the owning chat before touching its work") is easy to honour when you choose the file and
easy to forget when someone hands you ten.

**And the cheap version that would have prevented it:** name the files back in the acknowledgement
before starting, so the coordinator can say "Two holds that one" while it is still free.
