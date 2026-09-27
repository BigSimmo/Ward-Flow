# F04 referral intake preview review r27

## Source review

Reviewed current `src/components/ward-management/referrals/referral-intake.tsx` at source hash `58ec06533852a7435ce5221959c4a09c38af6a7f534ba3023927598514baff0c`.

No actionable formatter defect was found. `referralSummaryRows` reads the value through the same `field.key` used to access the draft, and calls the formatter only after `fieldIsUnanswered` has excluded the sentinel or empty selection. Each specialised branch matches the corresponding draft field type: source, suburb reason, urgency, site code, four booleans, destination-kind array, and conditional ED id. Destination labels use the shared exhaustive helper. Site, ED, source, and future-code lookups retain a raw fallback instead of hiding an unrecognised recorded value. Remaining fields are already human strings and use the default branch.

The type casts do not introduce a runtime key/value mismatch in the current structure: `REQUIRED_FIELDS` supplies the key, and `draft[field.key]` supplies that exact field's value. The formatter does not mutate the draft or participate in validation, event assembly, or dispatch.

## Test correction

Changed only `tests/ward-referral-intake-sections.dom.test.tsx`.

Added one rendered behavior case that selects representative internal values through the actual controls and asserts the corresponding summary `dt`/`dd` row values:

- `not_known` → `Suburb not known`;
- `ed_medical` → `ED medical staff`;
- urgency `2` → `Tier 2 · urgent`;
- `RPH` → `Royal Perth Hospital (RPH)`;
- secure-bed `false` → `No`.

The case also rejects exact raw `not_known` and `ed_medical` text within the summary. It preserves every existing assertion and does not inspect CSS classes or implementation-only helper calls.

## Verification

- `prettier --check tests/ward-referral-intake-sections.dom.test.tsx` — passed.
- TypeScript `transpileModule` syntax diagnostic on the final test file — `TSX_PARSE_OK`.
- Tests were not run, per controller ownership.

## Hashes

- Before test: `363a89b48d4babfe8353abf0c53503b5166173f850f0f5b2bd8617a06ce1e880`
- After test: `0c0906eeae56f8c8384a5b81de286b2ea58f8e75105a8a9e85b5002a4b080c8c`
- Before snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-intake-preview-test-r27/ward-referral-intake-sections.dom.test.tsx`
