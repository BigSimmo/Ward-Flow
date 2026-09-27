# F09/F10 correction r7

Date: 2026-09-13  
Writer: `/root/hub_inventory`  
Plan: `2194350E1AD66ED47049CF7EAA115DB7789D8BEBAE18AB06C465559B253B4155`  
Scope: the page-local TSX/CSS pairs for Transport officer, On-call and contacts, Alerts, and Legal forms

## Result

The four screens now opt into the third-edition page frame through `wardShellTokens` and `data-ward-design="third-edition"`. Each root paints the canonical ground and bridges the legacy colour roles still consumed by its existing page elements or shared primitives. The obsolete page-local phone-bar-bar top reserve is gone; current in-flow shell chrome remains untouched.

Long governance copy no longer precedes the useful workspace on On-call, Alerts, or Legal forms. Each screen retains a short visible synthetic-data line and moves the complete explanation into a labelled native disclosure at the end of the relevant content. `usePrintableDisclosures` opens those `source-print` details before print and restores their previous state afterwards.

Alerts now presents existing live `InboxItem` records first in each role panel. The seven named watched/support conditions, measured-empty statements, triage source explanation, override limitation, and full handover-timing absence remain in reachable labelled details. The exact accessible region name **What this screen does not watch** is present inside the second disclosure.

Legal forms retains the authoritative group order—deadline records, then records without a deadline—along with the existing derivations, test IDs, movement IDs, counts, and absence sentences. Existing `WardRecordRow` nodes now render as inset cards, and their reason treatment is bounded within the card rather than spanning the whole panel width.

Transport actions, refusal persistence, selection, stage order, fixed phone action bar, and all reducer guards are unchanged. The page received only the rebuilt marker, token bridge, panel material adjustments, and removal of its obsolete top reserve.

## Deliberate deviations and dependencies

- The Transport officer screen keeps all four real selected-job stage actions and the persistent refusal surface. The drawing's simpler static treatment cannot replace working reducer behavior.
- On-call continues to provide no contact method and no dial action. No person or contact was invented to match drawing fixtures.
- Alerts retains engine-derived records, grouping, order, counts, exclusions, and measured absence. The drawings' example alerts were not copied.
- Legal forms keeps deadline and no-deadline records in separate groups; they are not globally urgency-sorted because the second group has no comparable deadline.
- Shared visible route labels were not edited. The parent owns the separate **Officer** → **Transport officer** and **On-call** → **On-call and contacts** shell-label correction.
- Runtime visual acceptance, interactions, dark mode, forced colours, print emulation, and responsive captures remain controller-owned.

## Before-source evidence

Exact byte copies were made before source edits under:

`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F09-F10-visual-r7/`

| File                                                                | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/officer/officer-screen.tsx`         | `510A9133CBBD3834076BABBCE9F7AD52156E8CC753F539168D8FF929A3CF07D4` | `B87977557BD8100C2D1B6C9823A289E10A150F7E63BE14AF96CDD6A1E22B6D25` |
| `src/components/ward-management/officer/officer.module.css`         | `B42FCAFD3621AEA62E87B9019027103C1D97D1AA4E251AD30E07018FE119147D` | `316347856B98BC61CBE01AA8E03A341B8DD5CF2FA28310418A245294090A55AB` |
| `src/components/ward-management/on-call/on-call-screen.tsx`         | `4E713F4D41A60B82C3764EAB5D5C309E1220565C1DC602A56561D04DEFBDB832` | `9085FB369B288FF9203A1B16ED010F6903AB593EB532179EADB80191E614648D` |
| `src/components/ward-management/on-call/on-call.module.css`         | `A6917EA7FD0DD277B47451F4A7F1407E1D3E55BD551F4DF0E9C4AFEC53FFCC2F` | `2D17E2298C7DA799060C60550264EA9F6D6FC29FBE179686803590B7C3F14EF7` |
| `src/components/ward-management/alerts/alerts-screen.tsx`           | `22CA628A77B52EDE2E8CB76C25D2F712377BD2827F19BB512A3655F63D64F6BA` | `85DBAFE6D8F498FDCFA24BF9C3B6000E618011E92B2F217977ED95B557E91456` |
| `src/components/ward-management/alerts/alerts.module.css`           | `A418A4A729368B6571D85F9A48FB6529951852AC0286A2FD63503D6CC288A5DD` | `B28556650370BBD01AEB72ABCD944EEFF73378A32BAB4AC0BACD8F1EAB75566B` |
| `src/components/ward-management/legal-forms/legal-forms-screen.tsx` | `D88DD4AA9E39915965235913DD7A3B1748510B8D9F6F35E7167ED6D01E1D6347` | `FAC8F97842A600D5A571435CEFC95DFB71024AFE74E67B6C63DA317412F4482D` |
| `src/components/ward-management/legal-forms/legal-forms.module.css` | `9FABEA4DCE5A3A538087F0E6A917300B1854C93560E527F0F72DD05FD583EF7A` | `C6D421BAA28D1DD1B8909F747ACFB11E314CBA51CCDF4548EB2CA7D337AAEB22` |

## Source checks

- Prettier wrote the eight owned files once, then a second pass reported all eight unchanged.
- TypeScript `createSourceFile(..., ScriptKind.TSX)` reported `TSX_PARSE_OK` for all four TSX files.
- PostCSS with Next's installed `postcss-modules-local-by-default` plugin in `mode: "pure"` reported `CSS_MODULE_PURE_OK` for all four CSS Modules.
- A focused static source assertion confirmed all four third-edition markers and token compositions, absence of the former page-local phone reserve, the Alerts disclosure/limitation/handover strings, both Legal forms groups and test IDs, and the On-call contact-refusal text.
- The first purity-check attempt addressed a non-exported `next/dist/compiled/postcss` path and exited before reading any source. The corrected command used the installed top-level `postcss` package with Next's installed purity plugin and passed as reported above.

No tests, browser checks, server actions, Git operations, or shared-shell edits were performed, as required by the assignment.
