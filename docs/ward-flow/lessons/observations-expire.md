---
name: observations-expire
description: "a measurement has a shelf life and a relayed figure arrives already believed; pin every number to the SHA it was taken at"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 4 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 4 index lines for one subject crowd out 3 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# observations-expire

> A true measurement has a shelf life nobody attaches to it — state every observation with its SHA or timestamp

**A measurement can be true when taken and false when read, and nothing in its wording says so.**
Five sessions produced four instances of this in one day (2026-08-29/30), each a correct observation
whose truth expired between measuring and acting:

- A fast-forward reported as "no conflict possible" that stopped being one **four minutes later**,
  when the other line committed.
- A worktree read as free from a lock table that was accurate when measured and stale when read —
  _a directory's state does not tell you a session's_.
- A background agent's output file read as empty and inferred wedged; it was buffering, and file
  mtimes showed writes thirty seconds old.
- A document state measured across every branch ("the fix is on one unmerged branch only") that
  became wrong within the hour when the fix was carried to the working line — and I argued from it
  after it had expired.

**Why:** none of these were sloppy. Each was measured properly and reported honestly. The defect is
that the _sentence_ carried no expiry, so a later reader — often me — could not tell whether it still
held.

**How to apply — the fix is one habit and it is cheap.** State the observation **with its SHA or its
timestamp**, so the reader can see for themselves whether it has expired:

- "clean **as of `f20b8087b` and `bdade7a2`**", never "clean"
- "dirty=0 **at 01:52**", never "free"
- "77 files / 1171 tests **on `f20b8087b`**", never "the suite passes"

**The hardest case, and it is the one that cost hours:** the expiry rule is hardest to apply to a
finding you are pleased with. I checked a peer's correction sceptically because it contradicted
something I had found, and did not check my own refutation at all — it agreed with me. See
[[check-the-conclusion-that-flatters-the-theme]].

**And the companion, learned the same day from the other direction:** scepticism pointed at the other
session is not the safeguard. The peer _did_ check me, adversarially, and it changed nothing — their
check was narrower than the question by one file. **Directing suspicion correctly does not repair a
broken instrument.** See [[checks-that-cannot-fail]].

**A corollary worth its own line: being behind does not make your own measurement stale.** A run on
your own commit stays true of that commit. What is unmeasured is the _merged_ tree, which it never
described. If "behind" means "stale", every result is stale nearly always and the word stops
selecting anything. The discriminating question is _has anything I measured been touched by what I am
behind_ — which is checkable.

**AND A SHA IS NOT ENOUGH ON ITS OWN: AN OBSERVATION CARRIES ITS BRANCH TOO** (2026-08-30, twice in
one night, once in each direction):

- A defect class reported **closed** after a grep on one branch. The fix lived only on the branch
  that made it, and the class was **wide open on the line every other session builds from**. The
  receiving session nearly took it and moved on.
- A banner reported as a **live defect** by two sessions when the branch owning that surface had
  **already fixed it**.

**Naming the branch is one word and it makes the claim self-correcting.** _"Measured at `<sha>` on
`<branch>`"_ — without it, the reader cannot tell a fix invisible from here from a fix that does not
exist.

**⚠️ THE INVERSION, and it looks like this rule applied correctly: A POINTER MUST NAME A BRANCH AND
NEVER A SHA.** An observation is a claim about a moment and pins a commit. A pointer is a way to
**find** something and has to survive the thing moving on. A handover was cited by SHA in a message
and the branch had moved before the recipient read it — minutes. The same pointer written as
`git show <branch>:<path>` still worked. **Do not "improve" a tracking pointer by pinning its commit.**

**A THIRD DIRECTION, learned the same night: OVERSTATING A LIMITATION IS NOT THE SAFE DIRECTION.** A
tool was described as _"stranded on a 260-commit branch"_ when it was three Node builtins with no
dependencies and one `git show` away from any worktree. **Caution has a cost and it is paid by
whoever needed the thing and did not get it.** It is the same error as an over-broad refusal or a
caveat so heavy nobody acts on the finding underneath it.

Related: [[measure-the-thing-not-a-proxy]], [[assert-only-about-code-you-opened]],
[[ward-flow-coordination-state]], [[checks-that-cannot-fail]].

## ⚠️ The opposite rule for POINTERS — they must NOT be pinned (2026-08-30)

This memory's rule applies to an **observation**. It is exactly wrong for a **pointer**, and the two
are easy to confuse because pinning looks like rigour in both cases.

|                                                              | Names                     | Why                                                                                       |
| ------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| An **observation** ("174 paths, 0 missing", "84 test files") | a SHA **and its branch**  | a count is only true somewhere; a SHA without its branch misled two sessions in one night |
| A **pointer** ("read the handover at X")                     | a **branch**, never a SHA | it has to keep working after the thing moves                                              |

**Proved the same evening.** A peer cited a handover at `9fed2e0ba`; the branch was at `01df4e7fc`
before I read the message — minutes. The durable pointer they had written into the session-start
registry named the _branch_ and still resolved. **Had it carried the SHA, as this memory's rule
appears to demand, it would have been wrong before it was first read.**

**So: never "improve" a branch-named pointer by pinning its commit.** It looks like applying the
observation rule correctly and it breaks the only thing the pointer is for.

**How to apply:** ask what the reference is _for_. Reporting what you saw → pin it (SHA + branch).
Telling someone where to look → name the moving reference and let it move.

## ⚠️ A rule and its story decay in opposite directions — and the story wins

2026-08-30. A browser pane showed two copies of a screen; the server shipped one. The correct rule
that came out of it is **"a duplicate-node finding is unproven until checked against server HTML"**.
The memorable story compresses to **"duplicates in that pane are fake"** — and the story is what
gets retold, so the rule decays into its own opposite while sounding like the same lesson.

**The rule survives only if it is written in the form the story cannot swallow.** Here that meant
ending with the case that keeps the check alive: _if a future duplicate survives the server check,
it is real._ A later reader meets that before they meet the anecdote.

**Generalises past this case.** Any lesson learned from a false positive is at risk of compressing
to "that class of finding is noise", which is precisely the sentence that stops the next real one
being investigated — the sibling of
[[a-correct-diagnosis-that-stops-the-inquiry]].

**How to apply:** when recording a lesson from something that turned out not to be real, write down
what would make the next one real. A rule with no route back to a true positive is an off switch.

## Stamp the unit as well as the SHA — two errors can cancel to the right answer

2026-08-31. A count pinned in a docblock was taken correctly and became wrong, twice over:

- **The record was counted BY the measurement.** The sentence “85 `initialNow=` call sites” itself
  contains `initialNow=`, so writing the number down made it 86. Any count of a token, pinned in a
  file the pattern would match, is self-referential — a doc listing TODO markers, a test asserting
  how many `@ts-expect-error`s exist, a checklist counting its own warning symbols.
- ⚠️ **Then the wrong unit on a later tree reproduced the original right number exactly.**
  `git grep -o` counts MATCHES, `-c` counts LINES CONTAINING a match, `-l` counts FILES — three
  plausible answers to “how many”. Measured: 109/107 at the original commit, 111/109 two commits
  later. **So re-checking the pinned 109 today with `-c` returns 109 and confirms it, while being
  wrong about BOTH the unit and the tree.** Structural, not freak: the tree drifts by one per
  commit mentioning the token and the units differ by a small constant, so they cross regularly.

⚠️ **AND THE SCOPE IS A THIRD AXIS.** 2026-08-31: a peer reported a repository-wide diffstat that
matched nothing I measured. It had been taken with `-- src tests` and reported as the whole tree —
correctly measured, wrongly labelled, in the very document carrying the stamp-every-count rule. Its
"identical for both branches" claim was then an artefact of that filter: identical under the scope,
different whole-tree. **A property of your chosen scope presented as a property of the thing.**
Neither of us could have found it from the numbers alone; it took measuring every way.

**How to apply:** stamp every count with the SHA it was taken on, the unit it was taken in, _and the
paths it was scoped to_.
The SHA kills the wrong-tree half; the unit kills the wrong-measure half; **either alone still
admits the cancelling pair.** And do not fix a self-counting figure by excluding its own file from
the pattern — that tunes the measurement so the record fits, and the measurement is not the thing
that should move.

⚠️ **Why it matters that the drift is ONE:** off by fifty gets investigated as a bug; off by one
gets attributed to sloppiness and quietly discredits a record that was exact. That is an argument
for stamping _every_ count, not only the self-referential ones.

**And the recording form that survives:** a finding recorded together with the thing that will
contradict it — a repair comment whose claim the line below it can falsify, with a test that fails
if it stops. A note with nothing beside it able to go red becomes folklore at the same rate as any
other comment.

Related: [[check-the-conclusion-that-flatters-the-theme]], [[measure-the-thing-not-a-proxy]],
[[verify-in-head-not-the-working-tree]].

## Byte-identity is a LIVE check on a copy — do not spend it on cosmetic compliance

2026-08-31. Thirty ward documents were copied from two branches onto the main line and verified by
hash. Twenty-five fail prettier. The tempting tidy-up is to format them.

⚠️ **Do not, and the good reason is not the obvious one.** My objection was "it rewrites documents
this session does not own" — true, and not the deciding one. A peer tested what prettier actually
does to them: asterisk-italics become underscore-italics, 236 changed lines in one file, no reflow,
nothing lost. So the damage argument is weak.

🔴 **The deciding reason is that the source documents are STILL BEING EDITED.** Byte-identity is the
check that answers _"is the copy on the main line current?"_ **Format one side and that check is
broken permanently** — the two differ by formatting forever, and no future sync can be verified by
hash again. **You would be trading a working verification for cosmetic compliance nothing currently
reads.** Ward Flow is never pushed, so the debt costs nothing today.

**How to apply:** before formatting, linting or normalising a COPY, ask what comparison currently
works because the two sides are identical. If a push ever makes it necessary, format BOTH sides in
one operation so identity survives — never one side to make a check pass.

## The unifying rule, after five instances in one session — 2026-09-02

A peer made four measurement errors in one night, each caught only because the number clashed with
something already read. It then made a fifth on a different axis: it ran the right command on the
right tree, got a real red, and **reported it as a fact about "the master line"** — which it had never
measured. Its own words: _"I wrote 'measured just now on the folded tree, not recalled'. True, and
the word FOLDED did the false work, because my tree was folded from an OLDER master."_

**It had a written rule against exactly that — state every observation with the SHA it was taken at —
and skipped it on the one report where it mattered.**

Its generalisation is better than the four separate lessons it replaces:

> ⚠️ **A MEASUREMENT IS NOT A FACT UNTIL ITS SUBJECT IS NAMED: the UNIT, the TREE, and the MOMENT.**

**The four unit errors were _what_ was counted. This was _where and when_. Every one is a measurement
of something ADJACENT to the claim, reported as a measurement OF the claim.** Five in one session
stops being bad luck and becomes the thing to design against.

**Practically: "1 failed at `<sha>`" costs four extra characters and would have been answered with
"you are behind" in one line. "The master line is red" cost an exchange and nearly caused an
unnecessary edit to somebody else's file.**

⚠️ **And the reasoning can be right while the fact is wrong.** Its argument — a standing red on a
shared branch trains everyone to stop reading reds — was correct, was the reason the entry had
already been deleted, and had nothing to do with whether the red still existed. **Keep the two apart
in the record; being right about the principle is not being right about the state.**

Siblings: [[measure-the-thing-not-a-proxy]], [[assert-only-about-code-you-opened]],
[[relayed-numbers-lose-attribution]].

⚠️ **AND IT IS NOT ONLY MEASUREMENTS — IT IS ANY STORED FACT THAT BECOMES WORDS ON A SCREEN.**
2026-09-04: a note of mine read _"a referral to an ED is a notification nobody declines"_. True when
written on 2026-08-29, contradicted in the repository on 2026-08-30 by the FD-18 correction, and
still reading as settled five days later. I wrote it into a clinical screen as _"nobody declines
it"_ — a promise the system cannot keep — and a verifier caught it against source.

**A note that was TRUE when written is the hardest kind to distrust, because nothing about it looks
wrong.** No hedge, no stale timestamp, no uncertainty to notice. So the trigger cannot be "does this
look doubtful"; it has to be structural: **anything stored that will end up as user-facing words
gets re-read against the code before it is written down for a user.**

## A CONCLUSION expires too — write it as a condition with a catcher (2026-09-04)

Everything above is about measurements going stale. **A decision does the same, and faster than you
expect.**

**Ward Flow.** I was asked whether two screens could share a component. The answer turned on whether a
second role would ever get its own screen. **I answered "yes, share it — under today's answer", named
the exact condition that would reverse it, and shipped a test asserting that condition was still
false.**

⚠️ **The owner reversed it WITHIN THE HOUR.** The reversal cost one revision instead of a
rediscovery, and the lead could act in one step rather than re-deriving why the question mattered.

> **When a conclusion rests on a premise somebody could change, do not report the conclusion. Report
> the conclusion, the premise, and a test that fails when the premise moves.**

**Three things that made the revision cheap, all worth repeating:**

- **The condition was named precisely** — not "if things change" but _"if a community-scoped
  projection appears or a community screen enters the ward-facing list"_.
- **The test INVERTED rather than being deleted.** It had asserted an absence; the absence was filled,
  so it now asserts the new thing exists and carries no forbidden field. ⚠️ **A guard removed because
  reality changed leaves nothing behind.**
- **The superseded reasoning was kept in a collapsed block, not overwritten.** A document that
  silently rewrites its own conclusion hides that the conclusion was ever different — and the _reason
  it changed_ is the part a later reader needs.

**And the corollary:** having answered, ask what would make the answer change — then check whether
that condition is **already partly true**. Here it was two-thirds true before anyone ruled: the role
existed, no rule covered it, and the guard did not mention it.

## And they are also LOCAL — the same measurement, at the same instant, differs by branch

2026-09-04. Two of us counted `--ward-border:` declarations across the same repository within
minutes of each other. I got five files, six declarations. Ward Lead got three files, four
declarations. **Neither count was wrong.** The two extra were `search` and `statistics`, which had
been adopted on my branch and not yet folded into the integration line.

⚠️ **A SHA is not only a timestamp, it is an IDENTITY** — and in a repository with many live
worktrees, the branch is the larger source of disagreement, not the clock. Two agents can measure
carefully, agree on method, disagree on the number, and both be right, and the only way anyone
notices is if one of them re-measures and finds the difference is exactly the other's unmerged work.

**So state the ref, not just the date, on any count you send to another session** — "five files,
measured on `claude/ward-builder-two` at `591e85d8c`" — and when a peer's count disagrees with
yours, check whether the delta is their branch before treating either as an error. The correction
that goes out afterwards is not "the number was wrong" but "here is the number on each line",
which is the only form that stays true for both readers.

Related: [[relayed-numbers-lose-attribution]], [[establish-the-unit-before-counting]],
[[assert-only-about-code-you-opened]].

## ⚠️ VOID IS NOT STALE: a measurement taken before a sync you performed yourself. 2026-09-04.

Ward Flow. I measured "0 of 20 movements carry `referralId`" early in a session. Later I
fast-forwarded my branch 63 commits — deliberately, and I reported the fast-forward at the time.
Hours after that I quoted **0 of 20** to a colleague as a current fact, in a message correcting a
claim of theirs about the model.

**It was 2 of 20 on my own tree at the moment I sent it.** The seeding was already in the commit I
had fast-forwarded to. The colleague generously framed it as a measurement that had aged out; it had
not. **It was already false when I wrote it.**

> **The failure is not ageing. It is reusing a number across a change you made yourself.**

An expired observation has an innocent cause — the world moved while you were looking elsewhere.
This one had me moving the world, in one deliberate command, and then quoting my own notes.

⚠️ **AND A REF STAMP WOULD NOT HAVE SAVED IT.** I would have stamped it with the ref I was on when I
QUOTED it, not the ref I was on when I TOOK it, and nothing in the message would have looked wrong.
Traceable and still false.

**How to apply: any measurement taken before a sync, merge, fast-forward or checkout is VOID, not
stale — re-take it, do not re-stamp it.** The moment you move your own tree, every number you are
holding is unsourced. Keep the list of what you have measured, and treat the sync as invalidating
all of it.

⚠️ **And note where it happened: inside a correcting message.** Having just established that somebody
else was too broad, I reached for the number I already had instead of the one I could get in one
command. Same condition as [[establish-the-unit-before-counting]]'s finding — the correcting message
is written in a hurry and with confidence, which is the worst pair for choosing evidence.

## 🔴 A ref stamp is NOT sufficient. A measurement taken before a sync is VOID, not stale.

2026-09-04. A chat measured "0 of 20 movements carry a `referralId`" on its own tree, then
**fast-forwarded 63 commits** — deliberately, its own action, reported at the time — and hours later
quoted the old number as current fact. The true figure on the tree it was standing on was 2 of 20,
and had been since before it wrote the sentence.

⚠️ **The failure was not ageing.** An expired observation has an innocent cause: the world moved
while you were looking elsewhere. This one had the measurer moving the world and then quoting their
own notes. **A sync, merge, rebase or fast-forward voids every measurement you are holding** — all
of them, silently, including ones about files you did not touch.

⚠️ **And "state the ref" would not have caught it.** The stamp would have carried the ref they were
on when they QUOTED the number, not the one they were on when they TOOK it — traceable, plausible,
and still wrong. Nothing in the message would have looked odd.

**So the operational rule is narrower and more checkable than stating a ref: after any sync, RE-TAKE
every number you are still carrying. Do not re-stamp them.**

⚠️ **And the condition it happened in is the one to watch for:** it was inside a message CORRECTING
somebody else. _"The adrenaline of being right is exactly when you reach for the number you already
have rather than the number you can get."_ See [[deferring-to-a-correction-looks-like-humility]] for
the mirror image — the same moment, from the other side.

### ⚠️ The mirror: both sides of a correction are biased, in opposite directions

Ward Lead's addition, same session, and it completes the picture:

> **The corrector reaches for the number they already have. The corrected reaches for deference.**

**Neither is visible from inside, and both LOOK like the right behaviour** — one reads as confidence,
the other as humility. I was on the wrong side of the first; a colleague had been on the wrong side
of the second four hours earlier, accepting an unmeasured correction that turned out to be wrong.

**The only external tell: a correction settled in ONE exchange with no measurement taken by either
party is the shape where both biases were satisfied at once.** Re-measure when you correct, and
re-measure when you accept a correction — the second feels unnecessary, which is exactly why it is
the one that gets skipped.

### And the fix is not "state the ref" — it is "say how to OPEN the artefact"

2026-09-04, third instance in one night. A Playwright spec I wrote existed on my branch alone. Five
sessions reasoned from its result all evening and **not one of them could open it**, because I kept
reporting the OUTCOME in messages and never said where the test lived. Its scope was only recovered
when somebody thought to run `git show <branch>:<path>`.

⚠️ **A result travels as a sentence while the artefact that produced it stays put — and only the
artefact can be interrogated.** My spec measured a case its own header proved was unreachable by the
thing being asked about; it was a good answer to a question nobody had asked, and it survived three
rounds of discussion because it could not be read.

**So: when you report a measurement produced by something on a branch, put the `git show
<branch>:<path>` in the same breath.** Stating a SHA proves when; naming the artefact lets the
reader disagree with you.

## 2026-09-04: a 37-minute shelf life, and a confirmation nobody could audit

Reviewing four live branches, I reported that a print fix existed on one branch and not the master
line, so a fold would lose it. MEASURED and true at the tip I read. **The master line moved 37
minutes later and the blob became identical.** Shortest expiry yet, and a property of reviewing
moving branches rather than a lapse.

⚠️ **The near-miss underneath it is the part to keep.** The colleague checking my claim first used a
WIDER grep on the master line than on their own branch — a not-like-for-like comparison that would
have _confirmed_ my finding. They caught it because the patterns differed, not because the answer
looked wrong. **A confirmation is exactly when nobody re-reads the method**, and since it was my
finding being confirmed, neither of us was positioned to check it. The error was invisible from both
ends at once.

**How to apply:** stamp every cross-branch claim with the tip SHA _and_ re-read the tip before anyone
acts on it. And when a check confirms someone else's finding, audit the method harder than when it
refutes it — agreement is where method review stops.

## The number aged between the measurement and the message — 2026-09-06

I reported two uses of a token at lines 672 and 972. A peer corrected me: **one.** Line 972 had been
inside a 300-line duplicated block they deleted, and my measurement predated the deletion by
minutes. **True when made, stale when sent** — and I had stated it flatly, with a line number, which
is the form that reads as freshly checked.

⚠️ **This happened three times in one night on one line of work**, and never because anyone
measured badly. Five sessions were committing to a fast-moving branch; **any figure crossing between
sessions is describing a tree that has already moved.**

**How to apply: pin every relayed measurement to the SHA it was taken at, in the message, not just
in your own notes.** _"Two uses at 793361ac1"_ would have let the reader correct it themselves
instead of having to catch me. And ⚠️ **when a number is about to be written into a durable
record, re-measure at the tip first** — the register in question was about to be corrected against
my stale figure.

**The corollary that cost more here:** a stale number and a wrong number are indistinguishable to
the reader, so **being right when you measured buys you nothing at the point of use.** Related:
[[relayed-numbers-lose-attribution]], [[a-measurement-is-scoped-to-what-it-measured]],
[[ledger-rows-lag-reality]].

---

# relayed-numbers-lose-attribution

> A figure passed between sessions arrives already believed, because the relay strips the name that would prompt a check

On 2026-08-30 I reported "roughly eighty-five call sites across thirty-five files". One hop later a
peer had passed it on in its own voice, without my name and without the word "roughly"; a third
session filed it as settled and had to measure independently. Measured: 85 call sites (right) in 38
files (wrong).

The peer's own error had the same shape and it named it precisely: it verified the diagnosis — the
part that would have been embarrassing to get wrong — and passed through the number travelling beside
it. **A verified diagnosis lends its credibility to every figure attached to it.**

**Why:** an unverified number is not dangerous because it is unverified; plenty get checked. It is
dangerous because the relay erases attribution, and attribution is the thing that prompts the check.
An undercount of exposure also argues for less urgency than the truth supports — the direction that
gets a fix deferred.

**How to apply:** measure a second-hand number before acting on it, especially in the direction that
could make it worse. State your own figures as measured or estimated, and never let "roughly" be the
only thing marking an estimate — it is the first word a relay drops. Prefer an identity (a hash, a
compile error, a type) over a count whenever one exists. Related: [[measure-the-thing-not-a-proxy]],
[[false-attribution-manufactures-corroboration]], [[observations-expire]],
[[assert-only-about-code-you-opened]].

## An INSTRUCTION relayed is worse than a figure relayed, because acting on it creates the defect

2026-09-04. A peer told me a shared token `--ward-tap` now existed at `ward-tokens.module.css:94`
and to switch twelve sites onto `var(--ward-tap)`. I grepped before acting:

    src/ on my branch            no match
    the integration line          no match
    (later, by the peer)          present on ONE unmerged branch only

They had been told it by a third session, relayed it as a fact about the shared line, and **quoted
a line number they had never opened.** All twelve sites were tap-target `min-height` with no
fallback, so following the instruction would have made the minimum touch target on four screens
silently zero — no error, no warning, no failing test.

⚠️ **A WRONG NUMBER MISINFORMS; A WRONG INSTRUCTION MANUFACTURES THE DEFECT.** The cost is not
symmetric, so the checking threshold should not be either. **Before acting on any relayed "X now
exists / X has landed / use X instead", grep for X.** It costs one command and it is the only step
that distinguishes a real hoist from an unmerged one.

⚠️ **AND IT WAS RE-ISSUED AFTER I DISPROVED IT, because our messages crossed.** A second
confirmation is not corroboration when the sender has not yet read your refutation — it is the same
claim arriving twice. Do not treat repetition as evidence; re-measure, and reply with the ref.

**Ask for the SHA, not for reassurance.** "Tell me the commit that declares it and I will repoint
everything in five minutes" is a request a correct claim can satisfy instantly and an incorrect one
cannot satisfy at all — and it accuses nobody, which matters when the peer is right most of the
time and simply relaying.

Related: [[observations-expire]] (the same fact differs by BRANCH, not only by date),
[[a-relayed-approval-is-not-an-approval]], [[assert-only-about-code-you-opened]].

## A `file:line` is the least-audited claim there is, 2026-09-05

A reviewer reported that a sentence was pinned by `tests/ward-community-index.test.ts:216`, so
correcting it would move a deliberate test. The builder relayed that to me; I built a ruling on it.
**Checked at the point of action, the line pinned the two clauses ADJACENT to the one described, and
the sentence at issue was pinned by nothing at all** — zero hits across the whole test tree. The fix
was free and we had both priced it as expensive.

> **A precise-looking citation reads as a measurement, and checking it feels redundant.**

That is worse than a vague claim, which at least invites a check. And note WHEN it was caught: **at
the point of action and nowhere earlier.** Anything relayed onward but never acted on stays
unchecked indefinitely — which, across five sessions passing citations all day, is most of them.

**The rule: open a relayed `file:line` before you REPEAT it, not before you use it.** Repeating is
what gives it a second witness; using it is what eventually exposes it. The order is backwards by
default.

⚠️ **The same-day sibling, and the count is what makes it dangerous.** `grep -c` for a field on a
screen returned **2**, read as "the screen handles it" — both matches were mentions inside a doc
comment listing field names; the screen reads the field nowhere in code. **Zero would have prompted a
check; two closed the question.** A small non-zero count is the most effective way to stop somebody
looking. See [[a-mention-is-not-an-assertion]] and [[measure-the-thing-not-a-proxy]].

---

# a-finding-asserted-past-its-base

> I ran a suite on my own tree, correctly, then asserted the red about the master line eight commits ahead — and escalated it as urgent

I reported to Ward Lead that their line carried a second, undocumented red and that the
"one deliberate red" filter had been broken for an hour. It needed an owner tonight. I offered to
take the file.

**It had been fixed and folded before I reported it.** The guard was present on master
(`open.length === 0`, 2 matches) and absent from my base (0). The fix was inside the exact SHA I
quoted while saying "live on your line". Ward Builder One had to spend a measurement disproving me,
and had itself been handed a stale report about the same defect hours earlier.

**The measurement was sound. The sentence was written wider than the evidence** — a red observed on
MY tree, asserted about a tree eight commits ahead. **I printed `behind: 8` in the same command that
produced the finding and did not draw the conclusion from it.**

**Why:** a test run answers a question about the working tree it ran in, and nothing in its output
names that tree. The scope has to be re-attached by hand, and it is easiest to drop at exactly the
moment the finding feels urgent.

**How to apply:** before reporting any red as being on the shared line, check the file the test
names — `git cat-file blob <master>:<path>` — not just the test result. And **escalation raises the
bar rather than lowering it**: a confident stale report costs more than a quiet wrong one because it
moves people. Copy Ward Builder One's form — lead with "measured, not recalled", give the tip you
ran at and the named files, so the reader can disprove you in one command. See
[[a-measurement-is-scoped-to-what-it-measured]], [[observations-expire]],
[[a-stale-guard-answers-honestly]], [[relayed-numbers-lose-attribution]].

---

# a-progress-note-in-the-result-slot

> An agent that stops while waiting on its own children returns a status update where a deliverable should be, and it reads as one

2026-09-04. I dispatched a census. The completion notification arrived and the result read:

> _"I've dispatched four parallel agents… I'll assemble the full census once all four return.
> Waiting for their completion now."_

**That is a progress note occupying the result slot.** The agent had stopped, had no live children,
and nothing further was ever going to arrive. Skim it and it reads as work in hand.

**The tell is grammatical: it describes what it WILL do, not what it FOUND.** Future tense in a
deliverable is the signal — "I'll assemble", "waiting for", "once they return". A finished census
says how many rows it has.

⚠️ **And the danger is the same direction as every other failure that day: a census with unstated
coverage reads as complete.** Four files read directly, thirty-nine delegated to agents that may
never have reported — and nothing in the text says which. A precedent in this repo: a sweep covered
92 of 138 files and its short summary hid it; the figure surfaced only because somebody asked.

**How to apply:**

- **Demand the denominator as the FIRST LINE of any sweep result**, not in a closing caveat:
  examined directly / covered by a child that returned / not covered at all, with the last named.
- **Four rows with honest coverage beats forty with unknown coverage.** Say so in the brief.
- **Forbid gap-filling by inference explicitly.** An unexamined file recorded as "nothing found" is
  a false negative that will be trusted and never re-derived.
- When resuming such an agent, tell it not to re-dispatch and not to wait — **deliver what exists**.
- Nesting is where this comes from: an agent that dispatches its own children can stop between their
  completion and its own assembly step, and that gap is invisible from outside.

Related: [[caveat-only-in-the-report]], [[compliance-without-coverage]],
[[a-conveniently-shaped-control]], [[two-task-lists-one-check]],
[[a-humble-conclusion-is-under-audited]].

---

## A sound run on a stale base — the failure with no tell in its own output

2026-09-06, Ward Flow. A peer reported one remaining test failure and framed it as a design question
for the owner. **The run was complete, internally consistent, and reconciled exactly: 1 failed + 6
passed = 7, against a file declaring 7.** They had checked it three ways.

⚠️ **Their branch was 56 commits behind. The test they were describing had been re-pointed at a
different screen hours earlier and had been green ever since.**

🔴 **Every check they ran asked whether the RUN was sound. Not one asked whether the CODE was
current.** Their own words: _"a complete, internally consistent, correctly-reconciling run on a stale
base is byte-for-byte indistinguishable from the same run on current code."_

**Compare the two failure modes — the difference is where the evidence lives:**

```
killed run        summary printed, 8+5+23 = 36 against a suite of 74
                  -> THE TELL IS IN THE OUTPUT. Read it harder and you find it.

stale base        summary printed, every total reconciles, failures named
                  -> NO TELL EXISTS IN THE OUTPUT. Reading it harder finds nothing.
                     Only the base says so, and the base is not in the report.
```

**How to apply — a fourth check beside the arithmetic:**

> **Before quoting any run, state the base and its distance from master.**
> `git rev-list --count <base>..master` — and put the number in the report, not just in your head.

- **A number without a base is not a measurement**, it is a measurement-shaped sentence. This is the
  same discipline as dating an observation, applied to the code rather than to the clock.
- ⚠️ **It generalises backwards.** The peer immediately noticed their whole census that morning had
  been measured on a base they never recorded — not necessarily wrong, but now uncheckable. **A
  figure whose base was never written down cannot be revalidated later, only re-measured.**
- **Fast-forward before re-running**, and verify it IS a fast-forward: `56 behind · 0 ahead` means no
  conflict is possible; any "ahead" count makes it a merge with a real resolution.

Related: [[a-summary-line-over-a-broken-run]], [[a-measurement-is-scoped-to-what-it-measured]],
[[compare-against-merge-head-not-the-branch-name]], [[a-merge-of-a-branch-name-is-a-claim-about-a-moving-target]],
[[hand-picked-test-subsets-ship-red]].

## 2026-09-07 — FOUR HOPS, ONE ARTEFACT, NOBODY OPENED IT

The sharpest instance yet, and it is about relay rather than about age.

A subagent reported a test failure. **Ward Builder Two relayed the test name and the failing line
item from that subagent's SUMMARY, without reading its output.** I relayed it onward to Ward Lead.
Ward Lead escalated it to the owner as _"the most consequential unowned thing on the board"_ and as
_"every mutation proof tonight may be void."_ Builder Two and I then each constructed a MECHANISM for
it — two different mechanisms, both confident, both wrong.

🔴 **Four hops. Each added confidence and none added a caveat. Not one of us had opened the log.**

When Builder Two finally found it, one line settled everything: `exit 1, expected 4` — the harness
had returned SURVIVED where it should have returned INDETERMINATE. **My mechanism (a dying
subprocess) was refuted by the same line that confirmed the defect was real**, and the severity was
backwards: the observed failure condemns a good guard rather than blessing a weak one.

⚠️ **A subagent's summary is a claim ABOUT output, not the output.** It is the same shape as a
summary line over a broken run, one level up — and it travels further, because a summary is written
to be quotable and an artefact is not.

**How to apply:**

1. **Before relaying a finding you did not observe, say so in the relay** — "reported, not read by
   me" — and keep saying it at every hop. The caveat is the first thing lost and the only thing that
   would have stopped this.
2. **Before building a mechanism on a relayed observation, get the artefact.** A mechanism is a much
   stronger claim than the observation it explains, and it is the point where an unread artefact
   becomes an unfalsifiable story.
3. ⚠️ **Escalation is where this compounds.** Confidence rises with each hop because each relayer is
   summarising a summary, and the receiving party reasonably reads a two-chat agreement as
   corroboration. **It is not: it is one observation with two authors.** See
   [[right-conclusion-wrong-evidence]] — agreement is where nobody checks the reasoning.
4. **The fix that worked was somebody saying "I had not read this either", unprompted.** That is what
   sent both of us to the log. Say it first.

## 2026-09-10 — a fix leaves NO TRACE in the thing it fixed

I measured a broken tooling state, broadcast it to six chats, and re-measured an hour later to find it
healthy. I concluded my warning had been **stale**. It had not: another chat escalated it to the owner,
he authorised a repair, and it was repaired — **I measured the result of my own warning working and
filed it as evidence the warning had been wrong.**

🔴 **The two readings produce OPPOSITE lessons from identical facts:**

    "my warning was stale"                  -> distrust the broadcast
    "my warning was true, somebody fixed it" -> the broadcast did its job

**I filed the one that would make the next person hesitate to raise a warning.** That is `no longer`
compressing to `never` in a single step, applied to my own escalation.

> **A HEALTHY DIRECTORY IS IDENTICAL WHETHER IT WAS NEVER BROKEN OR REPAIRED TEN MINUTES AGO.** The
> repair was announced in chat and in a report; the artefact says nothing. **When you re-measure a
> condition you broadcast, check whether anyone ACTED on it before concluding it was never real.**

⚠️ **And filing a TRUE lesson against a FALSE case destroys the lesson.** "An observation has a shelf
life, and independent confirmation of a transient state confirms the reading rather than the shelf
life" is sound — but this episode is not its example, and anyone checking the case would have thrown
out the rule with it. **Check that the case actually instantiates the lesson before filing it there.**

⚠️ **Third level of the same defect in one day:** the symptom (`.bin` empty) covered THREE states —
never installed, broken bookkeeping (packages present, shims absent: `npm rebuild`), and
`node_modules` present but EMPTY (`npm ci`, because rebuild has nothing to rebuild). **I broadcast one
repair as though it fitted all of them.** One signal, several states, different actions.

---

## I did it to a peer, in writing, and it changed what they were willing to start (2026-09-18)

I told another session **"ward-lead is being actively rewritten right now, 31 files mid-edit"** and
advised against starting work in those files. It was true when written. The peer measured mtimes
seven hours later: newest write 10:10, clock 17:04. 🔴 **"Is it moving" is the most perishable
observation there is, and I had published it as a standing condition and then acted on my own
sentence for hours.**

⚠️ **The cost was not a wrong fact, it was a wrong DECISION held open.** Thirty-five files sat
uncommitted — by this repository's own rule, the only work this machine can lose — because I was
still obeying an expired reading of my own. The peer, correctly, would not be a second committer in
my folder, so nobody could act.

✅ **The rule that would have caught it:** a "someone is writing / the lock is held / the job is
running" claim needs a timestamp IN the sentence, and a re-measurement before anyone acts on it
again. `stat -c '%y %n'` over `git status --porcelain` takes one call.

✅ **And when the reason for a refusal expires, the refusal does not automatically flip.** The
original reason was that a mid-write snapshot had already produced a malformed
`screen-verification.json`. Quiet is not intact, so before snapshotting: JSON parses, the
control-character gate clean over the tree, typecheck 0 — THEN commit, then back up. See
[[a-deferral-whose-reason-expires]] and [[a-clean-worktree-is-not-an-empty-one]].

---

## One mechanism, three severities — and the third caught me mid-operation (2026-09-19)

Two sessions, four times in one night, each filed separately before we noticed it was one thing.

1. **A reading of SOMEONE ELSE'S state goes stale.** The mtime survey saying a tool was "actively
   writing", still being obeyed seven hours later. A peer's dirty-file list, three commits old, that
   nearly authorised a destructive revert.
2. 🔴 **A reading of a state YOU changed goes stale.** I told Josh twice that ten type errors sat in
   "unsaved work" — true when written, and then **I committed those files myself** and kept the old
   framing. Strictly worse than (1): there is no external cause to notice, because the invalidating
   event was my own hand.
3. 🔴 **A BASELINE EXPIRES BETWEEN CAPTURE AND COMPARISON.** I captured a typecheck error set before
   a merge specifically to measure the merge. Afterwards it showed 2 new and 4 gone — reading as a
   merge that changed something. **All six were in a file the merge never touched**, which another
   process had edited one minute before the comparison ran. Worst of the three: the artefact still
   exists, still parses, still yields a diff — and the diff is **about a different tree**.

⚠️ **All three are invisible for the same reason: every list was TRUE when taken, so nothing about
the artefact changes when it stops being true.** No corrupt file, no failed parse, no warning.

✅ **Defences that actually work:** re-establish the fact at the moment of USE, not of convenience.
And when a comparison is the point, **check the files it names were in scope before believing what it
says** — `git diff --name-only <base>..HEAD | grep <file>` costs one call and turns a scary diff into
a non-event. Related: [[a-plausible-author-is-not-an-author]],
[[a-measurement-is-scoped-to-what-it-measured]], [[a-baseline-from-the-subject-vouches-for-it]].

---

# Three severities of the same expiry, and the one-call defence (added 2026-09-19)

**Measured across one night of two sessions working the same ward line.** The shelf-life failure
above has three forms, and they are NOT equally easy to catch. Naming them separately is what makes
the worst one visible.

1. **A reading of SOMEONE ELSE'S state goes stale.** A dirty-file list three commits old; an mtime
   survey seven hours old. Easiest to suspect, because you already know you do not control it.
2. 🔴 **A reading of a state YOU CHANGED goes stale.** A session described ten type errors as
   "uncommitted writer state", then committed those very files itself in a snapshot ten minutes
   later and carried on using the pre-snapshot wording — in two reports to the owner. **Worse than
   (1), because the invalidating event was its own hand, so nothing external ever arrives to prompt
   a recheck.**
3. 🔴 **A BASELINE EXPIRES BETWEEN CAPTURE AND COMPARISON. The worst of the three.** A typecheck
   baseline taken before a merge, compared after, reported **2 new errors and 4 gone** — which reads
   unambiguously as "the merge changed something". It had not. All six were in one file the merge
   never touched, written 66 seconds before the comparison ran by a concurrent editor. **A stale
   list at least still looks like a list. A stale baseline looks like a FINDING** — it still exists,
   still parses, still yields a clean diff, and that diff is about a different tree.

⚠️ **What makes all three invisible is identical: every artefact was TRUE when taken, so nothing
about it changes when it stops being true.** No corruption, no parse error, no warning. This is why
"I measured it" feels like sufficient grounds and is not.

✅ **The defence that worked, and it costs one call.** Before believing what any before/after
comparison says about a file, confirm the change under test could have touched it at all:

```
git diff --name-only <base>..HEAD | grep <file>
```

Zero matches means the difference is somebody else's, whatever the comparison shows. It turned a
frightening diff into a non-event in about ten seconds, and it generalises past typecheck to any
before/after measurement — test counts, bundle sizes, lint totals, gate outputs.

**And for (2) specifically:** after any commit, snapshot or restore YOU perform, treat every
statement you have already made about that tree's state as void until re-measured. The action that
invalidates your claim is the one you are least likely to notice, because you were busy performing it.
