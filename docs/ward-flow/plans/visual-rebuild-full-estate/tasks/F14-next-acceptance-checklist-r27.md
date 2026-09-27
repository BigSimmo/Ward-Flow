# F14 next acceptance checklist r27

Date: 2026-09-13  
Mode: independent read-only evidence audit; this report is the only write

## Current boundary

- `docs/ward-flow/screen-verification.json` has partial `deviates` records for all 34 operational
  drawings. It records looking, not completion.
- Movements and Wards now have current r26 six-cell viewport closure in
  `docs/ward-flow/plans/visual-rebuild-full-estate/tasks/F01-F02-visual-closure-r26.md`.
  Record a decision retains the explicit D-16 not-wired announcement; New referral exposes its two
  existing destinations. WF-315 sheet open/Escape close is already observed.
- Ward Answer's lower panels now have six-cell r26 closure in
  `docs/ward-flow/plans/visual-rebuild-full-estate/tasks/F13-ward-answer-panel-correction-r26.md`.
  Its capacity/history layout, rail seam, decline disabled-to-enabled path, and focused DOM coverage
  should not be repeated unchanged.
- RF-011 on phone was selected and its ordinary closed `details` was opened, revealing all four
  choices and override controls. There is no hidden-table defect to investigate. Treat this as
  partial Referrals-register interaction evidence rather than rerunning the same state.
- The latest typecheck rerun passed with exit 0. It is a gate result, not visual acceptance, and is
  outside the remaining checklist.

## Priority 1 — smallest coherent batch: Referral intake changed state

This is the next batch to run. It closes one current-source delta and the most concentrated lower
panel/interaction gap without reopening accepted layout work.

- [ ] On `/referrals/new`, answer the existing questions far enough to populate **What this referral
      will record**. Capture that lower preview at 390, 820 and 1440 in Light and Dark against the
      existing paired r19 design evidence:
      `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/referral-intake-r19`.
- [ ] Confirm the r27 presentation maps the stored values to the human labels listed in
      `docs/ward-flow/plans/visual-rebuild-full-estate/tasks/F04-referral-intake-preview-labels-r27.md`:
      suburb absence, source, urgency, full site name/code, four Yes/No answers, destination kind,
      and selected department. Unanswered values must remain `Not answered`.
- [ ] In the same journey, record the empty/incomplete validation state, reach the lower destination
      controls and Send consequence text, and confirm the form cannot bypass its existing required
      answers. A successful dispatch is unnecessary for visual closure unless already intended by
      the controller; do not change or broaden submit behavior.
- [ ] Record focus return/continuity once across the phone disclosure and destination controls. Do
      not repeat RF-011 register choices here; that is a different screen and already observed.

## Priority 2 — current-source visual deltas still lacking direct closure

Run these together only after Priority 1 because each needs a fresh rendered state, while their old
top matrices are otherwise adequate.

- [ ] **Statistics ED:** fresh six-cell title and Export-action proof, then lower wait-band/table and
      exclusions after one department change. The open evidence is the r15 title truncation in
      `docs/ward-flow/plans/visual-rebuild-full-estate/tasks/F05-F11-ed-visual-review-r15.md`.
- [ ] **Statistics Service:** fresh six-cell Export-action proof, then the lower placement,
      out-of-area and flow panels after one service change. The action was absent in r16 but is now
      registered in `src/components/ward-management/ward-nav.ts`; r19 already found no page-local
      top-layout issue.
- [ ] **Out of area:** capture only the changed notice/table regions after
      `docs/ward-flow/plans/visual-rebuild-full-estate/tasks/F08-ooa-notice-table-correction-r25.md`,
      then select one real placement and reach the five group ends plus the 217-unbanded explanation.
      Do not repeat the already-clean r21 six-cell top/overflow matrix.

## Priority 3 — state-dependent lower panels most likely to reveal omissions

- [ ] **Network:** enter Placement workspace, select a real movement and candidate, traverse both
      tabs by keyboard, and capture the lower route/eligibility instrument. Do not recapture the
      already-closed r21 desktop or r23 phone overview.
- [ ] **Ordinary Ward:** capture the lower capacity/bed update forms and the Answer-link round trip,
      explicitly checking that Answer-only facts remain absent from the overview. Do not repeat the
      Answer r26 panels.
- [ ] **Capacity:** capture the complete lower bed map, legend and ward table at their scroll ends;
      reuse the already-observed Needs confirming and North Metro filters rather than rechecking
      unchanged top cards.
- [ ] **Alerts:** open **What this screen does not watch** and capture the conditional
      watch/empty/support sections plus acknowledgement state. The closed first viewport is already
      covered by the valid r9/r10 matrix.
- [ ] **Governance:** inspect the complete truthful empty register/detail branch and all six lower
      assurance cards. Current fixtures hold no populated review/override record, so do not create or
      imply one merely to imitate the drawing.

## Explicitly deferred as lower yield

Command, Delays, Board, Community, Hub, Handover, Discharges, Patient Search/Now, Add patient,
Settings, Sign-in, the utility screens, and the remaining Statistics screens still have bounded
lower-content or journey gaps recorded in
`docs/ward-flow/plans/visual-rebuild-full-estate/tasks/F14-acceptance-gaps-r26.md`. None currently has
a recorded unresolved P1/P2 that warrants repeating an unchanged six-cell matrix ahead of the
three batches above. Human acceptance remains pending for the estate.
