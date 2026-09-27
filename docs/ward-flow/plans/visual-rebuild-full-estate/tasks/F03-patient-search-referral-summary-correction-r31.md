# F03 Patient Search referral-summary correction r31

Date: 2026-09-13

## Diagnosis

`RecordPreview` correctly derived an accepted referral state for RF-010, then appended `buildReferralSummary(referral).declineNote`. That shared helper always emitted queued-only wording (`waiting for a decision, no bed accepted yet`) regardless of `referralState`, producing two incompatible claims in one selected-person panel.

RF-010 is accepted by a community team, so the preceding generic accepted sentence (`a bed has been agreed`) was also narrower than the model supports. An accepted referral destination may be a ward, emergency department, community team, or person.

## Correction

- `buildReferralSummary` now branches on the existing `referralState(referral)` result. Queued referrals retain their waiting/partial-decline meaning, accepted referrals report any declines before acceptance or the absence of declines, and fully declined referrals state that no destination accepted.
- The preview's accepted-state sentence now says a destination has agreed. It preserves the engine's `Accepted` status without inventing a bed for non-ward destinations.
- The existing Patient Search preview test now selects a real person-linked accepted seed referral, verifies the linked patient resolves, and asserts the panel cannot combine `Accepted` with waiting/no-acceptance wording.

No referral state, matching, facet, selection, access, movement, or action behavior changed.

## Evidence

Before snapshots: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-patient-search-referral-summary-r31/`

| File                                                       | Before SHA-256                                                     | After SHA-256                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/search/record-preview.tsx` | `2CCEE817569D43D7D0DFF5654FA0017815180077945DF9A16374B09FB790BEA3` | `FFAF9681800E9D51A28BE8BAC8ACDCD0DA1CA4A555AF5A9B38BC87C25CA5B597` |
| `tests/ward-search-preview.dom.test.tsx`                   | `58C68C2FBCA84997E0B88E680C917529DF457B66B18EA2DE34EFD461DA0F94E2` | `E440F66270F1EFED05AB348F2B81478EFD17697D23EA1C49416DBDD0D03F373E` |

Prettier completed on both owned files and `git diff --check` passed. Tests and browser checks were not run by instruction. The controller retains the before-state capture and runtime verification.
