---
name: v2-tokens-beat-globals
description: "ckb-v2-tokens.css wins over globals.css by specificity, not import order — resolving a colour from the wrong file gives plausible wrong numbers"
metadata:
  node_type: memory
  type: reference
  originSessionId: b1ace96a-832b-4e38-9f46-6c2896334ea0
  modified: 2026-09-03T21:08:54.463Z
---

## ⚠️ THE TRIGGER, because this recurred on 2026-09-05 WITH THIS MEMORY ALREADY WRITTEN

**`grep` for a token value in `globals.css` IS the mistake. There is no step after it at which you
notice.** The reflex has to fire on the grep, not on the number.

That day I published three contrast ratios in a CSS comment, as measurements, from globals. A peer
caught it. Two of my conclusions inverted: `--ward-chrome` IS identical to `--ward-canvas` (I had
"corrected" a peer who was right), and `--ward-ground` is NOT the strongest fill — `--ward-subtle`
is, in dark, because v2 aliases it UP ("subtle must lift, not sink"), making it weakest in light and
strongest in dark. **The fix I shipped was right; every figure justifying it was wrong**, which is
the worst combination, because nothing downstream fails.

**So: resolve from `src/app/ckb-v2-tokens.css` FIRST, always, and write the filename next to the
value before computing anything with it.** The memory below was already complete and said exactly
this. It did not help, because it was never opened. Related: [[never-produce-a-figure-while-writing]].

`src/app/globals.css` line 10 does `@import "./ckb-v2-tokens.css"`, which reads as "globals wins,
it comes later". **It does not.** Both files declare tokens on the element `<html>`, which carries
`class="… ckb-v2 dark"` (`src/app/layout.tsx`). So the selectors compete on the same element and
**specificity decides, not order**: `.ckb-v2.ckb-v2` is (0,2,0) against `:root`'s (0,1,0), and
`.ckb-v2.dark.ckb-v2` is (0,3,0) against `.dark`'s (0,1,0).

**Resolve every colour from `ckb-v2-tokens.css` first; fall back to `globals.css` only for tokens
v2 does not declare** (`--neutral-500` is one of those). Never mix — a background from one file and
a text colour from the other produces a number that looks completely reasonable.

Measured 2026-09-04: dark `--surface` is `#12161a` (v2), not `#101315` (globals). Light
`--surface-inset` is `#f4f7fa`, not `#eaeef4`.

**Why it matters more than a rounding difference:** six contrast ratios computed against globals'
surfaces were written into a comment across 27 ward stylesheets and quoted as measurements
(`--text-muted` claimed 7.55, actually 6.15). The conclusions survived, so nothing looked wrong.
A separate fix to `--ward-divider` was justified with figures from the same mistake, and its guard
could not resolve the token it was checking.

**The tell is never the number, it is the source.** State which file a value came from before
computing anything with it. Anchor every contrast calculation on black-on-white returning exactly
21.0000 — that catches a broken formula but NOT a right formula over wrong inputs, which is this
failure. See [[never-produce-a-figure-while-writing]] and [[measure-the-thing-not-a-proxy]].

## ⚠️ `.screen *` IS STILL ONE CLASS — the universal selector contributes ZERO. 2026-09-04.

A print reset written on the root, `.screen { color: CanvasText }`, is specificity **(0,1,0)**. Every
class-plus-type rule in the same file outranks it — `.table td`, `.table th`, `.governanceBanner p`,
`.jobDetailRow dd`. So the table cells kept their themed colour, which in dark mode is near-white:
**rows present on the paper, correctly sized and spaced, and invisible.**

**Widening it to `.screen, .screen *` does NOT fix it.** `*` adds nothing to specificity, so the
wildcard is _also_ (0,1,0) and loses the same fight. Measured through a real cascade:

```
.table td       color: rgb(244,246,248)   (0,1,1)
.screen *       color: rgb(0,0,0)         (0,1,0)
  wildcard on .table td   -> rgb(244,246,248)   STILL BROKEN
  wildcard on a plain span-> rgb(0,0,0)         works
  !important on .table td -> rgb(0,0,0)         works
```

⚠️ **Specificity resolves BEFORE source order, so putting the block last in the file buys nothing.**
`!important` is what wins.

### 🔴 The failure shape, which is the dangerous part

**The wildcard fixes every plain element.** So a spot-check on a heading or a paragraph prints black
and the fix reads as confirmed — **while the table rows, the one place the failure is clinically
dangerous, stay invisible.** A partial repair that verifies as complete.

**Verify by resolving a computed colour, never by reading the CSS.** The shape of the CSS is what
fooled two people in a row. And check the sibling files: the working implementation was already in
`coordinator.module.css`, in plain view, arrived at by somebody who had this fight first.

⚠️ **A guard that walks a fixed list of stylesheets is silent about every file not on the list, and
its silence reads as a pass.** Before trusting one, check your file is in its list.

Related: [[a-shared-layer-inherits-responsibilities-not-just-properties]],
[[a-property-set-on-the-element-itself]], [[compliance-without-coverage]].

## ⚠️ THE FALLBACK IS NOT A FOOTNOTE — IT IS MOST OF THE FILE. Measured 2026-09-06.

"Fall back to globals only for tokens v2 does not declare" reads like a rare exception. It is not:

```
globals.css declares      308 token names
ckb-v2-tokens.css          166
names ONLY in globals      204          <- globals is AUTHORITATIVE for every one of these
of those, used by ward CSS  33
```

Among the 33 the ward layer depends on **today**: `--radius-xs`, `--radius-pill`, `--font-sans`,
`--font-mono`, `--safe-area-bottom`, `--neutral-500`, and the entire sub-`xs` type scale
(`--text-3xs`, `--text-2xs`, `--text-sm-minus`, `--text-lg-minus`, `--text-2xl-minus`).

🔴 **So "globals never applies" is as wrong as "globals wins", and I said it to three chats before
measuring.** The rule is one sentence: **v2 wins on the ~105 names both declare; globals is
authoritative wherever it is the sole declarer.** Check which case you are in before quoting a value.

## 🔴 THE VECTOR IS A COMMENT IN THE SHARED TOKEN FILE. 2026-09-06.

`ward-tokens.module.css:317-320` documents the ward layer with four ratios computed against
`#fcfdfe` and `#f7f9fc` — globals' values for `--surface` and `--surface-subtle`, both of which v2
redeclares and wins (`#ffffff`, `#fbfcfd`). Same day, a peer resolved `--surface` to `#fcfdfe`
inside a message correcting _me_ on contrast, and that comment is the likeliest source.

**A wrong figure in the file every chat opens before touching a colour does not stay one error — it
recruits.** `ward-record-row.module.css` already records 27 stylesheets that carried contrast
measured against the losing file. The comment is how the 28th happens.

**Antidote: a contrast figure states its ground and the file the ground came from, in the same
line.** A ratio without its operand is unfalsifiable and gets copied. See
[[carry-the-antidote-with-the-assertion]], [[comments-that-recruit]],
[[absence-under-one-prefix]].

---

## ⚠️ THIS RULE HARDENED INTO A HABIT AND FIRED WHERE IT DOES NOT APPLY (2026-09-06)

A peer turned "prefer `ckb-v2-tokens.css`, it wins by specificity" into a general instruction and
wrote it into a subagent brief. **It is true of `--surface` and inapplicable to most tokens.**
Measured on the case that brief covered:

```
ckb-v2-tokens.css   declares --spacing-tap NOWHERE
ckb-v2-tokens.css:128   --tap-min: var(--spacing-tap)     ← a CONSUMER, not a declaration
--clinical-accent / --warning   globals declares both palettes;
                                ckb-v2 carries ONLY their forced-colors OVERRIDES
```

🔴 **A CORRECTION THAT HARDENS INTO A HABIT IS THE SAME FAILURE AS A NOTE THAT NEVER FIRES, POINTING
THE OTHER WAY.** The first misses; the second misfires on correct work — and the second is more
dangerous here, because it arrives carrying the authority of a lesson already learned.

**How to apply: a specificity rule is about a NAMED token, never about a file.** Before preferring
one file's declaration over another's, check the token is declared in both — a file that only
_consumes_ a token, or only carries its `forced-colors` override, is not competing for it at all.
**An override is not a definition.** Same trap, different direction, as
[[a-measurement-is-scoped-to-what-it-measured]] and [[a-blanket-fix-is-not-blanket]].

**And the sibling-value trap it produced:** filling a missing token in a standalone mockup by
copying "a clean sibling mockup's value" reads as consistency and is a coincidence being baked in.
`--spacing-tap` is 3rem in both today; the day a mockup carries 44px — a plausible thing to type from
a generic WCAG minimum, when this repo's floor is 48px _because_ 44 reintroduces a known flake — the
fix propagates a tap target smaller than the app enforces into the drawings the owner approves from.
**Copy from the app's own declaration, and write the provenance in the file**: a bare
`--spacing-tap: 3rem` is indistinguishable six weeks on from somebody having chosen 3rem.

---

## 🔴 2026-09-07: THE SAME MEMORY FAILED IN THE OPPOSITE DIRECTION — I APPLIED IT WHERE IT DOES NOT HOLD

The section above says the reflex must fire _at the grep_. It did, the very next night. **And that is
how it went wrong: I fired the reflex, skipped the check, and wrote the ANSWER into a subagent brief.**

The brief said, in as many words: _"when both app files declare the same token, `ckb-v2-tokens.css`
WINS — by specificity, not import order. Reading the globals value and reporting it is a mistake
already made in this project today."_ True. Inapplicable. **For all four tokens the task was about,
`ckb-v2` declares nothing in normal mode:**

```
--spacing-tap       globals.css:128        ckb-v2: NOT DECLARED
                    ckb-v2-tokens.css:128  --tap-min: var(--spacing-tap)   ← a CONSUMER, not a declaration
--clinical-accent   globals.css:415/776    ckb-v2:460  forced-colors override ONLY
--warning           globals.css:534/837    ckb-v2:466  forced-colors override ONLY
--font-sans         globals.css:304        ckb-v2: NOT DECLARED
```

⚠️ **The near-miss is specific: `ckb-v2-tokens.css:128` mentions `--spacing-tap` on a line that
LOOKS like a declaration and is a consumption.** An agent told "prefer ckb-v2" and grepping for the
token name lands exactly there. It would have found the string, believed the instruction, and
reported a source that declares nothing.

### What to change

- **A correction is a QUESTION to re-ask, never an ANSWER to carry.** "ckb-v2 wins" is the answer to
  one lookup. The transferable thing is _"ask what wins, don't ask where it is declared"_ — which
  survives a token ckb-v2 never declares. I compressed the question into its answer and the answer
  does not generalise.
- 🔴 **Writing a verdict into a brief is worse than believing it yourself**, because the recipient
  cannot re-derive it and has no reason to try. **State the check, not the conclusion:** _"grep the
  token in BOTH files; a `var(--x)` on the right-hand side is a consumer, not a declaration; if only
  one declares it there is no contest."_
- **A rule learned from a burn fires hardest right after the burn**, on the next thing that resembles
  it. The resemblance here was the word "token" and nothing else.

Related: [[carry-the-antidote-with-the-assertion]], [[a-blanket-fix-is-not-blanket]],
[[assert-only-about-code-you-opened]], [[a-guard-that-blocks-its-own-purpose]].

### ⚠️ The coincidence that manufactures the wrong answer: BOTH files have a relevant line 128

```
src/app/globals.css:128        --spacing-tap: 3rem;              ← DECLARES
src/app/ckb-v2-tokens.css:128  --tap-min: var(--spacing-tap);    ← CONSUMES
```

**Same line number, adjacent directories, near-identical filenames, and one of them declares
nothing.** A citation of "128" is true of either. Anyone told "prefer ckb-v2" who greps the token
name lands on the consumer and reads it as the declaration — **so the wrong answer is not produced
by carelessness, it is produced by the coincidence.** (Found by Ward Builder Four, 2026-09-07.)

**The rule: in this area, never cite a bare line number. Carry the filename AND the word
`declared`** — "declared at globals.css:128" cannot be misread as the ckb-v2 consumer; "128" can.
A right-hand-side `var(--x)` is a consumption, and a grep for a token name cannot tell the two apart.
