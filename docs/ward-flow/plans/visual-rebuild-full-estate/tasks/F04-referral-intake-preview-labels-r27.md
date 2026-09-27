# F04 referral intake preview labels r27

## Scope

Changed only `src/components/ward-management/referrals/referral-intake.tsx`. The requested guessed filename `referral-intake-form.tsx` does not exist; the controller confirmed ownership of the actual mounted component before editing.

The pre-change source was copied in place to `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-intake-preview-r27/referral-intake.tsx` before the write.

## Change

`What this referral will record` now renders the same human labels already used by the intake controls and shared Ward helpers:

- suburb absence reason: `not_known` becomes `Suburb not known` through `suburbUnknownLabels`;
- referral source: `ed_medical` becomes `ED medical staff` through `SOURCE_LABELS`;
- urgency: `2` uses `urgencyTierLabel` (`Tier 2 · urgent`);
- origin site: `RPH` resolves through `wardSites` to the picker label with the full site name and code;
- the four boolean answers render `Yes` or `No`;
- destination kinds use shared `referralDestinationKindLabel`, so `community_team` becomes `Community team`;
- a selected emergency department uses its existing department name.

Unanswered values still render `Not answered`. Unknown future/unrecognised codes retain a raw fallback rather than disappearing. The form's state values, option values, validation, destination assembly, reducer event, and dispatch payload are unchanged.

## Verification

- `prettier --write src/components/ward-management/referrals/referral-intake.tsx` — completed, unchanged after formatting.
- TypeScript `transpileModule` syntax diagnostic for the TSX file — `TSX_PARSE_OK`.
- No test or browser run was performed. The controller owns the real intake journey and final rendered check.

## Hashes

- Before source and snapshot: `32b1d0bb4bf0570004717f19af167ebbd09dcc7954b974c2a147529a505ed9b8`
- After source: `58ec06533852a7435ce5221959c4a09c38af6a7f534ba3023927598514baff0c`
