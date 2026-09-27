# ED screen r16 visual correction

Date: 2026-09-13. Scope: all 12 served emergency-department app/mock captures at 1440, 820 and 390 px in light/dark. Actual-before copies: `C:\Users\joshs\AppData\Local\Temp\ed-screen-r16-before`.

## Findings and correction

The app retained the four engine-backed populations and actions: Expects and inbox under Needs attention, plus Recently answered and Still to be moved under Department lists. At 1440 light/dark the tier badge rendered with a near-black legacy treatment against its dark/colored context (P1 contrast). The Department lists were two stacked sections, while the drawing uses a tabbed presentation (P2 hierarchy and task switching).

Only `src/components/ward-management/ed/ed-screen.tsx` and `src/components/ward-management/ed/ed.module.css` were changed. Department lists now use a two-tab ARIA tablist with roving tab index and Left/Right keyboard switching; both panels remain mounted, with the inactive panel hidden for the screen and both revealed in print. Existing row test IDs, population derivations, action handlers, explanatory facts and absence wording remain in place. Local third-edition aliases bind surface and radius tokens, and tier styling resolves against the local light/dark ramp.

Static checks: Prettier write reported both owned files unchanged after formatting; PostCSS parse passed; TypeScript transpile syntax diagnostics 0. No tests, browser, server or provider checks were run. Fresh runtime capture, interaction, print and human acceptance remain pending.
