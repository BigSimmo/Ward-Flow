# Ward citation repair — full session record, 2026-09-08 → 2026-09-10

**Written 2026-09-10 by Ward Builder (citation repair), at the owner's request, so the reasoning
survives the session rather than only its output.**

> **What this file is for.** The technical result lives in
> [`citation-repair-handover-2026-09-08.md`](citation-repair-handover-2026-09-08.md) — the numbers,
> the exemption list, the re-derivation commands. **This file is the part that document cannot
> carry: what was believed at each point, what turned out to be wrong, who corrected whom, and what
> the whole thing taught.** Read the handover to act; read this to understand why it says what it
> says.

---

## 1. The one-paragraph version

**A brief said 417 ward documents carried 118 broken citations — 94 paths and 24 commit SHAs — and
asked for them to be repaired. Two were defects.** Everything else was either a correct citation the
instrument could not read, or a wrong string that was wrong **on purpose** and would have been
destroyed by repairing it. **The single most valuable output is therefore not a repair; it is a list
of things that must never be repaired.**

---

## 2. What the work actually was

| Stage                                | What happened                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prove the instrument**             | Before believing any count: `--selftest` must exit 1, a run from outside the repo must exit 2 REFUSED, and all seven branches in its address book must resolve. All three confirmed. **A stale branch list had manufactured 231 of 325 reported missing paths two days earlier**, which is why this is step one and not step five. |
| **Re-take the measurement**          | 419 documents, 24 unresolved SHAs, 94 missing paths. Matched the brief.                                                                                                                                                                                                                                                            |
| **Audit the SHA half**               | `git cat-file -t` on all 24: **12 blob, 2 tree, 10 not a git object.** Every one a correct citation — byte-identity proofs, `git merge-tree --write-tree` states, patch-ids, sha1/sha256 checksums, hex task-output filenames. **Zero defects.**                                                                                   |
| **Audit the path half**              | 9 "live", 85 in dated plans. Of the 9, **7 were the instrument, not the documents.** Of the 85, all 13 "repointable" ones live **inside** dated plans — a subset of the group being held for the owner, not separate work.                                                                                                         |
| **Repair**                           | Two defects, both in documents, both fixed. **No source file and no test file in any of this chat's 11 commits** — see §8 for why that is deliberately not a claim about the branch.                                                                                                                                               |
| **Hand over, then keep being wrong** | Three further corrections after "finished", all to my own text. See §5.                                                                                                                                                                                                                                                            |

---

## 3. 🔴 The three findings worth more than the repairs

### 3.1 A gate defeated by its own documentation

`check-ward-citations.mjs --selftest` injects fake citations to prove it can fail. **One of those
canaries, `deadbeefdeadbeef`, is now quoted verbatim in two ward documents that explain how the
selftest works.**

**The mechanism, sharpened by Ward Verifier and re-derived locally:** injection is a `Map.set`, so it
does not add a row — **it overwrites the ATTRIBUTION of a row already present.** Measured across the
two runs:

```
selftest credits deadbeefdeadbeef to   <selftest>:0
real run credits it to                 docs/ward-flow/builder-prompts-2026-09-08.md:105
```

**Same string, same count, different author.** A single run cannot show this; a diff of two runs
states it plainly.

**Three consequences:** the checker can never exit 0 while those documents exist; every
"subtract the canaries" arithmetic is wrong — **mine said subtract one, the fix made it two, and two
is also wrong**; and a permanent exit 1 meaning _"somebody documented the check"_ is indistinguishable
from one meaning _"a citation broke"_.

### 3.2 The measurement is scoped to the documents, and was nearly quoted wider

**`check-ward-citations.mjs` walks `docs/` only. A wrong path cited inside source or test code is
invisible to it by construction.** The proof arrived by accident: `tests/ward-morning-tour.dom.test.tsx:139`
cited a file that does not exist — uncaught by everything, found only because Ward Builder Two opened
the file — **while a _document_ quoting the same string was flagged.**

**So "118" is the citation debt in the DOCUMENTS and must never be quoted as the repository's.**
Ward Builder Two's framing is the sharpest: **a gate that cannot fail across a whole population.**

### 3.3 Wrong strings that are load-bearing

Six — now eight — classes of citation in these documents are wrong deliberately. A fabricated SHA
kept beside its own correction as the evidence of a caught fabrication. A wrong path quoted **in
order to be described**. A retracted false accusation about a peer, kept so there is a trace the
accusation was made.

**The generalisation:** _a document about a wrong identifier will contain the wrong identifier — that
is what makes it useful._

⚠️ **And the list turned out not to be about citations at all.** Its last two entries are not
citations and no citation gate flags them. **It is about any text sweep** — a grep for withdrawn
claims, a wording guard, a find-and-replace. `spec-redirect-guard-2026-09-08.md` states the mechanism
better than I can: _"a presence check cannot distinguish a claim standing from a claim quoted inside
its retraction — both states contain the string."_

---

## 4. What the brief got wrong, and why that is the interesting part

**The brief was excellent and it was wrong twice** — which is the argument for its own instruction to
re-derive rather than believe it.

1. **"24 dangling SHA citations"** was a count of tool output presented as a count of defects. **Its
   author caught this himself and sent a correction before I could act on it.**
2. **"DO THE 9 LIVE ONES AND THE 13 REPOINTS — they are unambiguous"** did not survive contact in
   either half. The 13 are all inside the dated plans the same brief said to hold for the owner. And
   7 of the 9 were false alarms — including **one that would have deleted a real finding**, because
   the register quotes a wrong path in order to report it.

**The lesson is not that the brief was careless.** It is that **a brief carrying the instruction to
re-derive its own numbers is what made being wrong harmless.**

---

## 5. 🔴 Three corrections to my own text, after I called the work finished

**All three are one shape**, and I had written the warning about that shape myself before committing
all three.

| #   | What my text said                        | What was true                                                             |
| --- | ---------------------------------------- | ------------------------------------------------------------------------- |
| 1   | "routed, **not fixed**"                  | Ward Builder Two had fixed it, within the hour                            |
| 2   | "subtract **exactly one**"               | The checker was widened; the rule became wrong in the dangerous direction |
| 3   | "fixed, **not yet folded**" (×3 clauses) | Ward Lead had folded it                                                   |

⚠️ **A statement about somebody else's state is true when written and expires the moment they act. It
carries no expiry date and nothing anywhere goes red.** The register has no mechanism for a row to
learn that its routed half was answered.

**And #2 was not caught by vigilance.** I re-read my own rule only because `761874e51d` changed the
instrument underneath it. **Had nobody touched the checker, my wrong instruction would still be live
and I would still be calling the work finished.** The transferable habit is mechanical, not
attentional: **when an instrument changes, re-read every published rule that quotes it.**

---

## 6. What the other sessions contributed — none of this was one chat's work

- **Ward Builder Four** wrote the brief, **caught his own headline number before I acted on it**, and
  asked for the honest figure rather than his own.
- **Ward Builder Two** opened the file that exposed §3.2. Told me my WB1-013 conclusion was inverted —
  **half right, and the half that was right corrected my wording.** Later shipped a diagnostic with one
  signal covering two states; when told, did not defend it and wrote **_"I had that written down. I
  still shipped it."_** That sentence is a finding: **knowing a failure mode is not immunity to it.**
- **Ward Verifier** found a Playwright run reporting exit 0 through a wrapper when the real exit was 1
  — **and the same fault was live in my own session**, where two background checks were reported
  "completed (exit code 0)" while the captured Node exit was 1 both times. Also sharpened §3.1, and
  **explicitly declined to confirm my `24 − 14 + 1 = 11` reconciliation**, confirming mechanism and
  counts only.
- **Ward Builder Three** measured the retracted-accusation file and settled a question by reaching for
  `git log -S` where others had stopped at "I cannot tell which".
- **Ward Lead** ruled WB2-101 **UNVERIFIABLE** rather than let a guessed filename manufacture safety
  coverage; **withdrew its own assignment** of the source/test class when told an assignment is not an
  acceptance; **relayed a peer's refusal to confirm rather than dropping it**; and resolved a merge
  conflict where its side held only formatting and mine held a corrected figure — **a side-pick the
  other way would have reverted a factual fix under a diff that reads as pure whitespace.**

---

## 7. The pattern that ran through the whole day

**Almost every real problem found by anyone on 2026-09-10 was something reporting success for work
that did not happen.**

| Surface                               | What it said                 | What was true              |
| ------------------------------------- | ---------------------------- | -------------------------- |
| A wrapper ending in `echo`            | exit 0                       | Playwright exited 1        |
| `npm run format` with no `.bin` shims | 0 files changed              | 95 files unformatted       |
| A background-task notification        | "completed (exit code 0)"    | the tool exited 1          |
| A fold confirmation                   | a real SHA, correctly stated | the artefact was not in it |

**Every one was caught by habit or by a peer. None was caught by a gate.** The defence that worked
each time was the same: **read the recorded result, never the reporting layer** — and for folds,
**confirm the artefact, not the SHA**: `git rev-parse <master>:<path>`.

---

## 8. State at close

```
branch  ward/citation-repair-20260908
work    11 commits by THIS chat, all docs/ward-flow/ and docs/ward-flow-ledger.md
        every one of the 11 touched documents only -- zero source, zero test files
folded  all of it; verified by content on the master line, not by ancestry
tree    clean
pushed  never — Ward Flow exists on this disk only
```

⚠️ **THE PREVIOUS WORDING OF THOSE TWO LINES WAS WRONG IN BOTH HALVES, AND THE SECOND HALF IS THE
instructive one.** It said _"6 substantive commits"_ — a count that was correct on 2026-09-08 and was
never updated — and _"ZERO source files, ZERO test files, **on the entire branch**"_.

🔴 **The branch claim was written wider than its evidence.** This branch absorbed the master line by
fast-forward merge repeatedly, so its history contains **hundreds of other sessions' commits, many of
which do touch `src/` and `tests/`**. A range query from an old base returns all of them. **The true
claim is about THIS CHAT'S commits, not about the branch**, and it is narrower and still worth making.

**Re-derive it rather than believing this file** — the claim is only as good as the SHA list it is
scoped to:

```bash
for c in 8e1a7a18b5 dcdba94dc4 f4ee72d830 ef0dc80196 16b278d0ed 4fdf13de62          1f6ff678c1 8e9f1fe1b9 f4c9c6be99 364bd60bd9 ae7a94bd3b ; do
  git diff-tree --no-commit-id --name-only -r $c | grep -qE '^(src|tests|worker|supabase)/'     && echo "$c TOUCHES CODE"
done   # measured 2026-09-10: no output, 0 of 11
```

**It was a subagent that exposed this**, by running the range query I asked for and reporting that it
returned 171 commits rather than nothing. **The brief was mine and the range in it was wrong** — the
agent did exactly as asked and the answer disagreed with my published sentence. **A verification that
can only confirm you is not a verification**; this one could disagree, and did. See §7, and
[[a-measurement-is-scoped-to-what-it-measured]].

**Both owner decisions resolved as recommended:** the checker fix went through the owner and another
session landed it; **no supersession banners** were added to the 85 dated plans.

## 9. ⚠️ Open, and owned by nobody

1. **58 test files named in dated plans were never written.** `git log --all --diff-filter=A` shows
   79 of 81 cited-but-absent paths were never created on any branch at any point. **Not a citation
   problem — planned safety-checking that does not exist.** The largest thing this work surfaced.
2. **Wrong paths cited inside source and test code.** Invisible to every gate by construction. Ward
   Lead ruled it its own, then withdrew that. **Size unknown, because nothing has ever looked.**
3. **WB2-101's real guard filename.** Two plausible candidates; naming either would manufacture the
   reassurance the row cannot support. Left **UNVERIFIABLE** deliberately.
4. **WB-DB-18's ledger row still reads `ASSIGNED`** while `728947769f` says the decision landed.
   Flagged, never changed — a status is a claim about work.
