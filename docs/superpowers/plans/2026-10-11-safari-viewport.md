# Safari viewport and phone header

Original objective: remove phone-header reflow and check viewport fill, menus and navigation.
Owning repository: `BigSimmo/Ward-Flow`. This continues the supplied Safari handover.

## Current continuation

- Worktree: `C:/Users/joshs/.codex/worktrees/304a/Ward-Flow`.
- Branch: `codex/chat-safari-viewport-304a`; base: `1158c0950871a00f9eae544075d965b6e4f0fcee`.
- The base contains newer v10 phone layouts than the archive base `b7667f5`.
- Retain the handover's constant 56px header, fixed title size and separate scroll thresholds
  (enter above 8px, leave at 2px or below). Preserve document scrolling and existing controls.
- Josh approved the exact `ward-bar.tsx` takeover for Safari scroll state in this chat on
  11 October 2026. Preserve the earlier owner's click-away behaviour and checkout.
- Import the three phone regressions and wait for page load/hydration before measuring scroll.
- Synthetic data only. Local implementation/testing; publication and deployment remain separate.

## Verification checkpoint

The archive records Chromium, full offline unit, build and static passes on its earlier source.
Those are historical evidence, not a pass for this newer checkout. Its WebKit download blocker
does not apply here: matching Playwright WebKit 26.5 revision 2336 installed successfully.

The first development WebKit attempt reached the app but scrolled before hydration finished.
A second attempt was blocked by a local project-identity request timeout before tests ran.
Neither result establishes a Safari product pass. Use the production runner for stable proof.

Current state: implementation and verification in progress. Evidence is retained in
`.local/safari-viewport/` (ignored, local). Next action: run current-source static/unit gates and
the production Ward journeys, plus all ten WebKit responsive/phone checks; repair actual failures.

The first current-source readiness run passed its first ten checks, then stopped at six unused
import warnings in the existing v10 handover, patient census and statistics phone components.
Those three files were byte-identical to the base commit. Their exact active claim check was
clear. Remove only those imports to unblock the required zero-warning lint gate; no screen
behaviour or exported API changes. The failed run remains in `verify-pr-local.log`.

The next selected run passed all twelve preceding checks, including full lint and TypeScript.
The full unit gate refused to run on uncommitted source: `FULL evidence requires a committed,
clean tree; commit the batch before this gate.` Preserve a local candidate commit, then run the
remaining full unit gate and the complete Chromium Ward lane plus WebKit responsive lane.
The preceding static evidence is in `verify-current-cross-browser.log`.

Real iPhone Safari toolbar, keyboard, safe-area and installed-PWA behaviour requires separate
device evidence. Automated WebKit does not emulate Safari's physical browser controls.
