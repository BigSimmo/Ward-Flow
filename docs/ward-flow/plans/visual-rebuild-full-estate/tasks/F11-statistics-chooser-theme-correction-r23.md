# F11 Statistics landing chooser theme correction r23

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Scope

Changed only `src/components/ward-management/statistics/statistics-landing-third-edition.module.css`.
The actual-before copy is under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-statistics-choosers-r23/`.

## Complete landing-link inventory and correction

Current `statistics-screen.tsx` has three rendered link families that cover the landing's four
conceptual destinations:

- `ward-statistics-index-entry-*` — the hub entries, including Ward/ED comparisons and the one-unit
  Ward/ED route, plus the service and community destinations;
- `ward-statistics-community-link-*` — every community-team chooser route;
- `ward-statistics-service-link-*` — every health-service chooser route.

The previous service-only rule is now one grouped rule across all three families. Each link receives
canonical `--surface`, `--ink`, and `--line-strong`; each direct label span receives canonical ink;
hover receives `--surface-2`, `--accent`, and canonical ink. The local `.screen` anchor keeps all
selectors CSS-Modules-pure and landing-scoped. This fixes the dark-on-dark community/index cards
visible immediately above the corrected service chooser in the r23 light desktop capture without
changing names, order, routes, actions, target geometry, or any non-chooser control.

The separately scoped `ward-statistics-referral-join-absent` warning correction remains unchanged.

## Visual evidence status

The eight `statistics-landing-bottom-{app,mock}-{390,1440}-{light,dark}-r23.png` captures close the
r22 health-service-card and referral-join-warning contrast findings with no visible regression in
those corrected regions. They also preserve the old failure evidence: the preceding chooser remained
dark-on-dark in r23 light before this broader selector correction. Fresh light captures are required
to close that final chooser-family defect; this report makes no rendered-verification claim for the
new grouped rule.

## Hashes and checks

| File                                          | Before SHA-256                                                     | After SHA-256                                                      |
| --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `statistics-landing-third-edition.module.css` | `BC72B608DD5AD560671451F48C7C8D228C1C5B912F3C14B5D1AAE96B425EC090` | `CE664FD4D2CADDED0C3AB344D6B932BFE0FE44BB421EB8C1E8746046FF72D966` |

Static inspection found balanced CSS braces and exactly three grouped occurrences for each named
link-family prefix (base, direct label, hover). No test, browser, server, TSX, shared component,
canonical evidence JSON, or PROGRESS file changed or ran.
