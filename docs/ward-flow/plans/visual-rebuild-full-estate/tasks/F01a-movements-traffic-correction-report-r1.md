# F01a Movements traffic schematic correction report r1

Date: 2026-09-13  
Writer: Task `/root/hub_inventory`

## Scope

Owned files:

- modified `src/components/ward-management/movements/movements-screen.tsx`
- added `src/components/ward-management/movements/traffic-diagram.tsx`
- added `src/components/ward-management/movements/traffic-diagram.module.css`

`movements.module.css` remained outside this correction and was not edited. No derivation, model, reducer, provider, shared component, route, or test changed.

The actual before copy is stored at:

`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F01a-traffic/src/components/ward-management/movements/movements-screen.tsx`

The two new traffic files were recorded absent before implementation.

## Evidence viewed

The following rendered evidence was viewed at original detail before implementation:

- `movements-app-1440-light-r7.png`, SHA-256 `8A5D4A4173101311F60F43018DDB7CBE4CCB4B56157AC139C56149C5ED8A7674`
- `movements-mock-1440-light-r7.png`, SHA-256 `46345DFAA0108BB50F9A0D0726FF27CF28B330E6076B5908D7CB9C796B732D87`
- `movements-reference-390-light.png`, SHA-256 `999019EF9291A945BA196AB1493B477D66BFE3B56F5693F70FB432BFA6C91C17`

The app evidence showed one large From/To card pair for every stage-specific row. The drawing instead uses shared endpoint nodes around one coordination well, with connected orthogonal routes and a separate ranked register.

## Correction

- Replaced only the traffic panel's repeated-card rendering with the local `TrafficDiagram` presentation component.
- The component receives the already-derived and already-sorted `corridors` array unchanged. It does not filter, aggregate, widen, or reinterpret the population.
- Origin and destination nodes are deduplicated by their real identifiers for the picture only. Full labels still come from `edById` and `wardLabel`; unresolved identifiers retain an explicit absence sentence.
- Every original `(originEdId, acceptedUnitId, stage)` row still draws its own SVG path. Parallel stage rows between the same endpoints fan slightly rather than hiding each other.
- Paths are orthogonal through a shared coordination well. Stroke width is derived from the existing row's `count`.
- Every path contains a title naming its full endpoints, count, and real `stageCopy` label.
- The ranked register maps the original sorted array directly, preserving order and count. It now also shows each row's stage so none of the stage-specific information formerly printed on the repeated cards is lost.
- The existing empty-state and full refused-corridor explanation are retained.
- The wide diagram scrolls inside a named, keyboard-focusable region on narrow screens; endpoint names wrap rather than being shortened.
- Forced-colour and print rules preserve route visibility without status-by-colour semantics.

## Behaviour and content retained

- `corridorCounts(movements)` remains the sole source.
- Its exact open + accepted origin/unit/stage scope is unchanged.
- No completed-movement count, refused path, unused path, or fabricated endpoint was introduced.
- The Every movement / Resolved today controls, order controls, rows, links, drawer, transport panel, and all other Movements behavior are untouched.
- The existing ranked order remains count first, followed by its existing origin identifier tie-break.
- The drawing's different historical meaning of “carried” remains an explicit deviation; this build continues to show the working engine's open accepted load.

## Source verification

No tests, browser, server, build, or Git command was run; controller owns runtime verification.

- Prettier ran once over the three owned source files.
- TypeScript `transpileModule` parsing succeeded for `movements-screen.tsx` and `traffic-diagram.tsx`.
- PostCSS parsing succeeded for `traffic-diagram.module.css`.
- Every `styles.*` reference in the new component has a local CSS class.
- CSS Modules selectors are locally anchored; no bare attribute selector was added.

## Hashes

| File                         | Before SHA-256                                                     | After SHA-256                                                      |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `movements-screen.tsx`       | `D05E972BA8A4F7B91503DA42B60A6F82290584FD99F9E012BAB053A591D6E2FE` | `2E13851A3AE210B1C337EB1367C88CBB6E9666C079A4C39781AACF79145ACE81` |
| `traffic-diagram.tsx`        | absent                                                             | `55FE99D7287CB303560B774BA8EF30BED4238B10AD63B032333C48F0B992FEEA` |
| `traffic-diagram.module.css` | absent                                                             | `211F7F4C47C922B42F5C603F11450C3FF96E53A1607103ED8541C3AF630C766A` |

Current informational hash of the unedited, separately owned `movements.module.css`:
`3D2BA091FA8C6972BEF6C812F6916B48E7CC674205F8047CD553FC3F65B8D266`

This is a source-complete handoff, not a rendered acceptance claim.
