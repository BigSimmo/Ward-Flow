# Out-of-area and handover visual correction report r16

Date: 2026-09-13  
Writer: `/root/hub_inventory`

## Scope and evidence

Owned source was limited to:

- `src/components/ward-management/out-of-area/out-of-area-board.tsx`
- `src/components/ward-management/out-of-area/out-of-area-third-edition.module.css`
- `src/components/ward-management/handover/handover-third-edition.module.css`

I inspected, at original detail, every app/mock pair for both screens at 390, 820 and 1440 pixels in light and dark mode: all 12 `out-of-area-{app,mock}-{390,820,1440}-{light,dark}-r16.png` images and all 12 corresponding `handover-...-r16.png` images under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`.

These captures cover the initial viewport only. They do not prove below-fold journeys, keyboard focus movement, print output, or changed-state behavior. Runtime acceptance remains controller-owned.

## Before evidence

Byte-for-byte copies are under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-OOA-handover-r16/`, preserving repository-relative paths.

| File                                   | Before SHA-256                                                     |
| -------------------------------------- | ------------------------------------------------------------------ |
| `out-of-area-board.tsx`                | `69DD812987D1D7C20106D135702F9CC3E2BA175793F391F3D65C9C13A4626FBC` |
| `out-of-area-third-edition.module.css` | `72D12C1A3A2C533478E8BE4C5853C8812C934888F90A020749694F0B0CA447A3` |
| `handover-third-edition.module.css`    | `174BD2E75CA28D8F773BDE8779A5F9731EAD75CE294B0DAD66F52B1A3E2F6D0C` |

## Corrections

### Out of area

- Reused the existing complete, selectable card population as the on-screen register at every width. The canonical `WardTable` remains mounted with its existing test id and row/cell contract and is now reserved for print.
- Reordered each card around the drawing's hierarchy: unit first; actual health service and site from `siteByCode(entry.unit.siteCode)`; recorded home region and existing travel band; elapsed time aligned at the right on tablet/desktop and stacked only on phone.
- Kept ledger order, all 18 current entries, keyboard selection handlers, selected-placement detail, all five truthful group headings, absence explanations, governance text and provenance unchanged.
- Added a full-outline/fill selected state and a visible keyboard focus outline without introducing a priority edge stripe.
- Made the At-a-glance heading compact and explicitly scoped it to all services; reduced the existing two-part count statement from an oversized inset card while retaining every word and test id.
- Corrected the undefined `--t2` heading token to canonical `--t-2`.

The drawing's sample record count and names were not copied. The engine's current ledger remains authoritative, and no missing group population was inferred.

### Handover

- Scoped legacy clinical accent aliases to the canonical page `--accent`/`--on-accent`, correcting the sky-blue Print treatment in both themes without changing either print handler.
- Corrected `--t2` to canonical `--t-2` on the sheet heading.
- Applied canonical display/body/mono typography to the sheet heading, taken-at caption, scope label/control, section headings and side-panel explanatory copy.
- Limited the filled side-panel action treatment to the real Print panel. The sign-off secondary action keeps its distinct existing treatment and behavior.
- Preserved the live scope filter, exclusions, urgent-outside-filter disclosure, sign-off facts/actions, print content and all governance copy.

## Source checks

- Prettier formatted the three owned files once.
- TypeScript `transpileModule` parsed `out-of-area-board.tsx` with no diagnostics.
- PostCSS parsed both owned CSS modules successfully.
- A scan found no bare attribute selectors in either owned CSS module; all global selectors remain anchored to a local module class.
- No tests, browser session, server, or Git mutation was run, per controller assignment.

## After hashes

| File                                   | After SHA-256                                                      |
| -------------------------------------- | ------------------------------------------------------------------ |
| `out-of-area-board.tsx`                | `8ED9A3D32C16DBE9318936092EBB9B7E2F09C95C94716FA4BD37B9A80A3F5BFC` |
| `out-of-area-third-edition.module.css` | `4F6C1F3DFCD75E3B36248268C8AF2276807D4CB57544A55C29E4B61C070709AB` |
| `handover-third-edition.module.css`    | `6C6B83BA336DFB0DFA0F76EC52053774A581182F67437684D23D9AF526C7D613` |
