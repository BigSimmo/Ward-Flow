# Ward Flow — roadmap

_Updated 2026-11-09 - D-80 is built; earlier programmes moved to history (D-107); Documentation owns._

## Current programme — 3 November 2026

Read from source on `main` at `cd66be7a` (#1332) on 3 November 2026. This is a source reading only; no new browser, hosted CI or deployment check is claimed. The redesign of every approved screen is merged (see the [handover entry](../design/handover/README.md)). Josh chose the next feature on 3 November 2026 (Q380): finish role access, then get ready for a pilot.

### 1. Finish role access (D-80)

D-80 PRs 1 to 5 are merged. The 3 November source reading is below; item 17 was built on 8 November
(`24e75284`), and the [STATUS decision table](STATUS.md#decision-status-d-numbers) now shows D-80 as built.

| D-80 item | What                                                                                    | Source on 3 November                                                                           |
| --------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 7         | Officers see their own service's jobs, with risk flags                                  | Built (#637)                                                                                   |
| 9         | Own-place Statistics as counts for wards, EDs and teams                                 | Built: `ward-role-access.ts`, the three Statistics screens                                     |
| 10, 11    | Community Movements screen; phone alerts for officers and community teams               | Built (#666): `ward-role-alerts.ts`, push in `backend/ward-flow/engine.ts`                     |
| 12        | Readmission flag only once the ward has accepted                                        | Built: `ward-readmission-copy.ts`                                                              |
| 13        | ED sees the wards asked and the accepting ward, not other wards' decline reasons        | Built: `edMovementCopy` in `ward-access-scope.ts`                                              |
| 14        | Record view and break glass review; Access log in Settings                              | Built: `governance-record-views.tsx`, `settings/access-log.tsx`                                |
| 15        | Opening a record logged as a record view                                                | Built (#667 and later): referral, patient, movement, list and TV reads; migrations 013 and 015 |
| 17        | Coordinator gives an "on behalf of the ward" reason when opening a clinical ward record | Built 8 November (`24e75284`). D-86 dropped the two-person approval for role grants.           |

Next steps:

1. Walk each desk in the browser on synthetic data and check it sees only what D-80 allows. **Part 1
   done 8 November** ([desk walk](evidence/desk-walk-2026-11-08.md)); its two findings were fixed on a branch; the
   first-load case (a first visit or a second tab) is still open in the [backlog](backlog.md). Part 2 (detail pages, break glass, cover, phone, shared server) is in the [backlog](backlog.md).
2. ~~Correct the D-80 row and the "Waiting on Josh" list in STATUS.md.~~ Done 9 November.
3. ~~Build item 17.~~ Done 8 November.
4. **Done when:** every desk's walk passes and Josh has seen it.

### 2. Pilot readiness

No real patient data until the real-data gate in [D-87](decisions.md#d-87-d-36-and-d-37-are-replaced-by-the-real-data-gate-27-october-2026) is fully signed. The repository can prepare; the sign-offs belong to people outside it.

1. **Go/no-go checklist (Q378).** [REAL-DATA-GO-NO-GO.md](governance/REAL-DATA-GO-NO-GO.md) is the one list of every real-data blocker, including session drafts kept in the browser, a Secure session cookie, the privacy impact assessment, a breach plan and the list of subprocessors.
2. **Sign-in and front door (Q371, Q372).** Harden the demo-code rate limit and make production fail closed when the front door is off.
3. **Hosting (D-84, Q370).** The app and backend are on Railway Singapore and the database in Sydney. Q370 (move to Sydney) is not answered; D-84 says to revisit with the health service's IT before real data.
4. **Owner tasks (Q379).** Sign-in renewal test before about 16 November, database migration 13, invite-only sign-up, and naming the privacy officer and clinical safety owner. The list is in STATUS.md.
5. ~~**D-80 item 17.**~~ Built 8 November (`24e75284`).
6. **Outside reviews.** The six reviews in historical milestone 6 ([roadmap history](../history/roadmap-2026-10.md#6-pilot-readiness)) still stand: TGA check, clinical safety officer, privacy, WA legal advice on the forms, approved catchment and reference data, and post-incident review. The two open pilot questions also stand: run beside the whiteboard first or switch straight away, and who sponsors it in EMHS.
7. **Done when:** the real-data gate is signed and Josh approves a controlled pilot. A synthetic demonstration is a different milestone.

### Alongside

Design system clean-up (Q375 to Q377) and process changes (Q373, Q374) run in their own threads. They don't block the two steps above.

Open work for both steps is listed in the [backlog](backlog.md). Earlier programmes (17 October and
25 September 2026, with the milestone log) are in the [roadmap history](../history/roadmap-2026-10.md).
