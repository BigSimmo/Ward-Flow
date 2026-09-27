# Type-floor enumeration — RAW RECORD, measured 2026-09-11 at `528bb60708`. NOT A BASELINE.

**Measured at:** worktree tip `528bb60708` on `claude/wardflow-design-review-43df97` (the ward master
line at `1c45f97c42` plus documents; no source differed), served by `next dev` on this machine,
2026-09-11 22:00–22:30 WAST. Every figure in these files is a claim about that tree and no other.

🔴 **This is a record, not a baseline. Nothing should ever diff against it.** The screens it describes
were being rebuilt the same week; a later run that differs is expected, not a regression, and a later
run that matches proves nothing. A baseline captured from the subject vouches for the subject. Lane A's
committed re-measurement rig may check its first run against these files **for shape** — what kinds of
thing it should find and in what form — never for equality.

The written finding these files sit behind is `../2026-09-11-type-floor-rendered-enumeration.md`; the
owner's ruling on it is O-15.1 (2026-09-11).

## Files

| File             | What it is                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `results2.json`  | The main crawl: 34 routes visited from the ward home by following internal links, one instance per dynamic route family. Per route: every element group rendering below 12px, links seen, min. |
| `results3.json`  | Three routes the crawl could not reach by link: `/people/PT-003`, `/movements/WF-001`, `/search?q=RPH`.                                                                                        |
| `all-groups.txt` | The aggregation across both: 260 groups (element tag · class · size · flags), total count, routes, up to three text samples each. Sorted by size, then breadth.                                |
| `enumerate.mjs`  | The script that produced the JSON, as run. Resolves Playwright from this worktree's `node_modules`; takes the base URL and an output path; `SEED=` limits it to named routes.                  |

## How to read a group key in `all-groups.txt`

`tag | class | px | U | SR | Z | SVG` — class names have their CSS-module hash collapsed to `.`; `U`
means uppercase (by `text-transform` or by the text itself); `SR` means screen-reader-only (clipped to
a rectangle of nothing); `Z` means zero-size at the time of the read (inside a collapsed panel);
`SVG` means inside an SVG. Groups with `SR` or `Z` were counted but set aside as invisible in the
finding. `n` is the element count in that group summed over routes; `routes` the number of distinct
screens it appeared on.

## Its own limits — read these before writing the next enumeration from this one

- **Routes walked:** 31 distinct screens — the sixteen mockup routes, one instance of each dynamic
  family (ward, board, ED, movement, patient, community team, service statistics, community statistics),
  search with and without a query. Six alias routes (`constellation`, `escalation`, `exceptions`,
  `queue`, `morning`, `transport`) redirect to counted screens and are in `results2.json` under their
  own key with the redirect target in `path`. Anything reachable only by an action (a drawer, a form
  step, a filter) was not walked.
- **Needs the root layout.** Sizes were read on real routes under `src/app/mockups/ward-flow/layout.tsx`,
  so the shell tokens and the `ckb-v2` class on `<html>` were in force. A component rendered in
  isolation would give different numbers.
- **Reads COMPUTED values**, not declared ones: `getComputedStyle(el).fontSize` per element with its own
  text nodes. `rem` under an ancestor scale, `clamp()` and the v2 tokens over globals are already
  resolved in every figure.
- 🔴 **An unresolved token reports as the INHERITED size rather than erroring.** A `var(--t-0)` written
  where `--t-0` is not in scope paints whatever the parent's size is and appears here as that size. This
  record therefore cannot distinguish "set to 12px" from "unresolved and inherited 12px". Only a check
  that compares the computed value to the intended target, per element by name, can.
- **One viewport, one theme:** 1600 × 1200, light. Collapse-ladder rules below 1500px were not in force;
  dark theme does not change sizes but was not read.
- **Dev server, not production build.** No size differences are expected between the two, but it was not
  verified.
- **Grouping is by class, not by element.** A group with `n=43` is 43 elements that share a tag, class
  and size on one screen; the samples are the first three texts met, not a representative set.

Tier: the crawl was written and run by this chat directly (no subagent); the finding it supports was
re-read against the standard by the same chat. Nothing here has been independently re-derived.
