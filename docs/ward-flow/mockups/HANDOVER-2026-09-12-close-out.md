# Ward Mockups — close-out handover, 12 September 2026

**Written to the branch because chat delivery failed three times tonight.** Four of eight
handover messages queued, three were not picked up, one delivered. A message that does not
arrive is indistinguishable from one that was never sent, so this is the durable copy.

    tip     1b0cd8a6e4
    branch  ward/mockups-20260910
    tree    clean
    gate    35 of 35 drawings ALL GREEN, full check.mjs sweep, run twice
    owns    docs/ward-flow/mockups/**

**Take `1b0cd8a6e4` for the fold into the local ward line.** Nothing held back, nothing
half-drawn, no work in flight.

---

## 1 · What landed

### 1.1 The prose audit

Four adversarial reviewers (**Opus, judgement output** — the verdict is whether a clinical claim
is true, and no gate can catch it) read **all 36 drawings, nine each**. About **fifty false
statements** found, and **not one code defect**: every automated gate was green throughout,
before and after.

> Every finding acted on was re-verified against source here before the file was touched. That
> was not diligence for its own sake — **four claims relayed by other chats failed checking the
> same night**, and two of the reviewers' own findings were written wider than their evidence. A
> finding inherits every failure mode a claim has, and arrives carrying the authority of having
> been found.

| commit       | what                                                               |
| ------------ | ------------------------------------------------------------------ |
| `59bf49e1fe` | first pass — the acuity block, the real-names family, ~12 findings |
| `31660b2d4f` | second pass — legal-forms, referrals, handover, the identity prose |
| `c0baea0b80` | the authorisation gate ruling (relayed by Ward Verifier)           |
| `1b0cd8a6e4` | the Breached column (reported by Lane D)                           |

### 1.2 The one that was mine

Commit `0472b07235` removed the 120-minute referral threshold on the owner's ruling. It was
removed from **two** sites in `referrals-third-edition.html` and reported gone. **It survived in
five more** — the predicate, the task, the tally field, the masthead row, the Activity sentence
and the rail's tone.

Two of the survivors were the live tally and the rail: **the exact two surfaces
`settings-third-edition.html` names in its own record of the removal, under the sentence "All
four are gone."**

> **The screen a reader consults to check carried the false claim. The screen that still had the
> threshold carried the truth.**

Lane C's formulation, sent to this chat hours earlier and not applied to itself: _a correction
that lands on one instance of a repeated claim is not a correction; it is a disagreement._

Removed the way the 200-minute ED threshold was: **the category goes, not merely its colour.** A
count of "waiting over two hours" partitions referrals at a number nobody chose whatever shade it
is printed in.

Removing the predicate then **orphaned its consumer** — `tone` was still read three lines below
its deleted declaration and would have thrown on every rail render. Caught by reading the block
back, **not** by the assertion that the name was gone: the name was gone from where it was
_written_, not from where it was _used_.

### 1.3 The clinical corrections

**Acuity — corrected in words, deliberately not in behaviour.** Six drawings said the acuity gate
_"has no counterpart in the real system"_ and drew an override on it. `ELIGIBILITY_GATES`
(`ward-eligibility.ts:43`) holds 13 including acuity, emitted with a real verdict under the
owner's 2026-09-10 ruling "build acuity as drawn". `SUITABILITY_GATES`
(`ward-flow-reducer.ts:662`) holds 9 and does not — so the referral path answers _"This is not
something a recorded reason can override."_ Three reviewers found it independently.

The application disagrees with itself: the movement path's `eligibilityRefusal` returns early
whenever an `overrideReason` is present, skipping every gate including acuity. **The drawings drew
one of two real behaviours.** Correcting the false sentence needed no ruling and is done;
re-siding the control does, and is open (§2.1).

The same block said two gates sit outside the overridable set. It is **four**: `acuity`,
`allocatable_bed`, `prior_decline`, `specialling`.

**`patient-now` printed "Not held"** against Record number, Date of birth, Address and General
practitioner. `Patient` holds all four and the record number is **mandatory at creation**. "Not
held" is a claim about the system; "not drawn here" is a claim about the page.

**`community-team` said no community team can answer a referral.**
`DECLINE_REFERRAL: ["ward","coordinator","ed","community"]`, under the owner's 6 September ruling
one line above it: community may decline, may not accept. The page collapsed both halves into
"answer" and lost the half that is its own subject.

**`delays` carried a tenth blocker cause** — "Awaiting medical clearance" — while printing
directly beneath it _"Medical clearance is not in this list at all."_ `delays-derivations.ts:454`
carries the ruling: clearance is a marker on the person, and `delayGroups` _"must therefore never
gain a tenth cause for this."_ The cause is removed; the drawing already had the marker, so the
design was right and only the list was wrong. **WF-033 was the one person on it and is reassigned
to `awaiting_transport`** — same stage, and their own trail says the department has not released
them. That reassigns an invented person's blocker, which is a change to what the screen
demonstrates rather than a wording fix. Flagged, not buried.

**The Breached column** (Lane D). Only transport and transfer forms carry a `dueAt` since the
2026-08-23 correction, so that column can never report a missed Mental Health Act deadline. Both
movements carrying a `legalDue` in the drawing are Form 4A — **so the figure was never wrong and
no test could have caught it.** The defect was entirely in the words, the worst a tooltip reading
_"Legal deadlines that have already passed."_

### 1.4 Provenance and naming

- **Three drawings said invented ward names are real WA names.** `ward-sites.ts` records exactly
  one real unit name in the whole fixture, and says so precisely because everything around it is
  invented. All three then named invented wards on the same screen.
- **Two disclosure panels claimed names were "read from the network's own tables at render time
  rather than typed here"** and typed them in the file. One also said twenty-three where its own
  table holds sixteen.
- **Eleven files called a health service the `Referral` type's `homeRegion`.** Ten WA regions
  against five services; `ward-model.ts:1554` refuses the mapping by name.
- **`handover` said its ten community team names are the repository's and nothing is invented.**
  All ten of `ward-teams.ts`'s strings end `(placeholder)`; the community screens do not read that
  table at all; and its `svc` field is the region-to-service mapping the model refuses.
- **Midland's suburb count was 68; the catchment table gives 70** — re-counted here from the 537
  raw rows, after two reviewers found it independently.

### 1.5 The identity prose

**85 comments called `--display` "the display serif".** It resolves to Geist, a sans. **Three
files said "the three fonts load"**; two load. One file still named Source Serif 4, Source Sans 3
and JetBrains Mono — the one page that missed the Geist re-cut.

### 1.6 The smaller ones, all verified

`legal-forms` documented throughout as the NETWORK screen, with a 26-line block describing a
diagram it does not have and a sentence naming a pressure strip it does not have · `referrals`
claiming its clocks mirror `referralClocks` _exactly_ then admitting the in-department clock is
absent · `referrals` calling ten rail screens eleven by counting itself among the others ·
`capacity` "the two gates a placement is refused by" (thirteen) and "eight of the nine" site names
(eleven) · `add-a-patient` claiming a record-number duplicate check it does not perform, and
stating a name-length gate wrong in both directions · `bed-board` "the seven leaving destinations"
(eight in the model, six on the page) · `sign-in` contradicting itself three against four ·
`on-call` asserting its roster ignores the Service selector when its own code scopes it ·
`out-of-area` saying a private hospital "belongs to none of the health services" (`Private` is the
fifth) · `raise-a-referral` "the three the New referral control offers" (two) and "twelve
structured questions" (thirteen) · `statistics-ED` a 30-day trend spanning 28 · `patient-now` a
hard-coded "room 6" in the generic branch, true today only because `eventAt()` returns null
without a drawn record · `statistics-community`'s enumerating disclosure panel missing an entire
panel added later, under a heading reading "Read before any figure" · `design-system` "Eleven
screens are drawn" where thirty-five are.

### 1.7 The authorisation gate

**Provenance: not heard first-hand.** Ward Verifier relayed the owner's ruling and the commit says
so. Verified rather than trusted: `authorisation` is in `SUITABILITY_GATES`, so **nothing about
the engine changes** — the ruling explains a behaviour that already existed.

Six drawings stated _"X is not authorised under the Mental Health Act"_ as a bare wall with no
sign a coordinator may set it aside and no reason why anyone would. **A check that refuses without
saying why is the kind people learn to click past, and clicking past one check weakens every other
check on the screen.** The owner's reason is now on the line.

Ward Verifier's own formulation is recorded beside it **as theirs**, because it is sharp enough to
be misread as his: _an override does not permit the placement, it protects the record of it. A
gate nobody can override does not stop the admission; it stops the admission being written down._

Not extended to `security`, which has the same shape and no ruling.

---

## 2 · Everything outstanding

### 2.1 For the owner — clinical

**(1) Six patients have their legal paperwork inverted.** Four already involuntary inpatients hold
a **Form 1A**, the referral asking for an examination. Two not yet examined hold a **Form 3B**,
continuation of detention. The app's twenty seeded movements never do this — 1A only with
"referred for examination" or "detained awaiting examination"; 3B/4A/4C only with "involuntary
inpatient" — and `src/lib/form-register.ts` agrees. Nothing in code forbids the odd pairing (the
owner's August ruling was to avoid hard rules for now), so no gate caught it, and it sits in the
**shared** Command dataset, so it shows on eight drawings at once.

> **Question: is there a real situation where an involuntary inpatient still carries a 1A?** If
> not, it is a six-value swap.

**(2) The acuity override.** Should a coordinator be able to record a reason and place past a
high-acuity **staffing** check? The app does both today depending on route. Six drawings currently
offer the override.

### 2.2 D-1 — not done

`legal-forms-third-edition.html:8627` carries the annotation recording the overrule.
**`legalSortKey` at 8658 still returns `Infinity` and the single-list sort still runs.**

Lane C's distinction, passed on rather than buried: _"Mine documents a cross-file dependency;
yours deletes it."_ **A caption beside a working specification loses to the specification, because
the next person builds from the code shape, not the note above it.**

What remains: the two-group split implemented; `Infinity` no longer load-bearing; each group
heading stating its own order; nothing above them claiming one for both. Scope is wider than
1A/3B — `SELECTABLE_LEGAL_FORMS` carries no `dueAt` on any of five, so a coordinator-entered 4A
with no due time lands there too.

**Not done here because the ruling is held third-hand and the grouping would have been designed
from scratch at close-out.**

### 2.3 The provenance-sentence pass — accepted, not started

Lane D hit five sentences quoted from these drawings going red on
`ward-provenance-sentences-carry-their-own-marker.test.ts`. **The test was opened rather than
acted on from a description of it**, and two things in that file change what should be asked of
whoever picks it up:

- **It reaches 2 files out of 76 and says so itself** — it warns in terms that reading a green run
  as "the ward screens disclose correctly" is reading it about thirty-eight times wider than it is.
- **The obvious wider rule was built, measured and rejected first** — 44 of 58 banner sentences
  flagged, almost all correct. _A guard widened until it means nothing._

So a lane told "make the drawings pass the rule" will widen it until it means nothing. It is
screen-at-a-time judgement. These drawings disclose under a heading ("What is invented, and what
is real"), so they **are** in the decidable population, and the next verbatim quote meets the same
red.

**Lane D's sharper half is the rule actually worth applying, and it is better than the test:** _a
disclosing word loose in the clause discloses nothing — bind it to the noun it is about._ Their
own sentence contained "invented" and failed correctly, because the word modified the _records_
rather than the _counts_.

### 2.4 Fifteen of thirty-five drawings have drifted apart in the shared shell

`shell-sweep.mjs` reports DRIFT on 15 of 35. **Measured as pre-existing: the same 15 filenames
drift at `8d5ad32ae8`, compared as sets and not as counts** — both counts were 15, which is
precisely the coincidence worth mistaking for a result.

Not fixed. It is real: that sweep exists so a shared-layer change never lands on one page, and it
is currently telling nobody anything because it has been red for longer than anyone has looked.

### 2.5 The bare-digit question — three chats, three states

Ward Lead holds it as the oldest live escalation, unowned. **Ward Verifier broadcast that the
owner has ruled, with a measurement.** Lane D said later again that it is unanswered.

**All three were heard second-hand here and none is restated as current** — a relayed status is
exactly what expires in transit. The broadcast carried:

    /network                 33 sub-floor declarations  — mostly FIGURES (.count .tier .elapsed)
    coordinator.module.css   69 sub-floor declarations  — overwhelmingly WORDS

Reported steer: **raise the words, let the bare digits wait**, with a caution that these were
sized small to fit, so it is screen-at-a-time with a width check, never a token sweep.

> **If that broadcast is real, the close-out list is about to put to the owner a question he has
> already answered, and it reaches him as though nobody listened. If it is not real, a ruling has
> been relayed that does not exist, which is worse.** One message to Ward Verifier settles it.

**The framing that should go to him**, which is not the narrow one: the question is not _may small
text stay small_. It is that **the words explaining why a patient cannot go somewhere are below
the legibility floor** — gate verdicts, refusal reasons, legal-breach notes. A reader who cannot
read the refusal acts on the colour, and acting on colour is what makes every other check on that
screen decorative. The bare digits are a lesser and genuinely different question.

The original escalation from this chat was narrower than the real problem, and said so at the
time — the census that found the wider version only happened because the narrow question prompted
it.

### 2.6 Two smaller ones

- **`ward-flow-digest.html` still carries none of §4.3, §4.4 or §8.8.** Deliberate and unchanged:
  deciding what belongs in a summary is the owner's editorial call.
- **Panel names.** The owner ruled the screens win and the drawings are updated to match; five of
  six Movements headings differ. Waiting on Ward Lead's list. Watch the U+2019 in "Today's
  traffic".

### 2.7 `_broken-copy.html` — not this chat's, and not unowned

Ward Verifier's close-out passes this to the owner as _"yours-shaped and unowned"_. **Measured
here, and it is neither.**

    docs/ward-flow/mockups/_broken-copy.html
      on disk in this worktree                     no
      tracked by git                               no
      history on this branch                       none
      present on any of 40 local branches scanned  none

**It is on no branch, so no fold can ever carry it.** It exists in exactly one place on this
disk — confirmed by a completed recursive search under `D:/Worktrees/Database`:

    D:/Worktrees/Database/ward-builder-four/docs/ward-flow/mockups/_broken-copy.html
    664,537 bytes, dated 9 September

That is **Lane D's worktree**: an untracked scratch file in a live chat's working tree.

And it was already recorded two days ago in `WARD-MOCKUPS-STATUS-2026-09-10.md:137`, under a
heading that exists because three false claims about other chats' state circulated on 2026-09-10:

> **That Ward Builder Four's `_broken-copy.html` is only in its own worktree.** Ward Lead's words.
> Not checked here, and not this chat's to check.

**So the item has travelled a full circle** — Ward Lead identified it as Lane D's, this chat
recorded it as not its own to check, and it returned as unowned and needing a custodian. The
failure is structural, and it caught two chats on the same night: Ward Verifier's own close-out
says of a different item, _"I measured a tree 181 commits behind and reported it as the world."_

**What should reach the owner is not "who owns this".** It is: _Lane D has a 664 KB untracked
scratch file, four days old, referenced by nothing — does it still serve a purpose?_

**And it cannot simply be tidied away.** It matches the protected-name rule, so under D-5 any
deletion routes to the Ward Verifier first, automatically, **even where the owner has approved it
in another chat**, and **silence is not approval**.

### 2.8 Five false claims in the source, not in these files

Found incidentally by the reviewers, outside this chat's ownership, each verified:

| where                      | what                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-sites.ts:62,:395`    | calls `scgh-adult-open` and `fre-adult-open` "genuinely mixed"; both carry 0 locked beds. The mockups' "all open" is right.                       |
| `ward-eligibility.ts:225`  | "`remainingHighAcuityCapacity` … and `PULL_PATIENT` asks it" — it does not; that function has **no production caller**.                           |
| `ward-flow-reducer.ts:700` | names four gates outside `SUITABILITY_GATES` including `capacity_freshness`, which moved **in** by the 2026-09-02 ruling. The fourth is `acuity`. |
| `ward-flow-reducer.ts:759` | "`ELIGIBILITY_GATES` (12)" — it now has 13.                                                                                                       |
| `ward-model.ts:1112`       | `preparing` "must NEVER gate allocation" — overruled 2026-09-01; the reducer now refuses the pull.                                                |

**Two of those sit in comments whose whole purpose is to warn against transcribing the set they
misstate.**

---

## 3 · Method notes from the night

**A finding is a claim.** Four relayed here failed checking; two reviewer findings were written
wider than their evidence; two assertions written here were wider than the defect they checked,
and one passed while proving nothing. A finding inherits every failure mode a claim has and
arrives carrying the authority of having been found — including everything in this document.

**A count is not a set.** See §2.4.

**A removal orphans its consumers.** See §1.2. The name being gone from where it was written says
nothing about where it was read.

**A disclosing word loose in the clause discloses nothing.** See §2.3.
