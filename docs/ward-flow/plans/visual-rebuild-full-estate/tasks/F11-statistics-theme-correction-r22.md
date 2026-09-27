# F11 Statistics landing theme correction r22

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Scope

Changed only:

- `src/components/ward-management/statistics/statistics-landing-third-edition.module.css`

Actual-before copy:

- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-statistics-theme-r22/src/components/ward-management/statistics/statistics-landing-third-edition.module.css`

No Statistics TSX, data, derivation, action, shared primitive, shell, test, browser, server, canonical
evidence JSON, or PROGRESS file changed.

## Correction

The r22 lower-region captures exposed two legacy child styles that overrode the landing root's
canonical token bridge.

- `[data-testid="ward-statistics-service-list"] a` now receives the canonical `--surface`, `--ink`,
  and `--line-strong` pair directly. Its label span inherits the same explicit canonical ink, and
  hover uses `--surface-2` plus `--accent`. This is scoped to the five health-service route cards;
  other index links and controls are unchanged.
- `[data-testid="ward-statistics-referral-join-absent"]` now receives the canonical `--warn-soft`
  surface, `--warn` border/foreground, and `--ink` strong copy directly. This is scoped to the
  referral-to-bed measurement absence explanation; the separately corrected Declines-per-ward
  neutral notice and all other absence branches are unchanged.

The five real service names, network order, routes, link targets, 48px minimum target inherited from
the existing component, measurement copy, counts, and absence logic are unchanged.

## Hashes and checks

| File                                          | Before SHA-256                                                     | After SHA-256                                                      |
| --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `statistics-landing-third-edition.module.css` | `D3CBD8EDDD26C06750AB3D339255D3F3087E1FDB0BA64248EFA029BBF8DB7744` | `BC72B608DD5AD560671451F48C7C8D228C1C5B912F3C14B5D1AAE96B425EC090` |

Static source inspection found balanced CSS braces and only local `.screen`-anchored CSS Modules
selectors for the new global test-id scopes. No tests or browser checks were run by instruction.

Fresh light/dark lower captures should verify the service cards at 390 and 1440 and the measurement
warning at 390. The existing r22 captures remain failure evidence and do not verify this correction.
