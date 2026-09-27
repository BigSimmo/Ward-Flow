---
name: tokens-that-read-correct-and-paint-wrong
description: "three shapes of CSS custom property that pass every gate and paint the wrong picture — resolves to nothing, resolves to its neighbour's value, or does not exist"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b47da8c4-3fcc-439d-8ab6-db595efc1f75
  modified: 2026-09-06T15:47:45.766Z
---

**Nothing in this repository compares two design tokens for equality, or checks that a token has a
value.** So a stylesheet can be entirely legal, pass `no-hardcoded-hex`, pass every design ratchet,
pass review — and paint the wrong picture. Three shapes, all found on Ward Flow, all in one night:

0. **A FOURTH SHAPE, 2026-09-18: THE GUARD'S OWN SUGGESTION REPAINTS THE SCREEN.**
   `ward-raw-colour` flags a colour and prints advice — for a `#ffffff` it says _"use --ward-text /
   --ward-text-muted"_. Measured live on `/mockups/ward-flow/legal-forms`: the flagged sites were
   `color: var(--on-accent, #ffffff)` on badges whose background is `--danger`/`--accent`.
   `--on-accent` resolves to `#fff` at the element; **`--ward-text` is `#161a20`.** Taking the
   advice would have turned white badge text near-black on red — **and the guard would have gone
   green**, because it only checks that the colour came from the `--ward-*` layer, never that it is
   the right one.
   ✅ **A suggestion in a failure message names the LAYER, never the token for that case.** Read
   what the site actually paints before substituting, and `getComputedStyle` the element rather than
   reasoning from the token file.
   ⚠️ Also found there: 22 of 48 "raw colours" were not raw at all but **dead `var(--tok, #hex)`
   fallbacks** — the token always resolves, so the literal can never paint. Worth splitting a
   raw-colour list into fallbacks and bare declarations before touching any of it; the two need
   opposite treatment, and every one of those fallbacks said `#ffffff` for a token that is
   `#0f1216` in the other theme, so they were latent theme bugs rather than lint.

1. **USED BUT NOT DECLARED — IN A STANDALONE MOCKUP.** `docs/ward-flow/design/prototypes/mockup-front-doors-v5.html`
   paints with `var(--warning)` and `var(--clinical-accent)` and declares only their `-soft` and
   `-border` variants. Opened on its own, with no `globals.css`, those rules are silently discarded
   — **and the mockup still looks plausible**, which is how the defect gets approved.

   🔴 **I FIRST WROTE THIS ENTRY SAYING THOSE TWO TOKENS HAVE NO VALUE OUTSIDE `forced-colors` IN THE
   APP. THAT IS FALSE**, and a peer caught it before I acted on it. `globals.css` declares both
   twice — `--clinical-accent` at :415 light and :776 dark, `--warning` at :534 and :837 — and the
   `LinkText` / `CanvasText` declarations at :4594 and :4606 are `forced-colors` OVERRIDES, which is
   correct practice, not a hole. What I had measured was the MOCKUP; the sentence I wrote reached
   one file further than the evidence. See [[a-measurement-is-scoped-to-what-it-measured]] — a
   token's declarations are split across two files by design, and **neither file alone answers
   "does this token have a value".**

2. **RESOLVES TO ITS NEIGHBOUR'S VALUE.** `--ward-border-strong: var(--text-muted)` — so a chart
   segment using it and one using `--text-muted` directly painted the identical colour. Separately,
   `--ward-border` and `--ward-divider` BOTH resolve to `var(--neutral-500)`: three names reading as
   a weight ladder, two rungs identical.
3. **DOES NOT EXIST.** An undeclared token in a `var()` — the rule looks valid and is silently
   discarded.

⚠️ **A STRING COMPARISON CATCHES NONE OF SHAPE 2**, which is the trap: `var(--text-muted)` and
`var(--ward-border-strong)` are different strings. Only following the chain finds it.

## The consequence is not uniform, and this is what decides whether it is a defect

**Two BORDERS resolving to one colour asserts nothing** — nobody reading a panel edge and a row rule
is being told they differ. **Two adjacent CHART SEGMENTS resolving to one colour asserts something
false**: that there is one quantity where there are two, in the one element on the page whose whole
job is showing the split. Same mechanism, opposite verdicts. **Ask what the difference was claiming,
not whether there is a difference.**

⚠️ **AND A BORDER TOKEN IS NOT A DATA COLOUR.** Border tokens are tuned for a hairline against a
surface and are free to move for contrast reasons that have nothing to do with a chart. Using one as
a `background` couples a data visualisation to somebody else's decision about lines — and **a review
that greps for "border" will never find it.** When a border token changes, search for it used as
`background`, not as `border`.

## ⚠️ "Nothing could report it" was wrong — a detector is about forty lines

I wrote that no gate could see this. **Ward Builder Four then built one and found the same class
independently, before my message reached them**: resolve every fill declaration across all 51 ward
stylesheets through the real cascade, in **both palettes**, and flag two different token names
landing on one colour in both. They proved it on three planted cases before trusting a result.

🔴 **THE BOTH-PALETTES REQUIREMENT IS THE WHOLE TRICK, NOT A REFINEMENT.** Their light-only run gave
30 groups of which **21 were false** — tokens all `#ffffff` in light that diverge properly in dark.
A light-only version is noisy enough to be abandoned. The real defect survives the both-palettes
filter, so it would have been caught.

**Two sibling tools now exist**: Ward Builder Two's mockup sweep (does a STANDALONE mockup resolve
within itself, with `@media (forced-colors: active)` blocks stripped first — an override is not a
definition, and their first version reported a false clean by counting one), and
`tests/ward-hub-bar-colours.test.ts` (do one screen's chart fills resolve, and differ, in both
palettes). **The accurate sentence is: nothing DID report it, and now three things can.**

⚠️ **AND ANY FLOOR WRITTEN FOR THIS MUST SAY "ADJACENT", NOT "ALL".** A bar has an order: segments 1
and 3 may legitimately share a tone when 2 sits between them. "Differ from every other fill in the
set" reddens correct work, and that is how the previous floor got weakened.

## Why it survives every kind of looking

There is **no failing state to notice**. A chart with two segments the same colour looks exactly like
a chart with fewer segments. I photographed the screen twice and did not see it; the legend named all
three segments, so nothing on screen was untrue — the information simply was not in the picture drawn
to carry it. **It surfaced only because somebody asked an unrelated question about border weights**,
and answering honestly meant tracing what the fills resolve to rather than what they are named.

**How to apply: when a set of tokens is treated as a scale or as categories, assert the resolved
values are DISTINCT and NON-EMPTY**, following `var()` through the ward layer into `globals.css`, in
BOTH palettes — the collision can exist in dark only. Working example with mutation proof:
`tests/ward-hub-bar-colours.test.ts` (commit `11f118075`); re-create the failure by pointing
`.barBlocked`'s background back at `var(--ward-border-strong)`. **Prefer differing by TEXTURE over a
third tone** for chart segments: a hatch survives colour-blindness, forced-colors, and any future
move of the neutral ramp, where a third grey is correct today and hostage tomorrow.

Related: [[v2-tokens-beat-globals]], [[a-property-set-on-the-element-itself]],
[[checks-that-cannot-fail]], [[breakpoint-swaps-are-unreachable-by-every-gate]],
[[a-clean-result-from-measuring-nothing]].
