# Q004 Task 4b — Discharges source handoff

Implemented in `D:/Worktrees/Database/ward-lead` on the required local branch `codex/task-ward-flow-live-state-20260831`, confirmed by the worktree HEAD file. Source-only handoff; controller owns behaviour and visual acceptance. No Git command, server/browser/provider operation, test run or subagent was used.

## Ownership and preserved inputs

Owned source: `src/components/ward-management/discharges/discharge-board.tsx`, `discharges.module.css`, `discharges-third-edition.module.css`. All three dirty inputs were copied, preserving relative paths, beneath `.superpowers/sdd/2026-09-13-product-refinement/task-4b-before/` before editing. Only the TSX and third-edition CSS changed; the base CSS remains untouched. This report is the additional requested output.

Read README, Q004 Task 4, Task 3 design including classifier amendment and guarded receipt contracts, Task4b brief, visual rubric, actual provider/record/clock/BedRelease contracts and installed Next Link documentation. Viewed the controller's served-reference capture `screens/discharges-reference-1440.png` in the private Q004 workspace. No claim of inspecting a live redesigned page.

## Source changes

- Replaced the four sparse repeated panels and explanation footer with a compact population switch, service/ward/status controls, one grouped worklist and adjacent record detail. Ward palette/typefaces, subdued table bands, text-labelled status badges and full ward names remain.
- Anonymous releases remain the default. Admission records are a separate guarded population with an additional linked/missing identity filter. Each population has independent counts; their counts are never added, and no admission-derived release is concatenated into the existing release list.
- Status controls retain blocked-first work grouping. A blocked confirmed row still displays Confirmed plus its blocker. Actual date/time appears beside the existing anonymous release band. The completed anonymous group is labelled “last 24 hours”, matching the existing rolling calculation; exclusions are labelled “expected in 2+ days” and “discharged 24h+ ago”, matching actual helper branches. `groupDischarges` is unchanged.
- Admission records retain actual expected and departure dates, nullable confirmation and role provenance, blocker, destination and missing-link states. Confirmation comes only from its recorded finite confirmation time; a planned date is not a decision. No invented readiness, patient identity, forecast or clinical write.
- New identities come only from `readDischargeRecords` / `readDischargeRecord` guarded DTOs. Only an explicit record button calls `openDischargeRecord`; filtering and rendering do not dispatch access events. Detail re-reads with the selected handle on every render and never caches a selected DTO. Denied details show a retry state; allocator failure is caught and shows the same safe unavailable state.
- The workspace is keyed by generation and its fixed coordinator actor. A reset/scenario change synchronously discards handles and selection. Filters, population changes and Close clear selection. The screen offers no role switch, audit history or discharge action. Open full ward follows the existing ward route for operational follow-up.
- Desktop register/detail bodies scroll independently beneath their headers; the detail footer keeps ward navigation visible. Tablet uses a bounded worklist and full-width detail; phone releases the worklist bound, uses stacked rows and places detail before the worklist. Explicit opening focuses detail; Close/Escape returns to the worklist region. Print releases bounds, retains selected population/status totals, row stages and excluded counts, and forces readable paper colours.
- Removed the local explanatory prototype banner; the shared shell remains the owner of the existing unobtrusive prototype indicator.

## Populations and grounded counts

Source inspection of the unchanged `ward-movements.ts` seed finds 9 anonymous `BedRelease` rows: 2 blocked (one confirmed, one expected), 2 unblocked confirmed, 4 unblocked expected and 1 discharged. At the seed anchor all 9 fall in the existing four groups, with zero later/older exclusions. Live clock, scope, scenario or events may change these results; the UI derives them from current provider inputs.

Controller/domain handoff reports 267 admissions and a 222-record guarded discharge projection, including 2 uniquely linked records: occupied `AD-RPHS-14` in `rph-adult-secure`, departed `AD-LEFT-01` in `arm-adult-open`. The other 220 projection identities are legacy/missing, not inferred patient links. These domain counts were supplied by the controller and were not independently executed here. The UI reads counts from guarded current records and exposes a Linked patient filter; it does not hard-code these fixture counts.

## Verification performed

- `node node_modules/prettier/bin/prettier.cjs --write src/components/ward-management/discharges/discharge-board.tsx src/components/ward-management/discharges/discharges-third-edition.module.css` completed.
- A scoped TypeScript `transpileModule` source check returned `syntaxErrors: 0`. This is syntax/emission evidence only, not semantic typecheck or behavioural proof.
- Direct normalized source comparison against preserved inputs returned `groupDischargesUnchanged: true` and `exportedSectionUnchanged: true` for the original grouping and exported `DischargeGroupSection` implementation.
- No tests, typecheck, browser comparison, provider action or visual score performed. All six live width/theme cells remain pending controller acceptance.

## Controller-focused cases

1. Anonymous default: 9 seed records and unchanged 2/2/4/1 work groups; confirmed-with-blocker retains confirmation; timing bands and 2+ day/24h exclusions follow existing helper boundaries.
2. Switch to Admission records, filter Linked patient, open each of the two linked records, inspect exact name/UMRN and recorded dates/destination. Missing-link rows explicitly remain unlinked; filter counts remain separate from releases.
3. Explicit selection produces one audited open; filters/rendering do not. Denied receipt/link change shows no old DTO. Reset/scenario clears the selected handle. Capacity/Discharges navigate without a role escalation or discharge action.
4. Service change clears an invalid ward selection; status/identity/ward changes clear detail. Empty filters, unavailable list, allocator exhaustion and stale detail remain readable without fabricated zero-valued inaccessible summaries.
5. Keyboard record opening, detail focus, Close/Escape, scrolling and full-ward route. Compare 390/820/1440 in light/dark; inspect table density, long ward/blocker text, adjacent desktop bottoms, mobile detail placement and printing from dark theme.
6. Existing DOM tests that assert four standalone tables, the removed narrative banner/footer wording or old design geometry will require controller classification against the owner-authorised redesign. Original exported helper contracts are retained.
