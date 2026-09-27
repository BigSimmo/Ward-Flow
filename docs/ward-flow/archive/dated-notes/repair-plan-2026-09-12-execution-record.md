# Repair plan — execution record, 2026-09-12

**Brief: `docs/ward-flow/repair-plan-2026-09-12.md` at `846457c8177a07859f5253ddab42965fb5747bf0`.**
**Executed by Ward Lead at the owner's instruction. Every step's PROOF below is quoted from the run
that produced it, never described.**

⚠️ **Written STEP BY STEP AS EACH LANDED, not assembled afterwards — the owner's third condition. A
record written after the fact records what the writer remembers, which is the thing under test.**

---

## 🔴 THREE OF THE BRIEF'S OWN FIGURES HAD ROTTED BEFORE EXECUTION BEGAN

**The owner's first condition was to re-derive every number before acting on it. It paid for itself
three times in the first twenty minutes, and the brief predicted exactly this about itself:**

> _"A count in a brief is a pin that invalidates itself silently — that lesson was earned twice
> tonight, once inside a guard's own header."_

    STEP 1  "The Lead's recorded worktree no longer exists."
            🔴 FALSE. It exists, and so do all three:
              C:/Users/joshs/.codex/worktrees/ward-flow-live-state-20260831/Database   EXISTS
              D:/Worktrees/Database/ward-builder-community-route                       EXISTS
              D:/Worktrees/Database/ward-verifier-9afb82c6e                            EXISTS
            ⚠️ That premise is the brief's stated REASON for releasing by hand instead of using
            `certify-reset`. It is the load-bearing fact of the step, and it is wrong.
            → HANDED BACK TO THE OWNER. Not executed.

    STEP 3  "~/.claude/hooks/issues-surface.sh … OUTSIDE the repository, affecting EVERY project
            on this machine."
            🔴 NO SUCH FILE. The live hook is `.claude/hooks/issues-surface.sh`, INSIDE this
            repository, registered by this repository's own settings.json.
            ⚠️ This is lesson 1 of the brief's own list — "a brief named a real, plausible, WRONG
            file" — committed by the brief that records the lesson.
            ✅ The blast radius is therefore SMALLER than the owner authorised, not larger. Executed.

    STEP 3  "69 requests pending, oldest 2026-09-02."
            ✅ TRUE, re-derived: 69 files, oldest `createdOn` 2026-09-02, newest 2026-09-12 — and
            all 69 carry that field, so the oldest is over the whole population and not a subset.

---

## STEP 0 · BACKUP — DONE

**PROOF, from the run's own final lines:**

    == DONE ==
      5922 files, 3.3G, at /c/Users/joshs/Backups/claude-work/2026-09-12T051308Z
      Manifest: /c/Users/joshs/Backups/claude-work/2026-09-12T051308Z/MANIFEST.txt

**The manifest names the ward worktrees — 17 matching lines, including all six of tonight's lane
branches:**

    ward/lane-a-command-delays-movement-capacity-20260910  faf183c5b089315d3e82cb030ba9a961ff119d8a
    ward/lane-b-ward-board-ed-community-20260910           a5851c752e4987156956582607baad1bc149e442
    ward/lane-c-search-patient-referral-20260910           d4a03f4a7c4b094cfec490fbd2cb517d56ca0d3c
    ward/lane-d-statistics-20260911                        261412f95a803e951e53b257cb793995de3f8ee2

✅ **Those six names were added to the backup's verified list an hour before this run, and this is the
first run to assert them. Before that they were bundled but never checked — and a bundle that
silently dropped one would still have reported success.**

---

## STEP 3 · THE PENDING-REQUEST COUNT AT SESSION START — DONE

**What the session summary read before: only `docs/outstanding-issues.md`, the RECONCILED ledger. A
request lives in `docs/outstanding-issues-inbox/` as JSON until `issues:reconcile` runs, so a backlog
can grow for days while the summary reports a healthy, unchanged open count.**

**PROOF — the hook's own output, run with a real payload:**

    [issues] Outstanding-work memory — 121 open (7×P1, 78×P2, 36×P3). …
    [issues] 69 request(s) PENDING reconciliation, oldest 2026-09-02 — not in the count above and
             not in docs/outstanding-issues.md until `npm run issues:reconcile` runs.

**PROOF THAT IT IS ADDITIVE, which the brief required in bold — the before/after diff of the hook's
entire output, not an assurance:**

    $ diff out-before.txt out-after.txt
    1a2
    > [issues] 69 request(s) PENDING reconciliation, oldest 2026-09-02 — …

    27 lines before · 28 lines after

🔴 **`1a2` and nothing else. One line ADDED, no line changed, no line removed.**

⚠️ **TWO DEFECTS IN MY OWN FIRST ATTEMPT, recorded because both printed something plausible:**

1. The date extraction was written with a `sed` backreference that arrived at the file as a raw
   **0x01 control byte** — a backslash was eaten in transit. The hook still ran, still exited 0, and
   printed `oldest ` with nothing after it. **A silently empty field in a line that otherwise reads
   correctly.** Replaced with `cut -d'"' -f4`, which needs no backslash at all.
2. The em dash arrived as mojibake and printed as `â`. Repaired at byte level.

✅ **Neither was caught by reading the script. Both were caught by RUNNING it and reading the output
— which is the only reason the step has a proof rather than an assurance.**

**The oldest date is taken from each request's own `createdOn`, never from file mtime: a copy, a
restore from backup or a checkout rewrites mtime and would silently make the backlog look younger
than it is.**

**UNDO** revert this commit. The hook is read-only, guarded at every step, and still exits 0 on a
missing directory, an unreadable file, or a grep that matches nothing.

---

## STEP 1 · THE THREE DEAD ROLE CLAIMS — RELEASED, WITH RECORDS

🔴 **THE BRIEF'S REASON WAS WRONG AND ITS ACTION WAS RIGHT. Both halves matter, because the
reason is what the next person reuses.**

**The brief: release by hand, because `certify-reset` needs the dead chat's worktree to still exist
and the Lead's is gone.** Measured: all three worktrees EXIST — so I stopped and handed it back.

**Then I read `certifyReset` itself, which neither of us had opened:**

    it requires   a HANDOVER PATH, committed at HEAD, byte-identical to the working file, the
                  NEWEST committed record for its role, introduced alone, on the integration
                  branch, a clean worktree — and the active lease must match that handover's
                  instanceId, generation, sha256 AND ownedPaths
    it never      inspects a worktree at all

**Handover records in the whole programme: TWO.**

    0301fef1…   role lead      ward-lead-20260831-claude-b       generation 1
    a60d51ea…   role verifier  ward-verifier-20260831-claude-a   generation 1

**The three held leases:**

    lead       ward-lead-20260831-claude-c        generation 2
    builder    ward-builder-20260901-claude-a     generation 1
    verifier   ward-verifier-20260901-claude-a    generation 2

🔴 **Both records are from the PREVIOUS generation. Neither matches the lease it would retire, and
the builder has NO record at all.** ✅ **So none of the three chats stood down before stopping —
which is both why the claims were stuck AND why the supported route could not unstick them.**

⚠️ **A right action resting on a wrong reason passes every review, because reviewers check whether
the action is right.** That is the second instance in this one plan.

### PROOF, quoted from the runs

    lead      ward-lead-20260831-claude-c      gen 2  worktree EXISTS
    builder   ward-builder-20260901-claude-a   gen 1  worktree EXISTS
    verifier  ward-verifier-20260901-claude-a  gen 2  worktree EXISTS
    3 lease(s) retired, each with a record beside it.

    active/  — empty

    lead      active lease present: false  -> acquireLease's "already leased" refusal cannot fire
    builder   active lease present: false  -> acquireLease's "already leased" refusal cannot fire
    verifier  active lease present: false  -> acquireLease's "already leased" refusal cannot fire

✅ **The hash was computed with the control plane's OWN exported `sha256` and `canonicalJson`, never
by hand** — a wrong hash produces a filename that looks exactly right and is not the record the
tooling looks for. **Both hash forms were cross-checked and the script refuses if they disagree.**

✅ **The RECORD is written BEFORE the move, deliberately.** If the move then failed, the result is a
record of an unreleased lease — visible and recoverable. The other order produces a release with no
record, which is a deletion wearing a softer word.

⚠️ **Each record states that the worktree STILL EXISTS.** A release record repeating the brief's
"holder gone; worktree absent" would have written a false statement into the permanent record of the
act — and it is exactly the kind of sentence a later reader quotes instead of re-deriving.

**UNDO** move the three `.lease.json` files back from `history/<role>/` to `active/`. Nothing else
changed. Nothing was deleted.

---

## STILL TO COME IN THIS SITTING

    STEP 1  🔴 HANDED BACK — its premise is false (see above). Not executed.
    STEP 2  ⏳ BLOCKED ON STEP 1. Pointing D-5 at a lease held by a chat that ended would be
            WORSE than the marker it replaces, not better.
    STEP 4  in flight
    STEP 5  in flight — wire, run once, record the count, fix nothing
    STEP 6  handed to a lane, with Ward Verifier checking the result rather than the lane
