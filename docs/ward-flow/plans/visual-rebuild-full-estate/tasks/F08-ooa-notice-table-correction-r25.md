# F08 Out-of-area notice and table correction r25

Date: 2026-09-13  
Implementer: `gpt-5.6-sol / medium`

## Scope and result

Changed only `src/components/ward-management/out-of-area/out-of-area-board.tsx` in place.
`out-of-area-third-edition.module.css` was inspected and left byte-identical, preserving the
controller's canonical-token consolidation. Before copies of both files are under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-ooa-notice-table-fix-r25/`.

- Moved the complete `What out of area means here` panel, including both existing full governance
  notices, ahead of `ward-out-of-area-entries` in DOM and visual order. No notice text, testid,
  provenance panel, entry, count, selection action, or classification changed.
- Kept the canonical table print-only by moving `pageStyles.printTable` to a surrounding wrapper.
  `WardTable` now receives `wrapperClassName={styles.tableScroll}` directly, so the local 40rem phone
  hide rule reaches the primitive wrapper and the static phone-swap contract can verify the wiring.
- The selectable on-screen record list remains unchanged. The canonical table remains mounted with
  its existing testid and becomes visible under the existing print rule.

## Visual implications and capture targets

The governance meaning panel is now a full-width panel immediately before the two-column register and
detail layout. At phone widths it appears before any record card, so the invented threshold and
synthetic travel-time qualification cannot fall below the entries they govern.

Controller capture should compare Out-of-area at 1440 and 390 in light and dark themes, checking:

1. both complete governance notices appear before the first entry;
2. the desktop board still begins its register/detail columns beneath that panel;
3. only the card register is visible on screen at 390;
4. print still shows the canonical table and does not show the duplicate card register.

## Verification

- TypeScript syntax transpile: `PARSE_OK`.
- Static WardTable call inspection found `wrapperClassName={styles.tableScroll}` directly.
- Source-order inspection placed the threshold and synthetic notice testids before the entries
  testid.
- Prettier completed and `git diff --check` passed.
- No tests or browser checks were run, as directed.

## Hashes

| File                                   | Before SHA-256                                                     | After SHA-256                                                      |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `out-of-area-board.tsx`                | `8ED9A3D32C16DBE9318936092EBB9B7E2F09C95C94716FA4BD37B9A80A3F5BFC` | `761E623A8A6B322F9B894044C7A81C90E09F0404FFAEB9DBDE5E85C79487AA2E` |
| `out-of-area-third-edition.module.css` | `C8C9D62C5FD5C962ECC6082646A023DFA59623DCF9D1846EFF3F794D7499E125` | unchanged                                                          |
