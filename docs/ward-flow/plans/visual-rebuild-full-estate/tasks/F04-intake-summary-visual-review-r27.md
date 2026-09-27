# F04 intake summary visual review r27

## Scope

Independent rendered review of the six fresh Intake summary captures at 390, 820, and 1440 pixels in Light and Dark, plus the targeted 390 Dark destination/form capture. I viewed all seven original PNGs at native detail and compared panel structure with the served 390 and 1440 Light Raise a referral references. No source, test, browser, or verification JSON changes were made.

The captures show an intentionally unanswered destination (`11 of 12`, Send unavailable). The controller separately observed the real transition to `12 of 12` after selecting Psychiatric ward; that interaction is not claimed as visual evidence from these stills.

## Findings

### P2 — the desktop summary row stretches two short cards to the tallest card

At 1440 in both themes, `Progress` and `What sending does` stretch to the full height of `What this referral will record`, leaving several hundred pixels of empty card surface. The three panels read as empty columns rather than discrete summaries. This is absent at 820/390 because the cards stack.

Smallest correction: on the desktop three-column summary container, align items to the start (or otherwise prevent equal-height stretching) so each card keeps its intrinsic height. Preserve the current column order and content.

### P2 — the phone History callout heading collides with its border/content

In `intake-destinations-app-390-dark-r27.png`, the heading `The history — written by you, sent word for word` begins on the callout's top border and overlaps the opening body lines. The rest of the callout remains readable, but its title and first paragraph do not have a clean vertical separation. The summary captures do not show this earlier form region, and no Light counterpart was supplied for this exact scroll position.

Smallest correction: restore the callout's phone block flow by giving its heading a normal line box and bottom spacing inside the border; avoid absolute/negative positioning or a fixed height. Recheck 390 in both themes.

## Accepted in the reviewed evidence

- No P1 issue is visible.
- Every requested formatted value is readable: `Suburb not known`, `ED medical staff`, `Tier 2 · urgent`, `Royal Perth Hospital (RPH)`, and four `No` answers. No raw enum code is visible.
- The unanswered Destination is clearly italicised and agrees with both `11 of 12` and the unavailable-Send explanation.
- Summary labels and values retain adequate Light/Dark contrast at all three widths.
- The 390 and 820 summary cards stack in a coherent order; text wraps without overlap or horizontal clipping.
- The written-history absence explanation and `What sending does` governance prose remain present. No control or content is visibly cut off within the captured target regions.
- These targeted scroll captures do not prove the entire form, the selected destination card, Send activation, focus treatment, or interaction behavior.

## Evidence hashes (SHA-256)

```text
intake-summary-app-390-light-r27.png 320038737524bd16908285e574ba6a54074f5fadfd63033edc49b50c8e84df29
intake-summary-app-390-dark-r27.png 7609ac09fcce3a2bd17a106e6295d1465b9ddaa88e58afb060a88da7fa23705f
intake-summary-app-820-light-r27.png d97c00457b3856a6b464d53378bb086330ca262ecd09c6c727d2eb750a3b7b72
intake-summary-app-820-dark-r27.png af69465af53ffb42fc1d5d6eb802f429a8eb28ef53e13d51ac4e77feb8cea5e3
intake-summary-app-1440-light-r27.png 3ccdf5267e7e942a2cb40cc60ffe759489825d81d61f471470dc521e1c13bbd3
intake-summary-app-1440-dark-r27.png 5e7ed715ef0d756ccd358802a2c9e3c1507e01003bf5101b6ec520ed25dc6a8c
intake-destinations-app-390-dark-r27.png 6b1efae707885bcae99f659365558009e968b3c43234c7e76cc2d96cbfb4ee83
```

## r28 correction closure

I viewed the six targeted current captures at original detail:

- `intake-summary-app-1440-{light,dark}-r28.png`
- `intake-history-app-390-{light,dark}-r28.png`
- `intake-destinations-app-390-{light,dark}-r28.png`

Both r27 P2 findings are closed.

- The 1440 px summary grid now top-aligns its three cards. **Progress** and **What sending does** keep their intrinsic content heights instead of stretching to match the substantially longer **What this referral will record** card. The partial `2 of 12` state and its source/origin facts remain readable in both themes.
- At 390 px, the written-history heading, warning, field label, help copy, textarea, and counter remain in normal block flow with clear separation in both themes. The destination heading and **NOT ANSWERED** status also wrap without collision, and all three destination cards remain contained.

No new clipping, contrast, or page-overflow issue is visible in these six changed regions, so no further source change is requested. The captures do not add interaction, focus, Send-enablement, or whole-page scroll-end evidence.
