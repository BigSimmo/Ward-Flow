# Q004 Task 2 — independent review

Status: corrections required; no screen acceptance. Reviewed the two Task 2 edits against their preserved dirty-input snapshots, not against Git HEAD. Prior shared-shell, traffic and other dirty work is outside this finding set. Reviewer ran no tests, browser, server, provider or Git commands; the controller supplied the interaction observations identified below.

## Three corrections

1. **Blocking — a consumed attention request steals focus after changing order.** `movements-screen.tsx:677` focuses whenever a matching `StageRow` mounts. `reveal` remains set after the request, and the conditional Stage/Transport/Longest wait branches remount rows. Consequently attention → Transport replays the old request. Controller reproduced this with WF-315: the Transport radio was successfully clicked, but `activeElement` became `LI` with `aria-label="Movement WF-315"`. Consume each request once at an owner that survives grouping changes; retain highlight separately if useful. A fresh repeated attention click must still focus again. Recheck that sequence plus resolved → attention and stage-summary jump; ordinary grouping changes must leave focus on their control.

2. **Polish required by the brief — record hierarchy remains too tall and gives absence excessive emphasis.** The refined worklist capture shows ordinary rows about 190px tall, versus roughly 110–135px for the drawing's ordinary records. Full emergency-department names and bold “No accepted destination recorded” dominate the route, while stage, blocker, demographics, service, owner and actions occupy separate bands. Use the existing `originEd.siteCode` + `ED` vocabulary already used by the traffic diagram, retaining the full department name accessibly. Keep missing destination explicit but concise and subordinate, for example “No accepted destination”; never imply that no referral exists. Combine stage with the meaningful reason where space permits, and service/owner into one wrapping supporting line. Preserve legible facts and explicit actions; do not chase the drawing's pixel height by removing data or shrinking type. The current stationary toolbar, visible actions and aligned panel stack are sound.

3. **Polish required by the brief — attention falls back on truthiness rather than meaningful blocker state.** `movements-screen.tsx:225` displays “No blocker” for WF-312 and WF-309. Both are generated as `placement_requested` in `ward-movements.ts`; “Placement requested” is the useful, truthful compact status. Use `stageCopy[movement.stage].label` for blank blockers and the exact inactive sentinels in `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` (`ward-model.ts`), retaining meaningful blocker prose verbatim. Do not infer absence from a free-text regex or change ranking. Keep cleared/history detail available in the existing record/detail surfaces. The same sentinel currently costs an otherwise empty reason line in worklist rows.

## One provisional scorecard

Observed live states: **1440px light**, top-of-page and attention-focused worklist. Viewed actual files under `.superpowers/sdd/2026-09-13-product-refinement/screens/`: `movements-reference-dark-1440.png`, `movements-worklist-reference-light-1440.png`, `movements-before-light-1440.png`, `movements-refined-light-1440.png`, and `movements-refined-worklist-light-1440.png`. The dark reference supplies hierarchy evidence, not a live dark-theme comparison.

| Category                 | Score                     | Evidence / deduction                                                                                                         |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Reference fidelity       | 1.5/2                     | Compact metric band and attention now match the intended hierarchy; worklist remains materially taller.                      |
| Spacing and alignment    | 1.5/2                     | Good toolbar/panel alignment; avoidable vertical separation in ordinary records.                                             |
| Readability              | 1.5/2                     | Clear identity/time and restrained metrics; full route/absence wording overwhelms useful status.                             |
| Controls and interaction | 1.5/2                     | Explicit actions and focused record visible; confirmed stale-request focus replay.                                           |
| Responsive behaviour     | 2/2 observed desktop only | Adjacent bounded panels and target/actions visible in this capture. Phone, other widths, live dark and print remain pending. |

**Provisional observed-view total: 8/10.** This is not a full responsive score or acceptance. Reuse references and recheck only the corrected worklist/attention interactions and affected layouts. The score itself requests no test command.

## Preserved behavior and limits

Source comparison preserves all three grouping populations/order derivations, resolved-only population, closure outcome/reason and elapsed time frozen at `closure.at`, explicit drawer action and workspace href. Stage summary uses open-only counts, proportional bars and accurately labels its maximum as longest **journey**, not time in that stage; its action selects Stage grouping and the first open record. Empty stages are disabled. Follow-ups select the existing corresponding summary tabs. No engine change was found.

Controller observed initial attention click focusing WF-315 with zero dialogs. The viewed target is fully visible near the viewport bottom with its action buttons reachable; `block: "nearest"` is not itself a defect and needs no alignment change. CSS retains independent desktop scrolling and natural phone/print height release, but those unviewed layouts are source-only evidence. Full keyboard, other-order repeated clicks, detail/workspace journeys, closure rendering and required width/theme comparisons remain controller verification work.
