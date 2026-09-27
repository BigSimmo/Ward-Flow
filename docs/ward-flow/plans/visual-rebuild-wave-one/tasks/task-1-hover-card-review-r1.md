# Task 1 compact rail hover-card review — revision 1

Date: 2026-09-13  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Verdict

No P1 or P2 issue remains in the reviewed compact-rail labels, live badges, or hover-card styling.

The final app rail keeps a stable narrow width, readable icon-plus-text destinations, distinct active fill and full ring, and unobscured live badges in both themes. Rows retain comfortable vertical targets while the 23-route estate scrolls inside the rail rather than widening or clipping the page. The hover card clears the rail edge, uses the same compact width and attached-card placement as the drawing, and remains legible against both light and dark page surfaces.

The app card is intentionally shorter than the drawing's richer Command example. It presents the truthful route/count label available from the current registry; the unavailable purpose and breach prose are not replaced with sample claims. That content difference is accepted and does not create empty or broken card geometry.

## Source review

The closed desktop rail hides only the expanded visual label. An abbreviated compact label is rendered visibly with `aria-hidden="true"`, while the link retains the full registry label plus its live count in `aria-label`. Entries without an abbreviation keep their registry label visible. The same full label supplies the presentation-only card, and the existing title is suppressed only while that card is enabled, avoiding two simultaneous hover descriptions. The corrected CSS scopes compact labels and absolute badges to a closed rail above 1000px; no narrow-layout or open-rail label behavior is changed.

## Evidence reviewed

- `shell-card-r3-app-1440-light.png`
- `shell-card-r3-app-1440-dark.png`
- `shell-card-r1-mockup-1440-light.png`
- `shell-card-r1-mockup-1440-dark.png`
- Current `ward-rail.tsx` and `ward-rail.module.css` diff, limited to the compact-label/card path

All four images were inspected at original detail. The cells prove one hovered app destination and the paired desktop geometry in both themes; they do not independently prove every route's card, keyboard focus rendering, forced colours, mobile behavior, or physical-device behavior. No test, browser or server command was run by this reviewer.
