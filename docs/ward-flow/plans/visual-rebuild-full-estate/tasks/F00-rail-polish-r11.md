# F00 rail polish — r11

## Scope and evidence

Exclusive source ownership was limited to:

- `src/components/ward-management/shell/ward-rail.tsx`
- `src/components/ward-management/shell/ward-rail.module.css`

I viewed both supplied 1440 Light captures at original resolution:

```text
B0F5A9D2D39603EA9051B602153F780D547BCCA2964883C8B3A70A4401BAB482  tools-app-1440-light-r11.png
46957D70E078DAFC6957E427340A318789BA63FF761779B698EFF1AAD8B7EEC0  tools-mock-1440-light-r11.png
```

The mounted rail was already the correct 236 CSS pixel width. The visible differences were its
uniform information-poor rows, registry order rather than the drawing's group hierarchy, and a
larger footer treatment. The drawing's shared rules at
`docs/ward-flow/mockups/command-third-edition.html:625`, `:642`, `:717`, and `:3837` supplied the
group, row, footer and open-rail rhythm. The app's 48px target rule remains authoritative.

Actual input bytes are retained under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F00-rail-polish-r11/`.

## Implementation

- The one `railEntries()` registry result is arranged as Operations, Network and Records. Core
  order follows the drawing: Command/Movements/Capacity; Wards/ED/Community; Patient
  search/Referrals/Handover/Statistics/Governance. Delays and Network retain a stable semantic
  group position when current or exposed through More pages.
- The open desktop rail now uses the existing More-pages Sheet for non-core routes. Every one of the
  23 registry destinations remains in the DOM and reachable there, with its registry href, icon,
  count label and navigation handler. The current route is always promoted into its group, so its
  active state never exists only behind More pages. The closed rail continues to render every
  route and its existing focus/hover card.
- Entries with an existing derived count now show its existing noun as a compact second line. This
  adds no count or operational claim: the chip remains the same value from `wardNavCounts`, and the
  accessible label continues to come from `wardNavCountLabel`.
- Row padding and list gaps were reduced while every link still has
  `min-height: var(--spacing-tap, 3rem)`. Secondary state is hidden in closed and wrapping-phone
  forms so those layouts keep their accepted density.
- Reconciliation remains outside the footer and visible at every width. Footer padding/gaps were
  tightened, and the existing disclosure was shortened without dropping its two facts: ward data
  and figures are invented; real WA hospital/service names remain identified as real.
- Unavailable shift scheduling and movement pinning remain explicit. No shift, pin, role, count or
  reconciliation value was fabricated.

## Hashes

```text
BEFORE                                                            AFTER
8DEC408C2820EE3BF35B37D22BC565E397B630BE18C63F3B7DFD51CD263246A2  C498C31D14D8A1D12515003241B35FBCC9631A8D314695C9D1A9D9332D33CFB2  src/components/ward-management/shell/ward-rail.tsx
60BC97DC29F941496A9AD57CCD51BC9C4CF9E063FBA32ABEC1DFEC439368CD15  7408A6CCDC3FC80AE83F9F5DE325B8C448B71B92FC935CAB1E562D2D06EAB1B3  src/components/ward-management/shell/ward-rail.module.css
```

## Static evidence and limits

- `npx prettier --check` for both owned files — passed.
- `npx eslint src/components/ward-management/shell/ward-rail.tsx` — passed with no findings.
- `git diff --check` for both owned files — passed.

No tests, server or browser were run under the controller-owned verification boundary. Runtime
confirmation is still required for More-pages focus/return focus, active-extra promotion, closed
rail cards, desktop overflow, and the phone wrapping stream.

The 48px link floor means the app's individual hit boxes remain taller than the drawing's purely
visual 6px-padded row. Density is recovered by compact in-box paint and by moving non-core open-rail
routes to More pages, rather than weakening the interaction target.
