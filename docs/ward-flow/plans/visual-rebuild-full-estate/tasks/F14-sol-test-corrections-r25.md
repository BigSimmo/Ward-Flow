# F14 Sol test corrections r25

Date: 2026-09-13  
Implementer: `gpt-5.6-sol / medium`

## Scope

Reviewed the three assigned files. Changed only:

- `tests/ward-discharge-board.dom.test.tsx`
- `tests/ward-ed-psychiatry-hub.dom.test.tsx`

`tests/ward-referral-screens.dom.test.tsx` remains byte-identical because its failure exposes a real
source-order regression. Before copies are under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-f14-sol-test-corrections-r25/`.

## Corrected stale probes

### Discharges

- Group-order collection is scoped to the four `ward-discharge-group-*` regions, so the separate
  `Outside the four groups` footer heading does not masquerade as a fifth discharge group.
- Both exclusion assertions locate the exact count sentence within `ward-discharge-excluded`, then
  retain the literal leading-digit assertion and the ban on `none`.
- Existing expected-table row count, total listed-row arithmetic, reducer dispatch and excluded-row
  checks are unchanged.

### ED psychiatry hub

- Added a small test helper that activates the real `Still to be moved` tab and retrieves its visible
  `tabpanel` by the live tab label referenced through `aria-labelledby`, then confirms the established
  outbox testid before querying listitem roles.
- The row-count equality, strict-subset comparison, per-row acceptance-time absence checks and broad
  no-elapsed-clock bans are unchanged.

## Source regression retained as a failure

The Out-of-area notice-order test is correct and was not weakened. In current
`out-of-area/out-of-area-board.tsx`, `ward-out-of-area-entries` begins in the register column before the
detail column, while `ward-out-of-area-threshold-notice` and `ward-out-of-area-synthetic-notice` are
inside the later `What out of area means here` panel. Their observed indices, 47 and later versus the
entries index 1, reflect actual DOM order. On phone this also places both governance notices after the
entries they qualify. The source should move or repeat the complete notices before the entries; the
test must continue to require presence and earlier order.

## Verification

- TypeScript syntax transpile: `PARSE_OK` for all three reviewed tests.
- Prettier completed for the two changed tests.
- `git diff --check` on the three assigned tests: passed with no output.
- No tests were run, as directed; the controller owns the focused batch.
- No source or CSS file was changed.

## Hashes

| File                                  | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ward-discharge-board.dom.test.tsx`   | `94FDDBCE2994431A19ACA18AA8FBDFDF9DE22D2890A9FAF93547464286C292FC` | `F57AD1CE8EDFD055EE9B4850FB52C882EAC6D402398C5EDB997B208593D8024D` |
| `ward-ed-psychiatry-hub.dom.test.tsx` | `77C0AC7D1A444E25B4964D008172737071EA5564B0B7F1B66944127FF9340CDF` | `E97A5BCA00C2FB0CD6DEC643CEE148E59C695FC4874456BBB3512C34FFDF7B5D` |
| `ward-referral-screens.dom.test.tsx`  | `71185263C80AA01B0C603066B607B87FE5F114430727DF0F8A976C4B0C0B1C2A` | unchanged                                                          |
