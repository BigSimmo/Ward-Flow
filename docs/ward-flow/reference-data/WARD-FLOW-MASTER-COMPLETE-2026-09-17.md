# Ward Flow — Master Complete Document

**Edition:** 2026-09-17  
**Project:** Ward Journey / Ward Flow  
**Tip:** `f10ca39fbdb4f2903eeb87bf067946a6353dd9f3`  
**Tree:** `D:\\Worktrees\\Database\\ward-lead`  
**UI (local only):** `http://localhost:3606`  
**Constraint:** never merge / never auto-merge Database PRs; tip seeds not mutated in Phases 1–5

This is the single thorough roll-up of (1) local product audit, (2) data perfection Phases 1–5, (3) live fact-checks, (4) OneDrive Referring/Forms reconciliation, (5) open questions + owner decision packet, (6) file index.

---

## 0. How long / what this finishes

| Workstream                                       | Status               | Remaining time if you authorise next       |
| ------------------------------------------------ | -------------------- | ------------------------------------------ |
| Local product audit (logic/visual/tablet/safety) | **DONE**             | Fixes = separate eng work                  |
| Data Phases 1–4 reference pack                   | **DONE**             | —                                          |
| Phase 5 distance schema + null stubs             | **DONE**             | Filling real km/min = hours of sourcing    |
| OneDrive Referring/Forms inventory + matrix      | **DONE**             | —                                          |
| **This master document**                         | **DONE (this file)** | —                                          |
| Phase 6 tip overlay                              | **GATED**            | After Phase 7 decisions + your explicit OK |
| Phase 7 owner ratification                       | **GATED**            | Needs your choices on contests below       |

**ETA for this document:** completed in this session.  
**ETA for Phase 6/7:** blocked on your decisions (Graylands, Lynwood, Butler/Wanneroo, Armadale Orchard, tip overlay scope).  
**ETA for distance fill:** not started (stubs only); do after ratification.

---

## 1. Executive summary

### Product (local tip)

- **Verdict:** `GO_WITH_CAVEATS` for continued local prototype work; **`NO_GO`** for external clinical / statutory demo until P0 chrome is stripped.
- **E2e:** 95 passed / 2 skipped on tip.
- **Top blockers:** Statutory/MHA/Form 4A product chrome (P0); ED board horizontal overflow (P1); unbounded `CONFIRM_CAPACITY` (P1); STEP_BACK hold UX (P1); WLQ-4 revoked gap (P1).

### Data

- Tip fixtures (`ward-sites.ts`, `ward-teams.ts`, `ward-travel-bands.ts`) remain **explicitly synthetic / invented** — correctly separate from the verified **reference pack**.
- Reference pack Phases 1–5 written to Documents + `docs/ward-flow/reference-data/` with **all** `operational_use_approved=false` and `automatic_routing_approved=false`.
- Live conflicts reconfirmed: Graylands **109 and 122** dual; Lynwood CAMHS contested; Butler/Wanneroo split unpublished; Armadale tip/OneDrive vs live Orchard Ave; E-CENSUS dead URL retired as primary.

### Standing rules (do not break)

1. Prefer **neither** Graylands 109 nor 122 until NMHS ward-level staffed census.
2. Contested catchments → **no auto-route**.
3. Null ≠ zero; chairs ≠ beds; aggregates ≠ wards.
4. Never import `staffed_beds` into tip without Phase 6 + approval flags.
5. Never merge Database PRs without Joshua naming the PR.

---

## 2. Product audit — severity roll-up

_Canonical detailed audit:_ `C:\\Users\\joshs\\Documents\\WARD-FLOW-CONSOLIDATED-AUDIT-2026-09-17.md`

### P0 — clinical-trust / demo blockers

1. **Statutory / MHA / Legal-deadline chrome** on alerts, legal-forms, hub Act claims, capacity Act column.
2. **Form 4A countdown** on Transport/Movements (`movements-screen.tsx`) + Form 1A naming on Officer.

### P1 — serious

| ID                | Issue                                                          | Fix direction                                  |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| WF-P1-ED          | ED boards horizontal overflow (peel-ed, rph-ed) desktop+tablet | Constrain board to viewport / internal scroll  |
| WF-P1-02          | `CONFIRM_CAPACITY` unbounded write                             | Clamp/refuse in reducer                        |
| WF-P1-03          | STEP_BACK holds bed by design                                  | Clear RELEASE_PULL UX; forbid ambiguous unwind |
| WF-P1-WLQ4        | Revoked exam: EN_ROUTE/ARRIVED not blocked                     | Guard while revoked awaiting release           |
| WF-P1-seed        | pulled-admissions `it.fails`                                   | Implement or retire fixture 5b                 |
| WF-P1-unreachable | `RECORD_NO_REFERRAL`, `RECORD_TRANSPORT_NEED`                  | UI or allowlist                                |
| WF-P1-tablet      | Raise referral / intake submit / community card                | Tablet journey fixes                           |

### Intentional / mitigated (not defects)

- **D14** ACCEPT_REFERRAL does not create Movement (by design).
- **FD-23** referred-ward leakage mitigated (coordinator-only).
- `/morning` retired; bare `/officer` wrong path; `/transport`→Movements, `/queue`→Delays intentional.

### Suggested product fix order

1. Strip/rename Statutory/MHA/Form 4A/Form 1A chrome
2. ED overflow
3. CONFIRM_CAPACITY clamp
4. STEP_BACK / RELEASE_PULL UX
5. WLQ-4 guards
6. Tablet friction + seed `it.fails`

---

## 3. Data perfection — phase status

| Phase | Name                                                                  | Status                         |
| ----: | --------------------------------------------------------------------- | ------------------------------ |
|     1 | Scaffold from handover + live stamps                                  | **DONE**                       |
|     2 | Capacity duals / purge (Graylands, Bentley 50, network 166, E-CENSUS) | **DONE**                       |
|     3 | ED/facility completion notes (KEMH+PCH tip gap; private flags)        | **DONE**                       |
|     4 | Catchment contests WF-03..06 encoded in open questions / pack         | **DONE**                       |
|     5 | Distance schema + null stubs                                          | **DONE** (no invented km)      |
|     6 | Tip fixture overlay                                                   | **NOT STARTED — Joshua-gated** |
|     7 | Owner ratification + flip approval flags                              | **NOT STARTED — Joshua-gated** |

---

## 4. Reference pack inventory

**Locations (identical):**

- `C:\\Users\\joshs\\Documents\\ward-flow-data-review\\reference-pack\\`
- `D:\\Worktrees\\Database\\ward-lead\\docs\\ward-flow\\reference-data\\`

| File                        | Role                                      |
| --------------------------- | ----------------------------------------- |
| `PACK_README.md`            | Standing rules + phase coverage           |
| `PHASE_STATUS.md`           | One-line status                           |
| `entities.json`             | Facilities / EDs / wards / teams register |
| `capacity_assertions.json`  | Published bed claims + duals              |
| `catchment_assertions.json` | Suburb/postcode → service assertions      |
| `distances.json`            | Schema + null stubs                       |
| `sources.json`              | Source register                           |
| `open_questions.json`       | Contests + verification queue             |
| `INGEST_MAP.md`             | Tip file → pack table map                 |
| `CHANGELOG.md`              | Build log                                 |
| `pack_manifest.json`        | Hashes / counts                           |

### Counts (pack on disk)

| Metric               |                                                         Count |
| -------------------- | ------------------------------------------------------------: |
| Entities             |                                                           288 |
| Entity types (raw)   | 3 kinds — unknown:260, hospital:27, rehabilitation_facility:1 |
| Capacity assertions  |                                                            65 |
| Catchment assertions |                                                           955 |
| Distance stubs       |                                                             4 |
| Sources              |                                                           111 |
| Open questions       |                                    52 (P0=18, P1=12, High=22) |

### Graylands dual (pack)

- `gray51`: published=51 status=noted note=
- `gray58`: published=58 status=noted note=
- `gray109`: published=109 status=noted note=
- `gray122`: published=122 status=noted note=

---

## 5. Owner decision packet (Phase 7 — required before Phase 6)

Answer these; until then tip stays synthetic and routing stays non-automatic.

### D1. Graylands capacity (WF-07)

- **Options:** (a) hold dual / prefer neither · (b) temporarily display 109 with dual footnote · (c) temporarily display 122 with dual footnote · (d) wait for NMHS ward-level staffed census
- **Recommendation:** **(a)/(d)** — do not pick a single number for product routing.

### D2. Lynwood CAMHS (WF-03)

- **Conflict:** CAHS postcode PDF (12 Nov 2025): Lynwood 6147 → Midland/Swan; Fremantle clinic webpage lists Lynwood; Swan page omits.
- **Options:** follow PDF · follow Fremantle page · mark contested / manual only
- **Recommendation:** **contested / manual only** until CAHS confirms.

### D3. Butler / Wanneroo (WF-04)

- Both clinics verified; suburb split **unpublished** (Oct 2023 Joondalup-area list).
- **Recommendation:** keep clinics; **no auto-split**; shared referral pathway until NMHS publishes grain.

### D4. Armadale / Orchard (WF-06 / GEO-MEAD-EUDORIA)

- Tip Mead ATT / Eudoria CTT **aligned** to OneDrive Armadale CTT Guidelines; **contested** vs live Orchard Avenue (9398 6600). ATT manual phone 9391 2400.
- **Recommendation:** tip names OK as demo; live contact = Orchard until HSP confirms rename.

### D5. Tip overlay scope (Phase 6)

- **Options:** (a) leave tip synthetic, pack side-by-side · (b) replace only ED list (add KEMH+PCH) · (c) replace teams vocabulary · (d) full beds+teams+distances after approvals true
- **Recommendation:** start **(a)** then **(b)** only; beds last.

### D6. Distance matrix (Phase 5 fill)

- Stubs exist with `distance_km`/`duration_min` null.
- **Recommendation:** source from a single approved method (e.g. Google Distance Matrix / Main Roads) after D1–D5; flip `TRAVEL_BANDS_ARE_INVENTED` only then.

---

## 6. Open questions — P0

| ID                  | Subject                                        | Finding (short)                                                                                                                                    |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| WF-01               | Synthetic production substitution              | Ward Flow's bed and designation fixtures are invented; held field is inert.                                                                        |
| WF-02               | Team vocabulary is not an active registry      | Picker is derived from 2015 rows, 71 strings normalised to 65 names. Ten separate region-team entries are explicitly synthetic.                    |
| WF-03               | Lynwood child catchment conflict               | 2025 CAHS schedule lists Swan; 2026 Fremantle page lists Fremantle.                                                                                |
| WF-04               | Butler / Wanneroo split                        | Current directory has both clinics. Oct 2023 catchment table provides a single broad Wanneroo/Joondalup area.                                      |
| WF-05               | FSFHG three geographic CTTs                    | Fremantle, Cockburn and Melville CTTs share a broad published Fremantle area; individual boundaries not found.                                     |
| WF-06               | Armadale adult and older boundaries            | LGA-level service description found, but complete current approved adult suburb schedule not established.                                          |
| WF-07               | Graylands capacity disagreement                | Aug 2026 page: 109 = 51 acute + 58 extended. Mar 2026 inpatient page: 122 = 53 + 69.                                                               |
| WF-08               | SCGH denominator disagreement                  | 30 inpatient + 8 observation in one page; 36 aggregate on another.                                                                                 |
| WF-09               | Fremantle staged opening                       | 104 is post-expansion facility capacity. Ten Boodalung beds confirmed open. All 40 expansion beds not independently confirmed operational.         |
| WF-10               | Cockburn reconfiguration                       | 75 building beds is not a reliable current acute MH total after a ward's care-awaiting-placement conversion.                                       |
| WF-11               | PCH / Nickoll duplication                      | One 20-bed CAHS service across two sites. Historical 8/12 split not a second 12-bed service.                                                       |
| WF-19               | Host campus versus clinical operator           | Nickoll is CAHS at Hollywood; Mt Lawley changes to EMHS from Sep 1; JHC and Midland public care are privately operated.                            |
| WF-20               | ED hours and false ED records                  | Murdoch changes to 08:00–22:00 from Sep 1. Cockburn explicitly has no emergency service. Future SJOG Subiaco ED opening not established.           |
| WF-23               | No live availability or legal designation feed | Public website counts cannot establish beds open now, staffing, allocation, transfer acceptance, sex configuration or current legal authorisation. |
| WF-ED-KEMH-PCH      | Tip missing public EDs KEMH and PCH            | WA Health ED dashboard 2026-09-17 lists KEMH + PCH; tip demo has 8 EDs without them. Register also has private Hollywood + SJOG Murdoch.           |
| E-CENSUS-404        | E-CENSUS primary URL undercut                  | EMHS capacity chain primary URL returned 404 / retired as of 2026-09-17. Do not use as live primary.                                               |
| GEO-BUTLER-WANNEROO | Butler/Wanneroo tip over-collapse              | Tip over-collapses; public split contested WF-04.                                                                                                  |
| GEO-ALMA-CTT        | Alma Street CTT-grain overclaim                | FSFHG three CTTs lack published individual boundaries WF-05.                                                                                       |

## 7. Open questions — P1

| ID               | Subject                                        | Finding (short)                                                                                                                             |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| WF-12            | Bentley individual wards                       | Aug 2026 profile supplies 50 adult, 26 older, 12 EMyU. Full current ward-level breakdown not found.                                         |
| WF-13            | Armadale HDU double-counting                   | 33 adult beds explicitly includes high-dependency beds. Moodjar/Karri/Yorgum split not established.                                         |
| WF-14            | Joondalup omitted / 102 physical capacity      | Repo treats Joondalup as ED feeder. Current provider describes 102-bed mental health facility.                                              |
| WF-15            | Fiona Stanley adult count                      | Youth 14 and MBU 8 verified. Adult-unit current number not independently established.                                                       |
| WF-16            | Rockingham older published numbers             | 30-bed configuration is supported by a 2010 official opening source; not a current operational bed list.                                    |
| WF-17            | Older-adult geography and NMHS 56 total        | Older community service existence established, but separate approved catchments and Selby/Osborne individual ward capacities not all found. |
| WF-18            | Private ward-level census                      | Perth Clinic 100, Marian 69, Abbotsford 77 published aggregate. Hollywood 101 comes from 2020 opening.                                      |
| WF-21            | Raw locality spelling / partial suburbs        | Examples Nirinba, North Dandelup, Wannunup, Willeton, Warnboro, Pinjarra/Carcoola and split Keralup.                                        |
| WF-22            | CAMHS contact and postcode conflicts           | Fremantle phone changed between schedule and clinic page. Bibra Lake 6163 versus 6153; current geographic clinic index has nine sites.      |
| WF-24            | Research scope is not whole-state completeness | This package is Perth metro plus Peel and selected statewide interfaces. It is not every regional team, NGO program or every private ward.  |
| GEO-MEAD-EUDORIA | Mead/Eudoria stale vs Orchard                  | Verify Orchard as current before ingest.                                                                                                    |
| GEO-NO-CAMHS     | No CAMHS in tip                                | Register holds CAMHS clinics; tip has none — expected demo gap.                                                                             |

## 8. Open questions — High / prep

| ID      | Subject                                                  | Finding (short)                                                                                                                                                  |
| ------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WF-25   | Stirling parent versus clinic identity                   | Stirling is a supported umbrella; existing five-clinic list omitted the parent. Exact local identifier behind user term Stirling CMHT is unresolved.             |
| WF-26   | Mixed service hierarchy counted as teams                 | Geographic areas, physical clinics, cohorts, ATT/CTT functions and specialist programmes must not be flattened into a misleading team count.                     |
| WF-27   | Child community versus inpatient age thresholds          | Community CAMHS under 18 is not PCH inpatient under 16; Nickoll selected 14–15.                                                                                  |
| WF-28   | Older-adult threshold is service-specific                | City older adult publishes 45 for Aboriginal/Torres Strait Islander people; FOAMHS 55 plus self-identification. No universal Aboriginal threshold.               |
| WF-29   | Postcode field contradictions                            | Bibra Lake 6163 vs 6153; Kenwick 6107 vs 6108; Thornlie 6108 vs 6107 between schedule and clinic pages.                                                          |
| WF-30   | ED live-labelled source stale                            | Fetched official ED page carried 11 August 2026 02:15 data during September review.                                                                              |
| WF-31   | Fremantle MHCC versus ATT transition                     | V Block newer MHCC page versus W Block older ATT 08–20 page; project 24/7 promise does not settle current actual hours.                                          |
| WF-32   | Joondalup design versus operation                        | Architect supplies 102-room breakdown with swing capacity, not current operational ward IDs or staffed allocation.                                               |
| WF-33   | Older-adult source acquisition gap                       | 112 undated NMHS older-adult locality rows now text-extracted. Effective-date confirmation, fresh visual table verification and operational ratification rema... |
| WF-34   | No fresh PDF visual validation                           | New screenshot attempts failed. Parsed text and inherited structured rows were checked, but layout-sensitive completeness still needs page-image validation.     |
| WF-35   | Public-source contact and page mirrors                   | A recently crawled mirror can contain older contacts than another official page. Contacts are not call-tested and review status must be field-specific.          |
| WF-36   | OCP authorisation reference outdated for operational use | PriorOctober 2025 legal register is not a currentSeptember 2026 authorisation attestation. Lock status is not legal authority.                                   |
| PREP-01 | Undated older-adult schedule                             | 112 rows extracted, but publication/effective date absent and screenshot failed.                                                                                 |
| PREP-02 | SCGH observation denominator                             | Specific page 6 beds+2 chairs differs from broader page 8 beds.                                                                                                  |
| PREP-03 | Selby historical32 not independently current-confirmed   | 2024 annual report could not be reacquired; combined 56 does not itself prove current split.                                                                     |
| PREP-04 | Geraldton commissioning transition                       | Project and August transition evidence does not prove completed September opening or bed counts.                                                                 |
| PREP-05 | Bunbury acute versus observation                         | 6-bedroom MHOA is supported. Current APU count and planned 37 not established.                                                                                   |
| PREP-06 | Fremantle project versus operating capacity              | 104 and some component claims retained from earlier sources; no full current commissioning schedule.                                                             |
| PREP-07 | Published contact subteams                               | Fremantle CAMHS 1/2 extensions do not establish independently defined CMHTs.                                                                                     |
| PREP-08 | Regional completeness                                    | Five regional sites recorded. This is not proof that Wheatbelt/Pilbara lack other designated arrangements.                                                       |
| PREP-09 | Timestamp and source-cache discrepancies                 | OCP publication/search dates disagree; recently crawled pages can still be old.                                                                                  |
| PREP-10 | Team-name expansions and hours                           | Active/Assertive ART, Clinical/Community MCOT and Bentley ATT closing times differ between sources.                                                              |

---

## 9. Low-confidence / gaps (living)

# Low-confidence / missing / contested — interim (2026-09-17)

Living list while bots finish. **Do not ingest as truth.**

## A. Confirmed tip vs research layer

| Layer                                           | Status                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| Tip `ward-sites.ts` beds / locked splits / held | **Invented demo**; held inert; owner-marked replaceable                     |
| Tip `ward-teams.ts`                             | **Synthetic** region team names                                             |
| Tip `ward-travel-bands.ts`                      | `TRAVEL_BANDS_ARE_INVENTED=true`                                            |
| Tip admissions/patients seeds                   | Demo journeys                                                               |
| Handover prepared register (17 Sep)             | Research master; **not** operationally approved; packaging did not re-crawl |

## B. Live conflicts re-observed today

1. **Graylands beds (WF-07)** — HIGH conflict
   - 109 = 51 acute + 58 extended (NMHS Graylands pages; one marked Last Updated 24/06/2026)
   - 122 = 53 acute + 69 HECS (NMHS Inpatient Adult MH; Last Updated 10/03/2026)
   - Future forensic expansion announced Apr 2026 — not current census  
     → Need ward-level operating/staffed split from NMHS.

2. **Lynwood CAMHS (WF-03)** — MEDIUM, leaning Fremantle
   - Fremantle CAMHS suburb list includes Lynwood 6147 (updated 10/12/2025)
   - Historical Swan schedule may still conflict; need official postcode PDF + Swan page cross-check
   - PDF lead: CAHS catchment-by-postcode + older map PDF (2019 profiling — treat as HISTORICAL).

3. **Butler vs Wanneroo (WF-04)** — HIGH open
   - NMHS clinics page lists **both** Butler and Wanneroo clinics (page updated 14/02/2025)
   - Adult catchment PDF still “updated October 2023” with broad Joondalup/Wanneroo list under Wanneroo CMH — **no Butler-only suburb schedule found yet**  
     → Need current suburb/address split + exception pathways.

## C. Structural gaps for Ward Flow processes

Missing or incomplete for robust ingest:

- Official **road_km / drive_min** matrix (tip has only invented travel bands)
- Complete **statewide** regional psych units (handover scope = metro + selected regional only)
- Ward-by-ward **staffed vs commissioned vs physical** for every named unit
- Private facility bed claims (marketing vs authorised)
- FSFHG CTT boundaries Fremantle/Cockburn/Melville (WF-05)
- Armadale adult/older full suburb schedules (WF-06)
- Owner ratification contacts (suggested owners not contacted)
- Raw offline archive of all source HTML/PDFs
- Deep Research standalone report bodies (not in bundle)

## D. Handover verification queue

46 issues still open (14 P0 / 10 P1 / 22 High per CSV priority labels). Full list: `02_HANDOVER/NEXT_REVIEW_QUEUE.md`.

Top P0 subjects include: synthetic production substitution; team vocabulary; Lynwood; Butler/Wanneroo; FSFHG CTTs; Armadale boundaries; Graylands capacity; plus additional P0s in queue.

## E. ED inventory in prepared register (12)

Armadale, FSH, Joondalup, KEMH, Peel, PCH, Rockingham, RPH, SCGH, SJOG Midland Public, Hollywood Private, SJOG Murdoch.

**Check still needed:** whether any other metro public ED should be in scope for MH presentations; role of private EDs in routing; regional ED list for transfers.

## F. Next bot deliverables expected

- Capacity adversary: assertion-by-assertion URL re-fetch
- Geo: CAMHS PDF parse + adult catchment tables
- FactCheck: tip entity inventory vs register IDs
- Web executors: markdown reports under `/workspace/ward-flow-data-review/`

## G. Update — CAHS postcode PDF (fetched 2026-09-17)

URL: https://cahs.health.wa.gov.au/~/media/HSPs/CAHS/Documents/Mental-Health/Catchment-area-by-postcode.pdf

**CORRECTION (Geo independent re-extract, same PDF, footer 12 November 2025):** Lynwood 6147 appears **once** under Midland/Swan only — not dual-listed in the PDF. Postcode 6147 is split by suburb: Parkwood→Fremantle/Murdoch; Langford+Lynwood→Swan. WF-03 contest is **PDF/Swan schedule vs Fremantle clinic webpage** (which lists Lynwood), not a PDF dual-row for Lynwood.

## H. Catchment web fact-check complete (2026-09-17)

Full report: `web-catchment-factcheck-2026-09-17.md` (also on Josh PC under Documents/ward-flow-data-review/).

| Topic                | Status                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Lynwood CAMHS        | **CONTESTED** — PDF→Swan; Fremantle page→Fremantle; Swan page omits Lynwood                  |
| Butler/Wanneroo      | Clinics verified; **suburb split unpublished** (Oct 2023 single list; shared referral inbox) |
| FSFHG CTTs           | Teams verified; **CTT schedules unpublished**                                                |
| Orchard Ave Armadale | LGA wording verified; **suburb MH schedule not found**                                       |
| Statewide directory  | MHC My Services (May 2025) — finder, not catchment register                                  |

Transfer distance **schema only** proposed in that file (no invented km/min).

## J. Capacity adversary (2026-09-17)

Full note: `web-capacity-adversary-2026-09-17.md`

**CRITICAL:** Graylands 109 and 122 both still live on NMHS — leave dual assertions.
**HIGH:** SCGH MHOA chairs≠beds; E-CENSUS URL 404 breaks EMHS chain; Bentley 50 vs 62/100 conflicts; RPH 2K 14 live vs 20 stale PDF; Fremantle 104 / JHC design staging ≠ staffed ops.
**Strong keep:** RPH 14/12/6+2; Midland 25/16/15; SCGH MHU 30 + MHOA 6+2 chairs separate; OPH 24; regional WACHS samples.
**Ingest rule:** never promote tip synthetic beds; never treat aggregate/project/chair/HITH as staffed ward beds.

## K. FactCheck interim (2026-09-17) — tip vs register

Tip SHA `f10ca39fbd` confirmed.

| Item             | Finding                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Graylands in tip | Synthetic `gry-adult-secure` 15 + `gry-older-adult` 10 = **25 invented** — does **not** encode 109 or 122 |
| Graylands public | Dual live 109 vs 122 — **leave both**; do not prefer 109                                                  |
| Tip EDs          | **8** (RPH, SCGH, FSH, Armadale, SJOG Midland, Rockingham, Joondalup, Peel)                               |
| Handover EDs     | **12** — tip missing **KEMH, Perth Children’s, Hollywood Private, SJOG Murdoch**                          |
| WF-01            | Confirmed — `ward-sites.ts` marks all beds invented; held inert                                           |

Fremantle/Bentley/Graylands correctly have no ED in tip.

## L. Capacity web fact-check executor (2026-09-17)

Full: `web-capacity-factcheck-2026-09-17.md`

**Graylands:** Dual live confirmed; facility page ~109 (dated

… _(truncated for length; full file on disk)_

---

## 10. OneDrive Referring / Forms — contradiction matrix (excerpt)

_Full inventory:_ `ward-flow-data-review/referring-forms/INVENTORY-REPORT-2026-09-17.md` (~244 files)

# Contradiction matrix — 2026-09-17 (deepened)

**Layers:** OneDrive (extracted) · Live WA/HSP (fetched 2026-09-17 AWST) · Research pack · tip `f10ca39fbd` (synthetic)

**Standing:** Graylands 109 vs 122 prefer neither; contested catchments → no auto-route; never merge/rewrite tip.

| Claim                     | OneDrive                                                                                                                  | Live WA/HSP (URL + date)                                                                                                                                                                                                                                                                                                    | Research pack                                                                          | Tip f10ca39fbd                              | Status                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| Graylands beds 109 vs 122 | YOD clinic referral only; **no** acute/HECS census in extracted PDFs                                                      | **109** = 51 acute + 58 HECS on https://www.nmhs.health.wa.gov.au/Hospitals-and-Services/Hospitals/Graylands (fetched 2026-09-17; search stamp ~24/06/2026). **122** = 53 acute + 69 HECS on https://nmhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health/Inpatient (Last Updated **10/03/2026**, fetched 2026-09-17) | `web-capacity-factcheck` / `web-capacity-adversary` / LOW-CONFIDENCE WF-07 — dual HIGH | Synthetic GRY ~25 invented — not 109 or 122 | **conflict** (dual live) + **tip-synthetic**                               |
| Graylands YOD pathway     | Extracted: Neurosciences YOD clinic onset <65; (08) 6159 6464; Graylands.Neurosciences@health.wa.gov.au; Updated Mar 2021 | NMHS Neuro specialties page linked from referral PDF                                                                                                                                                                                                                                                                        | Research pack notes YOD ≠ bed truth                                                    | No YOD entity expected in tip beds          | **agree** pathway exists; **missing** as bed authority                     |
| WF-03 Lynwood CAMHS       | Catchment maps present; BMHS **adult** ATT list includes Lynwood (Bentley) — different cohort                             | CAHS PDF→Swan; Fremantle clinic page→Fremantle; Swan page omits Lynwood (`web-catchment-factcheck`)                                                                                                                                                                                                                         | geo-catchments-p0-synthesis CONTESTED                                                  | Tip has **no CAMHS**                        | **contested** — OneDrive maps do not resolve                               |
| WF-04 Butler / Wanneroo   | Adult HITH Oct 2019 list puts Butler under Joondalup catchment; no Butler-vs-Wanneroo clinic split                        | NMHS clinics page: both clinics exist; shared WannerooCatchment inbox; Oct 2023 AMSH PDF single Joondalup list                                                                                                                                                                                                              | web-catchment-factcheck                                                                | Tip over-collapses Butler→Clarkson          | **contested** / **missing** suburb split                                   |
| WF-05 FSFHG CTT schedules | FSFHG ATT MoC Mar 2023 extracted; CTT Guidelines present; **no** Fremantle/Cockburn/Melville suburb schedules             | SMHS: 3 geographic CTTs + EIP + ACTT verified; schedules unpublished                                                                                                                                                                                                                                                        | web-catchment-factcheck WF-05                                                          | Tip Alma CTT-grain = overclaim              | **missing** schedules / **tip-synthetic**                                  |
| WF-06 Armadale / Orchard  | ATT Referral (AKG) still **Mead Centre / 3056 Albany Hwy / 9391 2400**; CTT at Eudoria St in manual                       | Live AHS Adult MH Programs: ATT+CTT at **Orchard Ave Centre** Tenancy 3/10 Orchard Ave; phone **9398 6600**; ATTReferral.Armadale@health.wa.gov.au; Last Updated **24/02/2026** (https://www.ahs.health.wa.gov.au/Services/Mental-Health/Adult-Mental-Health-Programs). LGA wording verified; suburb schedule not found     | web-catchment-factcheck; tip Mead/Eudoria stale                                        | Tip Mead/Eudoria stale                      | **conflict** OneDrive address vs live Orchard; **missing** suburb schedule |
| ATT team presence         | Extracted ATT ops for AKG, BHS, FSFHG + Psychiatry contacts sheet                                                         | Live confirms Armadale ATT, FSFHG ATT entry, NMHS community clinics                                                                                                                                                                                                                                                         | Handover programmes                                                                    | tip `ward-teams.ts` synthetic names         | **agree** entities exist; **tip-synthetic** vocabulary                     |
| CTT team presence         | CTT Guidelines (+BHS) extracted; receives via ATT                                                                         | Live Armadale CTT at Orchard Ave; FSFHG geographic CTTs named                                                                                                                                                                                                                                                               | WF-05                                                                                  | Synthetic teams                             | **partial** / **tip-synthetic**                                            |
| TCU/PRU/RRU capacity      | Extracted: BWK = PRU 20 + RRU 20 = **40** transitio                                                                       |

… _(truncated for length; full file on disk)_

---

## 11. Capacity adversary (excerpt)

# Ward Flow — capacity adversary deliverable (2026-09-17)

**Auditor:** Ward Capacity Adversary  
**Method:** Live NMHS/SMHS/EMHS/CAHS/WACHS + provider pages, 17 Sep 2026 PT. Tip `ward-sites` beds discarded as invented.  
**Constraint:** read-only; never merge.

## WF-07 Graylands — BOTH totals still live

| Claim                    | Source shape                                 | Confidence |
| ------------------------ | -------------------------------------------- | ---------- |
| 109 = 51 acute + 58 HECS | NMHS Graylands / MH hub                      | HIGH       |
| 122 = 53 acute + 69 HECS | NMHS Inpatient Adult MH (updated 10/03/2026) | HIGH       |

Delta +2 acute / +11 HECS. Forensic beds separate. Neither page = staffed vacancy. **Do not silently prefer 109.**

## CRITICAL / HIGH

1. **CRITICAL** — Graylands dual live totals (above).
2. **HIGH** — SCGH MHOA: “8 beds” vs “6 beds + 2 recliner chairs” (chairs ≠ beds).
3. **HIGH** — SCGH aggregate 36 on MH hub may bake observation places; aggregate ≠ ward.
4. **HIGH** — E-CENSUS medcareers URL **HTTP 404** — undercuts EMHS census chain (Bentley adult 50, Armadale 33, MLH 12, TCU 40, RPH total 26, network 166).
5. **HIGH** — Bentley adult 50 unreconfirmed on hospital page; EMHS PDF “100 MH beds” aggregate; directories claim adult 62.
6. **HIGH** — RPH Ward 2K: live “14-bed” matches assertion; EMHS work-with-us PDF still “20-bed” (stale).
7. **HIGH** — Fremantle 104 / +40: media staged opening — project ≠ current staffed ops.
8. **HIGH** — JHC 102 opening article; design bedroom counts ≠ staffed wards.

## Private / special

- Perth Clinic 100, Marian 69, Abbotsford 77 — reobserved (PRIVATE).
- Hollywood Ramsay 101 — only Jul 2020 opening article (PRIVATE + stale).
- Nickoll — public CAHS programme on private Hollywood site during PCH refurb.
- SJG Midland 56 (25+16+15) — PPP public hospital / private operator (not private-patient facility).

## Conflation patterns to ban in ingest

Physical vs staffed vs authorised | aggregates as wards | staged/design as ops | chairs≠beds | HITH virtual beds | dead primary URLs.

## Strong live refs (keep citing)

… _(truncated for length; full file on disk)_

---

## 12. Catchment P0 synthesis (excerpt)

# Ward Flow — geo catchments P0 synthesis (2026-09-17)

**Date:** 2026-09-17 (Australia/Perth, AWST)  
**Baseline (authoritative for web findings):** `web-catchment-factcheck-2026-09-17.md`  
**Scope:** Tip ↔ baseline synthesis for WF-03…WF-06 + distance schema. **No tip merge. No invented km/min. No invented boundaries.**  
**Tip layer note:** Tip travel bands flagged `TRAVEL_BANDS_ARE_INVENTED=true` (see `LOW-CONFIDENCE-AND-GAPS-2026-09-17.md`). Tip catchments/teams are demo/synthetic until owner-approved ingest.

**Status vocabulary:** VERIFIED · CONTESTED · MISSING

---

## Executive summary

| P0     | Topic                                                | Status                                                       | Tip action                                                |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| WF-03  | Lynwood CAMHS (Swan vs Fremantle)                    | **CONTESTED**                                                | Do not auto-route; do not pick a winner from page recency |
| WF-04  | Butler vs Wanneroo adult (and OA) split              | **MISSING** clinic-grain suburb split (clinics **VERIFIED**) | Keep both clinic IDs; block split-based routing           |
| WF-05  | FSFHG Fremantle / Cockburn / Melville CTT boundaries | **MISSING** CTT suburb schedules (team names **VERIFIED**)   | FSFHG-area eligibility only — not team assignment         |
| WF-06  | Armadale adult + older catchments                    | **VERIFIED** at LGA grain; **MISSING** suburb MH schedules   | Do not invent suburb list from EMHS 2016 hospital map     |
| Travel | ED↔ward↔community distance matrix                    | **MISSING** numerics; schema **VERIFIED** (adopt baseline)   | Discard invented tip travel bands for operational use     |

**Standing rule:** contested or unpublished splits → `automatic_routing_approved = false` / `approved_for_routing = false`.

---

## WF-03 — Lynwood child/youth CAMHS (settled framing)

### Official artefacts (do not regress)

| Artefact                            | Date                                                             | What it says about postcode 6147                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAHS Catchment-area-by-postcode.pdf | **last updated 12 November 2025** (footer); fetched 2026-09-17   | **Lynwood 6147** — **one hit only** → Midland Community Hub / **Swan CAMHS** (row 59). **Parkwood 6147** → Murdoch Hub / **Fremantle CAMHS** (row 45). **Langford 6147** → Midland / **Swan** (row 55). |
| Fremantle CAMHS clinic page         | Last Updated cited 10/12/2025 (also prior ~2026-05-27 ambiguity) | Lists **Lynwood 6147** (and Parkwood 6147) under Fremantle                                                                                                                                              |
| Swan CAMHS clinic page              | fetched 2026-09-17                                               | **Lynwood absent**; **Langford 6147** present                                                                                                                                                           |

**Source URL (PDF):** https://cahs.health.wa.gov.au/~/media/HSPs/CAHS/Documents/Mental-Health/Catchment-area-by-postcode.pdf

… _(truncated for length; full file on disk)_

---

## 13. Data perfection plan (excerpt)

# Ward Flow — data perfection plan (2026-09-17)

**Status:** research / confirmation only — **do not** rewrite tip seed data or merge until Joshua authorises an ingest pass.

**Inputs:**

- Attached handover: `Ward_Flow_Complete_Handover_2026-09-17` (working master 17 Sep prepared register)
- Tip: `D:\Worktrees\Database\ward-lead` @ `f10ca39fbd`
- Live web re-checks started 17 Sep 2026 (AWST)

---

## 0. Non-negotiable rules (from handover + Joshua)

1. Preparation first: confirm completeness + currency; **do not** silently replace synthetic demo fixtures with real beds.
2. Keep **verified reference layer** separate from **synthetic demo/test layer** (WF-01).
3. Null/unknown beds ≠ zero. Never invent.
4. Capacity types stay distinct: physical / authorised / commissioned / staffed / available / observation / staged / design.
5. Catchment assertions are source-claims, not unique suburbs; conflicts stay contested until owner-confirmed.
6. No auto-routing / operational-use approval until ratified.

---

## 1. Current inventory (handover master)

| Dataset                         |                               Count | Notes                                      |
| ------------------------------- | ----------------------------------: | ------------------------------------------ |
| Core community services         |                                  32 | 14 adult + 9 older + 9 CAMHS               |
| Specialist/interface programmes |                                  33 | Not geographic CMHTs                       |
| Operational review records      |                                  29 | Teams/functions/endpoints                  |
| Catchment assertions            |                                 955 | 843 inherited + 112 new older-adult        |
| Emergency departments           |                                  12 | 11 Perth + Peel (+ 2 private in list)      |
| Facility/site-service entries   |                                  28 | Not full campus census                     |
| Ward/unit records               |                                  56 | Only 14 named_ward + 12 named_unit         |
| Capacity assertions             |                                  65 | Not additive                               |
| Relationships / sources         |                            188 / 87 | 47 sources inherited_not_freshly_rechecked |
| Verification issues             | **46 open** (14 P0, 10 P1, 22 High) | NEXT_REVIEW_QUEUE                          |

Handover itself says packaging **did not re-crawl**; treat as research master requiring fresh verification.

## 2. Tip seed / behaviour files to reconcile (ward-lead)

Canonical code surfaces (not exhaustive):

- `ward-sites.ts` — units/beds/sites (WF-01 synthetic risk)
- `ward-teams.ts` — community vocabulary (WF-02; 2015-derived risk)
- `ward-model.ts` — model/designations
- `ward-catchment.ts` — catchment logic/data
- `ward-distance.ts`, `ward-travel-bands.ts` — transfer modelling
- `ward-admissions-seed.ts`, `ward-patients-seed.ts` — demo journeys (keep synthetic)
- `ward-configuration.ts`, `ward-place.ts`, `ward-service-scope.ts`, `ward-bed-designation.ts`
- Community / ED / capacity UI that reads the above

**Goal of ingest later:** map prepared JSON → typed reference pack; fixtures stay fictional or clearly labelled demo overlays.

## 3. Workstreams (parallel bots)

| ID                    | Owner                                  | Scope                                                                       |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| W1 Inventory          | Ward Data FactCheck + Chief            | Diff tip seeds vs prepared register entity-by-entity                        |
| W2 Capacity adversary | Ward Capacity Adversary + web executor | Re-fetch every capacity assertion URL; resolve Graylands etc.               |
| W3 Catchments/geo     | Ward Geo Catchments + web executor     | Re-fetch CAMHS/adult/older schedules; Butler/Wanneroo; FSFHG CTTs; Armadale |
| W4 ED & facilities    | FactCheck                              | Complete public ED set; private ED role; regional psych units               |
| W5 Distances          | Geo + Chief                            | Build sourced road_km / drive_min matrix schema + fill high-traffic pairs   |
| W6 Adversarial pass   | Capacity + FactCheck                   | Second independent challenge of W2–W5 outputs                               |
| W7 Perfection pack    | Chief                                  | Ultimate reference JSON/CSV + ingest map + open questions                   |

## 4. Fresh web finding

… _(truncated for length; full file on disk)_

---

## 14. Ingest map (tip → pack)

| Tip file                  | Pack table                        | Rule                                            |
| ------------------------- | --------------------------------- | ----------------------------------------------- |
| `ward-sites.ts`           | entities + capacity_assertions    | Invented beds; do not overwrite without Phase 6 |
| `ward-teams.ts`           | entities / community              | Synthetic names                                 |
| `ward-catchment.ts`       | catchment_assertions              | Contested overlays block routing                |
| `ward-travel-bands.ts`    | distances.json                    | `TRAVEL_BANDS_ARE_INVENTED=true` until sourced  |
| admissions/patients seeds | —                                 | Demo journeys only                              |
| OneDrive Referring/Forms  | forms / pathways / catchment docs | `source_document_only`                          |

**CI recommendation:** forbid importing `staffed_beds` into tip unless `operational_use_approved=true`.

---

## 15. Complete file index (Joshua PC)

### Master + audits

- `C:\\Users\\joshs\\Documents\\WARD-FLOW-MASTER-COMPLETE-2026-09-17.md` ← **this file**
- `C:\\Users\\joshs\\Documents\\WARD-FLOW-CONSOLIDATED-AUDIT-2026-09-17.md`
- `C:\\Users\\joshs\\Documents\\WARD-FLOW-LOGIC-AUDIT-2026-09-17.md` (if present)
- `C:\\Users\\joshs\\Documents\\WARD-FLOW-AUDIT-INTERIM-2026-09-17.md`

### Data review

- `C:\\Users\\joshs\\Documents\\ward-flow-data-review\\` (plan, gaps, web fact-checks, geo, capacity, referring-forms)
- `C:\\Users\\joshs\\Documents\\ward-flow-data-review\\reference-pack\\`
- `D:\\Worktrees\\Database\\ward-lead\\docs\\ward-flow\\reference-data\\`

### Visual evidence

- `C:\\Users\\joshs\\Documents\\ward-flow-visual-2026-09-17\\`
- `C:\\Users\\joshs\\Documents\\ward-flow-tablet-local-2026-09-17\\`
- `C:\\Users\\joshs\\Documents\\ward-flow-tablet-interactive-2026-09-17\\`

### OneDrive inputs

- `C:\\Users\\joshs\\OneDrive\\Medicine\\Master\\✉️ Referring`
- `C:\\Users\\joshs\\OneDrive\\Medicine\\Master\\📋 Forms`

---

## 16. What remains (ordered)

1. **You:** answer Decision packet D1–D6 (section 5).
2. **Product eng (optional parallel):** P0 statutory chrome → ED overflow → capacity clamp → STEP_BACK UX → WLQ-4.
3. **After D1–D5:** Phase 6 tip overlay (scoped).
4. **After D6 method chosen:** fill `distances.json` real km/min; only then consider flipping invented travel flag.
5. **Phase 7:** flip selected `operational_use_approved` / routing flags; archive raw HTML/PDF cache.

_Nothing else is required to close the Sep-17 assessment wave._

---

## 17. Bottom line

Ward Flow local tip is **exerciseable** (e2e green) but **not** demo-safe as clinical/statutory software. Data work has produced a **verified-but-unapproved reference pack** beside synthetic tip fixtures, with every live conflict encoded and every approval flag false. The next human step is the **decision packet**; the next engineering step is **P0 chrome + ED overflow** if you want a safer demo.

— Chief of Staff · 2026-09-17
