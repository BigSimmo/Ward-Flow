---
name: a-double-encoding-is-reversible
description: "A mangled file is usually not lost — two encoding steps reverse exactly, and the guilty codec is the one that round-trips rather than the one that looks likely"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-20T15:07:40.563Z
---

**2026-09-20.** Two committed Ward Flow notes carried **14,019 NUL bytes** and rendered as garbage.
Every instinct said the content was gone and the files should be rewritten or deleted.

**It was not gone.** The damage was two mechanical steps, and both reverse exactly:

1. the original UTF-8 bytes were read back as **cp437** (the old Windows console codepage), which
   turned every em-dash and emoji into box-drawing characters and Greek capitals;
2. that misread text was saved as **UTF-16LE**, which is where the NULs and the `FF FE` BOM came from.

```python
fixed = open(p, "rb").read().decode("utf-16").encode("cp437").decode("utf-8")
```

## How to find the guilty codec without guessing

🔴 **Do not pick the middle encoding by which mojibake it resembles.** Test candidates and keep the
one that **round-trips without raising**. Here cp850 and cp1252 both threw `UnicodeEncodeError` on
characters the text contained; **only cp437 survived**, which identifies it rather than suggesting it.
The distinct non-ASCII set is the other tell — `U+0393`, `U+2229`, `U+2555` together is a cp437
signature, not a cp1252 one.

## Two things that make this look worse than it is

- ⚠️ **Printing the repaired text can crash while the repair is perfectly fine.** A Windows console
  is cp1252 and cannot _print_ `⚠`, so the verification step raises `UnicodeEncodeError` and reads
  like a failed conversion. Verify by **counts on disk** — replacement chars, NULs, em-dashes, the
  gate's exit code — never by echoing the text.
- ⚠️ **Compute the whole repaired string before opening the target for writing.** See
  [[a-failed-write-destroys-the-target]]: `open(p, "w")` truncates first, so a conversion that fails
  mid-write leaves nothing at all.

✅ **Confirm with the gate, not with the eye:** `check-source-control-chars` exit 0, plus zero
`U+FFFD` and zero cp437-signature characters in the result.

Related: [[a-failed-write-destroys-the-target]], [[heredoc-backslashes-collapse]],
[[local-test-failures-windows]], [[read-the-failure-message]].
