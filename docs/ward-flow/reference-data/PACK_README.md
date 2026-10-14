# Ward Flow reference pack (Phases 1–6)

**Original pack build:** 2026-09-17 (historical snapshot `f10ca39fbdb4f2903eeb87bf067946a6353dd9f3`; provenance & distance repair 2026-09-18)  
**Repository:** `BigSimmo/Ward-Flow` (`docs/ward-flow/reference-data/`)  
**Approvals:** all `operational_use_approved=false`, `automatic_routing_approved=false`

## Standing rules

1. Graylands 109 and 122 dual HIGH — prefer neither
2. Tip synthetic beds never reconciled to public totals
3. Null ≠ zero; chairs ≠ beds; aggregates ≠ wards
4. Contested catchments → no auto-route
5. E-CENSUS dead URL (`HTTP 404`) retired as primary (`no_live_primary`)

## Phase status

|                  Phase | Status                                                                                                                                           |
| ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
|             1 Scaffold | DONE                                                                                                                                             |
| 2 Capacity duals/purge | DONE                                                                                                                                             |
|          3 ED/facility | DONE                                                                                                                                             |
|   4 Catchment contests | DONE                                                                                                                                             |
|            5 Distances | DONE — **468 verified directed site-pair entries** across 19 geocoded points in `distances.json` (`wa_site_distances_km.json`), `outstanding: 0` |
|          6 Tip overlay | DONE (names, EDs, metropolitan distances & published team contacts compiled; bed counts remain synthetic/sample)                                 |
|   7 Owner ratification | NOT STARTED (`operational_use_approved=false`, `automatic_routing_approved=false`)                                                               |

## Runtime compilation & fixture boundary

- **Reference code generators (`npm run ward:reference:build`, drift-checked by `npm run check:ward-reference`):**
  - `scripts/ward-flow/build-reference-registry.mjs` compiles `entities.json` into `src/components/ward-management/reference/ward-reference-registry.ts` (`src/lib/ward-flow/ward-reference-registry.ts`) with **zero numeric capacity fields**.
  - `scripts/ward-flow/build-reference-distances.mjs` compiles the **468 verified site-pair entries** in `distances.json` (`wa_site_distances_km.json`) into `src/components/ward-management/reference/ward-reference-distances.ts` (`src/lib/ward-flow/ward-reference-distances.ts`).
  - `scripts/ward-flow/build-reference-teams.mjs` compiles published community-service contact details from `entities.json` into `src/components/ward-management/reference/ward-reference-teams.ts`.
- **Runtime imports & site/unit counts:**
  - The generated modules are imported by the Ward Flow runtime (`src/components/ward-management/` / `src/lib/ward-flow/`).
  - `ward-sites.ts` (`src/components/ward-management/ward-sites.ts` / `src/lib/ward-flow/ward-sites.ts`) includes **10 public EDs** (including specialist EDs `KEMH` and `PCH`) and **13 runtime inpatient units (266 operational beds)** vs **279 reference-pack beds** (which include the 13-bed `SCGH-MHOA` observation area; alongside the 22-unit standard synthetic network in `STANDARD_WARD_SITES`).
  - All runtime bed counts remain synthetic/sample figures, and regional travel bands in `ward-travel-bands.ts` retain `TRAVEL_BANDS_ARE_INVENTED = true`.
