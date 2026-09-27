# F00 search and Tasks content — report r1

Date: 2026-09-13. Owner/model: verification_plan / Luna medium.

## Changes

- `ward-global-search.module.css`: widened the desktop cap to 30rem, moved compact/tablet search to a dedicated full-width row at `max-width: 62.5rem`, and matched the served reference's compact surface while keeping the existing popup and footer structure. Visible type now uses the existing 12px-plus token floor.
- `ward-tasks-drawer.module.css`: applied the served third-edition drawer geometry (fixed `min(94vw, 28rem)` panel, sticky head, surface hierarchy, flat separated work rows, compact action treatment) while retaining the existing data-driven markup.
- `ward-global-search.tsx` and `ward-tasks-drawer.tsx`: no source changes were necessary; existing keyboard shortcuts, result limits, route/refusal behavior, acknowledgement/completion semantics, focus callbacks, empty states and test IDs remain intact.

## File hashes

| File                                                           | SHA-256                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/ward-global-search.tsx`        | `33A51587C2970C13B4C518D756AC3519352C01D30200DBADA1B2465C3B3D4F31` |
| `src/components/ward-management/ward-global-search.module.css` | `ECF77E0AB2011677132EBC4DC679B60298416276268F2A79BD58FFB83CE14C13` |
| `src/components/ward-management/ward-tasks-drawer.tsx`         | `CEB15977C06FAACC1B1690362E81BDF652735B425251402961044B30022A89BB` |
| `src/components/ward-management/ward-tasks-drawer.module.css`  | `DB1F81DAC7171384091CF0492359C4C3D5693C66B9957DC6DF4A8A598986D8E1` |

`git diff --check` over the four exclusive paths produced no output. Tests, browser comparison, server, provider, hosted Git, and the requested focused runner were not run by this worker; root owns those checks and the independent review.

Known deviation: the drawer component currently receives one unified `items` list, so the visual separation is expressed through row hierarchy rather than invented Notices/Work categories. No new category, count, label, or behavior was introduced. The Sheet/bar host retains ownership of positioning and width.
