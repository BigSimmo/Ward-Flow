# Q004 visual review — active lean policy

Owner approved risk-based coverage and removed numerical scoring from active delivery on 2026-09-13. The rubric below and previous scores are **historical material retained for a future polish pass**, not current acceptance requirements.

- Compare each changed page against its served HTML drawing at 1440px in light and dark. Fix material reference mismatches, unreadable content, hidden actions, misleading data, clipping and broken scrolling/navigation.
- Check 390px and 820px for each shared layout family; name the representative and reused layout in sibling records. Unique or materially changed responsive compositions need their own small-width checks. Complex dashboards, forms and drawers retain full six-view coverage where warranted.
- Up to three workers own disjoint screen families through implementation and initial visual checks. Use separate tabs; serialize shared viewport/demo-state changes when isolation is unavailable. Freeze source during its capture interval.
- Deliver coherent batches of 4–6 related screens where practical. Controller performs consolidated independent review, prioritizing complex layouts and behavior/access changes. Use one planned correction pass; remaining material defects still require fixing. Minor cosmetic preferences wait for one final consistency pass.
- Record actual page widths/themes/states, evidence and deviations in the existing ledger and canonical verification record. Name reused family evidence and deferred page-specific checks explicitly; never count a representative check as a check of every sibling. Regenerate the record per accepted batch.
- Reuse successful checks and unaffected captures. Preserve focused behavior/access-control tests, consolidate necessary test adaptation at stable batch boundaries, and reserve the broad domain gate for final integration. Styling alone does not trigger behavior tests.
- Park unsupported print/export verification unless it blocks a commissioned core journey; label it unverified. No scoring, scorecards, new review tooling or repeated aesthetic tuning during active delivery.

Historical score locations: `PROGRESS.md`, task review reports, `capacity-visual-acceptance.md`, and existing `screen-verification.json` notes. Preserve these and their evidence. They may inform later polishing but do not certify future changes or reactivate the old thresholds.

## Historical rubric — inactive, retained for later polishing

Use this short rubric alongside actual served-reference and live screenshots. Score each category 0–2 (half points allowed), with one concrete finding for any deduction. This is a reviewer judgement, not a measured quality guarantee.

| Category                 | Full-score standard                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Reference fidelity       | Matches the drawing's hierarchy, density and visual identity, with explicitly requested redesigns and behaviour deviations recorded.       |
| Spacing and alignment    | Balanced panel dimensions, consistent padding, aligned edges and readable density; no cramped key or large accidental voids.               |
| Readability              | Clear typography and information hierarchy; concise operational copy; semantic colour with text/icon equivalents and readable contrast.    |
| Controls and interaction | Important actions readily visible, proportional controls, clear selected/disabled states, logical focus and disclosure behaviour.          |
| Responsive behaviour     | Stable adjacent panels and independently scrolling content where appropriate; usable phone flow, no clipping/overlap, accessible controls. |

Acceptance: **at least 9/10**, no blocking visual, accessibility or journey defect, and all six required width/theme comparisons actually performed. Do not average away a failed viewport or theme. An unviewed cell remains pending regardless of the provisional score. A blocking defect includes hidden/unreachable primary actions, misleading status, clipped operational information or broken scrolling/navigation.

For each screen record: reference and live evidence paths; width/theme/state reviewed; five category scores; concrete deductions; required fixes; verified result. Reuse unchanged evidence. Review fixes once at affected states, widening only if shared changes justify it. Canonical completion still belongs in screen-verification.json and its generated record.

Promote a pattern to the shared design rules only after it works in the rendered screen and has no unresolved responsive defect. Record the concrete rule and reason, then reuse it on the next relevant page. Avoid arbitrary restyling or repeated scoring-only iterations.

## Keep the review fast

- Score once at the end of a coherent implementation batch, not after each edit. Use one short scorecard per screen; the six viewport/theme observations remain supporting evidence, not six separate essays.
- List at most three highest-impact corrections per pass, marked blocking or polish. Fix shared causes together. Do not withhold acceptance for personal styling preferences that are unsupported by the brief or visible evidence.
- Recheck only affected states after a fix. Reuse unchanged reference captures and valid observations; do not rerun behaviour tests for a spacing-only correction unless it changes interaction or overflow.
- A numeric score never triggers a test command. Select behaviour checks from changed risks, independently of the design score. Avoid artificial precision: use half-points, not decimal tuning.
- Once the threshold, no-blocker condition and required evidence are satisfied, move on. Improve the rubric only when a concrete review miss or repeated ambiguity shows why a rule needs changing; keep the five categories stable across this commission.
