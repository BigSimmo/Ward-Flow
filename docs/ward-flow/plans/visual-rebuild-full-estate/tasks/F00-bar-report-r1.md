# F00 bar and drawers — implementation report r1

Plan SHA-256: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`

## Scope and inputs

Edited only:

- `src/components/ward-management/shell/ward-bar.tsx`
- `src/components/ward-management/shell/ward-bar.module.css`

The starting bytes matched `F00-inputs-r1.json`:

- TSX: `68777072a9b6dab1512fa99dca8d641ff20da4d9ae6bfc5377af03fcf1f9a270`
- CSS: `8d662564d7a080c02263351cfddacf2648a979c487dbedd5802289871c5ce6d0`

I read the installed Next CSS guide, the current Command inline shell, and the supplied 1440px Activity reference before the final source pass.

## Changes

- Kept every header control's 48px interaction box. On non-coarse pointers, a centered inset layer paints the 34px reference face; coarse pointers paint the full 48px face. Focus remains on the full control and uses the existing visible outline.
- Restored the reference spacing ladder: the search caps at 30rem, the prototype mark shortens at 1500px, decorative drawer words become visually hidden at 1300px while remaining in the accessible name, and search takes a full usable row at 1000px. The universal search caller now uses the compact visible placeholder `Search`; its full accessible label remains owned by `WardGlobalSearch`.
- Kept the Service selector explicitly unwired and added a stable check position for the chosen option. No service count, scope behavior, or clinical fact was invented.
- Styled the existing `Sheet` through local props only: Activity and Tools use 36rem/94vw carriers, Tasks uses 28rem/94vw, side corners are square, backdrop blur is removed, and headers, close controls, bodies, and footers use the compact Command furniture.
- Split Activity into native pressed-button segments for Activity and Live tally. The reconciliation statement remains visible in the drawer header, current changes remain under What is going on, and all existing tally tiles and honest empty states remain available. Native buttons retain keyboard activation and visible focus without adding custom tab semantics.
- Moved the existing Tools disclosure to its footer while retaining demonstration, role, appearance, and developer-hub controls.

## Retained behavior and deviations

- Route-title resolution, global-search shortcuts/results, primary-action routing/refusals, Sheet focus trapping/Escape return, theme persistence, task actions, and publication-derived reconciliation were not changed.
- Service selection still changes only its local selected presentation and calls the existing optional seam; the panel continues to say that application scoping is not wired.
- Contact tables and operational Tools actions remain omitted because the mounted app has no approved real directory values or additional capability in this task.
- Activity has no engine-provided narrative equivalent to Command's synthetic summary paragraph, so the implementation presents the actual change feed and tally without manufacturing one.
- Tasks content remains owned by the separate F00 Tasks worker; this change supplies only its 28rem carrier and removes duplicate generic padding.

## Output fingerprints

- `src/components/ward-management/shell/ward-bar.tsx`: `b0ad3d1d161b2d5e621eb770f216e4f7276e8d9970560370c8409d2ed0f71ca2`
- `src/components/ward-management/shell/ward-bar.module.css`: `9a161549fb3b2e5ad94d415d03c9e9e8e6f4de9b923abeb70726861c0181e4bb`

## Checks

- `npx prettier --write src/components/ward-management/shell/ward-bar.tsx src/components/ward-management/shell/ward-bar.module.css` — completed; CSS unchanged by Prettier and TSX formatted.
- `git diff --check -- src/components/ward-management/shell/ward-bar.tsx src/components/ward-management/shell/ward-bar.module.css` — no whitespace errors.
- Tests, browser, and server were not run by instruction.

Requested controller checks:

- `npm test -- tests/ward-shell-third-edition.dom.test.tsx tests/ward-shell-mounted.dom.test.tsx tests/ward-shell-print-ancestor.test.ts`
- Served 390/820/1440 light/dark comparison with the Statistics long title; open Service, Activity, Tasks, and Tools; verify target rectangles, no overlap or horizontal overflow, Activity segment keyboard activation, Sheet focus trap/Escape return, and full-width narrow search.
