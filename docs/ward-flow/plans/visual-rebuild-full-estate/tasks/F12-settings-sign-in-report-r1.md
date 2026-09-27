# F12 Settings and Sign in implementation report r1

Date: 2026-09-13  
Writer: Task `/root/hub_inventory`  
Frozen plan SHA-256: `2194350E1AD66ED47049CF7EAA115DB7789D8BEBAE18AB06C465559B253B4155`

## Scope

The bounded implementation owned only:

- `src/components/ward-management/settings/settings-screen.tsx`
- `src/components/ward-management/settings/settings.module.css`
- `src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx`
- `src/components/ward-flow-sign-in/ward-flow-sign-in-screen.module.css`

No route, engine, provider, shell, primitive, data, test, credential, session, permission, or authentication implementation was changed.

Before-source copies preserving the repository-relative paths are under:

`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F12/`

## Design evidence read

The authoritative served drawings were viewed at original detail before the design edits:

| Route    | 1440 reference SHA-256                                             | 390 reference SHA-256                                              |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Settings | `8A858729AF997B8B21EDB56F20045B1DA161555EE87DD1D6AB12354803BCA962` | `33DFE9C6DD63C80F48352499158670EDEFAE69CAE7466B79604B142FC8DFFF91` |
| Sign in  | `CE0B04E7FDAF215D956E8EBD6AC36BD0EC7F1D21232E864461D45EB4249D5289` | `C985064E2E4F6C417586ABAC111F17F31E17F9A67E08CF466DF1E3BBD1949667` |

The source drawings `settings-third-edition.html` and `sign-in-third-edition.html`, the active Ward Flow README, and the installed Next.js CSS Modules guide were also read.

## Implementation

### Settings

- Opted the screen into the canonical `data-ward-design="third-edition"` frame and shell token carrier so the existing shared `WardPanel` instances render with the commissioned surface, strip, edge, type, and ground roles.
- Kept the local `h1` available to assistive technology while removing the duplicate visible title/prototype block already carried by the shared bar.
- Aligned the six existing sections to the drawing's stacked full-width panel order: Appearance, The rail, Default service, handover print facts, Thresholds, and Demonstration controls.
- Preserved the real shared appearance applier/store and real shared rail writer/store. No duplicate storage key or writer was introduced.
- Kept Default service as a truthful readout with no invented persistence.
- Kept the live, engine-derived threshold rows and canonical Ward table. Added a named, keyboard-focusable horizontal region so the full table remains reachable at narrow widths rather than widening or clipping the page.
- Preserved the complete handover and demonstration-control explanations and existing Handover link.
- Added page-scoped phone, forced-colour, focus, and print rules.

### Sign in

- Retained the deliberate sidebar-free route and reshaped its existing markup into the drawing's 44rem standalone document: masthead, flat divided sections, one-column role cards, verdict/action rows, Go in section, and appearance foot.
- Preserved all seven roles, thirteen actions, four universal refusals, explanatory paragraphs, derived counts, and the reconciliation result.
- Preserved the exact local state and handlers. Role selection still changes only the local choice and live announcement. Go in still announces the proposed destination and does not navigate, create a session, call a provider, collect credentials, or change permissions.
- Kept the real app theme control and its browser-local behavior.
- Added drawing-aligned narrow geometry, focus states, forced-colour treatment, and a print reset. The action and appearance controls retain a 3rem target.
- `ward-flow-sign-in-screen.tsx` received formatting only; its behavior and rendered content were not edited.

## Deliberate deviations

- Settings continues to use the working engine's current threshold columns and rows rather than the drawing's retired illustrative threshold content.
- Settings keeps the engine-authoritative handover section wording and omits a hand-authored section count, preventing a second source of truth.
- The Settings title remains a visually hidden semantic `h1` because the shared bar's visible route title is not a heading.
- Sign in continues to use the app's real theme hook rather than the drawing's standalone storage script.
- No credential field, real authentication, role persistence, permission gate, or role-home navigation was added.
- This report makes no rendered-app acceptance claim; controller-owned browser inspection remains required.

## Source checks

No tests, browser session, server, build, or Git operation was run, per task boundary.

- Prettier ran once over the four claimed files.
- TypeScript `transpileModule` source parsing: both TSX files parsed with no diagnostics.
- PostCSS source parsing: both CSS Modules parsed successfully.
- CSS class-reference check: every `styles.*` reference in each TSX file has a local class.
- CSS Modules purity inspection: selectors remain locally anchored; no bare attribute selector was introduced.

## Hashes

| File                                  | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `settings-screen.tsx`                 | `547581CB52528642BFB14DF1DF7638AF3798999AF8DD5046E2CB01ECE63F09A2` | `C963A7F2CC96752C73EB566BC63E8D50CEAFF23F7ED8E0967F2560B7187CE15E` |
| `settings.module.css`                 | `4A88A8CAFE3548C2426D44BB6C526D6AE508FB83F359EAB8B2641A73838B1B10` | `135F5EF1E88CD04208B96C309E5829C96735AC798B3B8CC703D2F64F3E8718D2` |
| `ward-flow-sign-in-screen.tsx`        | `40A9C5C650EAD047F01CA276DFF688BD01BF831D853F2CAA20F23BED23C58A4F` | `D52A8309C438E1AF0864DEEF5CC82DE940B7078FCA09A54960377681E2084EA9` |
| `ward-flow-sign-in-screen.module.css` | `295DF665FA51ACC7FA1E69C304B5A26C2A2A005D4ABACBF9AACAEABECEE34210` | `BE2DF6F2D4464EA52BF8C48C996324BFD28461E8827E16AF8871DBA8A886C604` |
