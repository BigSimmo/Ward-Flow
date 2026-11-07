---
name: a-refusal-contradicted-in-an-invisible-channel
description: "A correct refusal is undone by a concurrent announcement elsewhere — and sr-only live regions are invisible to tests, screenshots and eyes alike"
metadata:
  node_type: memory
  type: reference
  originSessionId: c186bff2-76e5-4e1f-b211-8b26b7fbdcab
  modified: 2026-09-10T16:51:24.858Z
---

Ward Flow, 2026-09-11. Typing `risk score` into Patient search produced the refusal **exactly
right**: the fixed sentence in both places, `role="status"`, zero rows, no match heading. The tests
asserted all of that and **all of it passed**. In the same breath, the typeahead's own live region
said **"Nobody matches."**

That sentence claims the system **looked** and found nobody. It did not look. The standard says a
refusal is spoken and nothing is returned, and that **it is never an empty list** — and that is the
empty list, spoken. A screen-reader user heard the one sentence the refusal exists to prevent.

## Why it survived every method in use

1. **`sr-only` live regions are a blind spot for all three review methods.** Tests assert only what
   they were told to. Screenshots cannot show them. A person looking at the page cannot see them.
   Reading live regions has to be a **deliberate step** on a browser pass or it never happens.
2. **The contradiction lived in a different file from the refusal.** Built correctly in the file
   that owns refusals; contradicted from a sibling component that had never heard of them and that
   the task brief did not list.

## The transferable rule

**A refusal test that asserts "the refusal appears" and "no rows render" passes with a contradiction
sitting beside it** — both assertions are positive, and both are scoped to the refusal's own file.

**The assertion that catches it is NEGATIVE and scoped to the WHOLE announcement:** while a refusal
stands, nothing anywhere may make a claim about matches — not a spoken count, not a near-miss note,
not a visible one. Scope it to everything mounted, not to the component under test.

Generalises past refusals: any state whose whole point is _"this was not measured"_ can be undone by
any other mounted component that speaks as though it was. See [[an-absence-promoted-to-a-headline]],
[[the-qualification-lives-in-the-vanishing-state]], [[a-clean-result-from-measuring-nothing]] and
[[the-same-words-true-on-one-screen-false-on-another]].
