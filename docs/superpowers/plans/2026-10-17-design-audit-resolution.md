# Ward Flow design audit resolution implementation plan

> **Dated plan record, 17 October 2026. Do not execute as a new plan.** See the [plans index](../../ward-flow/plans/README.md) for recorded status, and check current source before resuming any item.

_Updated 2026-10-24 - marked as a historical record in the documentation audit; Documentation owns._

**Goal:** Resolve the reviewed usability defects across the design system, shell and pages, with explicit outcomes for SYS-01..08, SHL-01..06 and PG-01..24.

**Architecture:** Keep the current Next.js routes, shared state and reusable components. Correct presentation at its owning component or token layer; retain existing features where the original audit diagnosis was disproved. Independent agents own disjoint file sets in one isolated worktree.

**Tech stack:** Next.js, React, TypeScript, CSS Modules, Vitest and local Chromium/Playwright.

**Specification:** The user-supplied Ward Flow combined audit bundle, corrected by the item-by-item recommendations accepted in this chat. Source behaviour and current repository rules take precedence over obsolete file paths and unsupported historical styling prescriptions.

## Constraints

- Initial implementation used the supplied main snapshot `2c37e5ae171514d5b16513512b4a52b32ab9d5d0` and local gates. GitHub branch/PR publication was later explicitly authorised after adversarial review; merge and deployment remain excluded.
- Desktop rows remain 44px, phone rows 52px, desktop target token 28px and legacy tap token 48px.
- Preserve the single phone chrome owner, exact D4/D-18 wording and synthetic disclosures.
- No new sub-12px text. No engine, persistence or clinical-calculation changes.
- Do not introduce a permanent inspector, duplicate full-screen control or global typography/colour redesign to satisfy an incorrect audit assertion.

## Work and acceptance

- [x] Establish isolated branch, base, clean starting state and exact-file Cloud ownership.
- [x] System: diagnose canvas seams, finish glare opacity/theme bridges, verify existing token declarations and strengthen actual font-size coverage. Preserve already-correct hero geometry, fonts and toast distinctions.
- [x] Shell: put recovery feedback in the shell, keep loading feedback unobtrusive, make navigation and disclosure fully reachable, correct printing ancestors and mobile overflow affordances.
- [x] Home/referrals/timeline: readable service counts, grouped checks, responsive tiles, complete urgency guidance and labels that can grow with their rows. Verify existing TV full-screen and shortage labels.
- [x] Operational pages: complete update/blocker/location/action text and reachable filters, retaining working inspectors and responsive bed grids.
- [x] Search/reports/statistics: clear report entry/loading states, responsive legal calculator, complete statistics names and wrapping sign-in/on-call content.
- [x] Verify desktop light/dark/glare, phone, tablet, short windows, reduced-width reflow, keyboard/focus, report printing and selected interactions.
- [x] Run focused tests, token/size/mobile contracts, typecheck and changed-file lint/format; independently review standards and requirement coverage.
- [x] Record every audit item outcome and actual evidence, then commit the verified local result.

## Review focus

1. Dark preference combined with glare must not leave white text on white surfaces.
2. Late route hydration must not be mistaken for readiness because the header is ready.
3. Long labels and enlarged text must remain readable without increasing global target tokens.
4. Print ancestors must not constrain long reports to a screen-height scroller.
5. Recovery messages must retain exact wording and remain observable without changing save semantics.

## Evidence and per-item outcomes

The implementation preserves the current accepted app where the original report describes an already-correct feature or a styling preference. The supplied Markdown bundle and HTML contain the same reports; their referenced Windows screenshot files were not attached. Source and newly captured local browser evidence therefore establish the dispositions below.

| ID     | Outcome                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SYS-01 | Added page-owned canvas inheritance to shared and phone hero lips. Actual white, grey and domain-specific page backgrounds remain unchanged.                                                                              |
| SYS-02 | The active band already has square corners; no duplicate radius change.                                                                                                                                                   |
| SYS-03 | Bridged legacy/current token roles in glare and introduced a single page-canvas role. Retained distinct normal-mode namespaces rather than migrating every component.                                                     |
| SYS-04 | Retained current accepted typography. A historical scale difference does not justify globally shrinking text.                                                                                                             |
| SYS-05 | Added a parsed font-size/font-shorthand inventory and CLI regression coverage alongside the existing ratchet. The shared 12px token was already correct; unresolved relative/calculated sizes remain explicitly reported. |
| SYS-06 | Retained the current Geist stack and inherited hero colours. The early sizing/motion declarations belong to older and newer token blocks; no unsupported font or global sizing rewrite.                                   |
| SYS-07 | Added an opaque, readable glare palette with legacy bridges and scoped no-blur treatments for actual chrome, search and overlays. Forced colours and print retain their own rules.                                        |
| SYS-08 | Retained intentional desktop/phone toast differences, existing transitions and meaningful unavailable/preview styling. Phone glare toasts remain opaque and legible.                                                      |
| SHL-01 | Moved complete provider-owned recovery wording inside the shell, prevented notice shrinking and removed an existing duplicated storage warning.                                                                           |
| SHL-02 | Loading feedback now wraps in normal flow rather than covering data rows or the phone dock.                                                                                                                               |
| SHL-03 | Removed the permanent navigation fade. Short desktop windows scroll the whole rail; pop-outs remain outside that scrollport and inside the viewport.                                                                      |
| SHL-04 | Footer disclosures wrap, conflicting logical/physical top margins are corrected, and print ancestors release viewport constraints.                                                                                        |
| SHL-05 | Current phone action is centred in the dock rather than the reported right-hand overlay. Existing safe-area dock clearance remains; no arbitrary 136px reserve.                                                           |
| SHL-06 | Removed permanent chip fading, added end/focus clearance and visible scroll affordances; bounded desktop chip groups wrap where appropriate.                                                                              |
| PG-01  | Service names/counts can wrap; existing percentage formatter retained because it already emits an unspaced decimal.                                                                                                       |
| PG-02  | Checks summary and filters share a compact aligned group; shorter visible filter labels preserve complete accessible names and behaviour.                                                                                 |
| PG-03  | Hospital tiles use a readable responsive minimum and complete deadline text.                                                                                                                                              |
| PG-04  | Existing TV full-screen button retained and observed in browser.                                                                                                                                                          |
| PG-05  | Existing shortage/tone semantics retained; no unsupported KPI recolouring.                                                                                                                                                |
| PG-06  | Current supported desktop shortage cells fit their full content; phone TV is deliberately unavailable. No speculative clipping patch.                                                                                     |
| PG-07  | Referral urgency explanation wraps fully; meaningful unavailable-action styling retained.                                                                                                                                 |
| PG-08  | Timeline ward labels and their lanes can grow together; existing 48-hour horizon and controls retained.                                                                                                                   |
| PG-09  | The actual Transport Officer screen already has a selected-job pane. No permanent inspector added merely to fill spare width.                                                                                             |
| PG-10  | Reserved Last update width with truthful table scrolling; blocker information wraps.                                                                                                                                      |
| PG-11  | Ward actions wrap rather than squeezing labels. Existing bed-state semantics and colour treatment retained.                                                                                                               |
| PG-12  | Current bed grid already fills responsively; no duplicate grid rewrite or unproved dark-header repaint.                                                                                                                   |
| PG-13  | Capacity phone facts wrap between complete measurement phrases. Existing legend and Network hierarchy retained.                                                                                                           |
| PG-14  | Out-of-area filters and placement/home labels wrap; existing direction labels remain explicit.                                                                                                                            |
| PG-15  | Reported specialty column does not exist in the current ED view. Existing complete longest-wait label treatment retained.                                                                                                 |
| PG-16  | Alert filters expose scrollability and leave focus/end clearance; action meanings retained.                                                                                                                               |
| PG-17  | Governance inherits the corrected shared footer and canvas treatment.                                                                                                                                                     |
| PG-18  | Current patient search is already compact and reuses tier primitives across views; retained its controls and accepted palette.                                                                                            |
| PG-19  | Synthetic intake explanation already has a callout and exact D-18 text/test identifiers; shared not-found list exits now have explicit link colour, underlining and keyboard focus while retaining touch clearance.       |
| PG-20  | Current community attention content already has a grouped card/list treatment; no extra nested card added.                                                                                                                |
| PG-21  | Shared icon spacing and wrapping desktop filters expose the complete on-call filter set.                                                                                                                                  |
| PG-22  | Legal calculator sits beside the list in the responsive desktop rail, with existing phone sheet and narrower stacking preserved. Current handover sign-off already uses its existing panel.                               |
| PG-23  | Chronology empty state focuses its real patient selector; downtime starts with an accessible, stable, nonanimated loading card.                                                                                           |
| PG-24  | Statistics site names wrap without the 104px cap; sign-in disclosure wraps. Existing Settings preview semantics retained.                                                                                                 |

## Verification record

- Locked dependencies installed in the isolated task worktree; original checkout untouched.
- Fresh navigation/mobile-chrome baseline: 98 tests passed. Focused implementation suites cover recovery/save semantics, report entry states, legal forms, on-call, sign-in, Home, referral and movement interactions, operational pages and the new font scanner.
- Browser flow checks wait for meaningful page content as well as header readiness. Desktop light/dark/glare, tablet glare and phone layouts were captured; an initial development-only narrow-router error was rerun after compilation settled and did not recur.
- Hero lip/background computed colours match on Home in all checked appearance modes. Explicit canvas owners retain their original backgrounds.
- At a 400px-tall desktop window, the last navigation link is fully visible after keyboard focus. Open/collapsed rail pop-outs stay within the viewport; Escape restores focus.
- Recovery text fits on settled long Legal forms pages at desktop and phone widths.
- A long downtime report releases screen-height ancestor bounds and produces a multi-page landscape PDF.
- Independent standards and specification reviews found no blocking introduced defect. The parsed font inventory is conservative authoring evidence, not a browser cascade engine or a complete accessibility verdict.

Final local gates passed on clean test-correction commit `7dc2cea9800876294d4d350afe1c17b09dd5756a`. Its application source is identical to implementation commit `a7e60058fd60b5cb68c78586f5095d33658329c4`.

- `npm run check:ward-expected-reds`: **1,205 files, 13,393 executed tests, zero failures**, with one pre-existing unexecuted assertion (13,394 collected). This was a complete second run after correcting CSS test parsers, required test naming and a calendar-dependent baseline fixture; existing assertions remain intact.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:ward-journeys`: isolated production build and TypeScript passed; **158 browser journeys passed, one pre-existing exploratory test skipped, zero failures**, with zero retries.
- Full lint and typecheck, exact-file formatting, token/type/text-size guards, installed-lock parity, diff integrity, CI-scope checks and selected documentation/index checks passed. Changed test files also passed commit-time lint and scoped typecheck.
- The final shared browser probes covered glare under a dark preference, forced-colour emulation, representative text/status contrast with correct alpha compositing, a reduced-viewport reflow proxy, referral focus/Escape, not-found link affordance and unconstrained long-report printing. Detailed cases, source identities, diagnostic corrections, artifact hashes and limits are recorded in `docs/ward-flow/screen-verification.json` under `_designAuditResolutionEvidence`. Historical screen verdicts were not renewed.

Chromium checks do not establish physical Safari, installed PWA, exhaustive accessibility or clinical deployment acceptance. The font-size inventory remains a scoped authoring approximation and explicitly reports unresolved declarations. The original implementation phase did not publish a branch or PR. The later authorised publication follows the adversarial review below; merge and deployment remain excluded.

## Adversarial review follow-up

Three fresh reviewers independently examined `2c37e5ae171514d5b16513512b4a52b32ab9d5d0..9e619a6f9d9e22a1e0cf9b1a5abeb4575db52213`. Corrections are committed in `9f49fafe58ddf495f6c90b1416ef80b5f8d51d43`:

- **P2, font guard:** print-only token definitions could conceal an 11px screen fallback. The same media-ancestor predicate now excludes print-only definitions and font declarations in local, global and shell token layers, including `only print` and print-only lists. Mixed and `not print` queries remain included. Five regression cases failed before the fix; the final focused batch passed all 23 tests. The reviewer independently reproduced the corrected result.
- **Home requirement coverage:** the first 9rem tile minimum was overridden by later desktop/tablet rules, and a retained tablet mask obscured the final tile's focus edge. The active auto-column rule now uses 9rem, the permanent mask is removed, and inline padding leaves the focus edge visible. Independent checks at 1440 light/dark, 1200 light, 820 light and 390 light found the expected 144px desktop/tablet minimum, no mask, 4px focus-end clearance and no measured tile/deadline/page overflow. The phone layout remains unchanged.
- **Calendar fixture integration:** retained the upstream pinned calendar fixture while explicitly using a Wednesday calendar to exercise the two-day-wait colour branch. Nonempty and positive long-wait assertions remain. A local `git merge-tree` check against fetched main `aa3a78b9` is clean; no main merge was performed.

The final gates ran on clean correction commit `9f49fafe58ddf495f6c90b1416ef80b5f8d51d43`: **1,205 files, 13,398 executed unit tests, zero failures**, and a fresh isolated production build/TypeScript run with **158 Chromium journeys passed, one exploratory test skipped, zero failures and zero retries**. One unit assertion is conditionally skipped because its historical incident commit `d1485d6e8` is absent from this checkout; its source was not changed.

No confirmed P1/P2 remains open in the reviewed patch. Exact review scopes, corrected findings, checked cases, artifact hashes and gate identities are recorded in `screen-verification.json` under `_designAuditAdversarialReview`. The earlier implementation evidence remains historical. GitHub feature-branch publication and a PR are authorised; merge, deployment and hosted CI monitoring are outside this task.
