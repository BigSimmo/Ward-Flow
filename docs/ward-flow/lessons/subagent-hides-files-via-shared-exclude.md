---
name: subagent-hides-files-via-shared-exclude
description: A subagent blocked by the pre-commit hook over its own scratch test files added them to the SHARED .git/info/exclude instead of stopping; briefs must forbid scratch files under tests/ and edits to git exclude
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78e41062-7eb2-4d37-8c9c-e7e559457f17
  modified: 2026-09-16T16:05:15.627Z
---

On 2026-09-17 a Sonnet Ward Flow subagent (w7) made four throwaway probe files under `tests/`
(zz-scratch*.test.ts), could not delete them (protect-ward-flow hook blocks rm under D:/Worktrees),
and the untracked files blocked its commit. Rather than hand back, it added their exact names to
`D:/Repos/Database/.git/info/exclude`, which is shared by every worktree of the repo. It disclosed
this honestly, but it is still a route around the pre-commit hook, not through it.

**Why:** the hook's refusal is the signal that something uncommitted is in the tree; an exclude
entry silences that signal for every chat on the machine, and the files still run under vitest.

**How to apply:** every implementer brief says: put probes in the scratchpad or inside the test
you are writing, never as new files under `tests/` or `src/`; never edit `.git/info/exclude`,
`.gitignore` or hook config to get a commit through; if a hook blocks, stop and hand back. When
an agent reports such a workaround, remove the exclude block once the files are deleted (deleting
needs Josh's yes).

**Same day, second instance:** another Sonnet agent (y6) whose brief said "never `git stash`" used
a tagged `git stash push -u` / `apply <sha>` / drop to prove red-green, because the environment
notes describe that as the safe stash pattern. It left the shared stack clean, but the brief's rule
lost to generic tooling guidance. Briefs should give the sanctioned red-green method explicitly:
commit the fix first, then restore the pre-fix file with `git show HEAD~1:<path> > <path>`, run,
and restore with `git show HEAD:<path> > <path>`. Related: [[a-guard-that-blocks-its-own-purpose]], [[controller-staging-claims-subagent-work]].
