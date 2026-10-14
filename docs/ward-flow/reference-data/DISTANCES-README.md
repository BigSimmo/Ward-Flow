# Distances — 2026-09-17, completed and repaired 2026-09-18

**Repository:** `BigSimmo/Ward-Flow` (`docs/ward-flow/reference-data/distances.json`, also referred to as `wa_site_distances_km.json`)  
**Method:** Nominatim geocode (AU) + OSRM public driving router  
**Filled:** **468 verified directed site-pair entries** (superseding the earlier 4 null stubs and 186-pair / 434-pair passes)  
**Geocoded points:** 19  
**Outstanding:** 0

## Caveats & runtime compilation

- Indicative OSM/OSRM road distance/time — **not** live traffic, peak, or clinical ETA
- ED pin = hospital campus
- Approvals remain **false** on every row (`operational_use_approved=false`, `automatic_routing_approved=false`)
- `scripts/ward-flow/build-reference-distances.mjs` (`npm run ward:reference:build`, checked by `npm run check:ward-reference`) compiles all **468 verified site-pair entries** into `src/components/ward-management/reference/ward-reference-distances.ts` (`src/lib/ward-flow/ward-reference-distances.ts`), which is imported by the Ward Flow runtime (`src/components/ward-management/` / `src/lib/ward-flow/`) alongside `ward-reference-registry.ts` (`scripts/ward-flow/build-reference-registry.mjs`)
- Regional home-region travel bands in `ward-travel-bands.ts` remain `TRAVEL_BANDS_ARE_INVENTED = true` because the 468 verified pairs are metropolitan-only
- Values are directional and routed each way separately, not mirrored, so small real
  asymmetries survive (Cockburn→RPH 22.98 km against RPH→Cockburn 23.39 km)

## Coverage

All public metro EDs in the register (10 public EDs in `ward-sites.ts`, including specialist EDs `KEMH`, `PCH`, and `Midland`) ↔ metro adult acute,
plus Graylands, Bentley, Fremantle, Mount Lawley and Cockburn; site↔site among acute. Private
Hollywood and SJOG Murdoch EDs included in the 12-ED reference register. Runtime `ward-sites.ts` (`src/components/ward-management/ward-sites.ts` / `src/lib/ward-flow/ward-sites.ts`) models **10 public EDs** and **13 runtime inpatient units (266 operational beds)** vs **279 reference-pack beds** (which include the 13-bed `SCGH-MHOA` observation area).

Cockburn has no emergency department (WF-20), so it appears only as a destination — there are
no `ed-cock__*` pairs and their absence is correct, not a gap.

## What changed on 18 September

The 17 Sept pass reported 434 filled pairs and a coverage line naming Bentley. The file also
carried a **108-row `route_failures` array** that no summary mentioned, which made the gap look
four times larger than it was and named the wrong sites. Resolved as follows:

| Rows | Cause                                                           | Resolution                                                                       |
| ---: | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
|   68 | `pair_id` had already been filled by a later pass               | removed — the file was reporting failures against pairs that hold a distance     |
|    6 | site id `bhs` for Bentley Health Service, geocoded as `bentley` | removed — an id alias; the routed distances were already present under `bentley` |
|    2 | campus ED routed to its own campus                              | filled 0/0, `router: same_campus`, matching the existing `ed-rph__rph` row       |
|   32 | Cockburn Health never geocoded                                  | geocoded and routed (owner approved, 18 Sept)                                    |

> ⚠️ **A qualified geocode query returning nothing is not evidence a place is absent.**
> Nominatim returned **zero** hits for "Cockburn Health, Cockburn Central, Western Australia",
> for "Cockburn Integrated Health Centre, Western Australia" and for "St John of God Cockburn
> Hospital, Western Australia". The bare **"Cockburn Health"** resolved immediately, to 11
> Wentworth Parade, Success 6164. Adding locality and state made the match worse, not better.
> Try the bare name before concluding a site cannot be geocoded.

> ⚠️ **`counts` is written by the fill pass and described only that pass.** Before this repair
> it read `failed_this_pass: 0` while `route_failures` held 108 rows — both true, and together
> they read as "nothing failed". `counts` now carries an explicit `outstanding` field so the
> standing gap cannot hide behind a per-pass zero again.

## Standing rules this does not change

Nothing here is ratified. `operational_use_approved` and `automatic_routing_approved` are
`false` on all 468 rows, D6 chose the method and not the approval, and Phase 7 is still open.
These values must not be used to route a patient automatically or presented as an arrival time.
