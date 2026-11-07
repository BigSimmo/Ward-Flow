---
name: a-failed-write-destroys-the-target
description: "open(path,'w') truncates BEFORE the write, so a script that errors mid-write leaves an empty file — and the escape that caused it survives being read back, so the same edit fails twice"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-17T17:00:16.667Z
---

**Measured 2026-09-18.** An in-place Python edit of a 58KB approved plan file ran
`io.open(p,"w",encoding="utf-8").write(s)` as its last line. Building `s` had embedded
`"🔴"` — a **lone surrogate pair**, which Python accepts in a `str` literal but cannot
encode to UTF-8. The open succeeded and truncated the file to zero; the `.write()` then raised
`UnicodeEncodeError`. **The file was destroyed by a script that never wrote a byte.**

Recovery was possible only because the harness had independently persisted the approved copy under
`.claude/projects/<project>/<session>/tool-results/<tool-use-id>.txt`. Without that, 58KB of
reasoning was gone. **That was luck, not design.**

## The rule

**Build and ENCODE the whole output before opening the destination.**

```python
data = s.encode("utf-8")          # fails here, harmlessly, if s is malformed
io.open(p, "wb").write(data)      # only now is the target touched
```

Or write to a temp file and `os.replace()` it over the target — atomic, and a crash leaves the
original intact.

## The two escapes that cause it, both specific to this environment

1. **Astral-plane characters written as surrogate pairs.** `"🔴"` for 🔴 is what a JSON
   dump or a careless transcription produces. Python holds it, then refuses to encode it. Use
   `"\U0001F534"`, or paste the literal character.
2. **The Bash tool eats one escape level even inside a quoted heredoc** — see
   [[heredoc-backslashes-collapse]]. So `\\uFFFD` in a `<<'PYEOF'` heredoc reaches Python as
   `�` and becomes the actual character, silently changing what the script matches against.
   A `str.replace` then finds nothing and the edit is a no-op, or an assertion fires after the
   file is already open for writing.

## How to apply

- **Never put `open(p,"w")` on the same line as the expression that builds the content.**
- For multi-block edits of one file, splice by **line index** from replacement blocks written with
  the Write tool. No shell quoting, no escapes, no regex.
- When a heredoc-based edit fails twice on quoting, that is the signal to stop using the shell for
  it — not to try a third escaping scheme.
- After any scripted in-place edit, **check the file is non-empty and its headings are intact**
  before moving on. An empty file reads as success to every subsequent `grep` that finds nothing.

Related: [[heredoc-backslashes-collapse]], [[restoring-a-mutated-file]],
[[corruption-that-makes-checks-pass-harder]].
