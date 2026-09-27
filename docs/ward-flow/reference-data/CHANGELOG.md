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
