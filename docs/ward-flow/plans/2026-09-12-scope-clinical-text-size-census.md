# Scope — a census of small text, classified by whether a coordinator acts on it

**Written 2026-09-12 by Lane A at Ward Lead's request. SCOPE ONLY — nothing built, nothing started.
It goes to the owner as a commissioned piece with its cost beside it, the way the model-growth four
did.**

## The question, and why it is worth more than a count

> **10px on a legend is a style choice. 10px on a bed count is a safety question.**

The ward tree uses `var(--text-3xs)` (10px) **299 times** and `var(--text-2xs)` (11px) **88 times**
(measured by Ward Lead, 2026-09-12, committed files only). That is the house idiom, not a defect,
and it predates every build running this week.

🔴 **So the useful answer is not "how many elements are below 12px". It is "which of them carry text
a coordinator acts on".** A total tells the owner nothing he can decide from; a list of the clinical
subset is a decision he can take screen by screen, which is how D-3 already frames it.

⚠️ **And only a browser can separate them.** The token is byte-identical in both cases: the
stylesheet cannot say whether `.legendLabel` and `.bedCount` differ in consequence, because as far
as the CSS is concerned they differ in nothing.

## What it would walk

|              |                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes**   | The ward route set — 31 screens per the enumeration the owner's ruling was measured against. ⚠️ The exact list must be **derived at run time from the route files**, not typed: a typed list silently misses a screen added after it was written, and this census's whole value is its denominator.                                                       |
| **Elements** | Every element rendering non-empty text, via `document.querySelectorAll("*")` filtered to leaf-ish nodes with own text. **Not a wrapper-keyed selector** — `tests/ui-ward-table-thresholds.spec.ts:103–123` records three of its four misses sharing one cause: the thing it looked for had no wrapper, so widening the route list could never reach them. |
| **Read**     | `getComputedStyle(el).fontSize`, on the **real route under the root layout**. Outside it, `--text-xs` and every `.ckb-v2`-scoped token resolve to nothing and `font-size` falls back to the inherited value — which is _larger_, and reads as compliance.                                                                                                 |
| **Build**    | Production. Module class names drop the source filename in a production build, so any class-keyed grouping is empty there (`tests/ui-ward-forced-colors.spec.ts:27`). Grouping must key on tag, role, text content or an added attribute.                                                                                                                 |

## How it would classify — and this is the part to argue about

🔴 **The classifier is a JUDGEMENT, not a measurement, and the scope should say so in its own output
rather than presenting a verdict.**

Three tiers, decided per element:

1. **Clinical** — text a coordinator acts on: a patient identifier, a ward name, a bed count, a
   wait, a deadline, a legal status, a refusal reason, a count of people.
2. **Chrome** — navigation, section labels, tab names, keyboard hints, legends, units on an axis.
3. **Undecidable** — the element's text alone does not say. ⚠️ **This tier must exist and must be
   reported, not folded into one of the other two.** A classifier with no "I cannot tell" bucket
   forces every ambiguous case into a confident answer.

### How it fails, stated rather than discovered

⚠️ **The two error directions are not symmetric, and the classifier should be deliberately biased:**

- **Calling chrome clinical is CHEAP.** The cost is somebody raising a label that did not need it.
- **Calling clinical text chrome is NOT.** It removes a bed count from the list the owner reviews,
  and the omission is invisible — nothing downstream says "this was considered and dismissed".

🔴 **So: when in doubt, classify as clinical.** And report the undecidable tier by name so the bias
is auditable rather than buried.

⚠️ **A second failure mode worth naming: the same element can be clinical on one screen and chrome
on another.** "Ready" as a column header is chrome; "Ready" as a bed's state word is clinical. The
census must key on **element-on-route**, never on a string.

## What it could not tell apart

- **Text that renders only in some state.** A figure that appears once a list is non-empty is absent
  from the census rather than silently absent from the check — the same distinction
  `ui-ward-table-thresholds` already prints on every run. **The census must print what it did not
  reach, not only what it found.**
- **Text inside a portal or an overlay that is closed by default** — drawers, sheets, the activity
  and tasks popovers. Reaching those means driving each one open, which multiplies the run.
- **Anything rendered only for a role, a width, or a scenario the walk does not adopt.** The 40rem
  case alone already hid a live violation from a desktop-width measurement.

## Cost

|                    |                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Build**          | A day's work, most of it in the classifier and its output format rather than the walk. The walk itself is ~40 lines and the pattern is already committed in four specs.                                                                                      |
| **Run**            | Long. The runner builds production per invocation — measured at **3.6 min to compile** before a single assertion, and 31 routes rather than four.                                                                                                            |
| **Where it lives** | ⚠️ **A new `ui-ward-*.spec.ts` filename matches NOTHING**: `playwright.config.ts`'s `testMatch` is an explicit allow-list. It must extend a listed file, or Ward Lead must wire two patterns.                                                                |
| **Maintenance**    | 🔴 **The real cost.** A census produces a number that ages the moment anybody styles anything, and a stale census is worse than none because it reads as current. **It should produce a dated, committed RECORD — never a baseline anything diffs against.** |

## 🔴 THE CHEAPEST WINS ARE NOT THIS CENSUS — they are a gate that already exists and runs nowhere

**Added 2026-09-12 after Ward Lead retracted its own "no committed gate exists" finding. It exists.**

```
scripts/ward-flow/check-text-size-floor.mjs      9,930 bytes — implements OWNER RULING D-3
scripts/ward-flow/text-size-floor-baseline.json  393 across 39 files, pinned 2026-09-10
occurrences of "check-text-size-floor" in package.json                    0
```

⚠️ **D-3 is the ruling, and it is not what "the 12px floor" has been relayed as.** The owner
**refused a sweep** and ruled instead: **no NEW sub-12px declarations from now on, existing ones
raised screen by screen as each screen is rebuilt.** So the floor _is_ an invariant for new work,
and the 299 existing uses are **grandfathered by that ruling** — which is a different thing from
deliberate non-compliance, and must not be recorded as the owner blessing the status quo.

### Three defects in the ratchet, measured

1. 🔴 **IT IS WIRED TO NOTHING.** No `package.json` script, no test, no CI job. It has never run in
   anger. **Two sibling gates in the same directory are orphaned identically** —
   `check-source-control-chars.mjs` and `check-errata-freshness.mjs`, both absent from
   `package.json`. **A directory of ward gates, none invoked.**
2. 🔴 **IT IS A NET RATCHET, so a new breach hides behind an old removal.** Run 2026-09-12: current
   **383**, baseline **393**, _"Not risen"_ — while nine new sub-12px declarations were added the
   same night. **It gets weaker exactly as the programme succeeds**: every rebuilt screen that
   raises text adds slack the next breach hides in.
3. 🔴 **IT CANNOT SEE A RAW LITERAL.** `TOKEN_PATTERN = /--text-3xs|--text-2xs/g` — it counts two
   token names. A size written as `0.625rem` or `10px` is invisible to it, and its own output says
   so. ⚠️ **Both sub-12px sizes this lane fixed tonight were raw literals:** `.personSince` at
   `0.625rem` and the phone badge override at `0.65625rem`. **Neither was ever visible to the gate —
   and neither was the FIX, so the count did not move when they were repaired.**

### 🔴 AND THE SCRIPT ALREADY COMPUTES THE RIGHT THING — verified, not relayed

**The remedy is shorter than "make it per-declaration". The data is already in memory:**

```
:104   const perFile = files.map((f) => ({ file: f, count: countFile(f) })).filter((f) => f.count > 0);
:105   const total   = perFile.reduce((sum, f) => sum + f.count, 0);          ← only `total` is used
baseline.json      { count: 393, fileCount: 39 }                              ← perFile is not pinned
```

✅ **`perFile` is computed and thrown away.** **Pin it, and the SAME script enforces D-3's actual rule
— no rise in ANY file — instead of the weaker one it reports.** 🔴 **The script computes the right
thing and publishes a weaker one; that is a reporting defect, not a missing instrument.**

⚠️ **AND A SECOND SLACK SOURCE: `fileCount` is PRINTED AND NEVER COMPARED.** Verified — it appears at
`:117` inside a template literal and at `:126` when writing a new baseline, and nowhere else; the
exit code turns on `diff` alone. **Both runs today report 37 files against a baseline of 39.** 🔴 **A
file LEAVING the population donates its entire count as headroom — and a RENAME does that as surely
as a deletion.**

**So the wiring item is three parts, not one: wire it · pin per-file · compare `fileCount`.**

### Recommendation, and it displaces the census in priority

✅ **Wire the gate the owner already ruled into existence, and make it per-declaration rather than
net. An hour, not a day.** 🔴 **The remedy is not "write a gate" — that is what would have been
commissioned had nobody looked.** ⚠️ **Add raw `rem`/`px` literals below 12px to what it counts, or
it stays blind to the shape that hid `.personSince` for as long as it did.**

## What it is NOT

🔴 **It is not the type-floor gate.** `tests/ui-ward-table-thresholds.spec.ts`'s type-floor block
asserts **fourteen** elements the owner named, on four routes, and passes or fails. That gate is
the first committed assertion of the 12px floor anywhere in this repository, and it must not be read
as evidence the estate complies — 299 uses of the 10px token sit outside its population entirely.

⚠️ **And the floor itself is an aspiration being measured, not an invariant in force.** O-17.1
approved it in principle and explicitly did not commission the migration. A census reported as a
compliance check would misrepresent the whole codebase.

## Recommendation

**Worth commissioning, and worth commissioning as a RECORD rather than a gate.** The clinical subset
is a list the owner can act on screen by screen; the total is a number nobody can. 🔴 **But it should
be his call, because a classifier that decides what counts as clinical text is a clinical judgement
wearing a measurement's clothes, and this lane should not make it silently.**
