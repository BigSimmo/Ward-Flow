# Statistics screens, fourth edition — the shared brief

**Owner brief, 2026-09-06, verbatim on the points that matter:** _"Some of the diagrams are good…
but you now have too many diagrams. Please can you focus on core useful ones then state the stats as
well for me clearly in data or tables and popup options etc. Please can you review and create 5
perfected artifacts now based on what you think is best and perfected and optimised design and
usefulness and best design principles and ux/ui."_

**This is a re-proportioning, not a repaint.** The third edition's look was approved and is
unchanged — same white ground, same figure band, same line/arc charts. What changes is the ratio:
**far fewer diagrams, and every figure a diagram implies also written down as a number.**

Your v3 file is the content source. Read it. The audiences, figures and reasoning are right.

---

## The one-sentence version

**At most three charts. At least two tables. At least three disclosures. Every number a chart shows
must also be readable as text.**

---

## ⚠️ These are ARTIFACTS now, and that changes the file's shape

The artifact runtime wraps your file in its own `<!doctype>`, `<html>`, `<head>` and `<body>`.

**So your file is BODY CONTENT.** It starts with `<title>` and `<style>` and then your markup.

- ❌ Never write `<!DOCTYPE>`, `<html>`, `<head>` or `<body>` tags.
- ✅ Do write a `<title>`. It names the page in the gallery and the browser tab.

🔴 **A local browser opens both shapes perfectly, so you cannot catch this by looking.** The guard is
the only thing that can. Do not "verify" the wrapper by opening the file.

### Naming it

The `<title>` is a **product name, not a caption** — a short noun phrase, two to four words, specific
enough to pick out of a gallery of thirty. No explainer after a dash or colon.

Good: `Where The System Is Stuck` · `EMHS Bed Flow` · `Emergency Department Waits`
Bad: `Statistics` · `Ward Flow — Statistics Page For Wards (v4)`

---

## ⚠️ The mechanical rules, and they are checked

`tests/ward-statistics-v4-language.test.ts`. Run it:
`npx vitest run tests/ward-statistics-v4-language.test.ts`

1. **Your `<style>` must BEGIN with the entire content of
   `docs/ward-flow/design/prototypes/statistics-language-v4.css`, byte for byte.** Copy it
   **programmatically** — read the file, write it in. Never retype it. Append your page rules
   **below** it under a marker comment; never above.
2. **Never edit `statistics-language-v4.css`** and never edit the test. If the language lacks
   something you need, say so and hand it back.
3. ⚠️ **Never write the literal characters of a style close-tag inside your CSS**, not even in a
   comment. Per the HTML spec the style element ends there and the page renders unstyled while every
   other check passes. This shipped once already.
4. **At most 3 charts** (`role="img"` in your markup). **At least 1.**
5. **At least 2 `<table>` and at least 3 `<details>`**, each `<details>` with a `<summary>`.
6. **Every chart needs a `class="chart-caption"` stating the same numbers in words.**
7. **At most two `<rect>`** in the whole file — the bar-chart ban, made checkable.
8. **Every class you use must be defined** in the language or in your own page block.
9. **Retired wording:** never "available now", "you can fill today", or "no bed free". ⚠️ **"no free
   bed" IS correct** — it names the raw `allocatable` gate, a different number. Word order is the
   whole distinction.

### 🔴 One trap from last time — do NOT pad your captions

The v3 guard counted `role="img"` **anywhere in the file, including inside the copied stylesheet's
own comment**, so every file read one chart higher than it was. Three builders hit it, all three
correctly worked out it was a miscount, **and all three added a caption for a chart that does not
exist rather than hand it back.**

**That is fixed.** The count now strips the style element first, so **your caption count should equal
your real chart count.** If a check here seems to demand something absurd, **say so and hand it back
— do not satisfy it.** A guard that gets obeyed instead of questioned manufactures the very thing it
claims to measure.

---

## The design, in specifics

### Choosing the charts — this is the actual work

**You are cutting from roughly six to at most three.** Keep a chart only if it answers a question a
number cannot:

- ✅ **A shape over time** — is this getting worse, and how fast. A number cannot show a trend.
- ✅ **A distribution where the tail matters** — where one person at 61 hours is the point, not the
  median.
- ✅ **One value against its whole**, where the proportion is the message — the ring.
- ❌ **A chart of four categories.** That is a table, and a table gives exact values.
- ❌ **A second chart making the first one's point again.**
- ❌ **A chart whose caption fully replaces it.** If the sentence says everything, ship the sentence.

**Give the page ONE centrepiece and let it be large.** The other one or two are supporting and small.

### Stating the numbers

Everything you cut has to land somewhere:

- **`.dtable` inside `.table-wrap`** for anything with rows and columns. Right-align numeric columns
  with `class="n"`; digits are already tabular so columns line up.
- **`.kv`** (a `<dl>`) where a table would only ever be two columns.
- **`.figs`** for a borderless figure row inside a panel.
- **`.delta`** for a change — ⚠️ with `data-dir` **and a word**, because "up" is good on one row and
  bad on the next and an arrow cannot say which.
- **Row severity:** `<tr data-tone="crit|warn|good">` draws a stripe with _width_, so it survives
  greyscale and colour blindness. Never hue alone, and the row must still say what is wrong.

### The disclosures — the "popup options"

`<details class="reveal"><summary>…</summary><div class="reveal-body">…</div></details>`

Put the **working** behind them: the full list behind a count, the method behind a figure, the
per-team breakdown behind a total, the definition behind a term of art.

⚠️ **The summary line must say what is inside, never "more" or "details".** Someone deciding whether
to open it is the entire audience for that line. Add a `<span class="reveal-count">` when a count
helps them decide.

**Summary before detail:** nothing behind a disclosure may be needed to understand the page. The page
must be complete when every disclosure is shut.

### Symmetry and rhythm

`.shell` sets one `--gutter`; every band and panel shares that edge. Grid columns equal or in a
stated ratio. `--s5` between panels, `--s4` inside them. No third gap.

---

## Content: unchanged, and it was good

Read your v3 file. Keep:

- The headline metric each screen leads with, and the figure band at the top.
- The invented-figures footnote and every "this page does not know" line.
- **Owner ruling R17**, once near the top via `.scope`: the board is a convenience, not a source of
  truth; confirm with the ward by phone before acting on a placement.
- **R16**: sex mix, one-to-one nursing and age band fail conservatively — stale or unconfirmed reads
  as the word "Unknown", never as a number.
- **R7** wherever a waiting-on reason appears: one hold-up is recorded, _the one that will take
  longest_, and the screen says so.
- **"Ready"** is the one word for `min(allocatable, empty)`.
- **Never sum "no bed" and "not suitable" declines** into one figure. They are different problems
  with different fixes.

---

## Deliverable

One self-contained file, artifact-shaped, no build step, no external assets, no scripts required to
read it. Native `<details>` only — no JavaScript.

**If you reach a decision this brief does not cover, stop and hand it back** rather than choosing.

---

# ⚠️ THE COMPACTION PASS — 2026-09-06, AFTER THE OWNER SAW THE FOURTH EDITION

**Owner, verbatim:** _"Please can you scan through all of these for me now and minimise all the text
for me. You have excessive explanations for me and also the boxes are too large… please compact and
perfect."_

**The pages are RIGHT. They are too wordy and too loosely spaced.** Do not redesign, do not re-cut
content, do not touch the charts, the tables or the disclosure structure. This is a trim.

## What I have already done for you

**The shared stylesheet is tightened** — the whole spacing ladder came down (`--s5` 1.5rem→1.125rem,
`--s6` 2rem→1.5rem, `--s7` 3rem→2rem, `--s8` 4rem→2.5rem), the figure band's padding dropped a step,
the big figure went 2rem→1.625rem, and panel and disclosure padding tightened.

🔴 **SO YOUR FILE'S COPY OF THE LANGUAGE IS NOW STALE AND BYTE-IDENTITY WILL FAIL.** Your first job
is to **re-copy `statistics-language-v4.css` programmatically** into your `<style>` block, replacing
the old copy, keeping your own page rules below the marker. Do not hand-patch it.

⚠️ **Check your own page rules for anything that now fights the tighter language** — a hard-coded
padding or margin you added will not have moved with it.

## The text: cut roughly half

Measured on your file as it stands: the five carriers run **1788–2390 prose words**, with **16–19
blocks over 45 words** and single paragraphs reaching **130**.

**The ceiling is 950 prose words. No block over 45 words.** Both are checked.

### How to cut, in order of what to reach for first

1. **Say it once.** The same fact is routinely in the figure label, the caption, the note beneath and
   the footnote. Keep the clearest instance and delete the rest.
2. **Delete the sentence that explains what the reader can see.** "The chart below shows…" — they can
   see that it does. Captions state the NUMBERS, not the existence of the chart.
3. **Cut the reasoning, keep the conclusion.** Why a figure is computed a certain way belongs behind
   a disclosure, not in the flow of the page.
4. **A paragraph over 45 words is two facts sharing a sentence.** Split it and delete the weaker one.
5. **Prefer a table row to a sentence.** A sentence naming three numbers is a three-row table that
   reads faster and takes less space.
6. **Cut adjectives and hedges before you cut nouns.** "significantly", "it is worth noting that",
   "currently", "at present" — all free to remove.

## 🔴 WHAT MUST NOT BE CUT, AND THE GUARD ENFORCES IT

**The cheapest way to obey "less text" is to delete the caveats — and on these screens the caveats
are the clinical safety.** A page that loses them reads as MORE authoritative than one that kept
them, which is the exact opposite of what this trim is for.

- **`.scope`** — ruling R17: the board is a convenience, not the record; confirm with the ward.
  **Shorten the wording if you like. Do not remove it.**
- **`.footnote`** — which figures are invented, and what the page does not know.
- **R16 on the ward page** — the literal word "Unknown" with its Stale chip and timestamp. Never a
  number, never a blank, never a dash.
- **Every table.** Table text is excluded from the word count and **floored separately at 140 words**
  precisely so trimming prose can never become deleting rows.
- **Both decline reasons, still separate and never summed.**
- **Ruling R7's sentence** wherever a waiting-on reason appears.

If cutting to 950 words would cost one of these, **stop and hand it back** rather than cutting it.

## Verify

`npx vitest run tests/ward-statistics-v4-language.test.ts` — 18 assertions. Read the failure text,
not the exit code.

**If a check appears to demand something absurd, say so and hand it back — do not satisfy it.** Three
builders did exactly that on the last pass and were right to.
