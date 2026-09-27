# F14 roster integration report r1

Scope: bounded roster/discovery update only. No tests, browser, server, provider, or Git mutation.

## Result

The current mockup directory contains 38 HTML files, of which 2 are superseded (`patient-search-console.html`, `patient-search-working.html`), leaving 36 current drawings. `PAIRS` now records 34 commissioned operational screens and 2 reference drawings (`design-system-third-edition.html` and `ward-flow-digest.html`). The 16 newly commissioned operational rows are contract=true and have null verification entries. Existing seven non-null verification records were preserved; the JSON now contains 34 rows and reports 7 looked at.

The new operational route mappings include `/network`, `/governance`, `/handover`, `/discharges`, `/out-of-area`, `/on-call`, `/alerts`, `/transport/officer`, `/legal-forms`, `/people/new`, `/referrals`, `/settings`, `/statistics`, `/statistics/service/[serviceId]`, sibling `/mockups/ward-flow-sign-in`, and `/ward/[unitId]/answer`. Component-folder labels use `officer` for transport, `../ward-flow-sign-in` for the sibling sign-in component, and `ward` for the shared Answer implementation.

`screen-map.mjs` now discovers the Ward Flow page tree plus the sibling sign-in `page.tsx` and Digest `route.ts` using explicit route-source roots. This avoids claiming either sibling is under the operational Ward Flow root. The generated map reports 38 mockups, 43 discovered routes, and 27 component folders; its two warning groups are the pre-existing undrawn-route and unreachable-component warnings. No hard map problem remains.

## Local checks

- `node scripts/ward-flow/screen-map.mjs` — generated map.
- `node scripts/ward-flow/screen-verification.mjs` — generated verification page, 7 of 34 looked at, 0 structural problems.
- `node scripts/ward-flow/screen-map.mjs --check` — current, no hard problems.
- `node scripts/ward-flow/screen-verification.mjs --check` — current, no structural problems.
- `git diff --check` on all five accepted roster/generated files — no whitespace error reported.

Before-copy directory: `C:\Users\joshs\AppData\Local\Temp\ward-f14-before-r1`.

Current hashes:

- `screen-pairs.mjs` `DB8C08411F092B583B7550A1541AA5F0FD0D9C13DACBA8EABF17A7ABF6FCF260`
- `screen-map.mjs` `A0B96302F1811A61DF689748FBC2A930CEF925DC8B7FD3426F8093D6F0C7B608`
- `screen-verification.json` `8357D1B42BFA5788E704657B77CD9E560F7C9A45C8DB3539E1870FE1DE27021C`
- `SCREEN-MAP.md` `124694AAA72C58505A6434694C15D4B11B85A3B71C83BC3F476A3DC09DEC50AE`
- `SCREEN-VERIFICATION.md` `1C7F5586183E790F99C5F793CD98346F45ECEB1242D74F4AB994B4E7A638F23D`

Visual verification remains pending for the 27 unlooked screens.
