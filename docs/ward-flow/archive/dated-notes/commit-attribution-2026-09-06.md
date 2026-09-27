# Who built Ward Flow — a capture, made 2026-09-06 because the source expires

**This file and its companion `commit-attribution-2026-09-06.tsv` are a SNAPSHOT, not a query.**
They record which branch each Ward Flow commit was **created on**, taken from this machine's git
reflogs on 2026-09-06. They exist because that evidence is going to disappear, quietly, and nothing
will mark the moment it does.

## Why a capture rather than a command

Three facts, each measured here rather than recalled:

1. **The commit objects cannot answer it.** Every chat on this machine commits as
   `BigSimmo <87357024+BigSimmo@users.noreply.github.com>`, author and committer identical. Author
   does not discriminate at all.
2. **`git branch --contains` cannot answer it either, and looks as though it can.** It discriminates
   only while a commit still lives on one branch; after a fold every commit is contained by every
   branch. `0f6e38520` sits on five.
3. **The per-branch reflogs CAN answer it.** A branch that _made_ a commit logs the action
   `commit:`; a branch that _received_ it logs `merge`, `pull`, `reset` or a fast-forward. So a fold
   **adds** a different kind of evidence rather than destroying the original.

⚠️ **Three sessions have independently concluded that no git command answers this question.** The
wrong answer is the one reachable by sound reasoning from true premises, which is why it keeps being
reached — and why it is written down here rather than left to be rediscovered.

## 🔴 Why it had to be done now

**Reflogs are local and they expire.** The documented expiry is 90 days, 30 for unreachable objects.
**That is not the real deadline.**

**Deleting a branch deletes its reflog** — `logs/refs/heads/<name>` goes with the ref. So the record
of who wrote what survives a fold and **does not survive a tidy-up**. On this machine worktrees have
been swept mid-session twice. A 90-day expiry is something you plan around; _"until somebody tidies
up"_ is not.

Measured on this machine on 2026-09-06, in this worktree:

- **405 branches, 405 branch reflog files, zero orphans in either direction.** That alone proves
  nothing — it is equally well explained by nobody ever having deleted a branch.
- **`logs/HEAD` names 28 distinct checkout endpoints; 16 still resolve and 12 do not.** Those twelve
  are the load-bearing half. They are gone, and their reflogs went with them:

  ```
  claude/agents-merge-deploys-rule          codex/clear-outstanding-ledger
  claude/d4-autodeploy-correction           codex/specifiers-nav-search
  claude/issues-reconcile-2026-08-19        gemini/clinical-data-lexicon-integrity
  claude/search-recovery-rail               gemini/design-tokens-source-contracts
  gemini/safe-tooling-ui-and-crossmode-hardening
  gemini/safe-tooling-ui-layout-and-workflow-hardening
  gemini/test-infra-tooling-hardening       gemini/test-safety-ci-hardening
  ```

⚠️ **And one branch is now load-bearing for a claim made elsewhere.**
`claude/ward-builder-two-modes` is the sole evidence that Ward Builder Two authored `0f6e38520`,
which is cited as an observation in §12 of the three-chat working agreement. **Delete that branch and
that observation silently degrades to hearsay, with nothing marking the change.**

## What the `.tsv` contains, and the gap you must read in it

Columns: `sha`, `created_on_branch`, `attribution`, `authored_at`, `subject`.
Population: every commit reachable from the six live Ward Flow refs and **not** reachable from
`origin/main` — i.e. the unpushed ward work, which is all of it.

`attribution` takes one of four values, and **the second one is a known gap, not an unknown author:**

| value                    | meaning                                                                                                                                                                                                                                                                       | count |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: |
| `commit`                 | exactly one branch reflog records this commit being **created** on it. `created_on_branch` is that branch.                                                                                                                                                                    |  1903 |
| `merge-not-attributable` | 🔴 **a merge commit. This method CANNOT attribute it, by construction** — a merge logs `merge <sha>:` rather than `commit:`. `created_on_branch` is deliberately empty. **An empty cell here means "this method is silent", never "nobody knows" and never "nobody did it".** |   266 |
| `reflog-gone`            | an ordinary commit with no `commit:` entry in any surviving reflog. Its branch was deleted, or its entry aged out.                                                                                                                                                            |    38 |
| `ambiguous`              | more than one branch reflog claims creation. None occurred in this capture.                                                                                                                                                                                                   |     0 |

🔴 **The merge gap is systematic and it falls entirely on one role.** Folding is Ward Lead's job, so
**this capture attributes every builder's work and none of the coordination that assembled it.** A
reader in six months would otherwise find a history in which five chats built things and the folds
appear to have no author. They have an author; this instrument cannot see them.

## Two further limits, stated where they can be read

- **It attributes a BRANCH, not a chat.** The branch is a good proxy here only because the ownership
  registry maps branches to chats one-to-one. **It is a proxy.** A second session working in the same
  worktree would be invisible to it, and two chats that shared a branch would be merged into one name.
- **A rebase or cherry-pick makes a new sha.** The capture truthfully names where _that sha_ was
  created, which is not necessarily where the work was done.

## Provenance of this file

Captured 2026-09-06 by Ward Builder Four, on the instruction of Ward Lead, from
`D:/Repos/Database/.git/logs/refs/heads` (405 files) against the six live ward refs.

⚠️ **Two runs twenty minutes apart returned 2204 and 2207 commits.** Three commits landed in the
interval, from chats still working — which is the clearest possible illustration of what this file
is. **It is a photograph of a moving thing, and its date is part of its content.** Re-running the
method later will not reproduce it, and should not be expected to.

Method, for anyone re-cutting this: walk `logs/refs/heads/**`, split each line on the tab, take the
**new** sha (field 2 of the space-separated head) where the message begins `commit`, and map it to
the file's path. ⚠️ Do not match loosely on "file contains the sha and contains the word commit" —
that matches a sha appearing as the _old_ value of any line and gives right answers for the wrong
reason. And write it in Python: a literal tab passed through a shell tool layer has silently become
the letter `t` on this machine, which splits on nothing, finds no message field, and reports that
nothing was authored anywhere — indistinguishable from a real negative.
