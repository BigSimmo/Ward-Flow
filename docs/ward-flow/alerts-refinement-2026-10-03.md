# Alerts refinement — 3 October 2026

Task identity: `alerts-refinement-20261003`, repository `BigSimmo/Ward-Flow`.
Base: `d8c1a05c24a55282c90547725ae9f397cf2ef284` (verified main tip).
Worktree: `/workspace/ward-flow-alerts`, branch `codex/alerts-refinement-20261003`.

The alerts page uses compact, unequal columns on desktop and one page scroll.
The narrower column groups alerts needing attention with role notices. The wider
column holds a dense operational queue. Columns stack on smaller screens.
Alert rows preserve patient identity, UMRN, location, ownership, timing, links and
existing actions. Legacy movement references are removed from row and drawer copy;
underlying identifiers, event routing and persistence remain intact. Arbitrary urgency
percentage bars were removed; recorded overdue times remain visible.

The HUD uses page-local styling to match the surrounding panels and wrap metrics,
without changing the shared island on other screens. Filters have shorter visible
labels, retained full accessible names, selected role states and keyboard tier navigation.
Group counts reflect the current filters; the page summary still reports overall totals.

The communication section reads `state.notices`, sorted by `raisedAt`, and displays
recorded recipient, timestamp and read state. Notices are created by reducer events
such as releasing a bed hold, referral decisions and transport cancellation. The
connection, latency and queue-status strings were hard-coded and have been removed.
This is not an external hospital telemetry connection. Broadcast directives remain a
separate reducer-backed feature and retain the synthetic-only modal disclosure.

Validation evidence is recorded in the same task's local receipt. The hosted Railway
page was unreachable from this environment (`ERR_TUNNEL_CONNECTION_FAILED`); the
local preview was checked after verifying `/api/local-project-id`. Deployment,
user acceptance and hosted behaviour are separate from local implementation.

The Windows shared sign-out file is unavailable in this Linux environment; local
claims and release status are held under `/workspace/shared/ward-flow-alerts-sign-out.md`.
Desktop concurrent claims could not be verified. All changes stay in the isolated worktree.

Local acceptance: 32 focused tests passed across six test files. Changed-file ESLint
and the pre-commit scoped TypeScript checks passed. Browser checks passed for tier
keyboard navigation, role filtering and counts, action menus, drawer and modal
Escape/focus return, and access to the final rows. Layouts were inspected at 1440,
1024, 768 and 390 pixels, with no page overflow or nested panel scrolling. No
page JavaScript errors were observed in the completed interaction run.

Recommended follow-up: complete the unavailable intervention confirmation workflow;
add recipient-scoped notice read actions using the existing `MARK_NOTICE_READ` event.
These require separate behavioural implementation and are not claimed complete here.

User refinement: avoid a long full-width stack. Group related content into columns,
reduce repeated row labels and timing, and keep touch targets and identification.

Clinical-summary refinement: use four equal metric cells with aligned values and
consistent supporting lines; keep the legal limitation beside the heading. Move
monitoring scope into a compact disclosure under notices, rather than the operational
queue footer. Use 36-pixel controls for desktop mouse input, retaining 48-pixel targets
for touch and smaller viewports. Preserve all seven condition scopes and recorded
counts, including unavailable handover monitoring.
