# F00 rail bottom gap diagnosis r24

Date: 2026-09-13
Scope: source-only diagnosis of the black strip below the left rail in `ward-answer-bottom-app-1440-light-r24.png`; no source or browser changes made.

## Evidence

The capture shows the rail painting through approximately y=1177, then the page/body black background for the final approximately 103 image pixels while the Ward Answer ground continues across the right content. The capture is at the bottom of the long Answer page (reported scroll position `window.scrollY = 632`). This is a real left-column containment mismatch, not the already-fixed lower landing notice.

Relevant current rules:

- `src/app/mockups/ward-flow/ward-flow-layout.module.css`: `.shellRow { display:flex; align-items:stretch; min-height:100dvh }`.
- `src/components/ward-management/shell/ward-rail.module.css`: `.rail { position:sticky; top:0; align-self:flex-start; height:100dvh }`.
- The rail is therefore explicitly viewport-height by design; its sticky/self-scroll geometry should not be stretched across the long route. The transparent `.shellRow` track exposes the host body background below the rail while the Ward ground continues in the right column.

## Recommended smallest correction

Keep the rail's sticky viewport height, width, and self-scroll behavior unchanged. The smallest correction is to have `.shellRow` compose the canonical shell tokens and paint `var(--surface)` (or the established shell track surface), allowing the Ward ground to continue in the right column without a black transparent left track. Verify the bottom capture and one long ordinary Ward route; do not stretch the rail across route content.

This diagnosis is source-based plus the supplied bottom capture. It does not claim a rendered fix, and no tests, browser probes, or source edits were performed.
