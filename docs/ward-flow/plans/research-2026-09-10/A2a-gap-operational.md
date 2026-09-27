## A2a — Gap inventory: eight Ward Flow operational screens

Mockups: `docs/ward-flow/mockups/*-third-edition.html` (paths below are relative to that folder).
App: `D:/Worktrees/Database/readonly-plan-20260910`, commit `20eb850792` (verified via `git log -1`).

### Shared finding — applies to all eight screens, stated once

The mockups' shell (design system §5.6) and the app's shell are **structurally different**, not
just incomplete.

- **One shared header** exists in the app, `WardChromeHeader` (`src/components/ward-management/ward-chrome-header.tsx`, 193 lines), mounted once in `src/app/mockups/ward-flow/layout.tsx` for every `/mockups/ward-flow/*` route — not per-screen. It renders: search (`WardChromeSearch` → `WardGlobalSearch`, 438 lines), a figures **toggle** (`WardStatsToggle`/`WardStatsPanel`, not always-visible tiles), a **Tasks** button+drawer, a **Handover** shortcut, a freshness sentence, and **one role-adaptive action link** (`roleAction()`, L56-60): role `ward` → "Answer bed offers" (→`/movements`), role `ed` → "New referral" (→ referral intake), everything else (coordinator — the default for all 8 screens below) → **"Referral board"** (→`/referrals`).
- **Absent from the app entirely** (grep across `src/components/ward-management/*.tsx`, no match): a Service selector ("All services" / one of four health services scoping the whole app), an Activity drawer, a Tools drawer. No `healthService` field exists on `useWardFlow()`'s state.
- Every mockup below shows the same header — search, Service selector, Activity/Tasks/Tools drawers, "New referral" opening an ED/CMHT/GP menu (e.g. `command-third-edition.html:4408-4470`) — and every app screen gets the one shared header above instead. Recorded once here; each screen's gap table has one "Header/bar chrome" row pointing back to this section.

---

## 1. Command

**Mockup** (`command-third-edition.html`). h1 "Command" (L4382). Primary: "New referral" menu, 3 sources, "Not wired in this prototype" (L4450-4467). Panels in order: "Emergency department pressure" strip (L4474-4481) → "Priority queue" with tabs **Patients**/**Referrals** (L4484-4529) → "Statewide flow" diagram (L4536-4538) → 4-tab "Exceptions, declines, overrides and refused actions" (tabs L4627/4642/4655/4672) → dynamic "Explainable shortlist" (candidates L7709, eligibility L7754, placement L7939). Live tally (shell `figures()`, L9503-9664): Waiting in ED, Breached, Due within 2 hours, Longest wait, all derived from `MOVEMENTS`/`EDS`.

**App today.** Route `/mockups/ward-flow` → `CoordinatorScreen` (`coordinator/coordinator-screen.tsx`, 326 lines), `<h1 className="sr-only">` (L179), reads `useWardFlow()` (L46-57). Renders `PressureStrip` (L227), `PriorityQueue` (L230-237, `priority-queue.tsx`, 137 lines — **patients only, no tab bar, no Referrals tab**; L28-30 implies referrals belong on their own screen), `FlowDiagram` "Statewide flow" (L250-278), `ExceptionDrawer` (L280-300 — L239-247 confirms it is deliberately "beneath the Statewide flow diagram... owner ruling: seen both, wants the mockup's"), `ShortlistPanel` (L303-319).

| Mockup element                                           | App state                                                                        | Evidence                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ED pressure strip                                        | Present                                                                          | `coordinator-screen.tsx:227` `PressureStrip`                      |
| Priority queue — Patients tab                            | Present                                                                          | `priority-queue.tsx` (whole file)                                 |
| Priority queue — **Referrals tab**                       | **Absent** (no tab bar at all)                                                   | `priority-queue.tsx:1-137`, no `role="tab"`/referral render found |
| Statewide flow diagram                                   | Present                                                                          | `coordinator-screen.tsx:250-278`                                  |
| 4-tab exceptions/declines/overrides/refused              | Present, explicitly matched to mockup by dev comment                             | `coordinator-screen.tsx:239-247`, `exception-drawer.tsx`          |
| Explainable shortlist (candidates/eligibility/placement) | Present                                                                          | `shortlist-panel.tsx` (1584 lines)                                |
| Header/bar chrome                                        | Partial — see shared finding                                                     | `ward-chrome-header.tsx`                                          |
| "New referral" 3-source menu, not-wired                  | **Absent**; app's default action is a "Referral board" link, not a source picker | `ward-chrome-header.tsx:56-60`                                    |

**Model needs**: none new.
**Wiring**: Command ↔ Movements (row → shortlist); Command ↔ Raise a referral (mockup not-wired; app has no picker at all).
**Defects**: mockup's qPanel swaps heading "Priority queue"/"Referral queue" by tab (L6533-6534); app's `PriorityQueue` never renders a referrals view, so referrals are unreachable without leaving Command (verified, whole file).

---

## 2. Delays

**Mockup** (`delays-third-edition.html`). h1 "Delays" (L5129), primary "New referral" (L5198). Panels: "Who is holding people up" owner strip (L5221-5234) → "Waiting" list (L5237-5253) → "What the blocker is", rule "**One blocker per person**... Awaiting a bed is not an ED blocker... Medical clearance is not in this list at all" (L5257-5268) → tabbed "Escalations"/"Resolved today" (L5270-5326) → dynamic "Selected person" (L5327) → footer "What is invented and what is real" (L5330). The mockup **names its own gap**: "the standard's screens index has no Delays entry yet... reported as a gap" (L7966-7968) — Delays is not one of §14.1's twelve screens.

**App today.** Route `/mockups/ward-flow/delays` → `DelaysScreen` (`delays-screen.tsx`, 1178 lines). Visible `<h1>Delays</h1>` (L263). Rail entry: `{ id: "delays", href: "/mockups/ward-flow/delays", label: "Delays" }` (`ward-nav.ts:118`) — history: "`queue` BECAME `delays` AND `exceptions` WAS RETIRED... MERGE 01... folded the priority queue, the exceptions inbox and the escalation board into one screen" (`ward-nav.ts:42-49`; `queue/page.tsx`, `exceptions/page.tsx` now redirect here). Panels via `WardPanel`: "Who is holding people up" (L279), "Who is waiting" (L339, mockup: "Waiting"), "What the blocker is" (L378, exact match), "Registers" (L455, holds the tabs), "The person you have chosen" (L558, mockup: "Selected person"), plus two **not in the mockup's static structure**: "Worth your attention" (L591), "Delays with no named person" (L614).

| Mockup element                             | App state                                                                   | Evidence                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Who is holding people up (owner strip)     | Present                                                                     | `delays-screen.tsx:279-334`                                                 |
| Waiting (main list)                        | Present, retitled "Who is waiting"                                          | `delays-screen.tsx:339` vs mockup L5239                                     |
| What the blocker is                        | Present, same wording                                                       | `delays-screen.tsx:378`                                                     |
| Escalations / Resolved today tabs          | Present under panel "Registers"                                             | `delays-screen.tsx:455-520`                                                 |
| Selected person                            | Present, retitled "The person you have chosen"                              | `delays-screen.tsx:558` vs mockup L5327                                     |
| Footer "What is invented and what is real" | **Not found under that title**; two differently-scoped panels exist instead | `delays-screen.tsx:591,614` vs mockup L5330                                 |
| Links to Ward                              | Present                                                                     | `delays-screen.tsx:905` `href={`/mockups/ward-flow/ward/${pullHolder.id}`}` |

**Model needs**: none new — `Movement.blocker` is already a required string (`delays-screen.tsx:714-721`).
**Wiring**: Delays → Ward (`ward/${id}`, L905); Delays → root (L914).
**Defects**: §14.1/14.2 (`WARD-FLOW-DESIGN-SYSTEM.md:1035-1048`) does not list Delays among the twelve screens — a documentation gap the mockup itself flags (L7966-7968); treat the mockup as authoritative here, not §14.

---

## 3. Movement

**Mockup** (`movement-third-edition.html`). h1 "Movement" (L5302, singular), primary **"Record a decision"** (L5375, not "New referral"). Panels: "The day, and what is severe in it" (L5407-5409) → "Today's traffic" diagram with "Corridors" sub-heading (L5422-5453) → "Open movements", heading "Why each open movement is still open" (L5479-5481) → tabbed "The shape of the same day" — 5 tabs: Where each open movement stands, Transport legs and what has none, How long they have waited, Resolved today, Movements with no owner (L5519-5621) → footer "What reconciles" (L5636). A **per-movement detail is a header pop-out**, not a page: `<details>` "Detail" (L5487-5489) opens "Movement detail" (L8900) with Person/Journey/Which wards were asked/Escalation/Transport leg/What you can do/Watch and flag (L8633-8863), triggered by `data-mv` on any row (e.g. L7930).

**App today.** Two routes. (a) `/mockups/ward-flow/movements` → `MovementsScreen` (`movements-screen.tsx`, 377 lines). "MERGE 03 — the patient movement board... and the coordinator's live transport tracker (`LiveTracker`) fold into one screen" (L27-31). Panels: "Where each move has got to" (L92, includes a `totalsReconciliation` sentence — the mockup's "What reconciles," inline not separate), "Who is being carried" (L119), "Transport right now" (L154), "Every stage, at a glance" (L175). No "corridor"/"traffic" text anywhere in this file or `movements-derivations.ts` (grep, zero hits). No "Record a decision" text found (grep, zero hits). (b) `/mockups/ward-flow/movements/[movementId]` → `WardPatientWorkspace` (`ward-management-console.tsx`, 2832 lines) — a **full page**, not a header pop-out; the mockup delivers this same content as a drawer on the _list_ screen, not a navigation.

| Mockup element                           | App state                                                                                                          | Evidence                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| "The day" severity panel                 | Partial — spread across "Where each move has got to"/"Every stage, at a glance"                                    | `movements-screen.tsx:92,175`                                                              |
| Today's traffic / corridors diagram      | **Absent**                                                                                                         | grep "corridor"/"traffic", zero hits in `movements-screen.tsx`, `movements-derivations.ts` |
| Open movements, "why still open" framing | Partial — no matching heading text                                                                                 | `movements-screen.tsx` (whole file)                                                        |
| Shape-of-day tabs (5)                    | Partial — "Transport legs"→"Who is being carried" (L119), "stage"→"Every stage, at a glance" (L175), no tab widget | `movements-screen.tsx:119,175`                                                             |
| What reconciles (footer)                 | Partial — inline sentence, not a panel                                                                             | `movements-screen.tsx:56,93`                                                               |
| Primary "Record a decision"              | **Absent**                                                                                                         | grep, zero hits                                                                            |
| Per-movement detail (7 sections)         | Present, but as a **separate route+page**, not a same-screen pop-out                                               | `movements/[movementId]/page.tsx` → `ward-management-console.tsx`                          |

**Model needs**: none new — `journeyStages`/`transportLegs`/`transportCounts` cover the tabs; a corridor/traffic diagram would need an origin→destination aggregation not currently derived (inferred).
**Wiring**: list → per-movement page is wired (row → `/movements/[id]`); mockup instead wires row → in-page drawer, a UX-level difference for product to decide.
**Defects**: rail labels this mode "Movements" (`ward-nav.ts:120`) while the mockup's h1/filename are singular "Movement" — naming drift only.

---

## 4. Capacity

**Mockup** (`capacity-third-edition.html`). h1 "Capacity" (L5573), primary **"New referral"** (L5642) — §14.1 claims Capacity's primary action is "Hold a bed" (`WARD-FLOW-DESIGN-SYSTEM.md:1039`), but that phrase appears **nowhere** in this mockup (grep, zero hits): the table is stale against the built page, not just against the app. Panels: "Bed map" (L5666-5668), side "Network summary and ward detail" (L5683, JS-filled), "Where the mismatch is" (L5687-5689), "Wards" (L5701-5703), footer "Every figure here is invented"/"What is real"/"Reconciled to Command" (L5738-5755).

**App today.** Route `/mockups/ward-flow/capacity` → `CapacityScreen` (`capacity-screen.tsx`, 1052 lines). "MERGE 02... folded the former bed-state view and the morning bed state board into this one screen... `/mockups/ward-flow/morning` now redirects here" (`page.tsx:6-9`). Reads `useWardFlow()` (L65). Panel titles (`WardPanel`): "Where the mismatch is" (L217, exact match), "Ready now" (L300), "Bed map" (L357, matches), "Every ward in the network" (L362, close to mockup's "Wards"), "Beds freeing today" (L498), "Worth your attention" (L470).

| Mockup element                                            | App state                                                                          | Evidence                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| Bed map                                                   | Present                                                                            | `capacity-screen.tsx:357`                 |
| Where the mismatch is                                     | Present, exact title match                                                         | `capacity-screen.tsx:217`                 |
| Network summary and ward detail / Wards                   | Present as "Every ward in the network"                                             | `capacity-screen.tsx:362` vs mockup L5701 |
| Footer disclosure (invented/real/reconciled)              | Not confirmed as a distinct app panel — inferred                                   | —                                         |
| "Ready now", "Worth your attention", "Beds freeing today" | Present in app; not cross-checked against mockup's JS-filled side panel — inferred | `capacity-screen.tsx:300,470,498`         |
| Primary action "Hold a bed"                               | Absent from **both** surfaces                                                      | grep, zero hits either file               |

**Model needs**: none identified.
**Wiring**: Capacity ↔ Command (mockup footer "Reconciled to Command," L5755); app-side wiring to Command not independently confirmed (inferred).
**Defects**: §14.1's "Hold a bed" primary action for Capacity is unimplemented in the mockup itself, not only the app — zero hits in both files.

---

## 5. Ward

**Mockup** (`ward-third-edition.html`). h1 stays generic **"Ward"** (L5611); the specific ward's name renders as an h3 inside the first panel ("FSH Adult Secure", L5721) — the page title never changes per-ward. Primary "New referral" (L5681). Panels: "This ward" (L5712-5721) → "Ward figures, right now" with sub-panels Worth your attention, Coming in, Beds on the way out, Awaiting your answer (L5787-5858) → "Today's return" (L5882-5884) → "Every bed on this ward" (L5921-5923) → "The record for today" (L5938-5940) → "Where to refer" (L5999-6001) → "Print the handover sheet" (L6085). Footer includes **"Where this page came from, and what moved"** (L8863, a provenance note).

**App today.** Route `/mockups/ward-flow/ward/[unitId]` → `WardScreen` (`ward-screen.tsx`, 2352 lines). Here the **h1 is the specific ward's own name** (`unit.name`, L838) — opposite of the mockup's generic "Ward" h1. Sections: `WardPanel title="Confirm today's numbers"` (L947-948), "Bed capacity" (L1255), "Incoming referrals awaiting an answer" (L1893), "Accepted, pulled or en route here" (L2090), "Withdrawn from {unit.name}" (L2267), "Overrides recorded against {unit.name}" (L2346), and aria-label "Anything limiting who can come in right now" (L1080).

| Mockup element                         | App state                                                                                                  | Evidence                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Page title behaviour                   | **Different**: mockup h1 "Ward" stays generic, ward name is a sub-heading; app's h1 is the ward's own name | `ward-third-edition.html:5611,5721` vs `ward-screen.tsx:838` |
| Ward figures / Confirm today's numbers | Present, reworded                                                                                          | `ward-screen.tsx:947-948` vs mockup L5787                    |
| Every bed on this ward                 | Present as "Bed capacity"                                                                                  | `ward-screen.tsx:1255`                                       |
| Awaiting your answer / Where to refer  | Present as "Incoming referrals awaiting an answer"                                                         | `ward-screen.tsx:1893`                                       |
| Today's return / Coming in             | Present as "Accepted, pulled or en route here"                                                             | `ward-screen.tsx:2090`                                       |
| The record for today                   | Present as "Overrides recorded against {ward}"                                                             | `ward-screen.tsx:2346`                                       |
| "Withdrawn from {ward}"                | App-only, no matching mockup heading — inferred                                                            | `ward-screen.tsx:2267`                                       |
| Print the handover sheet               | Not found (not exhaustively searched) — inferred absent                                                    | —                                                            |
| Provenance footer ("what moved")       | Absent — expected, mockup-authoring commentary only                                                        | —                                                            |

**Model needs**: "Withdrawn" referral status and unit overrides both appear modelled (live headings) but weren't traced to field names (inferred).
**Wiring**: Ward ↔ Delays (`delays-screen.tsx:905` links here); Ward ↔ Bed board (same unit, `ward-nav.ts:235-246`).
**Defects**: none beyond the shared header findings.

---

## 6. Bed board

**Mockup** (`bed-board-third-edition.html`). h1 "Bed board" (L5511), ward name as h2 inside a ward strip ("FSH Adult Secure", L5611). Primary "New referral" (L5580). Panels: "Needs you this shift" (L5661-5663), "Every bed, and who is in it" (L5700-5702), "Either side of this ward" (L5729-5731), dynamic "The bed you have chosen" (L5985). Footer heading **"Why this page exists next to the ward home page"** (L5935) distinguishes them: the ward home page answers "what can this ward offer, and what needs an answer from it"; Bed board answers "who is in every bed, and what is happening to them today" — deliberately non-duplicate. Footer heading **"One thing this page proposes that the model cannot do today"** (L5954) actually **retracts** a suspected gap: an earlier draft wrongly said a bed cannot be joined to a person, but `Admission` carries `referralId` and `Referral` carries an optional `patientId` (L5957-5964) — **verified against the model**: both fields exist (`ward-model.ts:775,1635`). The section's real "cannot do" item is two fields "deliberately absent... Aboriginal or Torres Strait Islander status and interpreter language... pending the Aboriginal health review" (L5972-5974) — documented and deliberate, not a defect.

**App today.** Route `/mockups/ward-flow/board/[unitId]` → `WardBoard` (`ward-board.tsx`, 1981 lines). Headings: h1 = ward name (L945), "Today on this ward" (L1070-1073, figures `<dl>`), "Needs a look this shift" (L1123-1126, near-exact match), "Coming in" (L1179-1182), "Going out today" (L1229-1232), "Since yesterday" (L1310-1313), dynamic "Who is in a bed"/"Who is in this bed" (L1505-1511), "Where these beds free up to" (L1766-1770), "Who is in these beds" (L1875-1879).

| Mockup element                             | App state                                                                                              | Evidence                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Needs you this shift                       | Present, reworded "Needs a look this shift"                                                            | `ward-board.tsx:1123-1126`      |
| Every bed, and who is in it                | Present, split into detail (L1505) + people list (L1875)                                               | `ward-board.tsx:1505,1875`      |
| Either side of this ward                   | Present, split into three: Coming in / Going out today / Since yesterday                               | `ward-board.tsx:1179,1229,1310` |
| The bed you have chosen                    | Present, dynamic detail heading                                                                        | `ward-board.tsx:1505-1511`      |
| Where these beds free up to (destinations) | Present; not confirmed as a distinct mockup panel — inferred, may be inside "Either side of this ward" | `ward-board.tsx:1766`           |
| Provenance/footer commentary               | Mockup-authoring only, not expected in app                                                             | —                               |

**Model needs**: Aboriginal/Torres Strait Islander status and interpreter language exist on the patient record but are deliberately not drawn pending review (L5972-5974) — do not add them to this screen without that review completing.
**Wiring**: Bed board ↔ Ward (same unit, `ward-nav.ts:235-246`); Bed board ↔ Movements (per-bed occupant, inferred from the referralId/patientId chain, not traced to a specific link in `ward-board.tsx`).
**Defects**: none beyond the shared header findings; the mockup's self-correction (L5957-5964) is worth relaying so nobody re-litigates a "beds can't link to patients" concern already checked and closed.

---

## 7. Emergency department

**Mockup** (`emergency-department-third-edition.html`). h1 "Emergency department" (L5555), primary "New referral" (L5624). **Structurally different from the other seven files**: the whole body renders into one script-controlled mount point (`.scroll.hScroll.edScroll`, L5646) with no static per-panel `<section>` scaffolding (verified — zero static matches before the script; every `aria-label` panel match is inside a JS template string, L8721-8845). States: "No emergency department is drawn here" (empty, L8721), "What is invented and what is real" (footer, L8734), "Emergency departments" (network list, L8801), "Emergency department board" (selected-department state, L8845) — one filterable list with status chips (`CHIPS`, L7702: Everyone / Not reviewed / Under a form / No destination / For discharge / …) plus "Seen in the last twenty four hours" (L8856-8862). Selecting a person opens a **modal dialog** (`role="dialog"`, L8894) with Where they are up to / Handover / The journey the record holds (L8640-8676).

**App today.** Route `/mockups/ward-flow/ed/[edId]` → `EdScreen` (`ed-screen.tsx`, 2654 lines — the largest component in the tree). h1 = department name (L1168). Sections (`<h2 className={styles.sectionHeading}>` inside `<section aria-label=...>`): "Expects" (L1187-1188), "Referrals" (L1293-1294), "Recently answered" (L1552-1553), "Psychiatry outbox" (L1636-1637), "Raise a referral" (L1719-1720, an **inline form**, not a link), "This department's patients" (L1976-1977), "Statewide capacity (read-only)" (L2583-2584).

| Mockup element                                | App state                                                                                                  | Evidence                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| One filterable "board" list with status chips | **Absent as one list** — app splits the population into 5 separately-headed sections                       | `ed-screen.tsx:1187,1293,1552,1636,1976` vs mockup `CHIPS` L7702-7730 |
| Seen in the last 24 hours                     | Inferred partial — "Recently answered" may cover it, heading not identical                                 | `ed-screen.tsx:1552`                                                  |
| Raise a referral                              | Present, **more built than the mockup** — an inline form; the mockup's states read show no submission form | `ed-screen.tsx:1719-1720`                                             |
| Statewide capacity (read-only)                | App-only, no matching mockup heading — inferred gap in reverse                                             | `ed-screen.tsx:2583-2584`                                             |

**Model needs**: none newly identified (both surfaces read the same movement/referral shapes; not exhaustively traced given file size).
**Wiring**: Emergency department ↔ Capacity ("Statewide capacity (read-only)" implies a live read from Capacity's data, `ed-screen.tsx:2583`, not traced to a shared selector — inferred).
**Defects**: this mockup's authoring pattern (100% script-rendered, no static scaffolding) is inconsistent with the other seven, which all declare static `<section>` elements even when JS fills them — makes this screen harder to diff against §14's panel model, worth flagging to a ninth mockup's author.

---

## 8. Community team

**Mockup** (`community-team-third-edition.html`). h1 "Community team" (L4944), primary **"Contact a team"** (L5039 — the only one of these eight screens whose primary action is neither "New referral" nor "Record a decision"). Panels: dynamic standing sentence (empty h2, L5064), "Waiting for the team's answer" (L5077), "Worth attention" (L5120), "In a bed or holding one" (L5135), "Admitted while already with the team" (L5158), "Discharged into the catchment" (L5189), "This team" — catchment/hours/contacts (L5204).

**App today.** Route `/mockups/ward-flow/community/[teamId]` → `CommunityScreen` (`community-screen.tsx`, 1457 lines) — **not** `community-team-hub.tsx` (143 lines, its own `<h1>{teamName}</h1>` at L119), which the route does not import (worth a separate dead-code check, out of scope here). h1 = team name (L373). Panel titles (`WardPanel`): "Waiting for your answer" (L436), "Admitted while already with this team" (L493, exact match), "Ours, in a bed or holding one" (L568), "Expected back" (L611), "Discharged into the area" (L679), "Left the ward another way" (L755), "Worth your attention" (L816). A rail/aside covers "this team" facts — catchment, limits, contacts (L812-880).

| Mockup element                                | App state                                                                                        | Evidence                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| Waiting for the team's answer                 | Present, reworded "Waiting for your answer"                                                      | `community-screen.tsx:436`     |
| Worth attention                               | Present, "Worth your attention"                                                                  | `community-screen.tsx:816`     |
| In a bed or holding one                       | Present, "Ours, in a bed or holding one"                                                         | `community-screen.tsx:568`     |
| Admitted while already with the team          | Present, exact match                                                                             | `community-screen.tsx:493`     |
| Discharged into the catchment                 | Present, reworded "into the area"                                                                | `community-screen.tsx:679`     |
| This team (catchment/hours/contacts)          | Present, as an aside rather than a titled panel                                                  | `community-screen.tsx:812-880` |
| "Expected back" / "Left the ward another way" | App-only, no matching mockup heading — inferred gap in reverse                                   | `community-screen.tsx:611,755` |
| Primary "Contact a team"                      | Not the app's action here — shared `roleAction()` has no `community` case, only `ward`/`ed`/else | `ward-chrome-header.tsx:56-60` |

**Model needs**: "suburbs naming this team" can render "Not derivable from the catchment table" as a genuine state (`community-screen.tsx:880`) — a real, currently-unfillable field, not an oversight.
**Wiring**: Community team ↔ other teams (switcher, L972-1004); Community team ↔ Movements/Ward (via admitted/discharged rows, not individually traced).
**Defects**: none beyond the shared header findings.

---

### PROVEN BY READING

Every heading, line number, component file, hook call, rail entry, redirect, and model field
cited above was located with Grep/Read at the stated paths and lines, including the two
model-field checks for Bed board (`ward-model.ts:775,1635`) and the negative greps for "Hold a
bed," "corridor/traffic," "Record a decision," and a Service-selector/Activity/Tools drawer
anywhere in `ward-management`.

### NOT CHECKED

`ed-screen.tsx` (2654 lines) and `ward-screen.tsx` (2352 lines) were sampled by heading grep, not
read end to end — some panels may sit under headings my search terms missed. Mockup JS-rendered
content (drawers, popups, side panels) was read only where a specific claim needed it; several
"app-only, no mockup match" rows are marked inferred for this reason. `community-team-hub.tsx`'s
live-import status elsewhere in the app was not traced beyond the one route file. No code was
run; no dev server was started.

### QUESTIONS

1. Should Delays get a formal entry in `WARD-FLOW-DESIGN-SYSTEM.md` §14, given the mockup itself
   already flags the standard as silent on it?
2. For Movement, should the per-movement detail become an in-page drawer (matching the mockup) or
   stay the separate, larger route it is today (`ward-management-console.tsx`)?
3. Community team's primary action ("Contact a team") has no case in the app's `roleAction()` —
   is a team-contact action wanted, or does the "Referral board" fallback stay here too?
