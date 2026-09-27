# F01 / F02 / F13 visual review — r16

**Reviewer:** independent visual reviewer, `gpt-5.6-sol / medium`  
**Date:** 2026-09-13  
**Verdict:** not an exact design match; no P1 found in these first-viewport cells, with four bounded P2 corrections below.

## Evidence reviewed

I viewed all 48 original PNGs at original detail:

- `movements-{app,mock}-{390,820,1440}-{light,dark}-r16.png`
- `ward-{app,mock}-{390,820,1440}-{light,dark}-r16.png`
- `wards-{app,mock}-{390,820,1440}-{light,dark}-r16.png`
- `ward-answer-{app,mock}-{390,820,1440}-{light,dark}-r16.png`

The ordered `filename + file SHA-256` evidence-list digests are:

| Route       | Files | Evidence-list SHA-256                                              |
| ----------- | ----: | ------------------------------------------------------------------ |
| Movements   |    12 | `3f2b8c8c372f70f57fca631e231bb1cb8d7d0247ef5e82e455ae124dc7187777` |
| Ward        |    12 | `21a3c69cb95e6eca7d8b2b87ca2694f06998edf2ebda5536b78503481b64ee96` |
| Wards       |    12 | `74aa108cc631a225c497d39d79f83969236504088d01ed23e573be9b3996bd85` |
| Ward answer |    12 | `642041464bb13f8325f7d162cc34b87e7223e10b0aee114006c276deba7c9171` |

The review compares first-viewport composition only. It does not prove content below the captured fold, interaction, focus, print, forced colours, or physical-device behaviour. The captured RPH Ward answer has an engine-authoritative empty queue, so it cannot establish whether the populated request/gate layout matches; the controller's planned populated case remains necessary. The shared bar has minor post-capture changes, so header typography alone is not assessed here.

## P2 findings

### 1. Movements and All wards omit their drawing primary action in every cell

The app has no **Record a decision** on `/movements` and no **New referral** on `/wards` at 390, 820, or 1440 in either theme. Both drawings retain those actions. This is not explained by population differences.

Source explains the repeatability: `WARD_PRIMARY_ACTIONS` registers `record-decision` only for `/movements/[movementId]` and `new-referral` for `/ward/[unitId]`, while these screenshots mount the index routes `/movements` and `/wards`. The bar therefore receives no action.

Smallest correction: add those two static routes to the existing action registry using the existing `record-decision` and shared `new-referral` menu arms, and extend the exact-set/kind/resolution guards in `tests/ward-nav.test.ts`. This reuses current behavior; it must not create a new handler or destination.

Files: `src/components/ward-management/ward-nav.ts`, `tests/ward-nav.test.ts`.

### 2. Ward answer's overview link and ward name collapse into one unreadable string

All six app cells render `Ward overviewRPH Adult Secure`; the drawing separates the navigation label from its context. The DOM already has two children and `.answerNav` declares a flex gap, but the grouped answer selector `.screen[data-presentation="answer"] .main > .answerNav { display: block; }` has greater specificity than the later flex selector. The intended flex layout therefore never wins.

Smallest correction: make the answer-specific direct-child rule declare `display: flex` (or split `.answerNav` out of the grouped `display: block` declaration) so its existing gap and `justify-content` apply. Preserve the phone column treatment.

File: `src/components/ward-management/ward/ward.module.css`.

### 3. Ward answer has no active rail destination

At all three app widths in both themes, neither **All wards** nor the ward-specific entry is selected on `/ward/{unitId}/answer`; the drawing keeps **Wards** selected and labels the nested context on desktop. This also means the active route is not promoted into the wrapping phone navigation.

Source uses exact equality for both `activeEntry` and `active` in `ward-rail.tsx`. The generated ward entry points at `/ward/{unitId}`, so its `/answer` child can never match.

Smallest correction: centralize a narrow active predicate that treats only `/ward/{unitId}/answer` as a child of that same generated ward entry, and use it for active-entry promotion, `data-active`, `aria-current`, and the announcement. Do not use a broad prefix match that could select unrelated routes.

Files: `src/components/ward-management/shell/ward-rail.tsx`; its existing static/DOM rail contract tests.

### 4. The Wards directory is one column sparser than the drawing at both wider widths

The app renders two cards per row at 820 where the drawing renders three, and three per row at 1440 where the drawing renders four. The result is materially taller and less scannable while leaving unusually wide cards. The 390 layout correctly remains one column and no horizontal clipping is visible.

The page-local rule uses `repeat(auto-fill, minmax(min(17rem, 100%), 1fr))`. Reduce the minimum track only enough to reproduce the observed 1 / 3 / 4 progression, retaining the existing single-column phone override and 48px targets. This is a page-local density correction; card facts and service grouping stay unchanged.

File: `src/components/ward-management/wards/ward-index.module.css`.

## Observations retained as justified or pending

- Different ward identities, counts, movement populations, explanatory prose, prototype caveats, and additional working routes are engine/governance differences and are not findings.
- Ward's extra ready-bed summary keeps a working bed-list action prominent and does not hide the drawing's figures, attention, answer, or return sections; no correction is requested from these first-viewport captures.
- Movements' app KPI labels reflect the current derivations rather than the drawing's fixed example labels. I have not requested a visual-only relabel because that would change the meaning of engine-authoritative figures without a separately proven derivation.
- No viewport-wide horizontal overflow, clipped card text, or light/dark contrast failure is visible in the supplied cells.
- Human acceptance and the populated Ward answer capture remain pending.
