# Ward monospace survey — 2026-09-06

**Every `--font-mono` declaration in the ward stylesheets, measured per node in a running browser.**
Commissioned by Ward Lead after a screenshot-based instruction named a site that turned out to hold
only digits. Measure-only: no styling was changed by the survey itself, and the rulings that followed
are recorded at the foot.

## The rule this produced

**The mono face is paired with `font-variant-numeric: tabular-nums` for exactly one purpose — so a
stack of figures aligns.** That is the whole of what it buys. A value that never sits above a sibling
aligns with nothing, so the face buys nothing and costs legibility.

> **In a column it earns its place; a one-off in a heading, a badge or a sentence does not.**

⚠️ **Grammar does not decide it, and it looks as though it should.** `.clock` renders `"7h 00m"` and
`.groupCount` renders `"2 people"` — the same shape — and they are ruled opposite ways: `.clock` is
288 nodes, one per row down a table; `.groupCount` is 42 nodes, one per group heading, never above
one another. **A name-based or grammar-based ruling gets that pair exactly backwards.**

## ⚠️ The method error, because it is the most transferable thing here

**The first pass measured LEAF NODES ONLY and was wrong about three declarations.**

A leaf-only DOM survey silently drops **every element that wraps a child**, which on this codebase is
most of the interesting ones. It **missed `.clock` entirely — 288 nodes** — because that element
contains a child span, and it reported `.id` and `.groupCount` as prose.

**Measuring each element's OWN direct text is the correct question**, and the two methods disagree on
exactly the sites where the answer matters. Nothing about the leaf-only output looked wrong: it was
per-node, unit-named, browser-measured and confidently incorrect.

**A second error in the same family:** `git grep <pattern> <rev> -- 'dir/**/*.css'` returned **10**
declarations where the true figure is **26**. `git ls-tree` with that identical `**` pathspec matches
**zero files** — so the pathspec was silently empty and `git grep` answered a different question with
a plausible non-zero number rather than an error.

---

- **Tree:** master line `793361ac1`. **Routes walked:** 33 of 33, zero failures.
- **Unit:** one `font-family: var(--font-mono)` declaration, comments excluded. **26 declarations, 26 selectors, 15 of 51 stylesheets.**
- **Measured as:** each element's OWN direct text — not leaf nodes. That correction mattered: the leaf-only
  first pass missed `.clock` entirely (288 nodes), because its element contains a child span.

| file · selector                                            | nodes | prose | ident | figure | fig+unit | fig+word | verdict                       |
| ---------------------------------------------------------- | ----: | ----: | ----: | -----: | -------: | -------: | ----------------------------- |
| `ward-figure.module.css .figureValue`                      |    11 |     3 |     0 |      6 |        2 |        0 | **MIXED — look**              |
| `ward-management.module.css .rowVerdict`                   |     3 |     3 |     0 |      0 |        0 |        0 | **PROSE — change**            |
| `ward-modes-second-edition.module.css .panelBadge`         |     1 |     1 |     0 |      0 |        0 |        0 | **PROSE — change**            |
| `ward-record-row.module.css .groupCount`                   |    42 |     0 |     0 |      0 |        0 |       42 | **NUMBER + WORD — your call** |
| `ward-record-row.module.css .id`                           |   288 |     0 |   288 |      0 |        0 |        0 | IDENTIFIER — keep             |
| `ward-record-row.module.css .clock`                        |   288 |     0 |     0 |      0 |      288 |        0 | FIGURE — keep                 |
| `ward-bar.module.css .count`                               |    20 |     0 |     0 |     20 |        0 |        0 | FIGURE — keep                 |
| `ward-controls.module.css .pillCount`                      |    20 |     0 |     0 |     20 |        0 |        0 | FIGURE — keep                 |
| `movements/movements.module.css .glanceCount`              |    14 |     0 |     0 |     14 |        0 |        0 | FIGURE — keep                 |
| `capacity/capacity.module.css .gapNumber`                  |    10 |     0 |     0 |     10 |        0 |        0 | FIGURE — keep                 |
| `delays/delays.module.css .attentionWho`                   |     8 |     0 |     8 |      0 |        0 |        0 | IDENTIFIER — keep             |
| `community/community-index.module.css .kbdHint`            |     1 |     0 |     0 |      1 |        0 |        0 | FIGURE — keep                 |
| `ward-management.module.css .timelineWhen`                 |     1 |     0 |     0 |      1 |        0 |        0 | FIGURE — keep                 |
| `ward-modes-second-edition.module.css .effectivenessValue` |     1 |     0 |     0 |      1 |        0 |        0 | FIGURE — keep                 |

**Samples, so nobody rules from a class name:**

- `.id` (ward-record-row.module.css) — "WF-009", "WF-308", "WF-002", "WF-010"
- `.clock` (ward-record-row.module.css) — "7h 00m", "10h 56m", "3h 00m", "1h 50m"
- `.groupCount` (ward-record-row.module.css) — "2 people", "4 people", "1 person", "6 people"
- `.count` (ward-bar.module.css) — "8", "19", "10", "25"
- `.pillCount` (ward-controls.module.css) — "23", "20", "7", "2"
- `.glanceCount` (movements/movements.module.css) — "18", "5", "6", "7"
- `.figureValue` (ward-figure.module.css) — "0", "None waiting", "0", "0"
- `.gapNumber` (capacity/capacity.module.css) — "-4", "-5", "-8", "+1"
- `.attentionWho` (delays/delays.module.css) — "WF-009", "WF-308", "WF-009", "WF-308"
- `.rowVerdict` (ward-management.module.css) — "Eligible", "Eligible", "Eligible"
- `.kbdHint` (community/community-index.module.css) — "/"
- `.timelineWhen` (ward-management.module.css) — "09:14"
- `.panelBadge` (ward-modes-second-edition.module.css) — "Synthetic prototype"
- `.effectivenessValue` (ward-modes-second-edition.module.css) — "1.2"

## Never renders on any of the 33 routes — 12 of 26 declarations

- `community/community-home.module.css .id`
- `community/community-team-hub.module.css .id`
- `community/community-team-hub.module.css .wait`
- `community/community-teams-table.module.css .n`
- `ed/ed-service-bands.module.css .wait`
- `movements/movements.module.css .glanceCountZero`
- `ward-modes-second-edition.module.css .toneBadge`
- `ward-modes-second-edition.module.css .numCell`
- `ward-modes-second-edition.module.css .candidateRank`
- `ward-management-modes.module.css .summaryCard strong` — element-scoped; measured by selector, 0 elements matched
- `ward-management-modes.module.css .bedStates strong` — element-scoped; measured by selector, 0 elements matched
- `ward-modes-second-edition.module.css .decisionHeader h2` — element-scoped; measured by selector, 0 elements matched

## What was ruled, and what was built

| declaration                                                                                                              | ruling                                                   | built          |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | -------------- |
| `ward-modes-second-edition .panelBadge`                                                                                  | prose — **the synthetic-data disclosure**; drop the face | ✅ `544f6a470` |
| `ward-management .rowVerdict`                                                                                            | prose (`"Eligible"`); drop the face                      | ✅ `544f6a470` |
| `ward-record-row .groupCount`                                                                                            | not a column; drop the face                              | ✅ `544f6a470` |
| `ward-figure .figureValue`                                                                                               | mixed — face moves to a numeric-only modifier            | ✅ `544f6a470` |
| `capacity .attentionWho`                                                                                                 | prose (ward names); drop the face                        | ✅ `f5e761347` |
| `ward-panel .panelCount`                                                                                                 | prose on 21 of 32 call sites; drop the face              | ✅ `eca172f8f` |
| `ward-bar .count`, `ward-controls .pillCount`, `movements .glanceCount`, `capacity .gapNumber`, `ward-record-row .clock` | **columns — keep the face**                              | —              |
| `ward-record-row .id`, `delays .attentionWho`                                                                            | **identifiers (`WF-009`) — keep the face**               | —              |

`tests/ward-mono-face-earns-its-place.test.ts` holds the ruled set as a table and asserts **both
directions**: prose slots keep the face off, and column slots keep it **on** — because "remove the
mono" read as a blanket rule takes the alignment with it.

## The twelve that never render — recorded as evidence, not actioned

**Nearly half these declarations style surfaces no route reaches**, measured by selector on all 33
routes rather than inferred from absence. That is a reachability question rather than a typography
one, and it belongs with the wider reachability item rather than in a styling fix.

⚠️ **A class can be partly reachable, which the count above hides.** `.panelBadge` has two call sites
— `"Synthetic prototype"` and `` `${n} synthetic records` `` — and only the first rendered on any
route. A per-declaration count says "1 node" where the truth is "one of two call sites is reachable".
