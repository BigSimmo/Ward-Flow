# Ward Builder Two — handover

**2026-09-07.** Everything open, blocked, or suggested, in one place. Branch
`claude/ward-builder-two-phases-3-5`. Working tree clean; nothing uncommitted.

---

## 1. BLOCKERS — things that stop other people working

### 1.1 🔴 The machine cannot run the full test suite

`vitest` exits 127 at startup; `tsc` exits 134 on a JavaScript heap OOM. Two worktrees' dev servers
have been OOM-killed, and browser runs fail with `memory allocation of 1966080 bytes failed`.

⚠️ **Consequence for every verification claim made tonight, mine included: a batch red is not yet a
red, and a batch green is not yet a green.** Ward Lead found four genuine failures only by re-running
suspects individually after a batch. **Every figure I report below is from a TARGETED suite and is
not a claim about the whole suite.**

**This is the one blocker that affects everybody.** It should be fixed, or accepted with the slower
manual verification it forces.

### 1.2 ✅ NOT A BLOCKER ANY MORE — everything is folded

**Re-measured 2026-09-07 before handing this over, and the answer had changed since it was written.**
All seven commits are ancestors of `codex/task-ward-flow-live-state-20260831` (tip `81558574dd`,
whose own merge message names the last of them). Checked one at a time with
`git merge-base --is-ancestor`, not inferred from a range:

    f3b62cd19e  IN   demonstration charts redrew every real minute — a LIVE defect fix
    4018894867  IN   the fourteen-finding sweep document
    25751ac388  IN   the owner's two wording rulings
    d47c44e21a  IN   finding 1's severity correction
    e2748d8eca  IN   finding 1 fixed
    d26bd2ded1  IN   this handover
    deb8da60ab  IN   the `initialNow` scope correction

⚠️ **This section previously listed five commits under a heading that said three, and asked for a
fold that has since happened.** Left visible rather than deleted, because the failure it shows is the
one this document keeps warning about: **a status line is a measurement, and it expires.** A reader
acting on the old text would have re-folded work already in. `git rev-list --count <master>..HEAD`
is **0**; the working tree is clean.

---

## 2. OPEN ISSUES — found, recorded, NOT acted on

### 2.1 🔴 Fourteen population-mismatch findings across the ward screens

`docs/ward-flow/population-mismatch-sweep-2026-09-07.md`. Six live in the seed.

⚠️ **ONE of the fourteen has been verified. It moved on contact.** Finding 1 was reported as "the
reducer refuses the pull"; it does not — the refusal needs EVERY free bed pending, and that ward has
one of two. The defect was the word "always" overstating fillable beds. **Fixed at `e2748d8eca`;
severity corrected in the document at `d47c44e21a`.**

**Treat the remaining thirteen as carrying the same risk.** The sweep's reasoning was sound and its
consequence sentence was not, which is exactly what the document's header warns about.

**The two other live ones worth checking first**, because both could change a placement decision:

- **Finding 2** — `flow-diagram.tsx`, `ward-management-network.tsx`. The ineligibility reason shows
  the FIRST failing gate, and `allocatable_bed` is last. So a ward with no bed displays an
  **overridable** reason, and a coordinator records an override the reducer will still refuse.
  `blockingGate` exists precisely to fix this and is used on only one screen.
- **Finding 4** — `delays-screen.tsx`, `ed-home.tsx`, `ed-screen.tsx`. "Patients physically present
  in an emergency department" over `!closure && stage !== "arrived"`, which admits `handover_ready`
  and `moving` — a vehicle has collected the patient. Their wait clocks keep running, inflating the
  danger band and the longest-wait figure.

### 2.2 The cross-cutting class, which is the most useful thing in the sweep

**Findings 1, 2, 5 and 10 are all cases where the correct derivation ALREADY EXISTS, with a comment
explaining the exact harm, and a second screen calls the wrong one:**

    openBedsNow                   vs  availableNow
    blockingGate                  vs  candidateReason
    remainingSpeciallingCapacity  vs  unit.speciallingCapacity

**The repair is a call-site change, not new logic — but the SENTENCE has to change with it**, because
in each case the sentence asserts the property the wrong function does not have.

⚠️ **Three sessions found this class independently within hours, in three different areas.** Ward
Builder Four on the ward home; me on `min(allocatable, empty)`; the sweep here. **Each time somebody
understood the risk, wrote it down, and the writing did not travel.**

### 2.3 "Pending" is consistent on four screens and not in the tree

The owner ruled "use Pending" and it is applied across the four statistics screens. **The wider tree
still disagrees:** `flow-diagram`, `bed-map`, `ed-screen` and `hub-screen` say "still being made
ready"; `ward-standing-strip` says "pending". Other sessions' files.

### 2.4 The demonstration-data safeguard — three weaknesses left open

The live defect is fixed (charts redrew every minute). Recorded and not repaired:

- **The static scan meant to enforce "`DemonstrationChart` is the only renderer" disarms itself** in
  exactly the files that could break the rule. It flags a file importing the generator WITHOUT the
  wrapper — and a screen reading `.points` would import both. **A scan for member access on a
  generator result would hold; an import scan cannot.**
- **One of two `@ts-expect-error` fixtures is insensitive to brand removal**, so the brand has one
  compile-time detector, not two.
- The test's screen-file list names five of six statistics screens.

**Nothing is currently unlabelled** — every path was traced, `.points` is read nowhere, and the label
is both visible and in the accessibility tree.

### 2.5 Nineteen tests pin whole sentences of rendered prose

Three carry alternations. **One was fixed** (`94d85ed52f`); the rest are recorded. ⚠️ **Do not close
this gap by adding MORE prose pins** — pinning prose is what produced three false reds today. Pin the
property instead.

### 2.6 Smaller, recorded

- The sidebar's "referrals awaiting a decision" duplicates `referralQueueOrder`'s predicate, and both
  figures render on `referral-board`. `ward-morning-rollup.ts`'s own comment warns against exactly
  this duplication — in a different file from where it happened.
- `min(allocatable, empty)` has **four** executable homes. Census committed at `c9ceecc95d`;
  deliberately not unified, because `openBedsNow` gates `PULL_PATIENT` and `referralEligibility`
  decides whether a ward is offered. **That unification is a decision for those owners.**
- `OutOfAreaEntry.sinceArrival` is computed and rendered nowhere.
- `ward-mutation-harness-reachable.test.ts` fails under batch load, passes alone — with Ward Verifier.

---

## 3. SUGGESTIONS — process, earned tonight rather than theorised

**3.1 A fold instruction naming a side must also name what must be ABSENT afterwards.** Git conflicts
on overlapping text, not on duplicated purpose, so **two different fixes for one defect merge cleanly
and both survive.** It happened twice; once the hole stayed open underneath a comment explaining it
was closed. Already adopted by Ward Lead.

**3.2 Two chats in one worktree: NEITHER can commit until one tree is completely EMPTY.** Not "only
one can commit". `git commit -- <paths>` builds its index from HEAD and the hook then reads the other
party's _cleanly staged_ files as unstaged. **Two hours went on a request that was mechanically
unanswerable.** Remedy: reverse-apply to a patch held OUTSIDE the worktree, let the other commit,
restore.

**3.3 A subagent's summary is a claim about output, not the output.** Four sessions built two
mechanisms, an escalation and an expiry rule on a summary **nobody had opened**. The log, when
finally read, disproved all of it. **Ask for the verbatim line before repeating any figure.**

**3.4 A filter named after the SOURCE file has no reason to select the TEST file that covers it.** I
edited `out-of-area-board.tsx`, ran `ward-out-of-area`, and shipped a red — the covering suite is
`ward-referral-screens`. And vitest does not object to a named file that does not exist, so it prints
"2 passed" for three names. **Run the population from disk before any commit that changes a rendered
sentence**, because a sentence has no import graph and `test:focused` cannot select its test either.

**3.5 A count built from your own search inherits that search's blind spot — and reads as exhaustive
because it is a number.** I reported two copies of a ruled figure and shipped a guard pinning two.
There are four, and the one I missed decides whether a bed is offered. **Nothing would have gone red
at two.**

**3.6 `document.body.textContent` is not a scope; it is everything.** A test named for a clinical fact
could not fail on it, because another panel on the page said the same words. ⚠️ **And my first repair
fixed a real but different flaw and changed nothing — two vacuous attempts in a row is a property of
the reasoning, not a slip.**

**3.7 Anything whose trigger is the clock ADVANCING is UNASSERTED by this suite — I first wrote
"unreachable by construction", and that was wider than I had checked.**

The mechanism holds and is stronger than I stated: `WardFlowProvider` short-circuits the wall clock
in **three** places when `initialNow` is given — the adoption effect, the 30s interval, and the
elapsed calculation. Ward Verifier confirmed all three from source.

🔴 **But "every DOM suite pins it" is FALSE, and I inherited it from a comment rather than checking.**
Measured from the tree afterwards: 236 provider render sites, **20 with no `initialNow`**, in 14
files — six of them `ward-statistics-*`, the very surface my redrawing-charts defect lived on.

⚠️ **Two of the twenty are unpinned DELIBERATELY and must stay that way**, which is my correction to
Verifier's list rather than a repeat of it: `ward-flow-provider.dom.test.tsx` and
`ward-out-of-area-live-state.dom.test.tsx` mock the clock functions instead, and the second one says
_"No `initialNow` on the provider either — that is the point."_ **Pinning either would delete the
property it exists to test.** The actionable set is **18 sites across 12 files, unpinned by omission
with no clock control at all** — neither pinned nor deliberately live, and those two states look
identical from outside.

**So the charts were reachable and merely unasserted, not unreachable.** That is a weaker claim and a
much better position to be in. `ward-flow-provider.dom.test.tsx:206` already proves the reachable
half by assertion — an unpinned provider re-anchors to the mocked wall clock and its interval ticks.

⚠️ **What remains UNMEASURED: whether any of the 18 actually varies run to run.** I tried a timezone
probe; its control showed Node ignores `TZ` on this machine, so the two green runs it produced
measured nothing and are discarded. **Do not cite them, and do not read their absence as an all-clear
either.** Corrected at the origin in `ward-flow-provider.tsx`, because the false half was a comment
there first and would otherwise keep re-infecting whoever reads it — as it did me.

**3.8 A defect that touches a model field is not thereby a model decision.** I escalated the ED
population question to the owner; he corrected the question. **Ask what the SCREEN can honestly say
first** — the answer was in my own scope, and two chats had stopped at a boundary that was not there.

**3.9 `tests/helpers/` needs an index in searched-for words.** Five sessions solved one problem five
times because `blankCssComments` in `strip-source-comments.ts` is unguessable from "strip comments
from CSS". Ward Lead has built it; **the maintenance rule that will decay is the second one — when a
search of yours fails, add the words you typed.**

---

## 4. WHAT I CLOSED

    statistics findings 1-8      ALL CLOSED
    adversarial review of my 6   4 further defects IN MY OWN FIXES, all fixed
    owner rulings                "Pending" and "Blocker recorded", both applied
    wiring / interaction / links CLEAN — 35 routes, 0 unreachable, 151 buttons, 0 dead
    demonstration safeguard      the live defect fixed, 2 false claims corrected
    sweep finding 1              verified, severity corrected, fixed

**My original brief's remaining phases needed VERIFYING rather than building, and that verification
came back clean.**

---

## 5. What I got wrong, because it calibrates the rest

- **I shipped a red test and reported it green.** My filter never selected the covering file.
- **I wrote a guard that could not fail, then repaired it wrongly, then repaired it again.**
- **I reported a count as complete when it was built from my own search.**
- **I recorded a wording decision in a code comment instead of asking the owner**, and he chose
  differently — and better, on the merits.
- **I repeated a sweep finding's consequence to the owner without checking it**, and it was wider
  than the evidence. Corrected within the hour by a peer.

**Five of eight statistics findings were WIDER than the review that found them**, and twice the
screen nobody listed mattered more. _A reviewer names the file it opened; the derivation names the
population._
