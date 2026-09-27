# F08 Governance visual closure r31

Date: 2026-09-13  
Scope: read-only inspection of the ten supplied Governance r31 captures at original detail.

## Closure verdict

The two P1 findings in `F08-governance-visual-review-r29.md` are closed in the supplied evidence.

- **Selected override row:** WF-001 now paints on a neutral theme-resolved surface. Its identifier,
  time, coordinator, reason, and destination are legible in every populated Light and Dark capture at
  390, 820, and 1440 px. The former charcoal-on-dark-text Light-mode collision is absent.
- **Detail truthfulness:** the notice now says the referral was made by override and that the record
  does not retain a prior gate verdict or identify a failed gate. It no longer asserts that a gate
  failed. The wording is fully visible in the 390 and 820 detail captures in both themes.

The register, selected record, detail facts, review-status absence, and lower governance explanation
cards remain contained and readable at the observed widths. At 1440 px, the register/detail columns
retain their intended relationship; at 820 and 390 px they stack without horizontal clipping. No new
P1 or P2 issue was found in the reviewed states.

## Evidence hashes

- `governance-populated-app-390-light-r31.png` — `268EA94701A101882668F2A38E558966A6A05AE250E0BA46006CC882BA444535`
- `governance-populated-app-390-dark-r31.png` — `5A3E131DF4164BDA51A5B5ED8883AA545AFEDFC962B8F6EBD98449EBE69CC792`
- `governance-populated-app-820-light-r31.png` — `F358277F2CE8A650486AA006F80384D6617906AE44B011897511BFC00919709A`
- `governance-populated-app-820-dark-r31.png` — `0F48DAF4E04FC580D941D4C51073825250605DEB45892947FCBD7088229BACD8`
- `governance-populated-app-1440-light-r31.png` — `D7CD5461C2C06A1D2B61F6A99F4952660FE47FBD24B3F9D4D6965CBF2FDF1635`
- `governance-populated-app-1440-dark-r31.png` — `DD28DAFE554E8919A08B9D91842FBEE21A9D093BA24443CF1B2C81AD540E96F4`
- `governance-detail-app-390-light-r31.png` — `EDCC51A51BC99C04E77F481F5679A749CA4F13754AFACD9A26D040E1FF8B3A6C`
- `governance-detail-app-390-dark-r31.png` — `38BA14D3F3C7633D3F43364AC3AC1996797FD0CE29C2E9A165584BA9C67F2A35`
- `governance-detail-app-820-light-r31.png` — `B86378AE32B39634FB2FE53BCD71926C3832936946A4743E3A3B46E7932AEA41`
- `governance-detail-app-820-dark-r31.png` — `1981F608738B88C1B200473CE1D1A8075B400C991C21023C51BEAC17597894E5`

## Limits

This is a narrow visual closure of the two r29 P1 findings and the visible responsive states. It does
not establish full Governance design acceptance, keyboard/focus behavior, callbacks, Access-record
content, print, forced colors, every scroll endpoint, or broader Ward Flow completion. The supplied
controller journey established creation of the real WF-001 SCGH override; it was not independently
repeated in this read-only review.

No source, test, browser, or verification JSON changes were made, and no checks were run.
