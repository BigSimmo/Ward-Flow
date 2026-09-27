# F12 Sign-in palette correction — report r1

## Scope and evidence

Owned source was limited to:

- `src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx`
- `src/components/ward-flow-sign-in/ward-flow-sign-in-screen.module.css`

Before-source evidence is preserved under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F12-sign-in-palette/` with `SHA256SUMS.txt`:

- TSX: `D52A8309C438E1AF0864DEEF5CC82DE940B7078FCA09A54960377681E2084EA9`
- CSS: `BE2DF6F2D4464EA52BF8C48C996324BFD28461E8827E16AF8871DBA8A886C604`

I viewed the served r7 app/mockup light references at 1440px and 390px before editing. The app captures still included the host chrome that the controller has since removed, so they were used for palette, typography and card treatment rather than standalone-page geometry.

## Change

The standalone screen now composes the canonical `wardShellTokens` layer from `src/app/ward-flow-shell-tokens.module.css`. Its ground gradient, top stripe, surfaces, boundaries, elevation, type scale/families, muted text, selected role, tags, primary action and appearance pills are expressed entirely through those third-edition tokens.

`useTheme()` remains the only preference owner and retains its existing Light/Dark/Auto storage, OS subscription and app-root class behavior. A page-local effect mirrors the hook's resolved `theme` to root `data-theme` while the sign-in screen is mounted, then restores the pre-existing attribute on cleanup. This closes the canonical token layer's selector seam: explicit Light cannot be overridden by a stale dark root attribute or a dark OS preference, explicit Dark wins, and Auto follows the existing resolved OS theme. No Ward management component, provider, store or engine is imported.

The forced-colours treatment now includes the appearance group and the top stripe. Print continues to omit the inert action and appearance footer; it relies on the canonical token module's light print palette instead of flattening every descendant colour.

All seven roles, the 13-action derivations, refusal facts, reconciliation logic, announcements, no-credential boundary and inert Go in behavior are unchanged.

## Static inspection

- `git diff --check -- <two owned source files>`: clean.
- CSS-module reachability comparison: no TSX class without a declaration and no declared local class without a TSX use.
- Scoped token grep: no remaining app-palette reads (`--text*`, `--clinical-*`, `--command*`, `--surface-inset`, `--surface-subtle`, `--border`, app radius/elevation/spacing aliases) in the owned stylesheet.
- Tests, browser rendering and server commands were not run, per controller ownership.

## Output hashes

- `ward-flow-sign-in-screen.tsx`: `97537DBBB084694985CF9730E619D85C5B76D67D975FF4B2C3ABFDA7F41F6970`
- `ward-flow-sign-in-screen.module.css`: `063A3D4E7E5D0918A4CB5C74F32E41402057F2993D0696892075A3F7D270E24B`

## Remaining deviations and evidence limit

- The app keeps 48px appearance targets, larger than the drawing's compact desktop pills, to preserve the existing accessible action-target contract.
- The existing implementation does not include the drawing's design-system-document link; this palette-only correction did not add content or an external navigation action.
- The app continues to use the existing application theme preference key rather than the drawing's standalone local-storage key, preserving the requested `useTheme` behavior.
- Post-change visual acceptance remains pending the controller's served light/dark and phone/desktop render check.
