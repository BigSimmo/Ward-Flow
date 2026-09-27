# F13 Ward Answer visual closure r24

Date: 2026-09-13  
Reviewer: `gpt-5.6-sol / medium`  
Scope: independent, read-only visual review of Ward Answer

## Evidence reviewed

I viewed all 20 original images at original detail:

- All twelve `ward-answer-populated-{app,mock}-{390,820,1440}-{light,dark}-r24.png` cells.
- All eight `ward-answer-bottom-{app,mock}-{390,1440}-{light,dark}-r24.png` cells.

The bottom mock captures use the corrected known internal scroll owner. This review therefore compares the lower panel content, but it does not prove ordinary pointer, touch, keyboard, or wheel scrolling through that mockup. I did not operate a browser or run tests.

## Findings

### P1 — Answer ends before the ward's bed-confirmation and recent-answer panels

In the app's 390 px and 1440 px bottom captures, the request reaches all eleven gates, the eligibility warning, and the two decision actions, then ends at the synthetic-prototype disclaimer. The drawing continues in the same DOM order with:

1. `Confirm your beds`, including the ward's bed-kind and current capacity facts, freshness, allocatable control, and `Confirm beds` action.
2. `Recent answers`, showing this shift's accepted and declined decisions.

The different fixture values do not justify removing those panel types. The app has current FSH Older Adult capacity data and the working capacity action elsewhere in `WardScreen`; it should render the current ward's real values here. If no qualifying recent answers exist for this ward, the panel should state that absence instead of disappearing.

The source confirms the cause in `ward/ward.module.css`: `.screen[data-presentation="answer"] .main > * { display: none; }` restores only `.answerNav`, `.governanceBanner`, `.screenName`, and the incoming-answer section. The existing capacity and decision-history surfaces are therefore suppressed by presentation CSS.

Smallest faithful correction: add compact Answer-only bed-confirmation and recent-answer panels after the request actions, reusing the existing WardScreen capacity state, dispatch, freshness, and movement decision records. Do not expose the whole legacy Ward overview form stack. Preserve the current ward-only projection and use explicit absence for data the engine does not hold.

#### Bounded reuse proposal from current source

- Capacity: reuse the existing `capacityValue`, `setCapacityValue`, and `submitCapacity` path, which dispatches the ward-scoped `CONFIRM_CAPACITY` event with `actingUnitId`. Render that one existing form in either the overview disclosure or the new Answer panel, never twice with duplicate `ward-capacity-*` ids/testids. The compact Answer panel can read the already-derived `capacity`/`breakdown`, `unit.empty`, `unit.allocatable`, and their existing `WardFreshness` values. It does not need a second counter rule or a new reducer event.
- Recent answers: derive ward-owned rows only from `movement.acceptedUnitId === unit.id` with a real `acceptedAt`, and each existing `movement.declines` entry whose `unitId === unit.id`; flatten and sort those recorded instants. `Decline` has no recording-role field and `Movement` has no accepted-by field, while this app explicitly holds no shift schedule. The app must therefore omit or state the absence of those drawing fields rather than invent `Nurse in charge` or claim `this shift`. If no dated rows exist, render an explicit empty state.
- Placement: both panels belong immediately after the incoming request section and before the prototype disclaimer, matching the drawing's keyboard and visual order. They should be separately labelled regions and remain full width on phone.

### P2 — Desktop decision actions expand across the entire request panel

At 1440 px, `Accept in principle` and `Decline` each consume roughly half the content width. The drawing keeps the same two actions as compact, left-aligned controls directly under the final gate. The app's phone layout is proportionate and readable; the issue is the wide-screen expansion.

The source cause is the shared `.acceptButton, .declineButton { flex: 1 1 auto; }` rule. Apply an Answer-scoped desktop flex basis or max width so the controls retain their current minimum target size without filling the full panel. Do not change the normal Ward card action layout.

### P2 — The Security gate's pass state and detail give conflicting signals

In every populated app cell, the `Security` gate reads `PASS` while its detail says `FSH Older Adult has no free bed`. The later `Allocatable bed` gate correctly reads `DOES NOT PASS — 0 allocatable`, so the underlying separation between bed-kind suitability and capacity is present, but the Security row's capacity wording makes its green verdict appear self-contradictory.

This comes from the existing `securityGateDetail()` path in `ward-eligibility.ts`, not the new card styling. The smallest content correction is to make the passing Open-movement Security detail describe bed-kind compatibility only and leave availability to the existing Allocatable bed gate. Gate logic and the failed capacity result should remain unchanged.

## Observed closure

- The app renders all eleven real eligibility gates in order in light and dark themes. Every visible row retains its detail and explicit `PASS` or `DOES NOT PASS` verdict.
- The failed allocatable-bed gate is visually distinct, and both `Accept in principle` and `Decline` remain visible immediately afterward. The informative eligibility result has not visually replaced or disabled the decision actions.
- At 390 px, fact values, gate details, verdicts, warning, and both actions wrap without horizontal clipping. The bottom capture demonstrates content through the final action is reachable by page position, though it is not an interaction proof.
- The app's neutral origin text is readable and names no emergency department. Patient name/age absence is explicit. Drawing names and counts remain fixture differences and are not treated as app defects.
- The Ward overview return link and truthful prototype disclaimer are app governance additions. Their extra height is visible, especially on phone, but each remains useful and neither obscures the request.

No other P1/P2 issue was visible in the captured areas. Human interaction, focus order, action feedback, decline-form expansion, print, and ordinary scroll usability remain outside this screenshot-only review.
