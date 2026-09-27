# F02 Ward Answer current-facts regression test r1

Date: 2026-09-13  
Implementer: `gpt-5.6-sol / medium`

## Scope and starting state

`tests/ward-answer-current-facts.dom.test.tsx` was verified absent before creation. No Ward source, engine, fixture, shared component, or existing test file was edited.

## Coverage added

The new DOM suite renders the real `WardScreen` Answer presentation for `fsh-older-adult` and its seeded live request `WF-002`.

- It pins the eight semantic current-fact terms and representative movement-owned values.
- It derives the expected eligibility result with the existing `eligibility()` function, then verifies the rendered gate-row count, each real detail, and each pass/fail verdict.
- It proves the linked referral's suburb, region, and history are not joined into the Ward Answer fact panel, while the explicit patient-name/age absence statement remains visible.
- In the same current-facts case, it proves the seeded failed `allocatable_bed` gate remains informative: the existing Accept action has neither native disabling nor `aria-disabled`.
- It exercises the existing decline interaction, proving no reason is preselected, confirmation remains disabled until a reason is chosen, all canonical reasons remain offered, and `no_bed` is recorded through the provider before the request leaves the incoming list.
- A third case renders real co-addressed `WF-013` on `bty-older-adult` in Answer mode and applies the existing place-name helper against every other unit, site, code, and emergency department. It also pins the neutral origin-disclosure sentence and the no-co-addressing vocabulary boundary.

Output SHA-256: `E00EB836402298F26282BC80740052B883C7EF41DA2D19610DF54B0BBD419016`

## Verification

- `npx prettier --write src/components/ward-management/ward/ward-screen.tsx tests/ward-answer-current-facts.dom.test.tsx` — completed; both owned files were formatted in place.
- `npx eslint src/components/ward-management/ward/ward-screen.tsx tests/ward-answer-current-facts.dom.test.tsx` — passed with no output.
- The `fsh-older-adult` source fixture was read to confirm its real allocatable value is zero; the test also guards this through the live eligibility result.
- Before the privacy correction, the controller's focused batch ran the first two cases successfully. The added co-addressed case and corrected source have not been run; the controller owns the rerun.
