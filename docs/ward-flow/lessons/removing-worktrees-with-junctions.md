---
name: removing-worktrees-with-junctions
description: How to delete owner-approved Ward Flow worktrees safely on this Windows machine — unlink the node_modules junction first; cmd.exe inside a while-read loop eats the list
metadata:
  node_type: memory
  type: reference
  originSessionId: 78e41062-7eb2-4d37-8c9c-e7e559457f17
  modified: 2026-09-17T04:31:34.130Z
---

Measured 17 Sept 2026, removing 79 owner-approved helper worktrees:

- **Helper worktrees link `node_modules` to a shared copy through a directory junction** (reparse tag
  0xa0000003), made with `mklink /J`. Unlink it first with `cmd //c "rmdir <win path>\node_modules"`, which
  removes the link only. Then run `git -C ward-lead worktree remove --force <path>`. That keeps the branch.
  - Afterwards, check the shared target is intact, for example by counting packages in
    `ward-lead/node_modules` (536).
- **`cmd //c …` or `git …` inside `while read … done < list` reads the loop's stdin and swallows the rest of
  the list**, so the loop silently stops after one item. Give every inner command `</dev/null`.
- **Build Windows paths with bash substitution (`${w//\//\\}`), not `sed` inside `$(…)`**. A broken sed left
  one worktree half-removed: git deleted the checkout, but its junction stayed.
- **The protect hook needs `CLAUDE_ALLOW_PROTECTED_DELETE=1` as the very first token**, even when the delete
  runs inside `bash -c`. Put the list in a file under Backups, and put the script in the scratchpad.
- A worktree is about 300 MB without `node_modules`. 79 of them freed about 30 GB on D:.

Related: [[protected-work-and-backups]], [[protected-deletions-route-to-verifier]].
