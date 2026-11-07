---
name: heredoc-backslashes-collapse
description: "The Bash tool layer eats one backslash level before bash sees it, so regexes written via heredoc silently lose an escape — and a mangled regex that still parses is the dangerous case"
metadata:
  node_type: memory
  type: reference
  originSessionId: 272cfee6-4b66-4c8f-bdcf-93a1b3add32c
  modified: 2026-09-17T13:36:46.081Z
---

Writing source code through the Bash tool with a heredoc mangles backslashes on this machine,
**even with a quoted delimiter** (`<<'EOF'`, which should pass text through literally). Measured
2026-09-17 while editing `src/lib/observability/error-tracking.ts`:

- Wrote `/[\\/]\.next[\\/]/` → landed as `/[\/].next[\/]/`. One escape level gone from every
  doubled backslash, while a single `\.` survived intact.
- `String.replace(/\\/g, "/")` → landed as `/\/g`, an unterminated regex, which at least failed
  loudly at parse time. The character-class one did **not** fail — it compiled to a different,
  silently wrong regex.

Two takeaways, the second mattering more:

1. **Never put a literal doubled backslash through a heredoc.** Write the corrected lines to a
   file in the scratchpad first, then splice them in with a script that reads that file.
2. **Prefer restructuring so the escape is not needed.** Here the regex only ever matches Linux
   container paths, so single-escaped forward slashes throughout were both correct _and_ immune.
   Reach for that before reaching for more escaping.

Same-session sibling trap: bash's `/tmp` is not Node's `/tmp`. Writing to `/tmp/f` from bash
succeeded, then `fs.readFileSync("/tmp/f")` looked in `D:\tmp\f` and threw ENOENT. Hand node an
absolute `C:/Users/...` path, never an MSYS-style one.

Also: deleting a scratch file inside a path under `.claude/worktrees/` trips the worktree
protection hook, and so does _prose mentioning that_. Do not reach for the documented override for
your own temp file — put temp files in the scratchpad, or use a non-shell tool.

Related: [[git-queries-that-answer-instead-of-erroring]], [[local-test-failures-windows]],
[[protected-work-and-backups]], [[a-comment-can-satisfy-a-guard]]
