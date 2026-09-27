# F13 Ward figure query correction r25

Date: 2026-09-13  
Implementer: `gpt-5.6-sol / medium`

## Scope and result

Changed only `tests/ward-bed-release.dom.test.tsx` and
`tests/ward-daily-return-rows.dom.test.tsx` in place. Before copies are stored under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-ward-figure-query-fix-r25/`.

The four full-suite failures were stale probes for contiguous text such as `Ready 1` and
`Expected 0`. The current accessible figure renders its label in a `<span>` and exact numeric value
in a sibling `<strong>`.

The corrected probes now:

- scope every read to `ward-unit-beds`;
- select the exact `data-state` figure (`available`, `expected`, or `confirmed`);
- require its visible label in the label span;
- require the strong value to match the complete non-negative-integer pattern before parsing it.

The bed-release dispatch and before/after arithmetic, Ready nonzero floor, preparation-note recording
canary, unchanged Capacity-board comparison, all-unit daily-return comparison, and nonzero-population
floor remain in place. No assertion was changed to a substring or permissive whole-panel match.

`tests/ward-answer-current-facts.dom.test.tsx` already carries the required neutral origin wording
assertion, so it needed no change in this batch.

## Verification

- TypeScript syntax transpile: `PARSE_OK` for both changed tests.
- Prettier completed for both changed tests.
- `git diff --check` on both changed tests: passed with no output.
- Tests were not run, as directed; the controller owns the focused batch.
- No source file was changed.

## Hashes

| File                                  | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ward-bed-release.dom.test.tsx`       | `3F4F890C044F38EFC87667FEBCA22C886BFE078A33F270555662AC3893F13826` | `F840CB2A6DC30BFFBCA246FC7031EE968FB725B1126957F56DA6B264583BD69D` |
| `ward-daily-return-rows.dom.test.tsx` | `4E47C4FCB154D25FDBE8217D2AB4B8606309222CE317E946BC34EC943A649DC4` | `A080A34E44017416CE21CCB62E7CA38633593F6CFE6FF3F8AAE229039FFC4879` |
