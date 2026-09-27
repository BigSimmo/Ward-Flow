# Q004 Task 1 — independent bounded review

Reviewed 2026-09-13. Scope: the eight coordinator files named in `task-1-brief.md`, compared with their individual task input snapshots under `.superpowers/sdd/2026-09-13-product-refinement/task-1-before/`. This is not a whole-branch review: the input already contains prior dirty work. No source edits, Git operations, providers, tests, browser or server commands were performed by this reviewer. This report is the only write. The controller's same-task preflight remains the applicable preflight.

## Findings — two corrections

**P1 / visual blocker — Expanded More key clips operational legend content at selected desktop width.** Viewed `command-corrected-key-light-1440.png`: the panel ends immediately after the row containing Confirmed today, Expected today, Eligible route and Route needing review. The next `Recorded destination` entry and `Schematic, not geographic` label are absent from the visible footer although both remain rendered by `flow-diagram.tsx:565–571`. The screenshot shows the next register below the panel, so this is clipping at the panel boundary, not the screenshot ending early. `coordinator.module.css:3470–3495` bounds the grid/flow tracks while retaining a 30rem minimum diagram scroller; the diagram region has `overflow: hidden` (`:3225`). `flow-diagram.module.css:253` expands More key onto a full row with further wrapping content. The footer cannot obtain enough space and its tail is clipped.

Smallest correction: give the legend an explicit non-shrinking allocation and provide enough flow-track space when More key is expanded, carrying any necessary height increase to the outer grid while retaining the 30rem drawable floor and the full 22rem lower register. An explicitly bounded, keyboard-accessible legend scrollport is another safe option if expanding the grid is undesirable. Merely allowing visible overflow risks painting the key over the register; shrinking the drawable or register floors would violate this brief. Recheck selected 1440px with More key open and closed, and verify the full Recorded destination row and schematic label are visible/reachable.

**P2 — Phone primary-action reachability still misses the brief after a lower candidate is selected.** `shortlist-panel.tsx:883` places Refer/Override before the entire candidate list (`:1336`); candidate activation (`:1357`) selects the ward without moving focus or revealing those actions. `shortlist-panel.module.css:282` makes the action toolbar sticky only above 48rem, while `coordinator.module.css:2411` explicitly makes phone action rows static. Therefore a phone user who reaches a lower candidate must scroll back through preceding candidates to reach Refer/Override. Moving the action block from the bottom to the top fixes initial visibility but not the stated requirement to expose the primary actions without long candidate scrolling.

Keep Update record and its form rows in natural document flow, while giving the single primary action group a reachable owner or a compact explicit return-to-actions control. Do not restore the old rule fixing every record-action row to the same viewport edge. The controller confirms that natural phone flow permits a primary-only sticky toolbar inside a valid scrolling owner, provided it cannot overlap Update record content or the global header. Confirm the lower-candidate journey at 390px with Update record both closed and expanded. This finding is source-backed; no phone runtime measurement was performed.

## Preserved behavior

- Shortlist non-render derivations, clinical guards and dispatch handlers are unchanged relative to the task input. The moved Refer/Override block retains the original availability predicates, refusal explanations, explicit reason selection and submit handler. Candidate activation and max-three referral protection remain intact; actionable candidates and their eligibility/restriction reasons have not been dropped.
- `coordinator-screen.tsx:76` still restores only a valid open movement from shared focus on mount. `selectMovement` (`:129`) clears unit/referral selection and updates shared movement focus. The new Close (`:189`) calls that view helper with undefined and returns focus to the active queue tab; it does not dispatch a clinical action.
- Referral selection remains independent of the queue tab and movement selection. A referral that leaves the queued population falls back to the existing movement subject. The new panel visibility predicate uses the resolved subjects, preserving those existing semantics.
- ED tones use the same open-movement population and `clockState` definition as the existing pressure derivation. Ordering, counts and wait lengths are unchanged. Breached, critical, due, recorded-on-track and missing-deadline labels have corresponding visible and accessible text.
- Native eligibility/decline disclosures preserve their content. The added `source-print` hooks use the existing beforeprint/afterprint helper, whose source opens and restores disclosure states. Print releases layout bounds and toolbar positioning. This is source evidence, not a print execution receipt.

## Visual evidence and score status

Viewed these actual files under `.superpowers/sdd/2026-09-13-product-refinement/screens/`:

- `command-reference-dark-1440.png`: served reference, 1440 × 1000, selected movement.
- `command-before-light-1440.png`: historical task input, 1440 × 1000, unselected.
- `command-corrected-selected-light-1440.png`: corrected build, 1440 × 1000, **actually unselected despite its filename**. The prompt and subjectless hub are visible, and there is no shortlist panel. It proves neither Close size nor selected-panel action visibility.
- `command-corrected-patient-light-1440.png`: actual selected WF-018 state; compact Close and Refer/Override/Update record appear before the candidate list.
- `command-corrected-key-light-1440.png`: selected WF-018 state scrolled down with More key expanded; proves the clipping blocker above. The controller attributes the earlier empty capture to initial clock adoption resetting the first click; the stabilized second selection produced these actual selected captures.

The corrected captures visibly support the compact closed Capacity row, the wider/taller useful flow, proportional Close, visible initial primary actions and labelled ED tones. There is no accidental large closed-footer void. The expanded-key capture shows the lower register with its own content scroll; the precise 22rem floor is source evidence, not a pixel measurement by this reviewer. The earlier `command-refined-selected-light-1440.png` was not used as final-source evidence because it predates the latest feedback fixes.

**Provisional visual score for the viewed 1440px states only: 9/10.** Reference fidelity 2; spacing/alignment 1.5 (expanded footer exceeds its allocation); readability 2; controls/interaction 1.5 (expanded key cannot expose all its content); responsive behavior 2 for the observed desktop arrangement only. These are reviewer judgments about the viewed captures, not measured quality guarantees or a phone/tablet verdict. The known clipping blocker independently prevents acceptance despite the numeric threshold. The reference is dark and the current live captures are light; the rubric's six required 390/820/1440 light/dark comparisons remain incomplete. No screen acceptance is claimed, and this report does not replace `screen-verification.json`.

## Smallest remaining controller checks

1. Correct the expanded-key clipping and recheck affected selected 1440px states. Include a lower candidate selection and expanded Override form to verify toolbar reachability without obscured content.
2. Complete the required width/theme observations, including the phone action journey in the finding. Reuse unchanged reference evidence. Check queue, diagram, register and shortlist scroll independence, and the 22rem lower-register floor at desktop.
3. Exercise patient → queue tab switch → referral → Close → reopen → route remount with valid shared focus; confirm zero clinical dispatch during selection/close. Retain the existing unavailable/stage/override-reason and selection-cap cases for the moved actions.
4. Print with the new disclosures initially closed/open and verify content expansion and post-print restoration. These checks remain unrun by this reviewer.

Review outcome: no clinical-state or guard regression found in the bounded input-relative source comparison; expanded-key clipping is a visual blocker, and phone action reachability needs correction. Visual and journey acceptance is pending fixes and controller evidence.
