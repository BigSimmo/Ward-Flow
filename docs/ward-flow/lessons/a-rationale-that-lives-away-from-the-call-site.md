---
name: a-rationale-that-lives-away-from-the-call-site
description: "An audit that looks for justification NEAR the call reports it missing when it lives on the shared helper or inside the assertion's own message — two false regressions from this in one sweep"
metadata:
  node_type: memory
  type: feedback
---

2026-09-04, Ward Flow. A sweep returned **two "confirmed regressions"** — absence checks
(`not.toContain`) run over comment-stripped source, which makes them MORE permissive. That is a real
defect class and I have a standing rule about it. **Both were wrong, and wrong the same way.**

| reported                                                                  | actually                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `not.toContain("FD-23")` on stripped source — permissive absence check    | **A CONTROL ON THE STRIPPER.** `FD-23` occurs twice in the file under test, both inside comments, so its disappearance PROVES the stripper ran. One of a trio pinning the stripper in both directions. |
| `not.toMatch(/\d/)` on `codeWithoutComments(...)` — "no stated rationale" | Rationale is on the **helper's own definition**, and it is load-bearing: one comment in a guarded module contains a digit today, so the unstripped guard would be RED on prose.                        |

## The mechanism

> **An audit looks for the justification NEAR THE CALL. Both rationales lived somewhere else — one
> inside the assertion's own message string, one on the shared helper's doc comment.**

⚠️ **The same sweep correctly cleared a THIRD guard of identical design**, purely because that
file happens to carry its explanation at the call site. **Same pattern, three files, and the
PLACEMENT of the explanation decided the verdict** — not the code.

## How to apply

- **Before calling a guard unjustified, read three places:** the assertion's own message string, the
  definition of every helper it calls, and the file it is asserting about. The message string is the
  one nobody thinks to read as documentation, and it is where a good assertion puts its reason.
- **Ask what the assertion would mean if it were a CONTROL rather than a rule.** A `not.toContain`
  over a transformed input is very often proof the transform worked, not a prohibition.
- ⚠️ **Check whether removing the thing you object to would BREAK the guard.** If the unstripped
  version goes red on today's tree, the strip is load-bearing and you are proposing a breakage, not
  a repair.

## 🔴 And the part that is about me, not the sweep

**Both findings agreed with the theme I had been pushing all night.** I had spent hours on
comment-satisfiable guards and had just written that stripping an absence check is "a regression
wearing a repair's clothes". **A finding that confirms the lesson you are currently learning gets
checked last** — and I nearly relayed both to a colleague running an audit.

Related: [[check-the-conclusion-that-flatters-the-theme]], [[a-comment-can-satisfy-a-guard]],
[[comments-that-recruit]], [[a-correction-that-agrees-with-you]],
[[run-the-mutation-before-relaying]].
