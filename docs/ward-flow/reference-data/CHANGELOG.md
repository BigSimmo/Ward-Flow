# CHANGELOG

## 2026-09-17 — Phases 1–5 (efficient combined build)

- Seeded entities/capacity/catchments/sources/open_questions from Sep-17 prepared reference
- Phase 2: dual Graylands assertions; Bentley 50 / network 166 marked no_live_primary; E-CENSUS retired as primary
- Phase 3: ED tip gap notes (KEMH+PCH); Peel MH planned note
- Phase 4: WF-03..06 contest overlays
- Phase 5: distance stubs for public ED × metro site pairs (null km/min)
- Included Referring Forms phase1 feed pathways/forms/catchment docs as source_document_only
- Tip demo fixtures not modified

## 2026-09-17 — Decisions + distances fill

- Applied D1–D6 recommended decisions (`decisions.json`)
- Filled 186 OSRM road pairs in `distances.json`
- Tip fixtures still not mutated

## 2026-09-17 — DATA completion: decisions and OSRM distances

- Applied D1–D6 in `decisions.json` and `DECISIONS-APPLIED-2026-09-17.md`.
- Updated WF-03, WF-04, WF-06, WF-07, ED KEMH/PCH, E-CENSUS-404 and GEO-* open-question decision/status fields.
- Rebuilt `distances.json` with directed OSRM public road routes for the public ED × metro acute/Graylands/Bentley set and acute site-to-site pairs.
- Added `geocode_cache.json` and `DISTANCES-README.md`; no tip files or Phase 6 mutation performed.
- 2026-09-20: duals encoding pass — Graylands `best_published_capacity_summary` set to prefer_neither; all E-CENSUS-only capacity assertions marked `no_live_primary` (aligns Phase 2 claim; E-CENSUS URL 404).

## 2026-09-18 — Distance repair (468 verified pairs), provenance audit & runtime compilation (`BigSimmo/Ward-Flow`)

- Completed and repaired `distances.json` (`wa_site_distances_km.json`) to **468 verified directed site-pair entries** across 19 geocoded points (`outstanding: 0`, superseding the earlier 4 null stubs and 186-pair / 434-pair passes and resolving the 108-row `route_failures` array).
- Added `PROVENANCE-AUDIT-2026-09-18.md` auditing `sources.json` (111 records) and retiring `E-CENSUS` as a live primary after verifying soft HTTP 404.
- Added `scripts/ward-flow/build-reference-registry.mjs`, `scripts/ward-flow/build-reference-distances.mjs`, `scripts/ward-flow/build-reference-teams.mjs`, and `scripts/ward-flow/check-ward-reference.mjs` (`npm run ward:reference:build` / `npm run check:ward-reference`), compiling the reference JSON into `src/components/ward-management/reference/ward-reference-registry.ts`, `src/components/ward-management/reference/ward-reference-distances.ts`, and `src/components/ward-management/reference/ward-reference-teams.ts` (`src/lib/ward-flow/ward-reference-registry.ts` and `src/lib/ward-flow/ward-reference-distances.ts`), which are imported by the Ward Flow runtime (`src/components/ward-management/` / `src/lib/ward-flow/`).
- Updated `ward-sites.ts` (`src/components/ward-management/ward-sites.ts` / `src/lib/ward-flow/ward-sites.ts`) in `BigSimmo/Ward-Flow` to include **10 public EDs** (including specialist EDs `KEMH` and `PCH`) and **13 runtime inpatient units (266 operational beds)** vs **279 reference-pack beds** (which include the 13-bed `SCGH-MHOA` observation area; alongside the 22-unit synthetic standard network in `STANDARD_WARD_SITES`). All runtime bed numbers remain synthetic/sample and all pack approval flags remain `false`.
