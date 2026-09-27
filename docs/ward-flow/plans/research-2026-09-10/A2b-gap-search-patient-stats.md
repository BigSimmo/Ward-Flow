Paths: mockups live in `docs/ward-flow/mockups/<file>` (root `.../ward-flow-phase-5-resume-166ecb/`), cited `M:<file>:<line>`. App files are under `src/` in the read-only worktree `D:/Worktrees/Database/readonly-plan-20260910` (HEAD `20eb850792`, confirmed), cited `A:<path>:<line>`. Standard is `WARD-FLOW-DESIGN-SYSTEM.md`, cited `DS:<line>`. Everything is **verified by reading source** unless tagged `[inferred]`.

**Shared shell (all 8, not repeated per screen):** identical Activity/Tasks/Tools drawers, service switcher, appearance toggle and "New referral" menu are copy-pasted verbatim into every file (`M:patient-now-third-edition.html:9284` = `M:patient-search-third-edition.html:7728`). The rail's other items are `<button data-page>`, not links — clicking one for a different screen opens the Activity drawer scoped to that screen's tally and announces "not part of this prototype" (`M:patient-search-third-edition.html:9044-9053`); it never navigates. Only the four Statistics mockups contain real `<a href>` cross-page links. "Not wired in this prototype" is the fixed phrase for every inert control.

**Standard (DS §14.1) coverage:** only **Patient search** (row 7) and **Raise a referral** (row 12) have an entry. **Patient Now, Search hub, Ward/Community/Emergency-department statistics have none** — DS names one generic "Statistics" screen (row 10); the mockups split it into four files. Patient Now and Search hub aren't among the twelve at all.

**App statistics routes with no mockup:** `statistics/service/[serviceId]` and `statistics/compare` are fully built, no mockup file exists for either.

---

## 1. Patient search

**Mockup** (`M:patient-search-third-edition.html`). Title "Patient search" (4790), rail item `search` (8356). 4 panels matching DS row 7: Results (4885) → Search (4903) → Selected person (4927, dynamic) → Access record (4929). Figures derived from `MOVEMENTS` (5387) and `REFUSALS` (5499, 3 entries, matching DS's "three kinds"); `SEARCHES` (5527) is a session-only audit log. Actions: KINDS tabs (5656), FACETS (5687), and per-person primary **"Open the movement"** (`data-unwired`, 6121, inside the Selected-person panel, not the header) — announces "The Movement screen would open… Not wired" (8973). States: nothing selected (6049), selected-but-filtered-out (6058), refusal by regex on risk/acuity/score/best-match or closed/arrived/discharged (5518).

**App today.** Route `/mockups/ward-flow/search` → `PatientSearchPage`, `A:search/patient-search.tsx` (668 lines), h1 "Patient search" (188). Real typeahead + Stage `<select>` (with a live fix: "Arrived" hidden because it can never match, 30-52, 231-257) + Department `<select>`, both with live counts; a summary line counting 3 kinds (328-368); "N people" panel (378); "N matches" panel split into referral/movement rows (489). Data: `useWardFlow()` → movements/referrals/units/now/patients (90). Links: person row → `/people/${patient.id}` (462); movement row → `/movements/${movement.id}` (662); `RecordPreview` side panel cross-links person↔movement both ways (`record-preview.tsx:215,246,276,294`).

**Gap table.**

| Mockup item                      | App state                                                   | Evidence                               |
| -------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| Search facets (multi-array)      | Partial — 2 selects only                                    | `A:patient-search.tsx:231-268`         |
| "What this search refuses" panel | Absent as a panel; folded into banner prose + 1 select-note | `A:patient-search.tsx:179-184,246-256` |
| Selected-person panel            | Partial, via `RecordPreview`; no stage-stepper              | `A:record-preview.tsx`                 |
| "Open the movement"              | Present and really wired                                    | `A:patient-search.tsx:662`             |
| Access record (search audit log) | **Absent**, no logging anywhere                             | grep, no match                         |

**Model needs.** A search-refusal-reason entity (action/words/why) and an access-record entry (role, query, when) — the app has neither.

**Wiring implied.** To a person screen by patient id and a movement screen by movement id — both real in-app; mockup only imagines the latter.

**Defects noticed.** DS §8.6 fixes two exact refusal sentences. The mockup's own refusal panel uses **three different bespoke sentences instead** (`M:...:5504`, `:5510`, `:5516`), none matching, even though the same file's results-footer sentence elsewhere (`:7538`) does match verbatim — wording breaks §8.6 two panels away from where it's honoured.

---

## 2. Patient Now

**Mockup** (`M:patient-now-third-edition.html`). Title "Patient Now" (5172) — no DS entry. Panels: "The person now" (5269: identity, tier, wait, legal status, needs, owner, plus a derived **verdict + gates**, e.g. "Cannot be moved, 2 reasons") and "Journey" (5283), plus a tab strip **Now/History/Community/Details/Documents** (5300-5339). Data keyed by movement id via a `RECORDS` map (6303); movements outside it show an explicit absence sentence (7028). Actions: primary "Open the movement" (unwired, 7063, 7967); **"Copy handover summary"** — genuinely functional clipboard copy (7978); **Coordinator/Ward view toggle** — functional (7961-7973).

**App today.** No single match. Two partial analogues: (a) `/people/[patientId]` → `PersonScreen`, `A:patients/person-screen.tsx` (297 lines) — person-centric, panels "Who this is" (184) and "Placement details" (231), one action "Refer Patient" (258). No tier, wait, verdict, Journey, tabs, or toggle. Its own header comment says a history tab is **unbuildable, not merely unbuilt**: `Movement` carries no `patientId`, only `Referral` does, so no code path can find a person's past admissions (75-80). (b) `/movements/[movementId]` → `WardPatientWorkspace`, `A:ward-management-console.tsx:763+` — movement-centric, and it **does** carry a real verdict/gates concept (834, 1246-1248) plus "What is holding this up" (2171), but as an operational decision workspace (DS's separate "Movement" screen), not a read-first snapshot, and with no tab strip.

**Gap table.**

| Mockup item                                    | App state                              | Evidence                                                 |
| ---------------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Identity + verdict/gates together              | Split across two screens, never paired | `A:person-screen.tsx`, `ward-management-console.tsx:834` |
| Journey panel                                  | Absent from both                       | grep, no match                                           |
| Now/History/Community/Details/Documents tabs   | Absent, no `role="tab"` anywhere       | grep, no match                                           |
| Coordinator/Ward toggle, Copy handover summary | Absent                                 | grep, no match                                           |

**Model needs.** A combined read view needs tier, wait, legal status, bed-need, verdict+gates and a journey/events list, plus the `Movement`→`patientId` link `person-screen.tsx` says doesn't exist.

**Wiring implied.** Would need reachability from Patient search and an onward link to the real movement workspace.

**Defects noticed.** None beyond its own unwired controls — absence from DS §14 and from any one app route is a coverage gap. `[inferred]` whether Patient Now becomes a new screen or a fusion of the two candidates is outside this brief.

---

## 3. Search hub

**Mockup** (`M:search-hub-third-edition.html`). Title "Search hub" (4775) — no DS entry. Panels: "The network" directory (4853, worst-first by fewest-beds-ready) and "At a glance" (4886, overview or per-item detail via `renderWard`/`renderEd`/`renderTeam`, 6182-6198), plus a real/invented footer (4894). The rail's `search` key has no index entry of its own (7574) — the same key `patient-search` uses for itself (8356): the two screens share one rail identity by design.

**App today.** Route `/hub` → `HubScreen`, `A:hub/hub-screen.tsx` (924 lines) + `hub-derivations.ts` (407 lines). h1 "Search hub" (274) — exact title match. Close structural match: group headers (392), "At a glance" (475) with Recently opened/Beds network-wide/Ready beds by service/Worth knowing (539-666), selected-item detail (688) with Beds/Wards/Notes (721-811), footer "What is real"/"What is invented"/**"Design decisions"** (889-910, an app-only addition). Links: `/ward/${unit.id}` and `/ed/${ed.id}` (`hub-derivations.ts:170,198`) — the **operational board**, not statistics; community has an index only (211). No link anywhere to any Statistics screen.

**Gap table.** Directory+detail layout: present, close match (`hub-screen.tsx:274-475`). Real/invented footer: present and expanded (889-910). Per-item "Open X": present, but targets the board not statistics (170,198).

**Model needs.** None — this is the most nearly-complete of the eight.

**Wiring implied.** Ward/ED rows → operational board by unit/ED id (built); community → index only (matches the mockup's own caveat, 846-847).

**Defects noticed.** The app's own comment records that **the mockup's footer made four claims that failed a data check** (`hub-screen.tsx:869-877`): a pin/star + "recently viewed" feature the build lacks, a placeholder-caveat-frequency claim the code deliberately changed away from, and Broome's forensic **ward** mis-described as a forensic **bed** (a whole-ward flag covering six beds). Already corrected in-app; worth not reintroducing in a mockup refresh.

---

## 4. Raise a referral

**Mockup** (`M:raise-a-referral-third-edition.html`). Title "Raise a referral" (5707); DS row 12 names the primary action **"Submit the referral"** (DS:1052) but the button itself reads **"Send referral"** (6012) — see Defects. Panels: "The person" (5804, fixed to one hardcoded `PERSON`, `PT-014`, 7532), Step 1 "Who the referral is about" (5822: age band/sex/home region/suburb — **read-only, no inputs anywhere in the file**), Step 2 "What they need" (5851: source, urgency, origin-site [disabled, unwired], plus three **real** Yes/No toggles wired via `[data-set]`, 8524), Step 3 "The history" (5908: three prose blocks — Why now [required, pre-filled], Background, Risk and safety [optional, empty], no `<textarea>` anywhere), "Where to refer" (5960, 3 fixed `DESTS`, 7614), "What will be sent"/"What follows"/"What sending does" (5972-5992), "Send" (6003, disabled until validation passes, `renderSend`, 8372). A closed-by-default 9-section "Design appendix" (6030-6577) is explicitly build reference, not live UI. Duplicate check is one inline sentence inside "The person" strip (`dupLine()`, 7916-7930), not its own panel.

**App today.** Route `/referrals/new` → `ReferralIntakeForm`, `A:referrals/referral-intake.tsx` (1888 lines), h1 "Raise a referral" (1137). A **real, fully editable form**: real `<textarea>` (1554), real `onSubmit` (1145), submit button reads **"Send referral"** (1735, matching the mockup, not DS's table). Reads `?patientId=` and refuses to render if the id names nobody known (836-929) — exactly the link `person-screen.tsx`'s "Refer Patient" builds (260). Fieldsets secureBedNeeded/involuntaryBedNeeded/transportNeeded (1380-1459) match the mockup's three toggles by name. History is **one collapsed box** (1529), not three fields. `originSiteCode` is real and validated at submit (651) — **more built than the mockup**, whose equivalent is disabled.

**Gap table.** Read-only person strip: absent by design — app instead validates a real `patientId` (836-929). Source/urgency/origin site: present and real, origin site ahead of the mockup (445,651). Yes/No triad: present, same 3 fields (1380-1459). 3-field history: partial, 1 collapsed box (1529). Duplicate-check line: **absent**, no "duplicate open movement" check anywhere in the file (grep). Send button: present, real handler (1145,1735).

**Model needs.** `Referral.patientId` (already added per person-screen.tsx:277-289) makes a duplicate-check query newly possible; nothing yet queries it at intake time — a small, concrete addition, not a modelling gap.

**Wiring implied.** Confirmed live: Person → Raise a referral by `patientId`. Not built: a duplicate-check query back to open movements for that patient.

**Defects noticed.** (a) DS:1052 says "Submit the referral"; both the mockup (6012) and the app (1735) instead say "Send referral" — the standard's table is the stale artifact, not the build. (b) In the mockup, **"Send referral" has no click handler at all** — the page's one click delegate only listens for `[data-set]`/`[data-ask]`/`[data-choose]`, none of which `rrSendBtn` carries. Every other unwired control at least calls `announce("Not wired…")`; this screen's own single primary action is silently inert, breaking the pattern the rest of the suite establishes.

---

## 5. Statistics (overview)

**Mockup** (`M:statistics-third-edition.html`). Title "Statistics" (4923); DS row 10 is far thinner than what's built. Panels: "Across all services" (5019, headline band + primary **"Export the figures"**, unwired, 5038), "Flow over time" (5058, 14-day admissions/discharges SVG chart), "Where the pressure is" (5122, ward table), "Emergency departments" (5164, table), "Community teams" (5208, table), "Referrals for a bed" (5249, band). `REFERRALS_TODAY` (6575) is a **literal object**, not counted from the page's own `REFERRALS` array — its "Raised" total is tautologically the sum of its own three inputs one line later (6695), not drawn from row-level records. **Real cross-page links** to Ward, ED and Community statistics (7041, 7095, 7153) — the only genuine `<a href>` navigation found among all 8 screens.

**App today.** Two candidates, neither a clean match: `/statistics` → `StatisticsScreen`, `A:statistics/statistics-screen.tsx` (1034 lines) — the section's real **index**: "How the system is performing" (234) and "What is happening to patients" (707: two conversion funnels), plus choosers for health service (973) and community team (1008), linking out via `statistics-sections.ts` (115-156). `/statistics/overview` → `StatisticsOverviewScreen` (462 lines) — explicitly scoped as partial ("what this section is for… and what it still cannot", 139). **Neither has a flow chart, a per-ward pressure table, a per-ED table, a per-team table, or an Export control** (grep across all statistics components: no match for "Export").

**Gap table.** Headline band: partial, different shape (234,707). Export: **absent** everywhere. Flow chart: **absent**. Per-ward/ED/team tables: absent here, but built at their own dedicated routes (§6-8). Cross-links to Ward/ED/Community stats: present in spirit via choosers, different panel shape (984,1019,221).

**Model needs.** None — the app already computes richer per-patient funnels than the mockup asks for.

**Wiring implied.** `StatisticsScreen` plays the mockup's hub role; links by service id and team id, and to a ward chooser and Compare, but has **no direct chooser for a single ED** (only reachable via Compare's tables).

**Defects noticed.** None beyond the `REFERRALS_TODAY`-literal note above — a fragility, not a currently visible defect.

---

## 6. Ward statistics

**Mockup** (`M:statistics-ward-third-edition.html`). Title "Ward statistics" (5009), h2 names one hardcoded ward, **"SCGH Adult Open"** (5135) — no DS entry. A "Wards in this page's data" switcher exists (5143) but lists **exactly one ward**; pressing it announces "No other ward is in this prototype's data" (7581-7584). Panels: Beds now (5162), Occupancy over the window (5189), Length of stay (5217), Admissions and discharges (5251), Discharge planning (5313), Clinically ready — not yet gone (5348), Referrals into this ward (5382), Long stays (5396).

**App today.** Route `statistics/ward/[unitId]` — **genuinely serves every ward** with an honest not-found state (comment: "One route serving every ward, not a page per ward"). `StatisticsWardScreen` (628 lines): Which ward this is (190), Bed capacity — Empty/Allocatable/Ready (207-234), Occupancy and readiness over time (282), and "What can be measured" (294): Average length of stay (311), Average time a bed stood empty (349), Average wait after being accepted (428), Ready to leave & blocked (470), Blocked discharges by blocker (515), Long stays (544), Discharge dates (557).

**Gap table.** Multi-ward support: **app exceeds mockup**. Beds now / Length of stay / Long stays: present, matching names. Admissions-and-discharges flow chart: **absent** (app measures averages/blockers, not a time series). Discharge planning ≈ "Ready to leave & blocked" + "Blocked discharges by blocker": present. Referrals into this ward: **absent** by heading.

**Model needs.** A referrals-into-this-ward count would need `Referral` filtered by destination unit `[inferred, not confirmed against Referral's fields]`.

**Wiring implied.** No observed link from Hub or Search directly into ward _statistics_ (Hub's ward link goes to the operational board, §3).

**Defects noticed.** See the cross-screen asymmetry recorded once under §7.

---

## 7. Community team statistics

**Mockup** (`M:statistics-community-third-edition.html`). Title "Community team statistics" (4858), h2 names one hardcoded team, **"Armadale Community Mental Health Team"** (4955) — no DS entry, and **no switcher of any kind** (no `data-team`, no data-limit disclosure) — stricter than Ward statistics, which at least discloses its own limit. Panels: Caseload (4993, + case-age breakdown, 4999), Referrals into the team (5012), Where referrals came from (5034), Discharges into this team's care (5050), Time to first contact (5065, + grouping, 5070), Contacts (5084), People currently in a hospital bed (5094).

**App today.** Route `statistics/community/[teamId]` — real per-team routing + honest not-found, same pattern as Ward. `StatisticsCommunityScreen` (245 lines), much thinner than its mockup: "This team, in figures" (111), **"Where this team sits"** (181, a cross-team comparison **the mockup doesn't have at all**), "What this page cannot see" (221, explicit limits disclosure).

**Gap table.** Multi-team support: app exceeds mockup. Caseload/referrals-in/discharges: partial, likely folded into "This team, in figures" `[inferred, sub-fields not individually confirmed]`. Time to first contact / Contacts: **not confirmed present** by heading (grep, no match). Cross-team comparison: app-only, no mockup counterpart.

**Model needs.** Not independently determined beyond §6's ward findings `[inferred]`.

**Wiring implied.** Same absence as Ward statistics — no observed inbound link from Hub or Search to a team's statistics page.

**Defects noticed.** **Cross-screen asymmetry, evidenced across §6-8 together:** Ward statistics ships an inert switcher that truthfully admits it can't switch; Community statistics ships no switcher affordance at all; Emergency department statistics (§8) ships a **fully working** live switcher across all 8 departments. All three App routes, by contrast, equally support arbitrary ids already. The mockups understate two-thirds of the app's real multi-entity capability and overstate none of it — a planner reading only the mockups would not learn that Ward and Community statistics already work for every unit/team today.

---

## 8. Emergency department statistics

**Mockup** (`M:statistics-emergency-department-third-edition.html`). Title "Emergency department statistics" (4898) — generic, not naming one department, because this screen (unlike its two siblings) has a **real, fully wired switcher** (`data-dept`, `setDept()`, 7178-7199) across "All departments" plus each of 8 EDs (6430-6448) — genuinely functional. Panels: per-department summary tiles (6587), "Wait time, band by band" (6654, five bands, under 4h to over 24h), "Waiting now" (6817, longest-first), "Wait time over the last 30 days" (6884, trend chart, or an explicit "not drawn" state at 6937), an outcomes panel (6952), and — unique among the four statistics mockups — **"Comparison across departments"** (7081, same measures, every department, side by side).

**App today.** Route `statistics/ed/[edId]` — real per-department routing + not-found. `StatisticsEdScreen` (634 lines): Which department this is (267), "What can be measured" (288: On the list/Marked urgent/No ward yet, 297-307), "How long people have been waiting" (327: Past 24h/Past 48h/Longest wait, 342-352), "Declines this department has recorded" (489: no-free-bed vs. other, 496-502), "What else is not measured here" (529).

**Gap table.** Multi-department switching: present in both, different mechanism (mockup = client tabs; app = route per id). Wait-time 5-band distribution: **absent** (app uses 24h/48h/longest thresholds instead). "Waiting now" full list / 30-day trend chart: **absent**, no matching heading. **Comparison across departments: absent from this screen** — the equivalent lives at a separate route, `/statistics/compare` (`statistics-compare-screen.tsx:166,192`, wards **and** EDs, two tables). Declines: present, 2-way split (496-502).

**Model needs.** None beyond existing decline-reason data `[inferred, exact band boundaries not re-verified]`.

**Wiring implied.** The mockup keeps department comparison **inside** the per-department page; the app moved the equivalent concept to its **own route** that also folds in wards. A planner must decide whether Comparison belongs on the ED page (mockup's placement) or stays separate (app's current placement) — `[inferred, outside this brief]`.

**Defects noticed.** See the cross-screen asymmetry recorded under §7.

---

PROVEN BY READING: every `M:`/`A:` path:line citation above; DS §14.1 table contents and §8.6's two fixed sentences; git HEAD of the read-only worktree (`20eb850792`).

NOT CHECKED: exact "Where to refer"/`rrDests` interactive behaviour beyond what's cited (§4); field-level match of Community statistics' Caseload/Time-to-first-contact/Contacts against the app's single "This team, in figures" panel (§7); whether `Referral` carries a destination-unit field for a future "Referrals into this ward" panel (§6); ED statistics' exact decline-reason taxonomy against the mockup's band boundaries (§8); whether Compare is truly the only path from the statistics index to a single ED.

QUESTIONS: (1) Patient Now has no clean app match — new screen, or a read-mode fusion of `PersonScreen` + `WardPatientWorkspace`'s verdict/gates? (2) The ED mockup's "Comparison" panel maps to a separate app route that also covers wards — move Comparison onto the ED page to match the mockup, or correct the mockup to match the app's placement? (3) Ward and Community statistics mockups understate the app's real multi-entity support (both already work for every id) — should the next mockup revision show a working switcher for both, matching what Emergency department statistics already demonstrates?
