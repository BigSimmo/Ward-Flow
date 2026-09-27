# Ward citation repair — handover

**Written 2026-09-08 by Ward Builder (citation repair), worktree `D:/Worktrees/Database/ward-builder`,
branch `ward/citation-repair-20260908`. Handed to Ward Lead.**

> ⚠️ **Everything numeric below is an observation with a timestamp, including the "all landed" claim.
> Re-derive before acting. Every assertion here carries the command that re-takes it, which is what
> makes being wrong about it harmless.**

---

## The bottom line

**The ward citation debt was reported as 118 items. Two of them were defects.** Both are repaired.
The other 116 are correct citations that the instrument cannot read.

| Reported                                                            | Actually defective | What the rest were                                                                                                                           |
| ------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 24 dangling SHA citations (**11** since the 2026-09-09 checker fix) | **0**              | blob hashes, tree hashes, patch-ids, sha1/sha256 checksums, task-output filenames, one deliberate fabrication kept as evidence               |
| 94 dangling path citations                                          | **2**              | 79 never built, 13 routes that moved, hypothetical examples, proposed files, untracked scratch probes, one wrong path quoted _as_ the defect |

**Nothing here required a code change, and the one that looked most like a repointing job was the one
that most needed leaving alone.**

---

## State at handover

```
branch   ward/citation-repair-20260908
cut from codex/task-ward-flow-live-state-20260831 @ 05792e7a3f
repairs  8e1a7a18b5, dcdba94dc4, f4ee72d830  -- ALL THREE ALREADY ON THE MASTER LINE
merged forward four times: 9add828165, 58bebf2f3b, 508a6b8406, 131f55e5bc
tip      level with the master line at 131f55e5bc when this line was written
```

✅ **All three repair commits were already folded to the master line by Ward Lead before this handover
was written** — verified both by ancestry and by reading the merged file content, because a reachable
commit and a landed change are different claims:

```bash
for c in 8e1a7a18b5 dcdba94dc4 f4ee72d830 ; do
  git merge-base --is-ancestor $c codex/task-ward-flow-live-state-20260831 && echo "$c ON MASTER"
done
git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/register/REGISTER-2026-09-02.md \
  | sed -n '/^| WB2-101 /p' | grep -o '\*\*UNVERIFIABLE\*\*'
```

**There is nothing of mine left to merge, and nothing uncommitted.**

---

## The instrument, and the two ways it lies

```bash
node scripts/check-ward-citations.mjs             # 0 clean · 1 a citation broke · 2 REFUSED
node scripts/check-ward-citations.mjs --selftest  # must exit 1
```

**Proved able to fail before any result was believed, 2026-09-08:**

- `--selftest` exited **1**, re-proved on the WIDENED checker 2026-09-10 (see the update below).
  🔴 **THE SUBTRACTION RULE THIS LINE USED TO GIVE IS NOW WRONG, AND WRONG IN THE DANGEROUS
  DIRECTION.** It said "injects one impossible SHA and one absent path, subtract one from each".
  The fix at `761874e51d` added a SECOND injected SHA — a full 40-hex string — so the naive rule
  is now "subtract two". **Do not use that either.** Measured 2026-09-10: selftest 12 unresolved,
  real run 11 — **a difference of ONE, not two.**

  ⚠️ **The reason is worth more than the number: one canary is ALREADY IN THE CORPUS.**
  `deadbeefdeadbeef` is quoted verbatim in `docs/ward-flow/builder-prompts-2026-09-08.md:105`
  and `docs/ward-flow/merge-to-main-survey-2026-09-08.md:210`, both of which document how the
  selftest works. The injection is a `Map.set`, so re-adding a key already present grows nothing.
  **Two documents describing the check permanently added a finding to it**, and the checker can
  never exit 0 while they exist. Subtract by NAMING the canaries in the output, never by
  arithmetic.

- A run from outside the repository exited **2** with `REFUSED: could not read any of: docs (ENOENT).`
- All seven branches in its `BRANCHES` list resolve. **Check this first whenever a count looks wrong**
  — on 2026-09-08 a stale list manufactured 231 of 325 reported missing paths.

### 🔴 Lie 1 — it cannot tell a commit from any other git object

It matches `` `[0-9a-f]{7,40}` `` and tests only `^{commit}`. A blob hash, a tree hash, a patch-id, a
sha256 checksum and a hex filename are all reported identically as "UNRESOLVED SHA".

**All 24 reported SHAs were correct citations.** Classified with `git cat-file -t`: **12 blob, 2 tree,
10 not a git object at all.** The 10 read, in their own documents' words, as 2 patch-ids in a table
whose column heading is literally `patch-id`, 4 content checksums ("restored to sha256 …", "baseline
hash …"), 3 zero-byte agent output filenames, and `2c9a2d7`.

⚠️ **"It resolves to a blob" is not evidence on its own, and the first two analyses of this stopped
there.** These are 7–12 character prefixes and `git cat-file -t` resolves by prefix, so the hits could
have been an artefact of repository size. **The control:** 20 random 8-hex strings against ~304,000
objects → **0 of 20 resolved**. Run independently by Ward Lead, same answer. The hits are real.

⚠️ **And resolving is still not the same as being cited correctly** — a document could call a blob a
commit, which is a real defect of another shape. All eight distinct blob sites were read: _"blob
`51263c10`"_, _"source hash `a951bc77` before and after"_, _"component restored to hash `e0e496cd0`"_.
None claims to be a commit.

**The fix belongs in the checker — try `^{blob}` and `^{tree}` before giving up — not in the
documents. Repairing any of them would replace a correct citation with a wrong one.**

✅ **FIXED 2026-09-09 at `761874e51d`, by another session, not by this chat** — the change was
outside the documents-only remit and went to the owner, which is how it should have gone. The
checker now tries commit, then blob, then tree, and REPORTS THE TYPE (`commit: 765  blob: 13
tree: 2`) rather than passing silently.

🔴 **AND IT WAS RE-PROVED ABLE TO FAIL AFTERWARDS, WHICH IS THE POINT.** Widening what a check
ACCEPTS is the moment it can become a check that accepts anything — strictly worse than the one
it replaced, because it would call every genuinely dangling citation clean. The author saw this
and injected a full 40-hex non-object as a second canary. **Verified independently 2026-09-10:
selftest still exits 1 and names all three injections, including the 40-hex one.** The intent is
not the proof; the run is.

**The audit reconciles exactly, which is the strongest evidence either way:** 24 originally
unresolved, **+1** (`deadbeefdeadbeef`, from a document written after the first scan), **−14**
(the 12 blobs and 2 trees this audit identified) = **11 today**. ⚠️ **This reconciliation rests on
ONE session's measurement and has NOT been independently confirmed.** Ward Verifier re-derived the
canary MECHANISM and the counts, and said explicitly that it was not confirming the arithmetic.
**Two people agreeing on the mechanism is not two people agreeing on the sum** — re-run it before
quoting it. Every one of the 11 is one of
the ten correct non-git-object citations catalogued below, plus the canary. **Still zero
defects in the SHA half.**

### 🔴 Lie 2 — it walks `docs/` only, so it cannot see the other half of the problem

**A wrong path cited inside source or test code is invisible to it by construction.** This is not a
bug; it is the edge of what it measures, and it means **the 118 is the citation debt in the documents
and must never be reported as the repository's citation debt.**

The proof arrived by accident: `tests/ward-morning-tour.dom.test.tsx:139` cites
`tests/ward-morning-tour-paused.test.tsx`, which does not exist — uncaught by anything, covered by no
register row, and found only because Ward Builder Two opened the file. Meanwhile a _document_ quoting
that same string was flagged.

⚠️ **Ward Lead has ruled this class is Lead's to close. An assignment is not an acceptance** — if it
is not started, it should sit as an open _unowned_ item, or it acquires the appearance of coverage.

---

## What was repaired

| Commit       | What it did                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `8e1a7a18b5` | `docs/ward-flow-ledger.md` — WB-DB-18's row said its text was "drafted in `docs/ward-flow-decision-wb-db-18.md` … ready to paste after DB-17". **That file was not missing: it was a paste-and-delete handoff deleted with the owner's explicit approval at `728947769f`**, whose message records that WB-DB-18 "landed in the ward board spec and is live there". Found by `git log --all --diff-filter=A`, not by observing its absence. The clause now says what happened and tells the reader not to look. |
| `dcdba94dc4` | `REGISTER-2026-09-02.md` WB1-013 — closed. The row was **true when written and never updated**: `5c71720edb` ("fix a comment citing a missing file", ancestor of the master line) changed that exact comment from `.test.ts` to `.dom.test.tsx`. Carries the uncovered `ward-morning-tour.dom.test.tsx:139` finding as routed — **since fixed by Ward Builder Two at `514f7c3b4b` and **FOLDED to the master line, verified 2026-09-10 by reading line 139 there.**                                            |
| `f4ee72d830` | `REGISTER-2026-09-02.md` WB2-101 — **`**TESTED**` → `**UNVERIFIABLE**`**, on Ward Lead's ruling. The row asserted that ward screens cannot reach the coordinator's private information and named `tests/ward-flow-module-graph.test.ts` as its guard. `git log --all` shows that file was **never created on any branch at any point.**                                                                                                                                                                        |

**On WB2-101, what was deliberately NOT done and why.** No filename was substituted. Two candidates
exist — `collectModuleGraph` is used by exactly two tests, `ward-referral-matching.test.ts` and
`ward-referral-screen-boundary.test.ts` — **and one of them is probably right, which is exactly what
makes guessing dangerous.** A plausible name in a field asserting safety coverage manufactures the
reassurance the row cannot support. They are recorded in the NOTE explicitly as _"A LEAD, NOT
COVERAGE"_. The mutation evidence and the FILE column are byte-identical.

---

## 🔴 Citations that must NEVER be "repaired" — the exemption list

**Each of these is a wrong string that is doing a job. Repairing it destroys the record.** None has
been suppressed in the checker: they stay reported, because an exemption is a small silent claim that
a string is known-good, and prose a reader can check is better than a flag they cannot see.

| Citation                                                               | Where                                                                         | Why it must stand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2c9a2d7`                                                              | `register/ward-lead-findings.md` WL-022                                       | ⚠️ **A fabricated SHA deliberately left standing beside its own correction.** The row says _"I quoted a commit SHA I had invented"_ and names the real one, `9d73ac158` (verified: resolves to a commit). **The dangling SHA IS the evidence of a caught fabrication.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tests/ward-morning-tour-paused.test.ts`                               | `REGISTER-2026-09-02.md` WB1-013, CLAIM column                                | The path is quoted **in order to be described**. Replacing it deletes the finding and leaves the row describing nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tests/ward-flow-module-graph.test.ts`                                 | `REGISTER-2026-09-02.md` WB2-101, FILE column                                 | An **open unknown**, not a known-good exception. It should keep reporting until somebody can name the real guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/app/mockups/development/foo/widget.tsx`                           | `verifier-findings-2026-09-03.md`                                             | A fictional path in a table illustrating how a gate behaves. There is nothing to fix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ward-release-notes.ts`, `ward-referral-dynamic-leak.ts`               | `triage/wf-build2-006-batch-b.md`, `-c.md`                                    | Files a triage document **proposes**, under a heading reading "**New file**". Proposals, not claims of existence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| three `scratch_*` / `zz-scratch-*` test probes                         | `cleanup-awaiting-approval.md`, `builder-plan-2026-09-01/`                    | **Untracked files that really exist.** Two confirmed physically on disk — `ward-referral-process/tests/scratch_forensic_probe.test.ts` (1897 bytes) and `ward-error-boundary/tests/scratch_ward_accept_bypass_probe.test.ts` (8487 bytes). The documents are accurate and say why they cannot be removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `deadbeefdeadbeef`                                                     | `builder-prompts-2026-09-08.md:105`, `merge-to-main-survey-2026-09-08.md:210` | 🔴 **THE CHECKER'S OWN CANARY, quoted by two documents that EXPLAIN the selftest.** Injection is a `Map.set`, so it does not add a row — **it OVERWRITES THE ATTRIBUTION of a row already in the corpus.** Measured in this session's two runs: the selftest credits it to `<selftest>:0`, the real run to `builder-prompts-2026-09-08.md:105`. **Same string, same count, different author** — which is why selftest minus real is ONE while TWO SHAs are injected, and why a diff of the two runs states it more clearly than either run alone. (Mechanism sharpened by Ward Verifier, re-derived here from this session's own output rather than taken.) **Writing down how the check works permanently added a finding to it, and the checker can never exit 0 while these documents exist.** Do not repair, do not exempt, and do not subtract the canaries by arithmetic — name them in the output. |
| the retracted phrase _"the merge plan takes main's side on that file"_ | `spec-redirect-guard-2026-09-08.md`                                           | ⚠️ **NOT A CITATION — the checker never flags this, and that is the point of listing it.** It is a false accusation about a peer, **quoted inside its own retraction** so there is a trace the accusation was made. Measured: the handover mentioned it 0 times, the file carries it once. **A sweep that "corrects" it erases the evidence the accusation was ever made** — the whole reason it was retracted in place rather than deleted. Found by Ward Builder Three, routed by Ward Lead.                                                                                                                                                                                                                                                                                                                                                                                                            |

⚠️ **The general rule, and it generalises past this list:** _a document about a wrong identifier will
contain the wrong identifier — that is what makes it useful._ **Assume any unresolvable citation
sitting next to its own correction is deliberate until the sentence around it has been read.**

🔴 **AND THE LIST IS NO LONGER ONLY ABOUT THE CITATION CHECKER — the last two rows are not
citations at all.** One is the checker's own canary, arriving via documentation OF the checker;
the other is a retracted accusation that no citation gate has ever flagged. **The rule is about
ANY text sweep over these documents** — a grep for withdrawn claims, a wording guard, a
find-and-replace. `spec-redirect-guard-2026-09-08.md` states the mechanism better than this file
can: _"a presence check cannot distinguish a claim standing from a claim quoted inside its
retraction — both states contain the string."_ Read the surrounding context
(`grep -o ".\{300\}<phrase>.\{300\}"`), never the count. **Done properly, the more retractions a
record contains, the more hits a naive sweep returns, and the worse an honest record looks.**

---

## The 85 dated plans — recommendation, not a decision

The instrument splits the 94 missing paths by **where they are cited**: 9 in live documents, 85 in
dated plans under `docs/superpowers/plans/`. The proposed remedy has always been a supersession banner
on the plans.

🔴 **Two findings that change what such a banner could honestly say:**

1. **The "13 repointable" citations are not a separate group — all 13 live inside dated plans.** They
   are a subset of the 85, not work that could be done without the owner's steer. The two instructions
   "do the 13 repoints, they are unambiguous" and "the dated plans need the owner first" covered the
   same documents.
2. **79 of the 81 paths that resolve nowhere were never created on any branch at any point.** Only 2
   ever existed. Re-derive with:
   ```bash
   git log --all --oneline --diff-filter=A -- <path>   # empty ⇒ never created
   ```

**So "the structure moved underneath the plan" is false for essentially all of them. A banner saying
so would be a NEW false statement in 79 cases.** The plans are not stale; they are plans whose intent
was never built.

For completeness, the structural move is real for the routes that did move —
`src/app/ward-management/** → src/app/mockups/ward-flow/**` resolves for 11 of 13; `clock/page.tsx`
has no counterpart and `discharge/page.tsx` would become `discharges/page.tsx`, a rename rather than a
move. **But `src/components/ward-management/**` did NOT move and still exists**, so the 22 missing
paths beneath it are a different story from the routes.

**Recommendation to the owner: no banners.** Ward Lead concurs.

---

## Open items at handover

| Item                                                                                                      | Owner                                                                                                                                     | State                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner decision — supersession banners on the 85 dated plans**                                           | Josh                                                                                                                                      | Put to him with the recommendation **no banners**. Unanswered at handover.                                                                                                                                                                                                                                                                                                                                                   |
| **Owner decision — may `scripts/check-ward-citations.mjs` be fixed** to distinguish blob/tree from commit | Josh                                                                                                                                      | Outside this chat's documents-only remit, so his call. **Would clear 24 of the 118 permanently.** Unanswered at handover.                                                                                                                                                                                                                                                                                                    |
| **Wrong path citations inside source and test code** — invisible to every gate                            | **OPEN, OWNED BY NOBODY** (Ward Lead withdrew its own assignment at `8cf0b70627`, on the grounds that an assignment is not an acceptance) | **The class is untouched and its size is unknown, because nothing has ever looked.** The one known instance, `tests/ward-morning-tour.dom.test.tsx:139`, was fixed by Ward Builder Two at `514f7c3b4b` on `ward/reword-arms-20260908` (**folded, verified 2026-09-10**) — ⚠️ **one instance closed is not the class closed**, and that file is inside the 2026-09-06 retirement, so its suite reports 9 skipped, 0 executed. |
| **WB2-101's real guard filename**                                                                         | Unowned                                                                                                                                   | Ward Builder Two declined (predecessor's row); Ward Lead ruled UNVERIFIABLE rather than guess. Stays open by design.                                                                                                                                                                                                                                                                                                         |
| **WB-DB-18's row still reads `ASSIGNED 2026-08-29`** while `728947769f` says the decision landed          | whoever owns the ledger                                                                                                                   | **Flagged, not changed.** A status is a claim about work, not a citation, and was not this chat's to make.                                                                                                                                                                                                                                                                                                                   |
| **58 test files named in dated plans that were never written**                                            | Unowned                                                                                                                                   | Surfaced, not chased. **Not a citation problem — it is planned safety-checking that does not exist.** Out of this chat's scope.                                                                                                                                                                                                                                                                                              |

---

## What this chat did not do, deliberately

- **Touched no source file and no test file.** Every repair is in `docs/`.
- **Deleted nothing.** No stale document was removed to clear a citation.
- **Pushed nothing and opened no PR.** Ward Flow is never pushed.
- **Added no checker exemption or allowlist entry** for any of the deliberate wrong strings.
- **Guessed no filename** into a field asserting safety coverage.
- **Stayed off** `statistics/**`, `ed/**` and `ward-referrals.ts` throughout.

---

## The one process note worth keeping

**Five sessions exchanged SHAs for the master line today and at least six of those exchanges were
stale on arrival, in both directions, including one false "we are in sync".** Ward Lead named
`8a46ed0b50`; by the time it was merged the line was `9add828165`; it was `58bebf2f3b` an hour later
`508a6b8406` an hour after that, and `131f55e5bc` at this handover. **Every one of those numbers was true when written.**

The habit that survives it: **merge the master line before finalising any claim of absence.** "This
path does not exist" and "this SHA does not resolve" are both claims about a tree, and a tree five
commits stale will report a citation somebody just created as dangling.

🔴 **AND THE SYMMETRIC RULE, WHICH THIS DOCUMENT LEARNED BY HAPPENING TO IT DURING ITS OWN HANDOVER.**
Ward Lead confirmed the fold at `f4ee72d830`. This file was committed at `ef0dc80196`, minutes later.
**The confirmation was true, the fold was real, and the file was not in it** — measured, not inferred:

```bash
git merge-base --is-ancestor ef0dc80196 codex/task-ward-flow-live-state-20260831   # -> NO
git rev-parse codex/task-ward-flow-live-state-20260831:docs/ward-flow/citation-repair-handover-2026-09-08.md
```

**A fold confirmation is a claim about a SHA, not about a branch, and the branch may have grown a
commit since.** Nobody was wrong and the artefact still was not there. **Confirm the artefact, not the
fold** — `git rev-parse <master>:<path>` answers the question a SHA cannot.

⚠️ The failure is quiet in the direction that matters: an unfolded document is not lost — the branch
ref and objects live in the shared repository, so a worktree sweep cannot take it — **it is merely
invisible to every chat reading `docs/ward-flow/` from the master line, which is the one property a
handover is written to have.**
