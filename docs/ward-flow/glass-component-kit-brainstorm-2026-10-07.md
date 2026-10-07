# Soft glass component kit: brainstorm, 7 October 2026

Goal: a reusable kit that looks Apple-glass inspired, with soft curves, a professional feel and a
polished finish. It should grow out of what the app already does well rather than replace it.
This is a set of proposals for Josh to pick from. Nothing here is built yet.

## What to keep from the current app

- **Lift and highlight.** `--lift` (a 1px contact shadow plus a long soft drop) and `--hl` (a
  white inner top edge) already give panels a glass edge. Make these the foundation.
- **Blur where it already works.** `blur(16px)`/`blur(18px) saturate(1.2)` on the bar and drawers.
- **One easing curve.** `cubic-bezier(0.16, 1, 0.3, 1)` is already the most used curve (43 uses).
  Adopt it as `--ease-glass`.
- **Calm palette and service hues.** Colour stays for status and service identity, never for decoration.

## Foundations (tokens first, then components)

| Token family | Proposal                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Material     | `--glass-thin`, `--glass-regular`, `--glass-thick`: translucent surface, blur, saturation and a 1px hairline border at three strengths                              |
| Elevation    | `--elev-0` to `--elev-3`, built from `--lift` and `--hl`, so a card, popover and sheet each have one shadow recipe                                                  |
| Radius       | A nested ladder: 8 for chips, 12 for controls, 16 for cards, 22 for sheets and pill for toggles. Inner radius = outer radius minus padding, so corners nest cleanly |
| Motion       | `--ease-glass` with 120, 200 and 320ms steps. Press scale is 0.98. All motion respects reduced-motion                                                               |
| Focus        | One `--focus-ring`: a 2px accent ring plus a 4px soft halo, used on every control                                                                                   |
| Fallbacks    | Solid surfaces under `prefers-reduced-transparency`, forced colours and when blur is not supported                                                                  |

## Components to build or remake

1. **GlassSurface**: the base layer (material, elevation, radius props). Every card, bar and sheet composes it.
2. **WardButton**: primary (solid accent, inner highlight), secondary (glass), quiet (text) and icon. 48px target, press scale, loading state.
3. **SegmentedControl**: an iOS-style sliding thumb on a glass track. Replaces the roughly 125 tab and segment classes.
4. **StatusPill**: a soft tinted capsule with a dot and a label, so status never relies on colour alone. Extends `WardChip`.
5. **MetricCard**: one figure, one label, a trend and an optional sparkline. Unifies statistics, capacity and hub tiles.
6. **RecordRow**: extends `WardRecordRow` with a tone edge, an avatar or bed badge, a trailing action and a swipe-ready layout for phones.
7. **Sheet and Drawer**: thick glass, a grabber on phones, spring open and a scrim blur. Builds on the existing `ui/sheet`.
8. **Toolbar and FilterBar**: a floating glass bar with search, filter chips and a count. Replaces per-screen toolbars.
9. **EmptyState**: an icon, one line and one action, using the existing `--empty-pad` tokens.
10. **Toast and inline banner**: glass with a tone stripe for confirmations and warnings.

## Screens to remake first (the highest-visibility proof)

- **Bed board tile** (board/ward): the most-viewed component. A soft card with a bed number, a status pill and a patient line.
- **Referral card and drawer**: shows the button, pill and sheet together.
- **Hub metric tiles**: shows MetricCard and elevation.

## Guard rails

- Text on glass must stay at 4.5:1 contrast. Glass is for chrome and containers; dense tables stay on solid surfaces.
- Blur is expensive on low-end ward devices, so limit it to bars, sheets and popovers (no more than 3 at once). Cards fake glass with a translucent fill and the highlight, without blur.
- Build in React and CSS Modules under `src/components/ward-management/kit/`, preview at a `/mockups/kit` route, then migrate screens one at a time.

## Suggested order

1. Foundations tokens and GlassSurface.
2. WardButton, StatusPill and SegmentedControl, previewed on a kit page.
3. Remake the bed board tile as the reference, for Josh's approval.
4. Roll out screen by screen, lowering the drift-ratchet caps as each lands.

## Direction v2, after Josh's review (7 October 2026)

Josh asked for a more compact layout, sharper buttons and well-defined badges, and no large empty areas.

### Principles

- **Dense but calm.** 4, 8, 12 and 16px spacing. Desktop controls are 36px, phone and primary controls 44px, and rows 52px. Card padding is 14 to 16px.
- **No dead space.** Every panel is filled with useful content or collapses. Empty states are one line, never a large box.
- **Edges you can see.** Every card, badge and input has a 1px hairline border plus a white top highlight. Shadow alone is never the only edge.
- **Shape plus colour.** Status badges carry a shape (triangle urgent, square stalled, tick accepted, dot en route, ring routine), so they read without colour.
- **One primary per area.** Primary has a soft top sheen and a darker edge. Secondary is a raised white key. Tint for in-row actions, ghost for tertiary.
- **Monospace only for data.** Times, IDs, counts and codes. Never for labels or headings.
- **Glass for chrome only.** The top bar, toasts and sheets. Data sits on solid cards. Deep slate is reserved for one hero band per page.
- **Counts live inside controls.** Use a divider segment in the badge or a count chip in the button, instead of separate stat strips.

### Further components worth adding

- Command palette (press /) for jumping to a patient, ward or form
- Split button for print and export options
- Stage track: a segmented pipeline that also filters the list below
- Inline alert with a single action (escalate, retry)
- Metric tile with a sparkline and a 24-hour change badge
- Before-departure checklist and a compact activity timeline in inspectors
- Keyboard shortcut hints on primary actions
- Service identity chips (a lettered colour square plus the name)
- Sticky table header with zebra-free hairline rows and a hover-revealed row action
- A "delivered this shift" strip that fills the space under short lists
