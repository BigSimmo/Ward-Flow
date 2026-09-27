# Ward Flow drawing staleness — committed-file check, `ward/mockups-20260910`

All reads via `git show ward/mockups-20260910:<path>` / `git log ... ward/mockups-20260910`. No working-tree files opened (a merge was in progress there). No tests run, no server started, no repo file touched.

## 1. Last-modified date, all 18

Every one of the 18 was last touched on **2026-09-11** (AWST) — none on 2026-09-10.

| File               | Commit                       | Date/time (+0800)       |
| ------------------ | ---------------------------- | ----------------------- |
| all 18 (see below) | `31ea2fdc19` or `d488d58a0d` | 2026-09-11, 22:43–22:54 |

Split: **network, legal-forms, add-a-patient, out-of-area** → `31ea2fdc19` (22:54). The other 14 (**wards, ward-answer, discharges, statistics-overview, statistics-compare, settings, handover, referrals, governance, statistics-service, transport-officer, alerts, on-call, sign-in**) → `d488d58a0d` (22:43).

## 2. The three named fixes, by commit

- **Corrected counts**: `f5342421b5` "two counts in the drawings were false..." (21:33) — touches **all 18**.
- **Breach wording made visible**: `d488d58a0d` (masthead word added on Command + 13 others, 22:43) then `31ea2fdc19` "the breach word reaches the other 32 drawings" (22:54, propagates it to the remaining pages incl. network/legal-forms/add-a-patient/out-of-area). Between the two, **all 18** are covered (sign-in has no masthead at all, so is exempt rather than missed).
- **Panel/grid overlap**: inside `d488d58a0d` — a structural CSS fix (`:has(> :nth-child(3))`, `:has(> .grid2)`) shipped to **14 of the 18**: wards, ward-answer, discharges, statistics-overview, statistics-compare, settings, handover, referrals, governance, statistics-service, transport-officer, alerts, on-call, sign-in. **network, legal-forms, add-a-patient, out-of-area did not receive it.**

## 3. Verdict vs. the owner's labels

**By file history, all 18 are CURRENT** — every one carries the counts fix and the breach-word fix. This disagrees with the owner's 10 "stale": handover, add-a-patient, referrals, governance, out-of-area, statistics-service, transport-officer, alerts, on-call, sign-in are all already fixed in the repo. His recollection was almost certainly about which _links_ he'd shared before the fixes, not the files themselves.

On the narrower panel-overlap fix only: 4 files never got it — 2 from his "current" list (network, legal-forms) and 2 from his "stale" list (add-a-patient, out-of-area). Reading their CSS, all 4 use a distinctly-named `.grid3`/named-panel layout, not the generic `.scroll` shape the bug report described — so absence of the patch likely means "not applicable," not "unfixed." Can't confirm without rendering in a browser (not run, per instructions).

## 4. Defect still present?

Grepped all 18 for breach-related text: consistently "Breach"/"Breached"/"breach"/"breaching" — no spelling/casing divergence found. No signature left to check for panel overlap without a browser measurement.

## 5. Limits

A commit touching a file proves it changed, not that a specific fix's _effect_ is correct — confirmed by reading diffs/CSS, not by rendering. The panel-overlap absence in 4 files is inferred as "not applicable" from CSS shape, not proven. All "12 September" fix commits are timestamped 2026-09-11 in the repo (AWST) — likely the owner's loose day-labelling of a late-night session, not a discrepancy in file identity.
