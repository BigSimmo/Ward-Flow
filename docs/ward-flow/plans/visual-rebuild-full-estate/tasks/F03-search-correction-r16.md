# F03 Patient search correction — r16

Implementation owner: `gpt-5.6-sol / medium`.

## Scope and source preservation

Changed only:

- `src/components/ward-management/search/patient-search.tsx`
- `src/components/ward-management/search/search.module.css`

Both protected source files were edited in place. Neither file was deleted, renamed, or replaced. Before-source copies are retained under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F03-search-r16/`.

| File                 | Before SHA-256                                                     | After SHA-256                                                      |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `patient-search.tsx` | `4B304A91EABA1AC6BD65E5B082322B3C97439003313AC1E8C370178F0E46855B` | `DADF2B619BAF8E5A0C0A6E98DAEF999C16D6AA7A0D8D4C1FBAB6B6B451EF9A47` |
| `search.module.css`  | `799FFDD03C62ED937CF3DFBBBFCABA6B2C323242F7BAF8442F89D5211B348CDF` | `6EEE6B0D42ED02B8B4402D59756CEB0BEBE58025C48793085764FB94F0425DDA` |

## Implemented correction

- Moved the intact `Patient search controls` region into the existing flattened console immediately after the Results console. Phone and intermediate layouts now present Results before Search, following the drawing. The existing bounded `.resultsViewport` remains an internal scroller (`36rem` maximum on the phone rule), so the 43-movement engine population cannot make Search indefinitely distant.
- Preserved the region's exact `aria-label="Patient search controls"`, form submit handler, typeahead bindings, Stage and Department handlers, refusal/live-region behavior, summary, and all three result populations.
- Bound the legacy text, Ward surface/status, and clinical-accent roles on the opted-in third-edition screen root to its canonical `--ink`, `--muted`, surface, line, accent, warning, and on-accent tokens. Nested legacy and composed controls now follow the explicit Light/Dark choice through their actual shared local ancestor.
- Reset the historical fixed-phone-bar top reserve only on the opted-in third-edition root at the existing `40rem` breakpoint. The legacy screen keeps its original reserve.
- Reversed the page-local flex order values to Results 1 and Search 2. The existing explicit desktop grid coordinates remain unchanged.

No engine derivation, population, counter, route, shell, shared token, preview state, or action behavior changed.

## Static evidence

- `npx prettier --write src/components/ward-management/search/patient-search.tsx src/components/ward-management/search/search.module.css` — both files formatted; the stylesheet was already formatted.
- Before/after source comparison: 21 literal `data-testid` attributes on each side with an empty multiset delta; `onSubmit` 1/1, `onChange` 2/2, `onValueChange` 1/1, `onPreview` 2/2, and `onPreviewMovement` 1/1, all with empty deltas.
- `git diff --check -- src/components/ward-management/search/patient-search.tsx src/components/ward-management/search/search.module.css` — passed with no output.

Per controller instruction, no tests, browser checks, or server commands were run. The r16 P1 contrast and responsive layout findings need the controller's fresh six-cell served capture before visual acceptance.
