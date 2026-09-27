# Q004 shared design notes

Owner-approved implementation exceptions and proven shared patterns, recorded 2026-09-13. These notes supplement the [Q004 plan](../2026-09-13-product-refinement.md) and its [active visual review policy](VISUAL-REVIEW.md). They do not rewrite the authoritative drawings or their historical design standard.

## Compact navigation

Below 1000px, show the three Operations routes and the current route when it is outside that group. Keep every remaining route accessible through the existing **More pages** sheet. Preserve active-route identity, keyboard access and the shared synthetic-data indicator. This is an explicit Q004 exception to the historical standard's phone rail showing all route groups as a wrapping row. The desktop rail retains its existing grouping.

## Panel height and scrolling

Short summaries, context panels and empty selection details use their content height; they do not stretch to fill an otherwise blank column. Long desktop worklists and detail bodies retain independent bounded scrolling, readable minimum heights and keyboard access. Keep their headings and controls stationary. Choose bounds per composition; do not replace every panel with unbounded document flow or force short panels to match the tallest neighbour. Narrow layouts and print release desktop bounds where required for readable document flow. Preserve canonical table styling and page-specific hierarchy, wrapping and actions.

## Capture and independent review

Keep source stable during capture. The controller's capture lane and independent reviewers work separately: reviewers inspect the actual served-reference/live evidence while capture continues on another frozen family. Serialize shared viewport and demo-state changes. Name the page, state, theme and actual dimensions; record reused family evidence and uninspected unique states explicitly. A screenshot file alone is not an acceptance verdict.

Numerical scoring is inactive. Preserve historical scores for later polishing. Review against operational readability, accessible controls, truthful data and the served drawing; fix material defects and record concrete acceptance evidence. Do not repeat unchanged passing checks or captures, and do not turn deferred coverage into a passing claim.
