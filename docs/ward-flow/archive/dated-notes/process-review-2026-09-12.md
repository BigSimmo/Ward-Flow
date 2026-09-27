# Process review — saving, ledgers, chat coordination, testing, staleness, memory, plans

**Ward Verifier, 2026-09-12, at the owner's request.** **Measured at `abdd4b0c61` unless stated.**
**Three subagents (Sonnet, extraction) gathered facts with file:line citations; every judgement and
every conclusion below is mine.**

⚠️ **This reviews the PROCESS, not the product. It forms no view on any ward screen.**

---

## 1 · 🔴 THE CONTROL PLANE IS DEADLOCKED, AND HAS BEEN FOR ELEVEN DAYS

**This project has a proper role-control system — `scripts/ward-flow/chat-control.mjs`, 3,404 lines.
It is genuinely good: leases are atomic, mutually exclusive, stored in the shared `.git` directory,
and refuse overlapping worktrees or owned paths. Acquisition is race-safe under a filesystem lock.**

🔴 **All three roles are currently leased to chats that no longer exist.**

    LEAD      ward-lead-20260831-claude-c        acquired 2026-08-31   gen 2
              worktree …/ward-flow-live-state-20260831/Database   ← an ABANDONED codex folder
    BUILDER   ward-builder-20260901-claude-a     acquired 2026-09-01   gen 1
    VERIFIER  ward-verifier-20260901-claude-a    acquired 2026-09-01   gen 2

**And `acquireLease` refuses, `chat-control.mjs:558-563`:**

> **"`${role}` is already leased to `${active.lease.instanceId}` generation `${active.lease.generation}`;
> certify that chat's reset before creating any replacement, EVEN WITH THE SAME SESSION ID"**

⚠️ **The only thing that retires a lease is a successful `certify-reset`, and that requires a
committed, certified handover chain from the dead chat PLUS its SOURCE worktree still existing at
its recorded path, on its recorded branch, clean.** 🔴 **The Lead's recorded worktree is gone.**
**Grepped for `force`, `expire`, `stale`, `TTL`, `maxAge`, `breakLease`, `releaseLease`: there is no
override and no expiry.**

### What follows

🔴 **For eleven days no chat has been able to formally hold a role.** ✅ **Every chat has coordinated
by ad-hoc message instead — which has worked, and is why nobody noticed.** ⚠️ **The machinery that
would have prevented half the incidents in this review has been sitting unusable the whole time.**

**RECOMMENDATION — and this is the single highest-value fix in the review:** **add a documented,
auditable way to break a lease whose holder is provably gone** (its worktree absent, or its session
absent from the live list), **writing a record of the break rather than deleting the lease.**
🔴 **Without it the system's own safety property — a role cannot be claimed twice — is what keeps
it permanently empty.**

## 2 · 🔴 THERE ARE TWO ROLE SYSTEMS AND THEY DO NOT READ EACH OTHER

    chat-control.mjs   LEASES   shared .git, machine-enforced, atomic, mutually exclusive
    whois.mjs          MARKERS  a self-reported `.ward-session.json` file inside each worktree

**Neither reads the other's data. Confirmed: `chat-control.mjs` contains no occurrence of `marker`
or `.ward-session`; `whois.mjs` never reads a lease file.**

**`whois` today: 30 rows — 2 verified, 1 CONTRADICTED, 26 with no marker.** ⚠️ **Its default filter
shows a worktree only if it has a marker OR its path matches `/ward/i` — and its own header records
that this once hid a real load-bearing worktree (`pr-2390-fix`).**

### 🔴 A CORRECTION TO MY OWN RECOMMENDATION, MADE EARLIER TODAY

**I recommended D-5's amendment 3 point at the Ward Verifier ROLE, resolved through `whois`.**
🔴 **I pointed it at the WEAKER of the two systems, and at the one whose data is self-reported.**
⚠️ **The lease system is the authority; `whois` is a claim file.** ✅ **D-5 should resolve the role
through the lease — which makes §1 a prerequisite, not a parallel task.**

## 3 · 🔴 THE ISSUE LEDGER'S WRITE PATH WORKS AND ITS APPLY PATH IS BLOCKED

    pending requests      69      oldest 2026-09-02 (TEN DAYS)
    already applied    1,080      so the 69 are genuinely unreconciled, not history
    last reconcile    2026-09-07

✅ **The design is sound: immutable request files, a fingerprint that detects a row changed under a
queued request, and `check:ledger-write-discipline` — wired at `package.json:121` — rejecting direct
table edits, changed requests, deleted requests, and partial reconciliations.**

🔴 **But reconcile is entirely manual. Nothing schedules it, nothing reminds about it, and the
SessionStart hook reads only the ALREADY-RECONCILED file — it never reports the pending count.**
⚠️ **So the backlog is invisible in the one place every chat looks at the start of every session.**

**RECOMMENDATION: print the pending-inbox count in the SessionStart surface.** **One line. It makes
a ten-day backlog visible to whoever can act on it, without changing any of the discipline.**

## 4 · 🔴 ALMOST NOTHING CHECKS WHETHER A DOCUMENT IS STILL TRUE

    docs/ward-flow/                        679 files
    containing a SHA-shaped token          131 files

**Three checks exist and they are narrower than they look:**

- **`check-ward-citations.mjs`** verifies a cited SHA or path EXISTS. Its own header, lines 18-21:
  _"WHAT IT DOES NOT CHECK… whether a cited SHA is the RIGHT one; whether a path's CONTENT still
  says what the document claims; whether any rule in those documents is still true."_ **Wired to
  nothing.**
- **`check-errata-freshness.mjs`** genuinely re-derives claims — but for **ONE hardcoded document**,
  with the claims **copied into the script by hand**. **Wired to nothing.**
- **`check-stale-docs.mjs`** IS wired (`package.json:318`) but only measures commit age plus whether
  any other file mentions the path, and **exits 0 always**.

🔴 **Of the thirteen files under `scripts/ward-flow/`, exactly ONE has an npm entry point
(`mutation-run.mjs`). NONE appears in any CI workflow.**

**RECOMMENDATION: wire `check-ward-citations.mjs` first.** ✅ **It is generic across all Ward Flow
documents, it needs no per-document maintenance, and dangling citations are the failure this
programme produces most.** ⚠️ **Its own limits must be quoted wherever it is reported, or a green
will be read as "the documents are true".**

## 5 · 🔴 THE LIVE-STATE CHECKER IS KILLED BY THE DRIFT IT EXISTS TO DETECT

    docs/ward-flow/live-state.json   capturedAt 2026-08-31   →  TWELVE DAYS STALE
    absolute paths it asserts: 8     of which MISSING: 5
    node scripts/ward-flow/check-live-state.mjs   →  exit 2
      "[ward-flow-state] ERROR: spawnSync git ENOENT"

🔴 **`git` is fine — `git version 2.55.0` resolves from node here. The real cause is
`execFileSync("git", args, { cwd })` with a `cwd` that no longer exists; Node reports that as ENOENT
and names the COMMAND, not the directory.** ⚠️ **So the error blames the wrong thing, and anyone
acting on it goes looking for a broken git install.**

✅ **Wired to nothing — confirmed with a control: `check-type-scale` returns 3 references, this
returns 0.**

**RECOMMENDATION: make it report a missing worktree as drift rather than dying on it.** **That is
what it is for, and today it is the one input it cannot survive.**

## 6 · 🔴 NOTHING ANYWHERE DETECTS THAT A CHAT HAS STOPPED

**Searched for heartbeat, last-seen, liveness, idle, session-stale across the repository. Every hit
is unrelated — SSE keep-alives, flaky-test history, HTTP health probes.** 🔴 **There is no
timestamp, no ping, and no committed mechanism of any kind.**

⚠️ **The nearest thing in force is prose in `worktree-ownership.md`: "a failed `SendMessage` is the
only signal you get that a peer became unreachable."**

🔴 **THIS IS WHAT MAKES D-5 DANGEROUS.** **"Silence is not approval" plus no way to tell a silent
chat from a dead one means a lane can wait on a recipient that will never answer.** ✅ **The escape
route the owner approved — ask him directly after a wait — is the mitigation, and it is a human
mitigation for a missing mechanism. Say so rather than treating it as a fix.**

## 7 · ⚠️ THE OWNERSHIP REGISTRY IS OUTSIDE THE REPOSITORY AND VALIDATED BY NOTHING

**`C:/Users/joshs/.claude/worktree-ownership.md` is hand-maintained prose, delivered into every new
chat by a SessionStart hook.** 🔴 **It is not in this git repository, so no gate, test or CI job can
read it.** ⚠️ **Its own prescribed remedy is to trust git rather than the document — an admission
that nothing checks its currency.**

## 8 · ⚠️ THE MEMORY STORE IS LARGE AND SELF-DECLARED PERISHABLE

    156 files · 1.6 MB · index 157 lines / 19 KB
    memories whose own text says they expire / must be re-measured:   87
    memories containing a SHA-shaped token:                           13

🔴 **More than half the store declares itself time-sensitive, and nothing checks any of it.**
✅ **The convention of writing the expiry INTO the memory is the right one and it is working — it is
why they can be spotted at all.** ⚠️ **But an index of 157 lines is at the size where adding one
crowds out another, and that trade is currently made by whoever writes last.**

## 9 · ⚠️ SAVING: THE HOOK IS CORRECT AND IT STRANDS THE CONTROLLER

**`.githooks/pre-commit` refuses when documentation INPUTS (`src/app/`, `src/components/`, `tests/`)
have unstaged or untracked changes, because the generated docs would otherwise describe the wrong
commit.** ✅ **That is right and must not be worked around.**

🔴 **But with five build agents live in one worktree, the controller cannot commit at all** — which
happened tonight — **and uncommitted work is the only thing this repository can lose.**

**RECOMMENDATION: not a code change. Make it a rule that a controller holding uncommitted work
SAYS SO in its next message, naming the files.** ⚠️ **It already happened correctly tonight. Writing
it down is what makes it reliable rather than a good habit.**

## 10 · ✅ WHAT IS WORKING, AND THE STANDARD IT SETS

- **The retirement of 82 test cases over eleven unreachable screens** — an owner ruling, a
  reconciled count, every retired case's subject preserved in its own record, a marker in each
  component, and a reachability guard that reddens if a route ever points there again. 🔴 **The one
  flaw is the shape of everything else in this review: the record still says "82 across 13 files"
  and it is now 75 across 12, because seven were correctly restored on 2026-09-07 and nothing told
  the record.**
- **The ledger's immutable-request design**, and `check:ledger-write-discipline` refusing to render
  a verdict at all while the ledger is dirty.
- **`chat-control.mjs`'s lease acquisition** — atomic, race-safe, refusing overlapping paths.
- **The branch-review ledger**, which is the ONLY ledger here with real staleness detection: it
  resolves the current HEAD and answers _"NOT REVIEWED at this HEAD"_ rather than reusing a verdict.

## 11 · The ranked list

    1  break the three dead leases, with a written record          §1   blocks everything else
    2  point D-5 at the lease, not at whois                        §2   my own correction
    3  surface the pending-inbox count at session start            §3   one line
    4  make check-live-state report a missing worktree as drift    §5   it dies on its own subject
    5  wire check-ward-citations                                   §4   generic, no upkeep
    6  reconcile the 69-request backlog                            §3   needs a quiet machine
    7  write down the uncommitted-work announcement rule           §9   already practised

## 12 · What this review did NOT cover

- **No provider-backed check, no CI run, nothing outside this machine.**
- **I did not audit the 679 ward documents for accuracy** — only counted how many carry
  SHA-shaped tokens.
- **I did not verify the 1,080 applied ledger records**, only that they exist and bound the 69.
- ⚠️ **Ward Lead reported wiring the two orphan gates at `46da2b218f` AFTER my extraction ran. The
  §4 table may already be one row out of date — which is, precisely, the subject of §4.**

---

## 13 · 🔴 ADDED AFTER THE REVIEW — NOTHING TESTS A HEADER, AND A GUARD'S OWN PROSE ROTS

**Ward Builder Two reported, against its own work, that `check-text-size-floor.mjs`'s header said
_"there is exactly one such comment in the tree today"_ — a claim about OTHER files, parked in a
comment, in the file whose entire purpose is to notice counts changing.**

🔴 **A guard can pin its own subject precisely and carry a rotting claim about the neighbourhood one
line above it. Nothing in this repository tests a header.** ⚠️ **And it nearly propagated: Ward Lead
asked for a line to be ADDED to that header, which would have placed new text directly beneath a
stale sentence and given the whole block fresh credibility.** ✅ **What caught it was refusing to
write next to a claim that had not been re-run.**

### ✅ Their fix is better than their own description of it

**Read at `03eb2e550f`: the header now carries NO count at all** — _"COMMENT counts too, and all of
them are included in the baseline below"_ — with a note recording what the line previously said and
that **a count pinned into a comment is a pin that invalidates itself silently.** **Removing the
number beats replacing it.**

### 🔴 BUT THE FIGURE IN THEIR MESSAGE IS WRONG, AND IT IS WRONG IN THE DANGEROUS DIRECTION

**Re-measured here by extracting every `/* … */` block and counting tokens inside it:**

    token occurrences inside CSS comments:  4, across ONE file
      4  statistics/statistics-v4.module.css   (lines 92, 111, 664, 760)

**Their message said four across TWO files — three in `statistics-v4`, one in
`handover/handover.module.css`.** 🔴 **The two occurrences in `handover.module.css` are LIVE
DECLARATIONS — `font-size: var(--text-3xs);` at lines 53 and 64 — not comments.**

⚠️ **Classifying a live sub-floor declaration as prose is the one direction that excuses a real
breach.** **The likely cause is visible at `statistics-v4.module.css:664-665`: a comment naming the
token sits immediately above a declaration using it, so a line- or proximity-based count conflates
them.**

✅ **And the totals agreed — 4 and 4 — from different compositions.** 🔴 **Same shape as the two
nines earlier tonight: an agreeing total from a different population is a coincidence, not a
corroboration.**

### ⚠️ My own propagation

**I quoted that stale sentence verbatim to Ward Lead as evidence when arguing the comment-counting
question.** ✅ **It reached no committed document of mine — grepped and confirmed — but it did reach
a decision-making chat in my voice.** **Corrected there.**

### 🔴 §13 CORRECTED — BOTH OF MY CORRECTIONS WERE WRONG, AND ONE WAS PRAISE-SHAPED

**Everything above in §13 that corrects Ward Builder Two is withdrawn. Measured:**

    handover/handover.module.css   token occurrences
      my HEAD (b292ff5bab)     2   both LIVE DECLARATIONS, lines 53 and 64 · none in a comment
      their 1ca818b88e         3   the third inside a /* … */ block from line 143

**The third reads: _"the smaller `--text-3xs` from before this floor was written down."_
🔴 IT IS THE VERY COMMENT THAT WAS D-4's SUBJECT, COMMITTED TONIGHT — after my HEAD.**

✅ **So "4 across 1 file" is correct for MY tree and "5 across 2" is correct for THEIRS. Neither of
us was wrong about the file. I compared a measurement of one tree against a claim about another** —
the same unit error I had caught three times today, committed by me while correcting somebody
else's measurement.

**WITHDRAWN WITHOUT QUALIFICATION: I wrote that they had classified `handover:53` and `:64` — live
declarations — as prose.** 🔴 **They never said that. Their claim was about line 147 all along, and
it is a genuine comment. I attacked a claim that was never made, and the evidence for it was
invisible to me because I was reading a different tree.** ⚠️ **The general point — that reading a
live declaration as prose excuses a real breach — stands as a hazard and did not happen here.**

### 🔴 AND THE ONE I MOST WANT RECORDED: MY ERROR WAS IN THEIR FAVOUR

**I wrote that their commit `03eb2e550f` "removes the COUNT ENTIRELY" and called that better than
replacing it. It did not.** **Read in full, that header says: _"RE-MEASURED 2026-09-12: there are
FOUR, across TWO files."_**

🔴 **I reached that conclusion from `grep -n -i "comment" | head -8` — a TRUNCATED SLICE of the
header — and reported about the whole block.** ⚠️ **The same shape as reading a gate's exit code
through a pipe, which I did earlier tonight and wrote up.**

✅ **Their reply is the sentence worth keeping: praise that describes work better than the work
deserves is the same defect as a wrong count — it just does not feel like one.** 🔴 **A correction
in somebody's favour is the one nobody audits, and it is how an unearned credit becomes the record.**

### ✅ WHAT IS NOW TRUE, AND THE REUSABLE PART

**At `1ca818b88e` the header gives NO number, explains how to derive one, and instructs the reader
not to quote the paragraph** — recording that it was repaired twice in one day and that **two chats
measured independently and both got FOUR by different wrong methods.**

✅ **The transferable control is theirs: a count of things inside comments has no natural check, so
give it one by making it reconcile against a number measured another way.** **5 inside comments +
379 outside = 384, which is exactly what the ratchet itself reports.**

### ✅ THE RULE THIS EXCHANGE PRODUCED, WHICH IS SHARPER THAN EITHER OF US REACHED FOR

> 🔴 **WHEN TWO COUNTS OF THE SAME THING DIFFER, NAME THE TREE BEFORE DISPUTING THE METHOD.**

**Ward Builder Two's, and it is now in the ratchet's own header.** ⚠️ **Neither of us asked the cheap
question. I went to "you misclassified"; they went to "you missed a block". The dispute ran for
three exchanges over two CORRECT measurements of two different commits.**

**And the mechanism behind the truncation defect, which is theirs and is the best statement of it:**

> ⚠️ **"A `head -8` and a `| tail` both produce output that LOOKS complete. Nothing in the result
> says _there was more_."**

🔴 **That is why it recurs in a room where everyone knows about it. The output of a truncated read
is indistinguishable from the output of a complete one.**

### ⚠️ AND A RE-TALLY IN MY FAVOUR THAT I AM DECLINING

**They wrote that I made ONE error, not three: the truncated read; that measuring my own tree was
not an error at all; and that the misclassification charge "evaporates" with it.**

🔴 **I am not banking that, for the reason they themselves gave an hour earlier: a wrong count in
somebody's favour is the same defect as any other wrong count, and a correction that exonerates you
is the one nobody audits.** **Audited, it is still three, of three different kinds:**

    1  a MEASUREMENT that was correct, carried by a SENTENCE written wider than it —
       I measured my tree and asserted their figure was wrong. The measurement was sound;
       the claim about THEM had no basis. That is this project's most-catalogued defect
       and it is not excused by the measurement underneath it being right.
    2  an UNFOUNDED ACCUSATION that did not follow from 1 — "our numbers differ" was
       available and complete. Asserting they had classified live declarations as prose
       was a separate step I chose to take.
    3  the TRUNCATED READ, and the praise-shaped conclusion built on it.

✅ **Their own count of themselves — original wrong, first correction wrong, published account of my
count wrong — stands as they wrote it.** 🔴 **Neither tally should flatter the other, which is the
point they were making, and it applies to their generosity toward me as much as to mine toward them.**

## 14 · 🔴 THE UNIFYING SHAPE, AND WHICH MEMBER OF IT HAS NO DEFENCE AT ALL

**Three of this review's findings are one failure:**

    an EMPTY result      and a CLEAN result       are the same shape
    a TRUNCATED read     and a COMPLETE one       are the same shape
    a SILENT recipient   and an APPROVING one     are the same shape

🔴 **In each case the thing that went wrong leaves NO ARTEFACT. There is no marker in the output
saying "there was more", no line saying "nothing ran", no signal distinguishing a chat that agreed
from a chat that is dead.** ⚠️ **That is why these recur in a room where everyone knows about them:
scepticism has nothing to attach to.**

✅ **THE ONLY DEFENCE IS AN INSTRUMENT THAT PRODUCES A DIFFERENT SHAPE FOR THE TWO CASES** — a floor
that refuses below N, a specimen the matcher must find before any number is read, a total that must
reconcile against a number measured another way. **Ward Builder Two's point, and it explains why
"add a floor" keeps being the answer to problems that look unrelated.**

### 🔴 D-5 IS THE ONE THAT WAS ENGINEERED, AND IT IS THE ARGUMENT FOR ITS OWN WORDING

**"A protected-work deletion does not proceed until the check REPLIES" does not merely counsel
caution. It makes silence MEAN STOP rather than mean nothing — it forces the two shapes apart.**
✅ **That is the case for amendment 1, and it is stronger than prudence: it is the only member of
this family anybody has made distinguishable, and the mechanism generalises.**

### ⚠️ ONE CORRECTION, WHICH SHARPENS IT

**Ward Builder Two wrote that the other two have no such repair yet. That is too wide for
EMPTY-versus-CLEAN, which does have one and we both built instances of it tonight** — the §U
sweep's mandatory specimen printing `RESULTS VOID`, the text-size ratchet's positive control, the
three-tier walk. 🔴 **The repair exists for that member; it is simply not applied everywhere.**

🔴 **THE MEMBER WITH GENUINELY NO DEFENCE IS THE TRUNCATED READ.** **Nothing anywhere makes a
`head -8` or a `| tail` announce that it cut something, and it bit both chats in this exchange
within an hour of each other.**

✅ **AND IT IS CHEAPLY ENGINEERABLE, which is the useful half:** a read that prints its own
completeness — the total alongside the slice — produces a different shape for the two cases in one
extra clause. **`sed -n '1,8p' FILE; echo "(of $(wc -l < FILE) lines)"` is the whole fix.**
⚠️ **Nothing here does it, and both of today's instances would have been caught by it.**

### 🔴 WHY A "BE CAREFUL" RULE WILL NEVER FIRE HERE — and the phrasing that might

**Ward Builder Two's addition, and it is the load-bearing half of §14:**

> 🔴 **"The reason it recurs is not ignorance. It is that adding `| head` FEELS LIKE FORMATTING
> rather than like changing what you measured. Both of tonight's instances were people SHORTENING
> OUTPUT, not people taking shortcuts."**

⚠️ **A rule phrased as "be careful reading files" attaches to the act of READING, and at the moment
of the mistake nobody believes they are doing anything risky — they believe they are tidying.**

✅ **So phrase it to attach to the act of QUOTING instead:**

> **ANY READ THAT WILL BE QUOTED PRINTS ITS OWN COMPLETENESS.**

🔴 **That fires at the right moment, because the hazard is created when a slice becomes a claim —
not when it is taken.** **Neither of tonight's instances was careless; both were formatting that
silently became evidence.**

⚠️ **This is a habit and not a gate, deliberately. A gate on how somebody reads a file is not
buildable, and pretending otherwise would put a fourth unenforceable rule in a review that is
largely about unenforced ones.**

## 15 · ✅ A PARTIAL ANSWER TO §4, APPROVED BY THE OWNER TODAY

**§4 found that almost nothing checks whether a document is still true. The owner has approved an
adversarial read of a body of work BEFORE it folds — with a brake he named himself:**

> **"Yes I agree to the adversarial review recommendation… however ensure you avoid excessive review
> churn… primarily just run it at the end of a large task or amount of work."**

    ✅ RUN   before a fold — the last look nobody else gives it
    ❌ NOT   per commit or per file. "Excessive review churn" is his phrase and his limit.
    ✅ TIER  Opus, adversarial, read-only — the output IS a judgement, and it is the last
            thing before a fold nobody re-reads

🔴 **On its first use, over four commits: SIX FALSE CLAIMS, no code defects, every gate green
throughout — including a comment asserting coverage that did not exist and a quotation from a
drawing that the drawing does not contain.**

✅ **NONE OF IT WAS REACHABLE BY ANY TEST.** **It was reachable only by reading what the work SAID
about itself against what it DID.** ⚠️ **That is the gap §4 names, and this is the only instrument
anybody has that addresses it — a human-shaped one, run rarely, by deliberate design.**

### ⚠️ AND A COUNT OF MINE THAT WAS WRONG, CAUGHT BEFORE I PUBLISHED IT

**Lane A said the reachability guard declares THIRTEEN unreachable modules. My first parse returned
SIX, and I was one sentence from disputing it.** 🔴 **My regex stopped at the first `]` and read only
part of the list. Re-counted by distinct module path: THIRTEEN. Lane A is right.**

✅ **What stopped it was checking my own method before disputing theirs** — the generalisation of
Ward Builder Two's rule from the same night. **A partial parse and a complete one are the same
shape, which is §14 arriving inside the section that records §14.**

## 16 · 🔴 TWO MORE, AND THE FIRST IS MINE

### ① THE INSTRUMENT I NOMINATED FOR D-2 REPORTS AND DOES NOT ENFORCE

**I set D-2's definition of done as "done when `ui-ward-table-thresholds.spec.ts` prints an empty
list", and called it a run rather than an investigation. Read to the end:**

    :376   console.log(
    :378     ? `thresholds that can never bind (${inert.length}): …`
    :379     : `no inert thresholds: all ${tablesWalked} tables are pinned above their own min-content`
    :381   });   ← the test ends here. NO ASSERTION.

🔴 **Ward Lead re-measured live: all three margins unchanged, the ruling unmet, and the spec GREEN
throughout.** ⚠️ **My condition is a correct definition of done and NOTHING GOES RED IF IT IS NEVER
MET. D-2 can silently never happen.**

✅ **FIX, with its sequencing, because the sequencing is the whole point: assert `inert` is empty
IN THE SAME CHANGE that raises the three thresholds** — so the assertion never exists in a
red-on-arrival state. 🔴 **A guard that reddens on day one over work nobody is touching gets
switched off within the hour; that is the ratchet's own stated reason for being a ratchet.**

⚠️ **And it is §7 of this review arriving in the instrument I chose FOR §7: a check that reports
rather than enforces is a check that cannot fail.**

### ② A RULE ITS AUTHOR EXEMPTED THEMSELVES FROM

**Ward Lead carried a question to the owner that a lane had already put to him an hour earlier — and
its recommendation was the OPPOSITE of the ruling he had already given.** 🔴 **It would have invited
him to reverse himself without either chat noticing.**

**Second instance tonight, and Ward Lead's own diagnosis is the finding:**

> 🔴 **"The rule I set after the first one did not prevent the second, because I SET IT FOR THE
> LANES AND NOT FOR MYSELF."**

⚠️ **A coordinator writing a routing rule is the one participant who never reads it as addressed to
them — they are the destination, not a sender.** ✅ **Every rule in this programme should name
whether it binds the chat that wrote it. D-5 does, deliberately: "it binds me too." Most do not.**
