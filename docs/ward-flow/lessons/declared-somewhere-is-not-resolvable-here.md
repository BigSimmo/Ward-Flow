---
name: declared-somewhere-is-not-resolvable-here
description: "An unresolvable CSS var() fails silently at computed-value time, and a guard that checks a token is declared SOMEWHERE cannot see that it is undeclared WHERE it is used"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78a1f8ba-8ebd-47af-9e6c-674b54499d41
  modified: 2026-09-07T00:40:22.714Z
---

**A `var()` naming a token that is not in scope on that element is invalid at computed-value time.**
It does not error, warn, or fall back to the property's initial value: `background` silently becomes
transparent, `border-color` silently becomes `currentcolor`. There is nothing to grep for and nothing
goes red.

Measured 2026-09-07 on Ward Flow. `ward-sidebar.module.css` hand-copied twenty canonical
`--ward-*` tokens onto `.panel` and `.drawerBody`, for a real reason — the drawer renders through a
**portal**, outside the shell's DOM subtree, so it cannot inherit from an ancestor. Every value in the
copy matched canonical exactly. **Four tokens were simply absent from it** (`--ward-warning`,
`--ward-warning-soft`, `--ward-danger`, `--ward-danger-soft`). An urgent count chip added the same day
rendered as an ordinary one, differing from its neighbours only in font weight — which looked like a
design choice.

**Why the guard could not see it.** `tests/ward-css-token-references-resolve.test.ts` asks whether
every referenced token is **declared somewhere in the ward stylesheets**. `--ward-warning` is — in
`ward-tokens.module.css`, which those two elements do not compose. The guard's question and the
question that matters differ by one word, and both are answered "yes" by the same file. Same family as
[[a-property-set-on-the-element-itself]] and [[v2-tokens-beat-globals]]: CSS scoping questions are not
answerable by searching the text of the stylesheets.

**How to apply:**

1. **Read `getComputedStyle` on the real render.** `getComputedStyle(el).getPropertyValue('--token')`
   returns `""` when the token is not in scope there. That is the only check that distinguishes
   declared-somewhere from resolvable-here, and it takes one browser call. Do it for any new
   token reference in a portal, a modal, a popover, or anything mounted outside its stylesheet's
   usual subtree.
2. **Never complete a copied token subset — compose the layer.** Completing it resets the clock:
   canonical gains a token, the copy does not, nothing goes red. The copy in this incident had
   already fallen behind once (the leadings) before it fell behind again.
3. **Guard the SHAPE, not the restatement.** The first guard written here forbade restating any
   canonical token and reddened 23 stylesheets doing the legitimate thing — a screen setting
   `--ward-table-min-width` for its own table. Overriding a token's value is what custom properties
   are for. The rule that survives is _a rule declaring five or more canonical tokens without
   composing the layer is standing in for it_: measured, the largest honest override group was four
   and the defect was twenty. See [[a-guard-that-blocks-its-own-purpose]] — a guard obeyed by undoing
   correct work gets disabled instead.
4. **Removing a copy can empty another guard's population.** Doing this fired an anti-vacuity floor
   elsewhere ("no ward stylesheet redeclares a `--ward-space-*` step any more — this guard now proves
   nothing"). That is the floor working. Re-aim it at the machinery (run the same matcher over the
   canonical file the walk skips) rather than deleting it or letting it pass on nothing.

Related: [[checks-that-cannot-fail]], [[compliance-without-coverage]],
[[breakpoint-swaps-are-unreachable-by-every-gate]], [[looking-at-the-screen-misattributes]].
