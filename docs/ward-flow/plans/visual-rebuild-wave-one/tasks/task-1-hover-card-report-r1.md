# Task 1 hover/focus card closure report

Plan SHA256: `7714BAF3D8FCFFBAAE58BD03346A755C0F116912CD4FB34F605833D7B4B72E67`  
Implementation model: `gpt-5.6-sol / medium`  
Source state supplied by the brief: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Result

The closed desktop rail now uses the existing portal-backed Tooltip lifecycle for a drawing-shaped
hover and keyboard-focus card. Its content is the existing truthful accessible label assembled by
`wardNavCountLabel`: the registry route label and, when present, its live count and noun. The link
keeps that complete accessible name. The visual card is presentation-only, so it does not repeat the
same words as an accessible description.

Tooltip gained opt-in right placement, presentation-only rendering, disabled behavior and wrapper
sizing. Existing callers retain the previous top placement, accessible-description behavior and
enabled behavior by default. Right placement uses the drawing's 10px gap and 2px top alignment,
stays within the viewport and flips left when the right side lacks room. Disabling a focused tooltip
also resets measured visibility; re-enabling it cannot paint stale geometry before the next animation
frame.

Every rail link remains inside the same stable Tooltip wrapper while rail state and viewport state
change. Cards activate only when the stored rail state is closed and the live media query is wider
than 1000px. Open rails, normal-flow narrow rails and More pages links retain the existing native
title fallback. The wrapper and link both fill desktop list rows, preserving the full-width selected
ring and count alignment.

The card carries its own Ward token composition because the portal is outside the shell ancestor. It
matches the served kit's width, padding, hairlines, stronger bottom line, radius, surface, lift,
type scale and pointer behavior. Forced-colours uses Canvas/CanvasText with no shadow, and print
suppresses the portal card explicitly.

## Deliberate design adaptations

- The drawing-only purpose and state prose was not copied because the application registry has no
  governed equivalent. The card shows only real route and live-count data.
- The card uses `OverlayPortal` rather than a rail descendant. This preserves the rail's vertical
  scrolling and prevents its overflow boundary from clipping the card.
- At the right viewport edge the card can flip to the left. The drawing assumes available right-side
  space; the application keeps the disclosure readable at constrained desktop widths.

## Focused contract coverage added

- Right-side coordinates, the 10px gap and 2px top alignment.
- Presentation-only content remains visual, has no duplicate `aria-describedby`, and dismisses with
  Escape.
- A focused tooltip disabled and re-enabled remains hidden until fresh geometry is measured.
- A closed desktop rail link activates the right-side card, preserves its truthful accessible name,
  omits the redundant native title, and does not add a duplicate accessible description.

## Verification boundary

No tests, browser checks or server commands were run, as required by the brief. The five owned files
were formatted with the repository-installed Prettier executable. `git diff --check` returned no
errors for the owned files. Controller verification remains required for the affected tests and the
two-theme closed-state hover, focus, Escape and viewport-edge journeys.

## Output hashes

- `src/components/ui/tooltip.tsx` — `66B3E90C9C70434625B42E04409E3F8D3895EDCC19FFE358DF831330CBCA6192`
- `src/components/ward-management/shell/ward-rail.tsx` — `9E269454F3E8B72AC5D97091972B8C4CBDD77850AF32AF58B32EFA046612DD6D`
- `src/components/ward-management/shell/ward-rail.module.css` — `02A30DFDE3DEED097FF76F66A4473E01A5150126D53B038A14E36A6932A95A52`
- `tests/ui-v2-components.dom.test.tsx` — `381CCB16F4FD6B1A780A82C8621628714E9894CE09D35EFBF395ABC0DFC7D8F8`
- `tests/ward-shell-third-edition.dom.test.tsx` — `38D0EAD21AD2C4805CDB478F5E68AEC4B4C74600DB99092B7030454BA0A124D0`
