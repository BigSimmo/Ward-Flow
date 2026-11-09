# Ward Flow UI and local server workflow

_Updated 2026-11-09 - design work follows the design review prompt; owner design rules live in DESIGN-SYSTEM.md and HOW-WE-WORK §6 only (D-107); Documentation owns._

Read before UI changes, mockups, browser evidence or a local app link. [AGENTS.md](../../AGENTS.md) governs safeguards. The dedicated repository engine/tests own behaviour; current accepted appearance must be preserved.

## Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- For UI or frontend changes, browser QA, screenshots, mobile checks or a local app link, run `npm run ensure` first, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001` or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Never kill or modify another project's server. If the stable port is busy, let `npm run ensure` choose the next safe URL.
- Do not run a permanent watcher. Start or verify the server only when the task needs the app or the user asks.

## Building UI

Every design task, of any size, follows the
[design review prompt](../design/design-review-artifact-prompt.md) (Josh, 9 November 2026,
[D-107](../ward-flow/decisions.md#d-107-working-rules-and-documentation-from-the-9-november-2026-audit-9-november-2026)). It carries forward D-74 (Josh approves before
build) and D-75 (start from the running app), and replaces the D-91 mock-up viewer. Build in the real app with React, TypeScript, the kit and CSS Modules; never a
separate HTML or JavaScript UI that must be rewritten. None of this authorises publication,
a provider read or deployment.

The owner design rules (control sizes, no coloured side edges, legal-form times, pop-ups, dates,
fewer warnings) have one home: [DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md), the design system of
record (Q327), with the build-failing ones in
[HOW-WE-WORK §6](../ward-flow/HOW-WE-WORK.md#6-owner-rules-that-fail-builds-or-reviews).

Design and wiring:

- The working engine is authoritative for behaviour. For appearance, the accepted app at current `main` stands until Josh approves a design through the [design review prompt](../design/design-review-artifact-prompt.md). Historical drawings and token notes do not authorise a restyle. Keep status understandable and controls accessible.
- Every offered control must work or accessibly expose why it is unavailable. Wire a new route into the real role navigation and verify it is reachable. Screenshots alone do not prove controls. Detail: [wiring-and-bundle-budget.md](wiring-and-bundle-budget.md).
- Repository contracts and committed tests outrank generic external skills and style plugins. Never change committed tokens or tests to satisfy a generic rule, and name the rule when an external one drives a change.
- Figma sync follows [figma-sync.md](figma-sync.md). Code is the source of truth.
