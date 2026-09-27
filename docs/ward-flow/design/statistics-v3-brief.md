# Statistics screens, third edition — the shared brief

**Owner brief, 2026-09-06, verbatim on the points that matter:** _"utilise the design system like
other pages and keep it crisp and white like the same database design system colour scheme … perfect
the overall style and layout and also make sure it is symmetrical and fix those boxes at the top and
make them more sophisticated, stylish and not blocky and tacky … utilise live diagrams that are easy
to show trends simply, ideally lines or circles etc … rather than bar charts … large design overhaul
and potential redesign rather than just polish."_

**This is a redesign, not a polish pass.** The v2 files stay on disk and are what you read for
CONTENT. Nothing about their appearance carries forward.

---

## What was wrong with the second edition

**It was its own colour scheme.** It invented `--ground: #f1f4f8`, `--ink: #0d1421`, `--faint`,
`--rule` and a dozen more names that exist nowhere in the product. The application's system of record
— `src/app/ckb-v2-tokens.css` — says `--background: #ffffff` and `--surface: #ffffff`: a genuinely
**white** page, not a grey ground with white cards floating on it.

So a statistics screen and the application it belongs to did not look like one product — **and the
mockup is the thing an engineer copies from.**

Three consequences you are fixing:

1. **White, not grey.** Separation is a hairline and a shadow rung, never a change of fill.
2. **The figure strip is not a row of boxes.** Five bordered cards in a row, each with its own edge
   and shadow, read as five competing objects. It is now ONE band, columns divided by a hairline.
3. **No bar charts.** A bar answers "how big is each"; a line answers "which way is this going",
   which is the question every one of these screens exists for.

---

## ⚠️ The mechanical rules, and they are checked

`tests/ward-statistics-v3-language.test.ts` enforces all of this. Run it:
`npx vitest run tests/ward-statistics-v3-language.test.ts`

1. **Your `<style>` element must BEGIN with the entire content of
   `docs/ward-flow/design/prototypes/statistics-language-v3.css`, byte for byte.** Copy it
   programmatically — read the file and write it in — never retype or hand-copy. Append your own
   rules **below** it under a marker comment; never above.
2. **Never edit `statistics-language-v3.css`** and never edit the test. If the language is missing
   something you need, say so and hand it back.
3. ⚠️ **Never write the literal characters of a style close-tag inside your CSS**, not even in a
   comment. Per the HTML spec that ends the style element there, and the page renders unstyled while
   every other check passes. This shipped once already.
4. **At most two `<rect>` elements in the whole file.** That is the bar-chart ban, made checkable.
   A plot background may be a rect; a data series may not.
5. **Every chart carries `role="img"` with a real label, and every chart has a
   `class="chart-caption"` stating the same numbers in words.**
6. **Retired wording:** never "available now", "you can fill today", or "no bed free". ⚠️ **"no free
   bed" IS correct** — it names the raw `allocatable` gate, a different number. The word order is
   the whole distinction.

---

## The design, in specifics

**Use the language's own primitives.** They exist so five screens draw one chart rather than five:
`.band` + `.stat-figure` + `.stat-label` for the figure strip · `.panel` · `.dtable` · `.chip` ·
`.c-line` `.c-area` `.c-dot` `.c-ring-*` `.c-grid` `.c-axis` `.c-threshold` `.c-label` for charts ·
`.legend` · `.note` · `.absent` · `.footnote`. Add page rules only for what genuinely has no name.

### Symmetry, because the owner asked for it specifically

- `.shell` sets one `--gutter`. **Every band and panel shares that edge** — the page edge must not
  move from row to row.
- Grid columns are equal or in a stated ratio (`data-cols="2"`, `"1-2"`, `"2-1"`). No orphan tiles:
  the `.band` already spans a lone final column on the two-up step.
- One vertical rhythm: `--s5` between panels, `--s4` inside them. Do not introduce a third gap.

### The charts

**Lines and arcs only.**

- **A trend over time** → `.c-line`, optionally over `.c-area`, with `.c-dot` on the latest point and
  `.c-grid` behind. Two series: the second takes `data-series="b"` (dashed) so the pair survives
  greyscale.
- **One value against its whole** → the ring (`.c-ring-track` + `.c-ring-value`). It uses
  `pathLength="100"`, so `stroke-dasharray="N 100"` states the percentage literally in the markup.
- **A distribution of individuals** → dots on an axis, not a histogram.
- **A sparkline in a figure column** → `.spark`, a bare `.c-line` path, no axes.

Give the page **one centrepiece** and let it be large. Small charts competing is what made the v2
pages busy.

### The figure band at the top

`.band` with `data-cols="4"` or `"5"`. Each column is a `<div>` holding `.stat-figure`,
`.stat-label`, optionally `.stat-note` and optionally a `.spark`. **No borders, no shadows, no fills
on the columns themselves** — the band draws the hairlines. Tone goes on the FIGURE only
(`data-tone="good|warn|crit|primary"`), never as a fill, and never as the only carrier: the label
must already say what the column is.

Where a column's value is a name rather than a number — the longest wait as a person — use
`.stat-figure--word`.

---

## Content: unchanged from the second edition, and it was good

**Read your v2 file for the content.** The audiences, the questions, the figures and the reasoning
are all correct; this edition changes how they look, not what they say. Keep:

- The headline metric each screen leads with.
- The invented-figures footnote, the reconciliation notes, and every "this page does not know" line.
- **Owner ruling R17**, stated once near the top via `.scope`: the board is a convenience, not a
  source of truth; a placement action must confirm with the ward. It bounds the claim, not the care.
- **Owner ruling R16**: sex mix, one-to-one nursing capacity and age band fail conservatively —
  stale or unconfirmed reads as the word "Unknown", never as a number.
- **Owner ruling R7** where a waiting-on reason appears: one hold-up is recorded, _the one that will
  take longest_, and the screen must say so.
- **"Ready"** is the one word for `min(allocatable, empty)`.
- Never sum "no bed" and "not suitable" declines into one figure.

---

## Deliverable

One self-contained HTML file. No build step, no external assets, no scripts needed to read it.

**If you reach a decision this brief does not cover, stop and hand it back** rather than choosing.
