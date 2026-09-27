# Task 7 Bed board layout correction — revision 2

Date: 2026-09-13  
Plan SHA-256: `DEB1A10C336EB44856430D8C15D91B09EE5787B5762B3D55A0159DB0C772BAEB`

## Input state

The correction was applied on top of `task-7-correction-r1.md` and the controller's later separation of the bed-grid `h2` from its Showing count.

- `ward-board.tsx` input: `6DD686939378A1763A442B34F4FDBCB671B7160DE7A5BDB8E08E1F688B3E6446`
- `board.module.css` input: `6A2069ABD41D2DA3639201DABDA05EB7C141BDEDA31D5B7F100A3E13C3BB0150`

## Result

The complete `Needs you this shift` work band now begins the left bed-grid column before the bed-grid heading. The selected-record aside therefore begins level with the work band at desktop widths instead of beginning only beside the bed grid. Its heading, digest, expanded list, counts, descriptions, test ids and default-open behavior moved together without data or behavior changes.

The nested work band drops its redundant outer border, radius, elevation and top margin inside the existing grid-column panel. Its own summary and list structure remain intact, with a separating bottom rule before the bed-grid heading. At narrow widths the containing grid column retains its existing first position, followed by the detail region and flow column. Print still hides `.workBand` as screen-only summary chrome, restores `.flowColumn`, reveals all flow panels and restores every bed tile.

Occupied-tile headings now use an explicit `0.25rem` inline margin between the numeric duration and its `day`/`days` unit. The visible separation no longer depends on collapsible leading text whitespace; the value and pluralization are unchanged.

Latest filter selection clearing, print restoration, warning pill, ward-switch helper, separated bed-grid heading/count, all three flow tabs, all five tile kinds and all three reducer actions remain present.

## Output hashes and checks

- `src/components/ward-management/board/ward-board.tsx`: `8A69E4D40FFD078773C23197FF1FC920EA71A9D8B3302D02434E135BF3211FDC`
- `src/components/ward-management/board/board.module.css`: `0808F8546E3E783D2FE49F58316D2DDF43AF27BA7E9AE0F00611C4E02AE14B91`

`git diff --check -- src/components/ward-management/board/ward-board.tsx src/components/ward-management/board/board.module.css` produced no output. Static inspection found one work-band section/test id, three flow tabpanels and three dispatch sites, unchanged in count.

No tests, browser work or server work were run by this worker. The controller owns desktop alignment, narrow ordering, print and day-unit visual closure. Human visual acceptance remains pending that evidence.
