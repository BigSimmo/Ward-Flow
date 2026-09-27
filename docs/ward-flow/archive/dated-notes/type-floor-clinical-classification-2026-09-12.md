# Small text, sorted by whether a coordinator acts on it — 2026-09-12

**What this is.** A classification laid over an existing measurement. It answers the question the
raw record deliberately did not: of the text rendering below 12px, which of it carries something a
bed coordinator acts on, and which is furniture.

**What it is NOT, and this matters more than anything below:**

- 🔴 **It is not a defect list.** O-15.1 grandfathers the existing 10px/11px text on ward, board, ED
  and community screens and raises it **at each screen's rebuild, not before**. Nothing here is a
  breach. This is a list for deciding **which screen to rebuild first**.
- 🔴 **It is not a measurement I took.** Every figure comes from
  `docs/ward-flow/plans/type-floor-record-2026-09-11-528bb60708/` (on `40a3e9ce7a`), crawled
  **2026-09-11 against `528bb60708`**, one viewport, light theme, dev server. That record says of
  itself: _a record, never a baseline._ This inherits that limit whole. A screen rebuilt since then
  has moved underneath this page, and this page will not know.
- **It is not a verdict.** The classification is a judgement. It is offered to be argued with, and
  the "could not tell" list is part of the answer, not an admission.

---

## The rule I classified by

A classifier nobody can check is worth nothing, so here is the rule, and it is mechanical enough
that you can disagree with any single row by looking at it:

> **CLINICAL** — the element's text **varies with the data**, or it **qualifies the truth of the
> data** beside it.
>
> **CHROME** — the element's text is **the same whatever the data says**: navigation, column
> headings, legends, keyboard hints, section titles, alphabet rails.

So `Ready` in a legend is chrome. `Ready 2` on a bed chip is clinical — the number is the point, and
the word without the number is meaningless. `Unit` as a column heading is chrome; `RPH Adult Secure`
in that column is clinical.

**Caveat text counts as clinical.** Every `Synthetic prototype` badge, every provenance paragraph,
every "this is not a live statewide count" sits in the clinical list. These exist precisely to stop
somebody reading invented figures as real ones, and a safety caveat too small to read has failed at
the only job it has.

### The bias, stated rather than hidden

The two mistakes are not equal:

- **Calling chrome clinical is cheap** — it costs a little review time.
- **Calling clinical text chrome is not** — it drops a bed count off the list somebody reviews, and
  nothing downstream ever says it was considered and dismissed.

So **when in doubt I called it clinical**, and where I could not tell at all I said so rather than
resolving it. That is the third list, and it is large.

**Added 2026-09-12, Step 4: does this rule bind whoever classifies?** Yes, including whoever wrote
it — the CLINICAL/CHROME test above is applied to every row in this document by its own author,
using the same test anyone else would use, and Lane B's rebuild-order document adopted it afterward
in the same words. This is not a routing instruction naming a recipient other than the writer; it
is the working definition, and it binds the next person who classifies a below-floor element
exactly as it bound the classification below.

---

## The answer, shortest form

**Of the 260 measured groups, the ones that should worry you cluster on five screens** — and they
are the five busiest screens in the tool. The biggest concentration of below-floor text is not a
label anywhere. It is **bed counts, waiting times and triage tiers**.

| Screen                     | Clinical elements below 12px (approx.) | The worst of it                                                                                                                                  |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Coordinator home** (`/`) | ~380                                   | Bed chips `Ready 2 / Held 3 / Blocked 0` (138 elements at 10px); triage tier and score on every queued patient (86); `Not authorised — MHA 2014` |
| **Network** (`/network`)   | ~380                                   | Bare bed counts rendered as digits alone — `2`, `3`, `0` (130 at 10px); waiting times (49); **triage tier as a bare `1` or `2`** (45)            |
| **ED** (`/ed/peel-ed`)     | ~180                                   | The referral table (101 cells at 10px); `Form 3B (Continuation of detention)` and its deadline; `Police in attendance`                           |
| **Delays** (`/delays`)     | ~190                                   | Every patient's wait, cause, and "nothing recorded for 10h 56m" — 170 elements at 10px                                                           |
| **Board** (`/board/…`)     | ~120                                   | `Tentative diagnosis: …`, held-up reasons, and length-of-stay bands at 11px                                                                      |

Then, some distance behind: `/capacity`, `/hub`, `/movements`, `/wards`, `/community`,
`/discharges`, `/out-of-area`, `/transport/officer`, and the statistics family.

🔴 **If the rebuild order is decided by one thing only, it should be the two places where a number a
coordinator acts on is rendered with no word attached — Network's bare bed counts and bare tier
digits.** A bed count misread is a wrong placement; a legend misread is a moment's confusion.

---

## The clinical list, by screen

Read `n` as "elements of this kind counted on that screen". `Z` marks a group that was collapsed or
zero-size when the crawl read it — real text the reader meets only after opening something. It is
still counted; it simply was not on screen at the moment of measurement.

### Coordinator home — `/`

| Group                                                                               | n         | px    | Sample                                                             |
| ----------------------------------------------------------------------------------- | --------- | ----- | ------------------------------------------------------------------ |
| `coordinator.diagramBedChip`                                                        | 138       | 10    | `Ready 2`, `Held 3`, `Blocked 0`                                   |
| `coordinator.queueTier`                                                             | 43 (+6 Z) | 10    | `Tier 3 — least urgent`, `Tier 1 — most urgent`                    |
| `coordinator.queueScore`                                                            | 43        | 10    | `Operational 12`, `Operational 53`                                 |
| `coordinator.diagramUnitCapability`                                                 | 23        | 10    | `All open — Adult — 24 beds`                                       |
| `coordinator.diagramUnitName`                                                       | 23        | 11    | `SCGH Adult Open`, `Graylands Adult Secure`                        |
| `span` (unclassed, Z)                                                               | 12        | 10    | `40m waiting`, `Youth — Perth Metropolitan — from ARM`             |
| `decline-register.entryMeta`                                                        | 12 Z      | 10    | `Declined by RGH Adult Secure`, `22:08`                            |
| `strong` (Z)                                                                        | 12        | 11    | `RF-001`, `RF-009` — referral identifiers                          |
| `coordinator.pressureStats`                                                         | 8         | 10    | `8 waiting — longest 2d 14h`                                       |
| `diagramEdName` / `diagramEdStats` / `diagramEdCode` / `pressureSiteCode`           | 8 each    | 10–11 | `Peel Health Campus Emergency Department`, `8 waiting`, `RGH`      |
| `decline-register.entryReason`                                                      | 6 Z       | 11    | `capability mismatch`, `specialling unavailable`                   |
| `coordinator.diagramServiceHeading`                                                 | 5         | 10    | `North Metro`, `East Metro`                                        |
| `exceptionDetail` / `exceptionOwner` / `exceptionTitle`                             | 4 each    | 10–11 | `WF-009 — 5 destinations have declined`, `Bed pull expired`        |
| `registerTabCount` / `queueTabCount` / `regionCount`                                | 4 / 2 / 2 | 10    | `6`, `43`, `8 departments`                                         |
| `coordinator.diagramUnauthorisedBadge`                                              | 2         | 10    | 🔴 `Not authorised — MHA 2014`                                     |
| `coordinator.queueFlag`                                                             | 1         | 10    | `Flagged urgent`                                                   |
| `coordinator.diagramBeingMadeReady`                                                 | 1         | 11    | `1 of the ready bed is still being made ready`                     |
| caveats — `prototypeBadge`, `pressureRule`, `exceptionsCoverageNote`, `placeholder` | 1 each    | 10–11 | `Synthetic prototype`, `Ordered worst first: breached deadlines,…` |

### Network — `/network`

| Group                                                                                                | n        | px  | Sample                                                                    |
| ---------------------------------------------------------------------------------------------------- | -------- | --- | ------------------------------------------------------------------------- |
| `ward-management-network.bedChip`                                                                    | 130      | 10  | 🔴 `2`, `3`, `0` — a bed count with no word attached                      |
| `ward-management-network.queueMeta`                                                                  | 98       | 10  | `Adult — Open ward`, `East Metro — Referred for psychiatric examination`  |
| `ward-management-network.elapsed`                                                                    | 49       | 10  | `1h 35m waiting`, `4h 20m waiting`                                        |
| `ward-management-network.tier`                                                                       | 45       | 10  | 🔴 `1`, `2` — triage tier as a bare digit                                 |
| `ward-management-network.serviceCapability`                                                          | 23       | 10  | `All open — Adult`, `All locked — Adult`                                  |
| `ward-management-network.bedTime`                                                                    | 23       | 10  | `21:58` — bed-count freshness                                             |
| `strong` (uppercase)                                                                                 | 6        | 10  | `NORTH METRO`, `WACHS`                                                    |
| `pipelineSplit`, `hubMeta`, `patientLine`, `patientSubLine`, `count`, `beingMadeReady`, `ownerLabel` | 1–2 each | 10  | `6 arrived — 1 did not proceed`, `43 open movements`                      |
| caveats — `assurance`, `tierNote`, `schematicBadge`, `prototypeBadge`                                | 1 each   | 10  | `System suggests, you decide. No automatic…`, `Schematic, not geographic` |

### Emergency department — `/ed/peel-ed`

| Group                                    | n      | px  | Sample                                                                              |
| ---------------------------------------- | ------ | --- | ----------------------------------------------------------------------------------- |
| `td` (unclassed; shared with `/network`) | 101    | 10  | `Different health service`, `Adult`                                                 |
| `th` (unclassed; shared with `/network`) | 31     | 10  | `1 SCGH Adult Open`, `3 RPH Adult Secure`                                           |
| `ed.outstandingLabel`                    | 19     | 10  | `Medically cleared`, `Waiting to move`                                              |
| `ed.cardMeta`                            | 15 + 7 | 10  | `Adult — Open — Female — Detained awaiting…`, `Handover ready`                      |
| `ed.tierLabel`                           | 13     | 10  | `Tier 1 — most urgent`                                                              |
| `ed.referralState`                       | 9      | 10  | `Accepted at FRE Adult Open`, `Destination review`                                  |
| `ed.outstandingItem`                     | 8      | 10  | 🔴 `Form 3B (Continuation of detention)`, `Bed pulled — ready to mark the handover` |
| `ed.sectionHeading`                      | 7      | 10  | `Referrals — 1 patient` (the count varies, so not chrome)                           |
| `ed.policeFlag`                          | 1      | 10  | 🔴 `Police in attendance`                                                           |
| `ed.beingMadeReady`                      | 1      | 11  | `1 still being made ready`                                                          |

### Delays — `/delays`

| Group                                                                                    | n            | px    | Sample                                                                      |
| ---------------------------------------------------------------------------------------- | ------------ | ----- | --------------------------------------------------------------------------- |
| `delays.personCause`                                                                     | 43           | 10    | `No suitable bed anywhere in the network`                                   |
| `delays.personMeta`                                                                      | 43           | 10    | `Adult — Needs a locked bed — Tier 1 — most urgent`                         |
| `delays.personSince`                                                                     | 43           | 10    | `nothing recorded for 10h 56m`                                              |
| `delays.personWait`                                                                      | 41 (+2 long) | 10    | `7h 00m`, `10h 56m`, `2d 14h`                                               |
| `delays.ownerSub`                                                                        | 5            | 10    | `Your decision, or a legal deadline running`                                |
| `grpN`, `tabNum`, `causeMeta`, `attentionWho`, `ownerHot`, `rowWhen`, `rowWho`, `rowSub` | 1–4 each     | 10–11 | `21`, `2 needing attention now`, `WF-009`, `to State bed coordination desk` |
| caveats — `foot`, `paneScope`, `prototypeBadge`                                          | 1–3          | 10–11 | `One blocker per person — the worst thing`                                  |

### Ward board — `/board/rph-adult-secure`

| Group                                                                                             | n           | px    | Sample                                                                                |
| ------------------------------------------------------------------------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------- |
| `board.personLine`                                                                                | 33 Z        | 11    | 🔴 `Tentative diagnosis: Schizophrenia, schi…`, `Tentative diagnosis: none recorded.` |
| `board.sheetRowLine` (`p` and `li`)                                                               | 23 + 8 Z    | 11    | `Female, from South West`, `Held up by: Awaiting accommodation.`                      |
| `board.personBand` / `sheetRowBand`                                                               | 17 + 7 Z    | 11    | `Under 2 weeks`, `Over 3 months`                                                      |
| `board.daysUnit`                                                                                  | 17          | 10    | `days` — the unit on a length-of-stay figure                                          |
| `board.pastMark` / `awayMark`                                                                     | 3 + 3 Z / 2 | 10    | `Past date`, `At ED`                                                                  |
| `board.flowRowLine` / `flowRowBlocker` / `personBlocker`                                          | 3 / 1 / 2 Z | 11    | `Bed given away 6 hours ago`, `Held up by: Awaiting clean.`                           |
| `board.waiting` / `heldLabel` / `emptyLabel`                                                      | 1 each      | 11    | `Empty, waiting`, `Held`, `Ready`                                                     |
| caveats — `sheetNote`, `flowNote`, `peopleAbsence`, `footnote`, `prototypeBadge`, `triageLedNote` | 1–6         | 10–11 | `No arrival time is shown: the record holds…`, `Any diagnosis shown is tentative`     |

### The rest, in brief

| Screen                          | Clinical groups worth naming                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/capacity`                     | `bed-map.wardCounts` 23 @11 (`2 ready — 3 held — none blocked — 19 occupied`); `capacity.who` 23 Z; `attentionWho` 6 (`A locked adult bed`); ward and service counts                                                    |
| `/hub`                          | `resultSub` 41 (hospital + service); `resultStat` 21 (`2 ready`); `decisionRef` 3; `decisionReason` 3 (`No ready beds, and the last bed confirmation…`); `flagPill` 2 (`stale`); `firstFlag` 1 (`Do this first — both`) |
| `/movements`                    | `groupCount` 7 (`18 people`); `ward-bar.zero` 3; group notes (caveats). ⚠️ `ward-record-row.sep` (323) and `clockSub` (58) are **chrome** — a separator and a constant word                                             |
| `/movements/WF-001`             | `rowRisk` 1 (🔴 `More restrictive than this movement requires`); `trackWhen` 7; `readinessWhere` 4; `timelineWhen` 1                                                                                                    |
| `/wards`                        | `ward-index.wardKind` 23 (`Adult — Open`)                                                                                                                                                                               |
| `/community`                    | `community-index.readsAlike` 22 and `familyCardLabel` 9 — 🔴 duplicate-record warnings (`Reads like 3 others — check you have the…`); `chipCount` 2                                                                     |
| `/community/central-wheatbelt`  | `footnote` 4 and `provenance` 1 — caveats about what acceptance does and does not mean                                                                                                                                  |
| `/discharges`                   | `cardService` 18 Z; `ward-freshness.stamp` 32 Z + 15 (`Confirmed 21:58 — NUM SCGH Adult Open`)                                                                                                                          |
| `/referrals`, `/referrals/new`  | `cardService` 10 Z (🔴 `1h 00m before decision — 22:09` — a deadline) and 6 Z                                                                                                                                           |
| `/out-of-area`                  | `cardBand` 18 Z (`Three hours or more from home`)                                                                                                                                                                       |
| `/transport/officer`            | `jobMeta` 8 (`Collected — 8h 20m waiting`)                                                                                                                                                                              |
| `/people/new`                   | `duplicateIdle` 1 (🔴 `Existing records have not been checked yet`)                                                                                                                                                     |
| `/governance`, `/statistics/**` | Mostly caveats and figure notes — `effectivenessBasis` (`from 1 of 27 recorded acceptances`), `chartCaption`, `figureNote`, `unitKind` 31 (hospital names), `statistics-sections.note` 22                               |
| Shared across screens           | `ward-freshness.stamp`; `ward-controls.pillCount` 7; `ward-bar.count` 7; `strong` 51 @11 (movement identifiers such as `WF-018`)                                                                                        |

---

## Chrome — named, so the setting-aside is visible

`kbd` keyboard hints (95 elements across all 31 screens, `Ctrl K` / `Esc`); `ward-global-search.guidance` (31); the alphabet rail on `/community` (26); column headings `Unit` / `Cohort` / `Security` / `Stage` / `Reason` / `Elapsed wait`; section headings and eyebrows (`Across all services`, `Ward and ED comparisons`, `Beds, network-wide`); legends whose text never changes (`Ready`, `Bed held`, `Confirmed today`, `Under 8 hours`, `8 to 24 hours`); tab buttons (`Wards` / `EDs` / `Community`, `Declines` / `Overrides` / `Refused actions`); form field labels (`Stage`, `Department`, `Search`, `Age band`, `Sex`, `Home region`); the `·` separator on `/movements` (323 elements); `in journey` (58); pipeline stage names; `View` row actions; the search hint on `/hub`.

⚠️ **Two of these are worth revisiting at rebuild even though they are chrome**: the `/movements`
separator at 323 elements and `in journey` at 58 dominate any raw count of that screen and will make
`/movements` look far worse than it is. A total will mislead there.

---

## What I could not tell — and it is a lot

🔴 **This is the honest limit of the exercise, and it is structural rather than a matter of effort.**
The record groups elements by **tag and CSS class together**, and a group with no class name lumps
unrelated elements from many screens under one key. Those groups cannot be classified as one thing,
because they are not one thing.

| Group                                                    | n        | Routes | Why it could not be called                                                                                                                                                |
| -------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `11.0px span` (no class)                                 | **388**  | 4      | Samples span `Updated 22:13`, `Scenario set on 15 Aug 2026`, `Review matches, cross-catchment escalation…` — a freshness stamp, a scenario label and prose, under one key |
| `10.0px span` (no class)                                 | **115**  | 6      | `40m waiting` and `7h 00m waiting` are plainly clinical, as is `Older adult — Open — from SCGH` — but the key spans six screens and the rest cannot be vouched for        |
| `10.0px td` (no class)                                   | **101**  | 2      | Table cells on `/ed` and `/network`. Almost certainly clinical, but the cells are not separated by column                                                                 |
| `10.0px kbd`                                             | 95       | 31     | Samples are `Ctrl K` / `Esc`, but the first sample is `/` and one key covers 31 screens                                                                                   |
| `11.0px strong`                                          | 51       | 6      | Mixes `not a medical device` (caveat) with `WF-018` (identifier)                                                                                                          |
| `10.0px strong`                                          | 38       | 22     | Mixes `Statewide flow hub` (chrome) with `not real figures` (caveat)                                                                                                      |
| `10.0px th`                                              | 31       | 2      | `1 SCGH Adult Open` is clinical; the uppercase sibling group is chrome. One key, two kinds                                                                                |
| `10.0px p`                                               | 24       | 23     | Provenance prose, but 23 screens under one key                                                                                                                            |
| `10.0px b`                                               | 14       | 5      | `Ready`, `Held`, `Confirmed` — clinical as a state word, chrome as a legend, and the key cannot say which                                                                 |
| `10.0px h3` / `h2`, `11.0px p`, `10.0px em`, `11.0px th` | 2–7 each | 1–4    | Too few samples to separate a heading from a statement                                                                                                                    |

**That is roughly 800 elements placed in neither list.** Where the samples made a call obvious the
lean was clinical and is shown in the screen tables above; where they did not, the element sits here.
**Resolving them needs a re-crawl keyed on element-and-route rather than on class** — which is what
the scope document asked for, and what the existing record, written for a different question, does
not provide.

### And these it could not see at all

- **Anything behind an action** — drawers, sheets, filters, form steps, the activity and tasks
  popovers. The crawl followed links only. `Z`-marked groups are the visible edge of this: text that
  exists, collapsed, at the moment of reading.
- **Anything at another width.** One viewport, 1600×1200. The collapse rules below 1500px were not
  in force, and a swap at a breakpoint can render entirely different text.
- **Whether a size is deliberate.** The record reads computed values, so a token that fails to
  resolve reports the **inherited** size and looks like compliance. A 12px reading here is not proof
  that 12px was intended.

---

## Recommendation

1. **Rebuild `/network` first**, for the bare `2` / `3` / `0` bed counts and the bare tier digits.
   A number with no word beside it is the one case where small text changes what somebody does.
2. **Then `/` and `/ed`** — the bed chips, the triage tiers, the detention form and its deadline.
3. **Treat every `Synthetic prototype` badge and provenance paragraph as clinical at every rebuild.**
   They are the only thing standing between invented figures and somebody believing them.
4. **Do not diff anything against this page.** It describes 2026-09-11. If it matters again, re-crawl.

**The classification above is one chat's judgement, not an owner ruling.** It is offered as a list to
argue with screen by screen — which is how O-15.1 already frames the work — and the "could not tell"
table is as much a part of the answer as the two lists above it.

---

## Addendum, same day — how much of this has already shifted

The classification above describes `528bb60708` (2026-09-11). Screens have been rebuilt since, and a
page that does not know it is stale is worse than no page, so this was measured rather than assumed.

**25 of the 31 crawled screens have changed** between `528bb60708` and this branch's head. Still
identical: `/community`, `/discharges`, `/hub`, `/statistics/ed/peel-ed`, `/statistics/overview`,
`/wards`. (Route-to-source mapping by App-Router file-system routing plus reading each page's
imports; shared infrastructure such as `ward-panel`, `ward-table` and `ward-bar` was deliberately
left out of the per-route scope, since including it would mark almost every route changed and erase
the distinction being drawn. Two shared files did change — `ward-derivations.ts` and `ward-model.ts`
— so an "unchanged" route may still be affected indirectly through them.)

🔴 **But "the screen changed" is not "the sizes changed".** Sizes come from the stylesheets. For the
five headline screens:

| Screen         | Stylesheet vs `528bb60708` | `--text-3xs` uses | `--text-2xs` uses | What that means here                                                                                                             |
| -------------- | -------------------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **`/network`** | **byte-identical**         | 33 → 33           | 0 → 0             | 🔴 **The bare bed-count digits and bare tier digits are still at 10px today.** The top recommendation is current, not historical |
| **`/ed`**      | **byte-identical**         | 11 → 11           | 0 → 0             | The referral table, `Form 3B`, `Police in attendance` — unchanged                                                                |
| `/`            | differs                    | 54 → 53           | 17 → 16           | One declaration of each is gone; the 138 bed chips are not among them                                                            |
| `/delays`      | differs                    | **16 → 11**       | 0 → 0             | Five below-floor declarations already raised, ahead of its rebuild                                                               |
| `/board`       | differs                    | 14 → 14           | 11 → 11           | Bytes differ, below-floor token count does not                                                                                   |

⚠️ **This is a count of declarations in a stylesheet, not of rendered elements.** A component change
can alter which classes are applied without touching the CSS, so an identical stylesheet makes it
_likely_, not certain, that the rendered sizes are unchanged. The only thing that settles it is a
re-crawl.

**Net effect on the recommendation: it stands, and `/network` strengthens.** The one screen carrying
numbers with no words beside them is also the one whose stylesheet is byte-identical to the tree the
measurement was taken on.
