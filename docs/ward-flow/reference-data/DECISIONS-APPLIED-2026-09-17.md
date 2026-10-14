# Decisions Applied — 2026-09-17

> [!NOTE]
> **Current Status (`BigSimmo/Ward-Flow`):** This file preserves the dated 17 September 2026 decision log. Since this record was written:
>
> - **Phase 5 distances (`D6`, `distances.json` / `wa_site_distances_km.json`):** Completed on 2026-09-18 with **468 verified directed site-pair entries** across 19 geocoded points (`outstanding: 0`).
> - **Phase 6 reference compilation (`D5`):** `scripts/ward-flow/build-reference-registry.mjs` and `scripts/ward-flow/build-reference-distances.mjs` (plus `scripts/ward-flow/build-reference-teams.mjs`) compile the reference JSON into `src/components/ward-management/reference/ward-reference-registry.ts` and `src/components/ward-management/reference/ward-reference-distances.ts` (`src/lib/ward-flow/ward-reference-registry.ts` and `src/lib/ward-flow/ward-reference-distances.ts`), which are imported by the Ward Flow runtime (`src/components/ward-management/` / `src/lib/ward-flow/`). `ward-sites.ts` (`src/components/ward-management/ward-sites.ts` / `src/lib/ward-flow/ward-sites.ts`) now includes **10 public EDs** (including specialist EDs `KEMH` and `PCH`) and **13 runtime inpatient units (266 operational beds)** vs **279 reference-pack beds** (which include the 13-bed `SCGH-MHOA` observation area). Runtime bed numbers remain synthetic/sample, and `operational_use_approved=false` and `automatic_routing_approved=false` remain in force across the pack.

These calls are locked into the reference pack for Joshua's Ward Flow DATA review. The pack remains preparation-only: `operational_use_approved=false` and `automatic_routing_approved=false` throughout. No unratified bed count is imported into runtime.

| ID  | Applied recommendation                                                                                                                  | Status                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| D1  | **Graylands (WF-07): `prefer_neither`** — keep dual 109 and 122; never use a single number for routing.                                 | Awaiting HSP ratification                                  |
| D2  | **Lynwood CAMHS (WF-03): `contested_manual_only`** — PDF→Swan versus Fremantle page remains contested; manual review only.              | Awaiting HSP ratification                                  |
| D3  | **Butler/Wanneroo (WF-04): `clinics_verified_no_auto_split`** — clinics verified, unpublished suburb split not automated.               | Awaiting HSP ratification                                  |
| D4  | **Armadale/Orchard (WF-06): `tip_names_demo_ok`** — live contact Orchard Ave **9398 6600**; ATT phone **9391 2400** until HSP confirms. | Awaiting HSP ratification                                  |
| D5  | **Overlay scope: `pack_side_by_side` + name/distance/ED compilation** — bed numbers stay synthetic; generated modules carry no beds.    | Names, 10 EDs & 468 distances compiled; beds remain sample |
| D6  | **Distance method: OSRM public road routing** on OpenStreetMap for metro ED↔acute pairs, stamped with source and retrieval date.        | Applied (468 verified pairs); still non-operational        |
