# Ward Flow — how the three chats work together

Written by Ward Lead on 2026-09-01, at the owner's instruction, after all three roles were set up
but none of them had been told how to work alongside the other two.

This file is the answer to four questions that were previously answered nowhere: **where each chat
builds, how work gets back to one place, how each chat uses subagents, and what order the work is
in.** Every one of the three reads this file. It is on the master line, so it is the same file in
every checkout.

---

## 0. How to write to the owner

**Read [how-to-write-to-the-owner.md](./how-to-write-to-the-owner.md) before your first message to
him.** He settled the format on 2026-09-01 after explaining it to several chats one at a time, and
the point of writing it down is that a new chat inherits it instead of being told again.

The short form: detail first at whatever length the subject needs, then a rule, then a `Summary`
block — DID, ISSUE, GAPS, NEED, RECOMMEND, NEXT. **ISSUE and GAPS always print**, because they are
the two that protect him and the two easiest to skip on a turn that went well.

## 1. Where each chat lives

| Chat              | Folder                                                                   | Branch                                                           | What it may change                                                                                               |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Ward Lead**     | `C:/Users/joshs/.codex/worktrees/ward-flow-live-state-20260831/Database` | `codex/task-ward-flow-live-state-20260831` — **THE MASTER LINE** | `docs/ward-flow`, `scripts/ward-flow`, `src/components/ward-management`, `tests`, `.gitignore`, `.gitattributes` |
| **Ward Builder**  | `D:/Worktrees/Database/ward-builder-community-route`                     | `claude/ward-builder-community-route`                            | Only the paths named in its committed assignment. Nothing else, ever.                                            |
| **Ward Verifier** | `D:/Worktrees/Database/ward-verifier-9afb82c6e`                          | detached at `9afb82c6e` — **deliberately frozen**                | **Nothing.** It writes no file anywhere in the repository. It decides, and reports.                              |

⚠️ **The Verifier's folder is detached on purpose and must stay that way.** A verifier that can move
its own checkout can quietly decide a different commit from the one it was asked about, and its
verdict then describes code nobody else has. The lease pins the exact commit; leave it pinned.

⚠️ **Never open two chats in one folder.** The pre-commit hook inspects the whole working tree, so
the second chat can never commit — it does not fail loudly, it just deadlocks. One chat, one folder.

---

## 2. Everything comes back to the master folder — and only Ward Lead moves it

**Ward Lead's folder is the single master.** It is the only place where the whole product exists in
one piece, and the only branch anything is merged into.

The rule is one sentence: **Builder commits to its own branch; Ward Lead merges that branch into the
master line; nobody else merges anything.**

- **Ward Builder** commits to its assignment branch as it works, and says so. It never merges, never
  rebases, never touches the master branch, and never pushes anywhere.
- **Ward Lead** merges each finished Builder branch into the master line, resolves anything that
  conflicts, and re-runs the check that covers the merged result.
- **Ward Verifier** merges nothing. It reports a verdict; Ward Lead acts on it.

⚠️ **Merge often — a Builder branch that runs for hours before its first merge is the expensive
case.** When a Builder task reaches a coherent, working state, it commits and tells Ward Lead. The
cost of a merge grows with the square of how long you leave it.

⚠️ **A green gate on a branch is not a green gate on the merge.** A merge inherits the other side's
broken checks too, and only one side ever has both lists. After merging, Ward Lead runs the check
that covers _the merged tree_, not the one that was green before.

🔴 **THE WIRING NOW COVERS BOTH SHAPES.** `npm run mutate` takes `--find`/`--replace` for a targeted
change to a guard, and **`--append` for a sweep**, where there is no anchor to give `--find`.
**Evidence for the second, and it is a real sweep rather than a synthetic one: Ward Builder Three
re-ran their 51-stylesheet sweep entirely through the harness — 51 of 51 caught AND NAMING THE FILE,
zero survived, zero restore mismatches** (2026-09-06). Until that run the sweep half was refused by
design and stayed hand-rolled, **which is where a fixture was truncated to two lines while the
control still went red.**

⚠️ **BUT `SURVIVED` MEANS SOMETHING WEAKER IN APPEND MODE, AND A SURVIVAL IS THE VERDICT PEOPLE ACT
ON.** The probe always lands at end of file, so a survival means _"no assertion covers a probe at
end of file"_ — not _"no assertion covers this"_. A guard that only inspects inside an at-rule will
correctly report a survival. **And a probe the gate cannot see — a comment — mutates nothing while
changing the bytes, so it survives too. Confirm the probe is functional before believing a
survival.** `CAUGHT` is exactly as strong as in find mode.

🔴 **MUTATE A GUARD THROUGH `npm run mutate`, NEVER BY HAND.** `scripts/ward-flow/mutation-run.mjs` refuses
an untracked target, refuses a `--find` that does not match exactly once, and restores in a
`finally` **from bytes captured before the edit** — _"not from `HEAD`: whenever the file carries
uncommitted work, `HEAD` is a different thing from 'the file a moment ago', and restoring to it
silently discards the very change under test."_ **That sentence describes a fault committed by hand
on 2026-09-06, an hour after the rule was quoted between two chats; the same session then truncated
a fixture to two lines and the control still went red.** Asserting the fixture survived is the
fallback for anything the harness cannot drive — the harness is the primary, because **structural
immunity beats a rule four tired sessions each broke once in one night.** Full reasoning, and why
_"restored, hash matches"_ cannot clear a control: `docs/ward-flow/publication-runbook.md`.

---

## 3. Subagent-driven development — the working method for all three

Each chat is a **controller**. It plans, decides and reviews; it dispatches subagents to do the
reading and the typing. This is not delegation for its own sake: a controller that does the typing
itself burns the context it needs for the deciding, and by the end of a long task it is the worst
reader in the room.

### The shape of a dispatch

Every subagent brief names, before it is sent:

1. **The exact files** it may read and change — copied from the chat's own owned paths, never wider.
2. **The exact symbols** it is adding or changing.
3. **The ordered steps.**
4. **The check that proves it worked**, by name, and what a failure of that check looks like.
5. The closing clause, verbatim: _"If you reach a decision this brief does not cover, stop and hand
   it back."_

A brief that cannot name all five is not ready to send. Sharpen it, or do the task yourself.

### Which model each subagent gets

State the tier in every dispatch summary, so a cheap result is never mistaken for a vetted one.

- **Opus** — anything clinical, anything privacy-touching, anything patient-facing; the last agent
  before a commit nobody else reads; any task whose success is a _judgement_ rather than a state;
  writing a spec, plan or decision record; debugging a cause you do not yet know; **and the first
  task of any new shape**, because it sets the pattern every later instance copies.
- **Sonnet** — only when you can name the catcher: a specific test, type error, build failure or
  visibly broken screen that will tell you it came back wrong. **An unnamed catcher is not a
  catcher.** "A careful reader would notice" means Opus.
- Later instances of a shape Opus has already established are Sonnet.
- Two rejected reviews escalate the third attempt to Opus.

**Read-only does not mean cheap.** _Listing, counting, locating_ is Sonnet. _Is this consistent,
would this bite, is this claim true_ is Opus. Both read files; only one of them is cheap.

Prefer Sonnet drafting with Opus reviewing over one expensive pass. When budget is tight, cut the
drafting tier, never the reviewing tier.

### Reviewing what comes back

⚠️ **Do not accept a subagent's report as the result.** Two rules, both learned here the hard way:

- **Check the claim, not the colour.** A subagent reporting "all tests pass" has told you about a
  process exit code. Ask what the screen shows, or what the value actually is.
- **Believe the subagent that contradicts you.** When a subagent's number disagrees with yours, it
  is more often right than you are, because it just measured and you are remembering.

---

## 4. Testing: run the smallest check that could actually fail

The full ward suite is 120 files and about 110 seconds. Running it out of habit is not rigour, it is
just slow, and the owner has asked twice for it to stop. Full policy is in this folder's `README.md`
("Which check to run, and what it costs"). The short form:

- One module changed → that module's own test file. About four seconds.
- One screen changed → that screen's own DOM test. Nothing else.
- A shared model or derivation changed → the whole ward suite, **once**, immediately before the
  commit. These are the only changes that earn it.
- Wording or a comment changed → the test that pins the wording, or nothing.
- Typecheck when the change can affect a type contract — a new field, a changed signature, a widened
  union — and not otherwise.

**Never re-run a suite that already passed on unchanged content.** Report a reused result as a reused
result, never as a fresh run.

---

## 5. The plan, in the order it is to be built

Measured against the code on the master line at `da3fd8f60`, not recalled from a document.

| #     | Work                                                                                                                                                                                                                                                                                                            | Who                                                         | Why it is in this position                                                                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Recording that a patient has left.** There are 36 actions in the app and **none of them discharges anybody**; the only person who has ever left a bed is one written into the starting data. Verified: `RECORD_LEAVING` appears zero times in `src`, and the sole writer of `state: "left"` is the seed file. | **Ward Lead** — it is in `ward-management`, which Lead owns | Patients arrive and stay forever, so the discharge half of the project's own argument has never been seen working. It is the only gap between the current build and the owner's definition of done. |
| **2** | **A web address for the community hub**, so the screen can be opened at all.                                                                                                                                                                                                                                    | **Ward Builder** — assignment `WF-BUILD-001`                | The screen exists and renders; there is no URL that reaches it. Outside Lead's paths, so it costs nothing to run in parallel.                                                                       |
| **3** | **Decide the work committed since `89d7f99ec`** — the transition receipts, the recovery bundle, the source inventory, the community team rule and the re-anchor fix.                                                                                                                                            | **Ward Verifier** — criterion `WF-VERIFY-20260901-001`      | None of it has been independently checked, and the party that built it also wrote its tests.                                                                                                        |
| **4** | **`Admission.followUp`: wire it up or take it out.** Nothing writes it and no screen reads it.                                                                                                                                                                                                                  | Ward Lead                                                   | A field with no producer passes every gate and renders as a legitimate empty state — it looks finished and does nothing.                                                                            |
| **5** | **Run the six ward walkthrough tests**, which as far as anyone can tell have never been run against current code.                                                                                                                                                                                               | Ward Lead                                                   | They are the only check that would catch a screen that has quietly stopped working.                                                                                                                 |

**Held for the owner, and not to be decided by any chat:** two independent clinician checks of the
bed-release model; confirmation of the six urgency reasons (they went in on a chat's own
recommendation, which is the weakest kind of decision); and the free-text override-reason box, which
has been answered two different ways and is still shipping as it was.

---

## 6. Four things none of the three may do

1. **Push, open a pull request, or reach any provider** — no GitHub, no Supabase, no OpenAI. Ward
   Flow is local-only and unpushed, on one disk. Ask the owner; never infer permission.
2. **Delete or move a worktree, a handover, a decision document, or either ward branch.** A hook
   blocks it mechanically. If the hook fires, that is a stop, not a retry.
3. **`git add -A`, or a bare `git stash`.** Both silently take another chat's in-flight work.
4. **Invent a clinical number, a bed count, a team name or a reason code.** One place per fact, and
   that place says when it is unresolved. A plausible invented value is indistinguishable from a
   decided one a week later, and that is how a placeholder becomes a requirement.

---

## 7. Commit as you go

The only work this project can lose is work that was never committed, and the thing that loses it is
**interruption, not carelessness** — the moment a task feels finished and attention moves elsewhere.

Commit each coherent unit as it becomes coherent. If a check is blocked, commit anyway and record
the check as unrun: an unverified commit is recoverable, an unwritten one is not. Before turning from
your own work to anything else — answering another chat, waiting on a lock, reporting to the owner —
either commit what you have, or say in your next message exactly what is uncommitted and why.

---

## 8. Speed-ups adopted 2026-09-01, at the owner's instruction

The owner's instruction was to iterate faster and loosen a plan that had become restrictive.
These are the changes. Each says what it costs, because a rule removed without naming its cost
comes back as a surprise rather than a decision.

**1. Builder does not block on a merge.** It commits, sends Ward Lead the SHA, and starts the next
unit immediately. Ward Lead merges on its own clock. _Cost:_ two units can be in flight against one
unmerged base. Acceptable because Builder's scope is one folder, so a conflict is confined to it —
and Ward Lead, never Builder, resolves whatever conflicts.

**2. Builder gets a standing scope, not an assignment per file.** Inside one owned path it may add,
wire and fix whatever that area needs, without a new assignment record. A fresh assignment is needed
only when the OWNED PATH itself changes. _Cost:_ less written-down intent per unit of work. Held in
check by the two limits that do not move: the moment the work needs a path outside the scope it
stops and hands back, and it never invents a clinical value, team name, bed count or reason code.

**3. Read-only subagent briefs need three points, not five.** Exact sources, exact output, and the
hand-back clause. The five-point brief stands for any subagent that WRITES. _Reason:_ a read-only
agent cannot damage the tree, and the controller's own inspection of the returned evidence is the
check — so naming a separate proving check was ceremony.

**4. Report findings as they are reached, not batched into one report.** A finding heard now can
change what another chat is doing; the same finding an hour later cannot.

**5. A per-worktree TypeScript cache, because the shared one thrashes.** `node_modules` in every
worktree here is a junction to the one shared `D:/Repos/Database/node_modules`, so every checkout
writes the same `node_modules/.cache/tsc/` buildinfo and none of them benefits from it. Pass
`--tsBuildInfoFile` somewhere worktree-local and repeat runs drop to seconds. `scripts/run-heavy.mjs`
already does this internally; it is the repository's own answer, not a new invention.

### What was NOT loosened, and why these five are not ceremony

The Verifier argued this better than I did, and it is right: these are the entire reason a verdict
from it is worth more than a second opinion from the party that built the thing.

1. **The Verifier's checkout stays frozen**, and it enters no other chat's worktree for any reason —
   not even a read, because `git status` can rewrite the index it touches.
2. **The Verifier writes no file anywhere**, including the defect it just found.
3. **One chat, one folder.**
4. **One merger — Ward Lead — and no exceptions.**
5. **No provider, and no invented clinical value.**

### A restarted session can look like a second occupant, and it is not one

⚠️ A chat whose session restarts comes back under a different display name while sitting in the same
folder on the same branch, and it will truthfully say it is not the role it in fact now holds —
because at that instant the role's name points at the older, dying session. That is exactly what a
forbidden two-chats-in-one-folder collision looks like from outside, and on 2026-09-01 it cost the
Verifier real time and nearly had it advise the master-line owner to vacate the master folder.

**The address a message arrives from is better evidence of identity than the name it carries.** Two
names arriving from one address is one session that was renamed, not two sessions.

### Anything said before a restart was not said

A chat that restarts loses every message sent to its old session. Both other chats' first messages to
Ward Lead were lost this way on 2026-09-01. **If it is not committed, it was not communicated** —
which is the same rule as section 7, arriving from the other direction.

---

## 9. Verification tiers — who checks a Builder's work, and when it is worth it

Proposed by Ward Builder on 2026-09-01 after it noticed the gap in its own first task, and adopted
by Ward Lead. **The gap: nobody but the Builder ever ran the Builder's acceptance criterion.** Lead
writes it, Builder runs it, Builder judges it. On WF-BUILD-001 the Builder chose the test ids, chose
what counted as passing, and graded itself. Self-verified to a high standard is not independently
verified, and a later reader collapses the two.

**Every assignment now names its tier in one field, `verificationTier`, beside `modelRouting.tier`.**

**INDEPENDENT — Ward Verifier runs the acceptance criterion and the Builder does not certify it:**

1. Anything clinical, privacy-touching or patient-facing. **No size threshold.**
2. Anything whose pass condition cannot be written as an exact expected value in advance — where
   success is a **judgement**. Authors grade their own judgements generously without noticing.
3. **The first task of any new shape**, because it sets the pattern every later instance copies.

**SELF-VERIFIED — everything else:** small, mechanical, falsifier written in advance, and the check
either passes or it does not.

### It reuses §3's test rather than inventing a second one

These are the same three triggers that route a subagent to Opus. That is deliberate and it is the
best part of the proposal: **Opus-for-the-vetoes implies Verifier-checked; Sonnet-eligible implies
self-checked.** One judgement at issue time, not two.

### Why this is FASTER, not slower

The implicit default before this was that work is either unchecked or fully checked and **nobody had
said which**. That ambiguity is what drives over-verifying out of caution — the exact habit the owner
has asked twice to stop. Naming the tier in the assignment removes the hesitation; it does not add a
step. The Builder still runs its own check in both tiers, which is what stops a red ever reaching
the Verifier.

### Two things this must never trade away

- **The falsifier is still written BEFORE the build, by Ward Lead, in both tiers.** Someone who has
  not seen the code names the ways it could be wrong, so it cannot be tuned to fit what was built.
  That is most of the value of independent review, obtained in advance at no round-trip cost, and it
  does not survive being written afterwards.
- **Unprompted disclosure must stay cheap.** WF-BUILD-001's unrun typecheck and the untested
  assumption behind a hook bypass were **volunteered, not caught**. Nothing in this section penalises
  a disclosure, and any process that makes one expensive is worse than what it replaced.

### The tiers must be able to move, in both directions

Ward Verifier found the flaw in §9 as first written — **the tier is decided once from a task's shape
and nothing ever changes it** — and proposed the escalation half unprompted, about a rule that
increases its own workload. Ward Builder proposed the decay half. Both are adopted, and whose is
whose is recorded because a rule with a known author is easier to revisit than one that appears
always to have existed.

- **ESCALATE.** If a self-verified unit is later found defective — by Ward Lead at merge, by the
  Verifier, or by the owner — the same Builder's next task **of that same shape** is INDEPENDENT,
  whatever the three triggers say. **One defect is enough.** The signal is not "this Builder is
  careless"; it is **"this shape was misclassified as self-verifiable"**, which is a fact about the
  classification rather than about the person.
- **DECAY BACK.** After **two** consecutive clean **independently-verified** units of that shape, it
  returns to self-verified. Two, to match §3's own two-strikes symmetry.

  ⚠️ **It counts INDEPENDENTLY-verified units, and the first wording of this clause did not — which
  made it dead on arrival.** A shape starts self-verified; a defect escalates it to independent; so
  once escalated, **no self-verified unit of that shape ever occurs again** and a counter of them can
  never reach one, let alone two. The release valve was welded shut, and it reproduced the exact
  ratchet it was written to prevent, one level down. Caught by Ward Builder against the committed
  text within minutes of it landing. **The corrected rule is also the better one on its merits: a
  shape earns its way back by passing the HARDER check twice, not the easier one.**

⚠️ **The decay half is not a courtesy — without it the rule can only ever tighten.** Every shape
eventually becomes independent, and §9 quietly turns into the over-verification habit the owner has
asked twice to stop. **A rule that can only ratchet is not a tier system, it is a delay with extra
steps.**

---

## 10. Four ward-verifier folders exist and one of them lies about its own pin

Measured 2026-09-01, on this machine. Found independently by Ward Verifier and Ward Builder, then
confirmed a third time by Ward Lead before being written down:

```
ward-verifier-89d7f99ec   folder claims 89d7f99ec   HEAD is 5620851bf   ** MISMATCH **
ward-verifier-9afb82c6e   folder claims 9afb82c6e   HEAD is 9afb82c6e   OK  <- the live Verifier
ward-verifier-9d2edecbf   folder claims 9d2edecbf   HEAD is 9d2edecbf   OK
ward-verifier-f91ef4b06   folder claims f91ef4b06   HEAD is f91ef4b06   OK
```

⚠️ **`ward-verifier-89d7f99ec` is the worst possible one to be wrong.** Its folder names the exact
SHA that `WF-VERIFY-20260901-001` uses as its range start, while its HEAD is something else entirely.
Anyone reaching for "the verifier checkout at `89d7f99ec`" gets different code **and the folder name
confirms they were right.**

**This is the third label-outlived-its-referent trap in one day** — after the branch whose name did
not describe the work it carried, and the session name that pointed at a dying chat while a live one
sat in the same folder. The lesson is the same every time and it is now a rule: **a name is a claim,
not a measurement. Read the pin, never the folder.**

**None of these are to be deleted.** A predecessor checkout may be somebody's evidence, and deletion
of a worktree is blocked by a hook for exactly that reason. §1's table names the one live Verifier
folder; this section exists so nobody assumes it is the only one on disk.

---

## 11. State the SHA a claim is about, inside the claim

**Ward Lead and Ward Builder made the same error in opposite directions inside twenty minutes on
2026-09-01, and neither was careless.** Lead reported "both amendments adopted exactly as proposed"
while Builder's correction to one of them was in flight. Builder reported a commit's contents as the
current state while Lead's fix to it was in flight. Both reports were true when written and false
when read.

**The shared cause is not weak checking. It is that a read and a report are separated by the time it
takes to write the message, and in a three-chat system that gap is routinely longer than the gap
between commits.** Three commits landed 2m44s and 1m07s apart that morning; a considered message
takes longer than either.

**So the fix is not "read more carefully" — it is to make every claim carry the state it describes:**

- **Name the SHA inside the claim.** "At `41cfe3927` the clause reads X" can never go stale. "The
  clause reads X" goes stale silently and reads as a claim about now.
- **Before concluding what HAS SHIPPED, compare the SHA you read against the current tip.** A file
  read is a measurement with a timestamp, not a fact about the branch.
- **This already applies to verdicts. It applies to reports too** — and a report is the more
  dangerous of the two, because nobody treats it as evidence and so nobody dates it.

⚠️ **And a correction is a claim like any other.** Ward Lead's correction of Builder here was itself
wrong: it inferred that Builder's read post-dated a commit from the fact that Builder's _message_
arrived after it. Message arrival is not read time. **Builder contested it with commit timestamps
and was right.** It contested a three-minute discrepancy specifically because a doubled count —
"the Builder repeatedly drew stale conclusions" — is one clean generalisation away from becoming a
rule, and **repetition is what makes a wrong lesson feel established.** That is the same mechanism
as a folder name confirming the mistake it caused (§10). Contesting it was correct.

## 12. A question a ruling has answered is struck through and answered beneath — never deleted

**Both obvious treatments of a resolved question are wrong, and one of them is invisibly wrong.**

Leave the question standing and **the next reader re-asks the owner something he has already ruled
on** — a decision record is read by people looking for what is still open, and an answered question
that still reads as open is an instruction to go and ask him again. Delete it and **nothing records
that the question was ever raised**, so a later reader cannot tell a settled question from one nobody
thought of, and the ruling loses the thing it was a ruling about.

**So: strike the question through, write the answer beneath it, and name the ruling and the commit.**
The record then says what was asked, that it is closed, and by what.

⚠️ **This is house style because three chats arrived at it independently on 2026-09-06, not because
it was reasoned out** — and a convention with converging instances behind it survives an argument
that a convention with only a rationale does not. **The three, stated precisely, because two of them
are the same act and the third is a generalisation of it:**

1. **Ward Builder Four**, `docs/ward-flow-phase-6-7-decisions.md` Q5 — _"Outstanding question for the
   owner: who decides a leave bed is usable, and on what basis?"_, answered by owner ruling 11 and
   struck through with the answer beneath (`d5a99965e`).
2. **Ward Builder Four**, the same commit — the `Leave (usable)` row of
   `docs/ward-flow/archive/dated-notes/capacity-figure-render-census-2026-09-06.md`, annotated rather than rewritten,
   because a census whose rows quietly track later changes stops being a record of what was measured.
3. **Ward Builder Two**, the `Midalnd` transposition typo in `docs/ward-flow-catchment-data.md` —
   ⚠️ **the same principle applied to a wrong VALUE rather than to an answered QUESTION**, and it is
   marked here as a generalisation rather than a third instance of the same act. **§11's own warning
   applies to this list: three instances make a lesson feel established, and inflating a count is
   how a wrong one gets there.**

   **The attribution is an observation, not a report** — upgraded 2026-09-06 after it was written
   here as hearsay. `0f6e38520` appears in exactly one branch reflog on this machine,
   `claude/ward-builder-two-modes`, with the action `commit:`, and in no other; see §13 for why that
   settles it and `docs/ward-flow/archive/dated-notes/commit-attribution-2026-09-06.md` for the capture. ⚠️ **That branch
   is now the sole evidence for this line. Delete it and this reverts to hearsay with nothing
   marking the change.**

**Before editing a shared decision record you do not own, prove it is byte-identical to the master
line first** — `git rev-parse <master>:<path>` against `git rev-parse HEAD:<path>`. That is the only
version of _"not my document"_ that means anything, and it is what makes the edit safe to make
without first asking whoever wrote it. **Say in the commit body that the file is shared and who
should know.**

⚠️ **One limit, from §11's neighbourhood and worth stating before somebody hits it.** A verdict
written into the artefact it is about is read by anyone later trying to re-derive that verdict
independently — so their second opinion is confirmation, not replication. **Where the ruling is one a
future check might need to reach on its own evidence, publish the finding elsewhere and leave a
pointer** (_"provenance assessed, see X"_), rather than the verdict itself. **For an owner ruling
there is nothing to re-derive** — he decided, and the record of his decision is the evidence — so the
strike-through belongs in the artefact. The distinction is whether the answer was _found_ or _given_.

## 13. Who wrote a commit is answerable, but only from this machine and only for now

⚠️ **Three sessions have independently concluded that no git command can tell which chat wrote a
Ward Flow commit. All three were wrong, and the reasoning that got them there was sound** — which is
why this section exists rather than being left to be worked out a fourth time.

**The two true premises everybody starts from:**

- **Author does not discriminate.** Every chat on this machine commits as `BigSimmo`, author and
  committer identical.
- **`git branch --contains` stops discriminating after the first fold.** It looks as though it works,
  because it does work right up until the commit is merged anywhere. `0f6e38520` now sits on five
  branches.

**The false conclusion drawn from them: that the repository has lost the information.** It has not.

🔴 **The per-branch reflog answers it, and `commit:` is the whole trick.** A branch that **created**
a commit logs the action `commit:`. A branch that **received** one logs `merge`, `pull`, `reset` or a
fast-forward. **So folding ADDS a distinguishing kind of evidence rather than destroying the
original** — which is the exact opposite of what `--contains` does, and why the intuition fails.

```bash
G=$(git rev-parse --git-common-dir); SHA=$(git rev-parse <ref>)
# walk $G/logs/refs/heads/**, split each line on the TAB, and take the file whose
# line has $SHA as the NEW sha and whose message begins "commit".
```

⚠️ **Do not match loosely on "the file contains the sha and contains the word commit"** — that also
matches a sha appearing as the _old_ value of any line, and returns right answers for the wrong
reason. And write it in Python rather than an `awk -F'	'` one-liner: a literal tab has silently
become the letter `t` passing through a tool layer on this machine, which then splits on nothing,
finds no message field, and reports that nothing was authored anywhere — **indistinguishable from a
real negative.**

### Four limits, and the third one falls on Ward Lead alone

1. **Local, and it never travels.** Reflogs are not in a clone and not in a push. This works on this
   machine and nowhere else. Ward Flow is never pushed, so **the reflogs are not a convenience here —
   they are the only record of authorship that exists.**
2. 🔴 **The real deadline is a tidy-up, not an expiry.** The documented expiry is 90 days (30
   unreachable), but **deleting a branch deletes its reflog**, and this machine has swept worktrees
   mid-session twice. A 90-day expiry is something you plan around; _"until somebody tidies up"_ is
   not. **Measured 2026-09-06: `logs/HEAD` names 28 checkout endpoints, 16 still resolve and 12 do
   not** — twelve branches whose authorship evidence has already gone. **No ward branch is deleted
   while its reflog is somebody's evidence.**
3. 🔴 **It is silent on merges, and that is not a rounding error.** A merge logs `merge <sha>:`, never
   `commit:`, **so this method attributes every builder's work and none of the folding — which is
   Ward Lead's whole contribution.** Any capture must say so beside the column rather than in a
   footnote: **an absent author reads as an unknown one rather than as a known gap.**
4. **It attributes a BRANCH, not a chat**, and a rebase or cherry-pick truthfully names where the new
   sha was made rather than where the work was done. The branch is a sound proxy only because the
   ownership registry maps branches to chats one-to-one. **It is still a proxy.**

**Because of limit 2 the answer was captured to a file rather than left as a command:**
`docs/ward-flow/archive/dated-notes/commit-attribution-2026-09-06.md` and its `.tsv`. **The reflog answers the question
today; it is not an archive.**
