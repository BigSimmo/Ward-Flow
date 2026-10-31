# Ward Flow UI and local server workflow

_Updated 2026-10-31 - current design rules from the redesign mock-ups and the kit (Josh, 31 Oct); 2026-10-23 - surface the D-74/D-75 mock-up evidence and approval requirements; Documentation owns._

Read before UI changes, mockups, browser evidence or a local app link. [AGENTS.md](../../AGENTS.md) governs safeguards. The dedicated repository engine/tests own behaviour; current accepted appearance must be preserved.

## Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- For UI or frontend changes, browser QA, screenshots, mobile checks or a local app link, run `npm run ensure` first, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001` or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Never kill or modify another project's server. If the stable port is busy, let `npm run ensure` choose the next safe URL.
- Do not run a permanent watcher. Start or verify the server only when the task needs the app or the user asks.

## Building UI

Before building from a mock-up, follow the
[D-74 standing approval rule](../ward-flow/decisions.md#d-74-owner-answers-to-the-21-october-open-questions-21-october-2026)
and [D-75 evidence rule](../ward-flow/decisions.md#d-75-ux-audit-follow-up-page-caching-community-gaps-and-the-extra-travel-bed-hold-21-october-2026):
make it from screenshots and visual assessment of the running app at current `main` or the
hosted site, record which commit it depicts, and obtain Josh's explicit approval of that
specific mock-up before implementation. This does not authorise a provider read or deployment.

React mockups, owner direction of 5 October 2026:

- Build interactive mockups in React and TypeScript with the site's existing Next.js routes, reusable components and CSS Modules. Design the real components that can become the approved site. Never build a separate HTML or JavaScript UI that must be rewritten.
- Reuse shared Ward Flow state, reducer actions and synthetic records rather than duplicating logic or data. Keep preview-only controls and fixtures small and separate. A shareable HTML preview bundles the same React components.
- On approval, integrate the reviewed components directly and keep their working interactions. Run only checks that cover plausible changed behaviour, and avoid repeated full suites, builds or screenshot matrices. An explicit request for static images, plain HTML or another framework wins. None of this authorises publication or deployment.

Design rules in force (31 October 2026). The full standard is
[design-system-v9.md](../../design/v9/design-system-v9.md); section 14 lists the owner rulings.

- **Control size.** No 48px controls. A phone button shows at 40px (32px small) with an invisible
  cover that keeps the 48px tap area; phone tabs are 32px in a 40px track; desktop segmented and pill
  tabs are 30px at 13px. Placement decisions keep their full-size button. Text never goes below 12px.
- **No coloured side edges** or stripes on rows, cards, tiles or stat boxes. Tone goes in the
  StatusGlyph or a small tinted tag; borders stay neutral.
- **Legal-form times only as typed**, never a countdown, "due in" or "passed … ago" (D-93, replacing
  D-71 item 5). Reused real parts can still compute one; check before reusing.
- **Pop-ups:** a status tag beside the title, tabs inside when there is a lot to show, and the main
  actions pinned at the foot. The styled "Leave this page?" confirm replaces the browser's own box.
- **Dates** are typed in the kit's DD/MM/YYYY date box, never the browser's date picker.
- **Fewer warnings.** Keep a warning only where a rule or a real risk needs it; safeguard wording
  stays word for word.
- **Keep:** surname first, nothing pre-selected, names wrap in full, synthetic data only.

Design and wiring:

- The working engine is authoritative for behaviour. For appearance, a page Josh has approved in the redesign mock-up viewer (D-91) is authoritative once it is built; any other page keeps the accepted app at current `main`. Historical drawings and token notes do not authorise a restyle. Keep status understandable and controls accessible.
- Every offered control must work or accessibly expose why it is unavailable. Wire a new route into the real role navigation and verify it is reachable. Screenshots alone do not prove controls. Detail: [wiring-and-bundle-budget.md](wiring-and-bundle-budget.md).
- Owner rules that fail reviews (D4 wording, D5 Act limits, no typed text in browser storage, privacy wording, design tokens) are in HOW-WE-WORK section 6.
- Repository contracts and committed tests outrank generic external skills and style plugins. Never change committed tokens or tests to satisfy a generic rule, and name the rule when an external one drives a change.
- Figma sync follows [figma-sync.md](figma-sync.md). Code is the source of truth.
