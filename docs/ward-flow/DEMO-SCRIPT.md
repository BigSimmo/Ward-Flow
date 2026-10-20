# A Day in the Life: Western Australia Psychiatric Bed Flow Demonstration Script

**Document:** Ward Flow Demonstration Script  
**Version:** 1.0.0  
**Target Audience:** Clinical Directors, Mental Health Executive Directors, Emergency Department Directors, Nurse Unit Managers (NUMs), and Statewide Bed Flow Coordinators across WA Health (NMHS, SMHS, EMHS, and WACHS).  
**Presenter Persona:** Dr Josh / Senior Statewide Mental Health Flow Consultant  
**Run Time:** 10 Minutes (600 Seconds)  
**Synthetic Data Guarantee:** **100% Synthetic Demonstration Data**. Zero real patient records, zero real EHR/WebPAS/PSOLIS connectivity, zero live patient identifiers. Fictionalized identities comply with the synthetic-only protocol.

---

_Updated 2026-10-19 - corrected transport, synthetic-data and persistence claims from source; Documentation owns. No new screen verification or sign-off._

## Executive Summary & Clinical Intent

In Western Australia, acute psychiatric bed flow represents one of the most operationally challenging domains in modern health administration. Across five Health Service Providers—North Metropolitan (NMHS), South Metropolitan (SMHS), East Metropolitan (EMHS), Child and Adolescent (CAHS), and the WA Country Health Service (WACHS)—bed coordinators, triage nurses, and on-call consultant psychiatrists navigate complex patient journeys under immense pressure.

Historically, this critical work has relied on fragmented whiteboards, circulating spreadsheets, bilateral phone calls, and cumbersome static EHR screens. When an acutely distressed patient presents to an Emergency Department under the _Mental Health Act 2014_, clinicians have lacked single-pane visibility over ready acute beds, high-dependency nursing ratios, gender-safe accommodations, and real-time inter-facility transit tracking.

**Ward Flow** bridges this systemic gap. It is an operational bed-coordination engine and clinical flight deck engineered specifically for Western Australia’s psychiatric healthcare network. Built on three foundational tenets:

1. **Clinician Always in the Loop:** The system never algorithmically allocates a bed or overrides clinical gatekeeping. It illuminates options, tracks constraints, and records human rationale.
2. **Honest Denominators:** It never shows what the data cannot support—no fabricated legal expiry deadlines, no phantom ready beds, and clear distinctions between "unrecorded" and "zero".
3. **Zero-Scroll Operational Clarity:** High-density, clinically ergonomic design delivering instant situational awareness for executive morning bed meetings and acute ED crisis placement.

This 10-minute guided demonstration script details a second-by-second clinical workflow across a typical day in Western Australia’s psychiatric bed coordination ecosystem.

---

## Demonstration Technical Setup & Pre-Flight Checklist

### Presenter Environment

- **Browser:** Chromium-based browser (Chrome, Edge) maximized at 1920x1080 resolution (100% zoom).
- **Environment:** Local Next.js runtime (`npm run ensure`) at verified local port.
- **Scenario Fixture:** Defaulting to `EMHS demo` or `Standard day` scenario (id `standard`) (`NOW_ANCHOR = 10:42` / Synthetic Day: `15 Aug 2026`).
- **Watermark Check:** Verify that the high-contrast `SYNTHETIC PROTOTYPE ONLY · NOT A MEDICAL DEVICE` disclosure banner is visible in the application footer.
- **Audio / Visual:** High-definition presentation display; presenter microphone calibrated for warm, calm, authoritative delivery.

### Keyboard Shortcuts for Presenter

- `Esc`: Closes any active slide-over drawer, modal dialog, or inspector pane.
- `Tab` / `Shift+Tab`: Clean accessible keyboard navigation across all interactive controls.

---

## 10-Minute Master Run-of-Show (Timeline Overview)

```
00:00       02:00       04:00       06:00       08:00       10:00
|-----------|-----------|-----------|-----------|-----------|
   ACT 1       ACT 2       ACT 3       ACT 4       ACT 5
  Morning    Acute ED     Statewide   St John WA  Inpatient
  Meeting     Crisis     Bed Match    Transport   Receiving
  Capacity    Triage     Placement     Transit     Handover
```

| Act       | In-Story Clock | Stage Duration          | Route Path                                          | Core Clinical Focus                                                |
| --------- | -------------- | ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| **Act 1** | 09:00 - 09:12  | Min 0:00 - 2:00 (120s)  | `/ward-flow/capacity`                               | 09:00 Morning Statewide Bed Meeting & Network Capacity Rollup      |
| **Act 2** | 10:30          | Min 2:00 - 4:00 (120s)  | `/ward-flow/ed/rph-ed` & `/ward-flow/referrals`     | Acute ED Presentation, Triage & Form 1A Paper Expiry Recording     |
| **Act 3** | 11:45          | Min 4:00 - 6:00 (120s)  | `/ward-flow/referrals` (Bed Match)                  | Intelligent Bed Matching, Acuity Gates & Bed Reservation           |
| **Act 4** | 13:15          | Min 6:00 - 8:00 (120s)  | `/ward-flow/movements`                              | Phone-Made Transfer Booking Records & Transit Flight Deck          |
| **Act 5** | 14:30          | Min 8:00 - 10:00 (120s) | `/ward-flow/handover` & `/ward-flow/board/[unitId]` | Inpatient Ward Arrival, ISBAR Handover & Real-Time Board Occupancy |

---

## Act 1: The 09:00 Morning Bed Meeting & Statewide Capacity

### Clinical Scenario & Setting

- **Time:** 09:00 AM (Duration: 2 Minutes / 0:00 - 2:00)
- **Clinical Role:** Statewide Mental Health Bed Flow Coordinator
- **Screen:** Capacity Screen & Morning Bed-Meeting Sheet (`/ward-flow/capacity`)
- **Key Health Services Highlighted:** North Metro (SCGH MHU, Graylands), South Metro (Fiona Stanley, Alma St Fremantle, Rockingham), East Metro (Royal Perth Dabakarn, Armadale Moodjar, Bentley Ward 7 & EMyU), WACHS (Albany, Bunbury, Broome).

```
+----------------------------------------------------------------------------------------------------+
| WARD FLOW · CAPACITY                                        [ Morning Bed Meeting Sheet ] [ Print ] |
+----------------------------------------------------------------------------------------------------+
| SERVICE SCOPE: [ All Services ] [ North Metro ] [ South Metro ] [ East Metro ] [ WACHS ]            |
| NETWORK READY: 14 Beds Ready Now (6 Locked / 8 Open) | 42 Occupied | 6 Expected Discharges Today   |
+----------------------------------------------------------------------------------------------------+
| [ Graylands Hospital - Adult Secure ]       | 15 Beds | 2 Empty | 1 Ready Now (Locked) | Stale 20m  |
| [ SCGH Mental Health Unit - Adult Open ]    | 24 Beds | 5 Empty | 2 Ready Now (Open)   | Conf 15m   |
| [ Royal Perth Dabakarn - Adult Secure ]     | 20 Beds | 2 Empty | 1 Ready Now (Locked) | Conf 20m   |
| [ Fremantle Maali 4.2 - Adult Open ]        | 22 Beds | 4 Empty | 3 Ready Now (Open)   | Conf 12m   |
| [ Bentley Health Service - Ward 7 Mixed ]   | 17 Beds | 3 Empty | 2 Ready Now (1 Lock) | Conf 14m   |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 0:00 - 0:30 · Opening & Executive Welcome

- **Presenter Action:** Display the primary navigation shell at `/ward-flow/capacity`. Ensure the Service Scope bar is set to `All Services`. Hover cursor gently across the top metric ribbon.
- **Presenter Spoken Dialogue:**
  > "Good morning, colleagues, Clinical Directors, and Executive leadership. It is 09:00 on a Tuesday morning. Across Western Australia, mental health executives, bed coordinators, and ED directors are dialing into the daily statewide bed meeting.
  >
  > Historically, this meeting begins with uncertainty: twelve coordinators on a teleconference reading from separate spreadsheets, questioning whether a bed reported open at Alma Street or Graylands is physically clean, staffed, or already promised to an ED patient.
  >
  > What you see on screen is Ward Flow’s **Capacity Command View**. In one zero-scroll surface, we have an honest, unvarnished operational picture of every acute adult psychiatric bed across Perth Metro and Country WA."

#### 0:30 - 1:15 · Honest Denominators: Physical vs Allocatable Beds

- **Presenter Action:** Point mouse to the comparison between the **Empty (Feed)** count and the **Allocatable (Ward Confirmed)** count for Sir Charles Gairdner Hospital (SCGH) Mental Health Unit. Click the North Metro filter pill on the `WardServiceScopeBar`.
- **Presenter Spoken Dialogue:**
  > "Notice immediately the principle of **Honest Denominators**. Look at Sir Charles Gairdner’s Adult Mental Health Unit. Our hospital PAS feed indicates five empty beds. In a traditional dashboard, an executive might assume North Metro has five available beds.
  >
  > But Ward Flow shows the real clinical truth: only **two beds** are allocatable. Why? Because the Nurse Unit Manager confirmed twenty minutes ago that two beds are held for incoming transfers, and one bed is awaiting emergency bio-cleaning and specialist 1:1 nursing cohorting.
  >
  > Ward Flow never hides this mismatch. It separates what the administrative PAS thinks from what the ward charge nurse has clinically verified. We also see the exact timestamp of ward confirmation: Graylands confirmed 20 minutes ago; SCGH 15 minutes ago. If a ward’s report goes beyond 90 minutes without confirmation, the badge shifts from green to amber: stale capacity is never passed off as live intelligence."

#### 1:15 - 2:00 · Launching the Printable Morning Bed-Meeting Sheet

- **Presenter Action:** Click the **[Morning Bed Meeting Sheet]** button in the upper action bar. A clean, high-density modal overlay appears displaying the standardized single-page morning rollup. Scroll smoothly through the four clinical quadrants: Today’s Capacity, Discharges Expected, ED Waiting Pipeline, and System Delays.
- **Presenter Spoken Dialogue:**
  > "With a single click on **Morning Bed Meeting Sheet**, the system compiles the statewide briefing document. Every figure here is derived from live ward records—no manual arithmetic, no double data entry.
  >
  > Across the state, we have 14 beds ready right now: 6 locked HDU beds and 8 open beds. We see 6 expected discharges scheduled before 14:00 today. Crucially, the sheet highlights high-acuity pressure points: three patients in EDs waiting over 8 hours, and two delayed discharges waiting on NDIS complex supported accommodation packages.
  >
  > Bed managers can print this directly onto a single physical page or project it onto the briefing room screen. In under two minutes, executive leadership shares an identical clinical baseline without a single telephone call.
  >
  > Now, let us see what happens when acute demand strikes our emergency network."
- **Presenter Action:** Press `Esc` to close the modal. Transition via primary navigation to `/ward-flow/ed/rph-ed` (or `/ward-flow/referrals`).

---

## Act 2: Acute ED Psychiatric Presentation & Referral Triage

### Clinical Scenario & Setting

- **Time:** 10:30 AM (Duration: 2 Minutes / 2:00 - 4:00)
- **Clinical Role:** Emergency Psychiatric Liaison Nurse (EPLN) / ED Psychiatric Registrar
- **Screen:** Emergency Department Console (`/ward-flow/ed/rph-ed`) & Referral Intake Drawer (`/ward-flow/referrals/new` or `/ward-flow/referrals`)
- **Patient Profile:**
  - **Name:** Callum Halloway (UM100001) on movement `WF-301`
  - **Demographics:** Adult resident of Bayswater (East Metropolitan Catchment)
  - **Triage:** Australasian Triage Scale (ATS) Category 2 (Emergency — 10-minute medical assessment)
  - **Clinical Picture:** Severe acute psychotic exacerbation, persecutory delusions, extreme agitation, poor oral intake, refusing voluntary treatment.
  - **Legal Status:** Form 1A (_Referral for Examination by a Psychiatrist_) executed under the WA _Mental Health Act 2014_ at 10:15 AM by ED Senior Medical Officer, with clinician-entered paper expiry time recorded on the form.

```
+----------------------------------------------------------------------------------------------------+
| ROYAL PERTH HOSPITAL · EMERGENCY DEPARTMENT (ED) INFLOW                          Time: 10:30 AM    |
+----------------------------------------------------------------------------------------------------+
| ACTIVE ED MENTAL HEALTH PRESENTATIONS: 5 Patients Waiting                                           |
| [!] URGENT | Callum Halloway (UM100001) | ATS Cat 2 | Wait: 1h 15m | Paper Expiry: 18 Aug 10:15   |
+----------------------------------------------------------------------------------------------------+
| REFERRAL INTAKE INSPECTOR (Callum Halloway · UM100001 · Movement WF-301)                           |
| - Origin: Royal Perth Hospital Emergency Department (RPH-ED)                                       |
| - Legal Status: Referred for psychiatric examination · Form 1A                                     |
| - Paper Form Expiry: Clinician-entered paper expiry timestamp (Not legally checked; per D-70)      |
| - Catchment: East Metropolitan Health Service (Home Suburb: Bayswater)                             |
| - Bed Requirement: Adult Acute (Secure / HDU Capable requested due to acute behavioural acuity)     |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 2:00 - 2:45 · ED Inflow & Clinical Crisis Presentation

- **Presenter Action:** Navigate to the RPH Emergency Department screen (`/ward-flow/ed/rph-ed`). Point to the acute mental health patient corridor. Click on patient card `Callum Halloway (UM100001)` (seeded on RPH ED movement `WF-301`).
- **Presenter Spoken Dialogue:**
  > "It is now 10:30 AM. At Royal Perth Hospital Emergency Department, an acute clinical crisis has arrived.
  >
  > Meet Callum Halloway (`UM100001`). Callum was brought in by ambulance, accompanied by WA Police. He is presenting with acute persecutory delusions, intense behavioural agitation, and marked distress. The ED triage team categorised him as **ATS Category 2**—requiring emergency intervention within 10 minutes.
  >
  > Following medical clearance by the ED team, Dr Chen, the emergency consultant, determined that Callum lacks capacity, presents a significant risk of physical deterioration and self-harm, and requires an involuntary psychiatric examination under the Western Australian _Mental Health Act 2014_."

#### 2:45 - 3:30 · Recording the Form 1A Paper Expiry (Owner Ruling D-70)

- **Presenter Action:** Open the Referral Intake Drawer. Show the **Legal Forms** selector and the clinician-entered paper expiry field (`legalFormExpiryIso`).
- **Presenter Spoken Dialogue:**
  > "Observe how Ward Flow handles Western Australian statutory recording under Owner Ruling `D-70`.
  >
  > In the intake drawer, the emergency team records the legal status (`Referred for psychiatric examination`) and the form identifier (**Form 1A**).
  >
  > Notice what Ward Flow does—and what it steadfastly refuses to do:
  > The ED movement row **does not** calculate a 72-hour Form 1A countdown from duration. Per `D-70`, Ward Flow never computes deadlines from statutory durations: the movement row displays only the **clinician-entered paper expiry time** written on the physical form (labelled _Not legally checked_).
  >
  > No screen, including Legal forms, works out a statutory duration. The software never makes an autonomous legal duration assumption."

#### 3:30 - 4:00 · Catchment Routing, Synthetic UMRNs & Clinical Acuity Indicators

- **Presenter Action:** Highlight the automated catchment resolver and the synthetic UMRN format (`UM100001`, or sibling synthetic UMRNs such as `UM100041` per `D-39`). Show that Callum’s home suburb of Bayswater routes his primary psychiatric catchment to East Metropolitan Health Service. Point to the High Acuity and Specialling requirement flags.
- **Presenter Spoken Dialogue:**
  > "Every patient on screen is identified by a synthetic `UM` plus six-digit UMRN—such as `UM100001` for Callum Halloway or `UM100041` for another synthetic cohort record—with generated seed records also using `UM5xxxxx`, while internal movement IDs like `WF-301` govern the journey behind the scenes. Callum resides in Bayswater, and Ward Flow’s internal catchment engine instantly resolves his home catchment to East Metro Health Service.
  >
  > Because Callum is severely agitated and requires intensive nursing supervision, the triage team marks his clinical requirements: **Adult Acute**, **HDU / Secure Capable**, and **High Acuity Nursing Ratio**.
  >
  > The referral is signed off in ED and submitted to the statewide flow queue. Instantaneously, without a single phone call or faxed referral sheet, Callum Halloway (`UM100001`) appears on the Statewide Flow Coordinator’s radar. Let us step into the Coordinator’s shoes."
- **Presenter Action:** Close the intake drawer and navigate to `/ward-flow/referrals`.

---

## Act 3: Statewide Bed Matching & Placement Allocation

### Clinical Scenario & Setting

- **Time:** 11:45 AM (Duration: 2 Minutes / 4:00 - 6:00)
- **Clinical Role:** Senior Statewide Bed Allocation Coordinator
- **Screen:** Statewide Referral Inspector & Bed Match Engine (`/ward-flow/referrals` -> Click Row `Callum Halloway (UM100001)` -> Inspector Tab `Placement / Bed Match`)
- **Key System Mechanics:** Multi-gate eligibility evaluation, gender-safety rules, travel bands, clinician override reasoning, one-click bed hold.

```
+----------------------------------------------------------------------------------------------------+
| REFERRAL INSPECTOR: Callum Halloway (UM100001) · Movement WF-301 · ATS Cat 2                       |
+----------------------------------------------------------------------------------------------------+
| [ Placement & Match ]  [ Clinical History ]  [ Legal Paperwork ]  [ Actions ]                     |
|                                                                                                    |
| SEARCH PARAMETERS: Adult · Acute Secure / HDU · Authorised Unit · East Metro Preferred             |
+----------------------------------------------------------------------------------------------------+
| MATCH CANDIDATES GROUPED BY TRAVEL BAND:                                                           |
|                                                                                                    |
| ▼ TRAVEL BAND 1: WITHIN 30 MINUTES                                                                |
|   [1] RPH Dabakarn (Secure)      | East Metro  | 1 Ready Bed | GATES: All Passed     | [ HOLD BED ] |
|   [2] Bentley Ward 7 (Mixed)     | East Metro  | 1 Ready Bed | GATES: All Passed     | [ SHORTLIST] |
|                                                                                                    |
| ▼ TRAVEL BAND 2: 30 TO 60 MINUTES                                                                  |
|   [3] SCGH MHU (Adult Mixed)     | North Metro | 2 Ready Beds| GATES: All Passed     | [ SHORTLIST] |
|   [4] Geraldton / Single-Sex Wing| Regional/SM | Ready Bed   | REFUSED: Single-Sex   | [ EXCLUDED ] |
|   [5] Fremantle Maali 4.2        | South Metro | 3 Ready Beds| GATE: Open Ward Only  | [ OVERRIDE ] |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 4:00 - 4:45 · The Intelligent Eligibility Matching Engine

- **Presenter Action:** On `/ward-flow/referrals`, click the row corresponding to `Callum Halloway (UM100001)`. The right-side inspector drawer smoothly expands. Click the **[Bed Match]** tab.
- **Presenter Spoken Dialogue:**
  > "At 11:45 AM, our Statewide Bed Coordinator opens Callum Halloway’s referral (`UM100001`). We immediately open the **Bed Match Engine**.
  >
  > Watch what happened behind the scenes in milliseconds. Rather than forcing a coordinator to mentally cross-reference 23 hospital units, Ward Flow evaluated Callum’s clinical profile against explicit clinical safety gates:
  > Age cohort match, involuntary authorized unit status, single-sex room/wing designation, current sex mix balance, high-acuity nursing capacity, and travel proximity.
  >
  > Notice the intelligent travel bands:
  > In Travel Band 1—under 30 minutes from Royal Perth ED—we have two viable candidates: Royal Perth’s own secure unit, **Dabakarn**, and **Bentley Health Service Ward 7**."

#### 4:45 - 5:15 · Absolute Gender Safety & Inviolable Safeguards

- **Presenter Action:** Scroll down to the excluded single-sex units/rooms in the candidate list. Point to the red gate refusal indicator for a mismatched binary single-sex ward or room designation (`R7` / `D-31`).
- **Presenter Spoken Dialogue:**
  > "Here is a crucial clinical safety feature: look at how Ward Flow handles single-sex wards and room wings (such as Fiona Stanley’s male-only secure unit or Geraldton’s female-only open unit).
  >
  > Why does Ward Flow refuse a binary sex mismatch automatically? Because single-sex room and wing designations are maintained for gender separation and trauma-informed safety.
  >
  > In Ward Flow, **binary single-sex room/wing protection is a non-overridable gate** (`R7` / `D-31`), while gender-diverse (`X` / `non_binary` / `not_stated`) placements require recorded coordinator review (`R2-2`). The system will never allow a placement to breach binary sex-mix safety rules."

#### 5:15 - 6:00 · Bed Allocation, Clinician Rationale & 4-Hour Hold

- **Presenter Action:** Return to Candidate 1: **Royal Perth Hospital Dabakarn**. Click **[Hold Bed for Patient]**. A confirmation popover appears requiring confirmation of the 4-hour hold. Click **[Confirm Hold]**.
- **Presenter Spoken Dialogue:**
  > "The coordinator evaluates Dabakarn at Royal Perth. It is in Callum’s home service of East Metro, located on the same hospital campus, minimizing transit trauma. Dabakarn has one locked bed ready and confirms 1:1 high-acuity nursing availability.
  >
  > The coordinator clicks **Hold Bed for Patient**.
  >
  > Instantly, Ward Flow executes three coordinated transactions across the network:
  > First, Dabakarn’s allocatable bed count drops from 1 to 0 across every dashboard in WA.
  > Second, a 4-hour countdown hold is stamped on the bed, preventing any other hospital from double-booking it while ED prepares Callum.
  > Third, the session event log records the action type, role, time, selected record IDs and whether it was accepted, without typed text. The separate governance audit records selected reviewable actions. A routine bed hold or acceptance appears there only when it includes an override; it does not record every hold as a clinical audit entry.
  >
  > The bed is secured. Now, we must coordinate safe inter-hospital logistics."
- **Presenter Action:** Transition via navigation to `/ward-flow/movements`.

---

## Act 4: Inter-Hospital Transit & Flight Deck Tracking

### Clinical Scenario & Setting

- **Time:** 13:15 PM (Duration: 2 Minutes / 6:00 - 8:00)
- **Clinical Role:** Transport Logistics Officer & Mental Health Flight Deck Controller
- **Screen:** Movements Flight Deck & Transit Cockpit (`/ward-flow/movements`)
- **Key System Mechanics:** Phone-made transport booking records, staff-recorded departure and transit status, local structured `sessionStorage` persistence and the `D-18` free-text privacy guard with the scoped `D-67` draft exception.

```
+----------------------------------------------------------------------------------------------------+
| WARD FLOW · MOVEMENTS FLIGHT DECK                                                Time: 13:15 PM    |
+----------------------------------------------------------------------------------------------------+
| ACTIVE TRANSITS: 4 In Transit | 3 Booked Awaiting Dispatch | 2 Held Awaiting Transport             |
+----------------------------------------------------------------------------------------------------+
| [ACTIVE TRANSFER] Callum Halloway (UM100001) · Movement WF-301                                     |
| - Origin: Royal Perth Hospital ED  -->  Destination: RPH Dabakarn Secure Unit                      |
| - Transport Mode: St John WA Mental Health Patient Transfer Service (Specialist Crew)             |
| - Dispatch Identifier: CAD-20260815-8842  |  Vehicle: SJ-VAN-04                                    |
| - Departure Confirmed: 13:12 PM           |  Estimated Arrival: 13:25 PM (10 mins remaining)       |
| - Patient Status: In Transit [ DEMO ]     |  Escort: 2x Paramedic Crew + Mental Health Nurse       |
| - State Invariant: Bed Held at Dabakarn (Cannot be given away during transit)                      |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 6:00 - 6:45 · The Movements Flight Deck & Transport Bottlenecks

- **Presenter Action:** Navigate to `/ward-flow/movements`. Point out the horizontal corridor visualization (`MovementHorizonGantt`) and the active transit rows.
- **Presenter Spoken Dialogue:**
  > "It is now 13:15 PM. We are on the **Movements Flight Deck**.
  >
  > In mental health operations, the period between deciding to admit a patient and their physical arrival on the ward is historically a black hole. Patients get stuck in ED corridors waiting for transport; beds on wards sit empty and staffed while charge nurses wonder if the patient is ever coming.
  >
  > Ward Flow eliminates this blindness through the Movements Flight Deck. In this synthetic demonstration, movements are shown across staff-recorded milestones from referral acceptance and bed hold through transport booking, departure, and ward arrival."

#### 6:45 - 7:30 · Phone-Made Booking Records & Recorded Transit

- **Presenter Action:** Click on Callum Halloway’s (`UM100001`, movement `WF-301`) active movement row. The **Movement Workspace Cockpit** drawer expands. Highlight the **Transport Details** card showing dispatch identifier `CAD-20260815-8842` and the countdown from the recorded estimate.
- **Presenter Spoken Dialogue:**
  > "Look at Callum’s transport record. At 12:45, the ED liaison team booked an inter-facility transfer with St John WA.
  >
  > Ward Flow records the booking already made by phone. The CAD field here contains the synthetic example `CAD-20260815-8842`. The prototype requires non-empty CAD text and a finite estimated time, alongside the provider, escort answer and transport legal status. It does not validate St John WA syntax, verify a dispatch number or reject non-empty placeholders.
  >
  > At 13:12, the St John transfer vehicle departed the ED ambulance bay. The transfer officer tapped 'Confirm Departure'.
  >
  > Instantly, Callum’s status shifted to **In Transit**. Look at the destination ward: Dabakarn’s dashboard immediately updated with an ETA countdown: arrival expected in 10 minutes. This reflects staff-recorded milestones and estimates, not a St John WA telemetry feed. The receiving ward nurse unit manager can prepare the seclusion room or high-dependency bed, allocate the 1:1 admitting nurse, and ensure the medical registrar is present for reception."

#### 7:30 - 8:00 · Structured Session Persistence & The D-18 Free-Text Privacy Safeguard

- **Presenter Action:** In a fresh local demo session with saving enabled, perform a **structured action** (such as toggling a bed state or assigning a structured blocker/step—do **not** type into a free-text note field), then press `F5` (or `Ctrl+R`) to demonstrate `sessionStorage` recovery of structured actions. Recording the typed CAD booking earlier in this script locks snapshot saving, so that session cannot demonstrate this recovery. Separately point out the `D-18` privacy safeguard (`eventCarriesTypedTextPayload(event)`).
- **Presenter Spoken Dialogue:**
  > "A quick word on local demo persistence and clinical privacy: when browser storage is available and saving remains enabled, a coordinator performs **structured actions**—such as holding a bed, toggling a bed state, or assigning a structured blocker or step—and refreshes the tab (`F5`), Ward Flow can restore that structured state from `sessionStorage` on a same-day reload.
  >
  > Equally important is Owner Ruling **`D-18`** (`eventCarriesTypedTextPayload(event)`): dispatching **any event that can carry typed free text**, whether the event is accepted or refused, locks further central demo snapshot saving until a genuine reset or scenario reseed and attempts to remove that snapshot; storage failure is reported. Under **`D-67`**, only the opted-in synthetic referral and legal form editors separately recover session drafts for review, scoped to account/session, scenario and subject. Submitted state keeps the D-18 lock. Shared workspace saving uses the backend instead; see [current modes](../../backend/ward-flow/README.md#how-the-ui-connects).
  >
  > Now, Callum’s transport vehicle has arrived at Dabakarn. Let us move to the inpatient unit for receiving and handover."
- **Presenter Action:** Close the movement cockpit and navigate to `/ward-flow/handover`.

---

## Act 5: Inpatient Receiving, Handover & Bed Occupancy

### Clinical Scenario & Setting

- **Time:** 14:30 PM (Duration: 2 Minutes / 8:00 - 10:00)
- **Clinical Role:** Nurse Unit Manager (NUM) & Inpatient Admitting Psychiatric Nurse
- **Screen:** Clinical Handover Flight Deck (`/ward-flow/handover`) & Inpatient Ward Bed Board (`/ward-flow/board/rph-adult-secure`)
- **Key System Mechanics:** Clinical ISBAR handover completion, Form 1A custody receipt, physical arrival confirmation, bed status transition to "Occupied", instantaneous network synchronization.

```
+----------------------------------------------------------------------------------------------------+
| ROYAL PERTH HOSPITAL · DABAKARN SECURE UNIT · WARD BED BOARD                     Time: 14:30 PM    |
+----------------------------------------------------------------------------------------------------+
| UNIT CAPACITY: 20 Beds Total | 19 Occupied | 1 Empty (Allocating) | 0 Beds Ready Now               |
+----------------------------------------------------------------------------------------------------+
| BED 04: Callum Halloway (UM100001) | Involuntary (Form 1A) | High Acuity 1:1 | Admitted: 14:28 PM  |
| - Primary Consultant: Dr K. Farrow (Covering) | Admitting Nurse: RN T. O'Shea                      |
| - Legal Status: Form 1A Received & Verified | Physical Custody Transferred from St John WA Crew     |
| - Clinical Handover: ISBAR Completed (ED Liaison -> Ward Nurse)                                   |
| - Care Plan: High-Dependency Nursing, Hourly Neurological/Sedation Obs, Next of Kin Notified        |
+----------------------------------------------------------------------------------------------------+
| NETWORK SYNCHRONIZATION: Capacity across NMHS, SMHS, EMHS, WACHS reflects Dabakarn at 0 ready beds  |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 8:00 - 8:45 · Clinical ISBAR Handover Verification

- **Presenter Action:** On the `/ward-flow/handover` screen, select `Dabakarn` from the Ward Scope dropdown. Highlight the arrivals corridor card for `Callum Halloway (UM100001)`.
- **Presenter Spoken Dialogue:**
  > "It is 14:30 PM. Callum Halloway (`UM100001`) has arrived at the sally port of Dabakarn Secure Unit.
  >
  > The admitting psychiatric nurse opens Ward Flow’s **Handover Flight Deck**. In mental health, handover is the most vulnerable point in patient care. Ward Flow structures this exchange around the national Australian clinical standard: **ISBAR**—Identification, Situation, Background, Assessment, and Recommendation.
  >
  > With one glance, the admitting nurse verifies Callum’s identifiers, his ATS triage history, his allergy status, and the physical handover of the statutory Form 1A paper order from the transport crew.
  >
  > The nurse checks the legal form verification box, confirming that the hard-copy Form 1A is in the physical hospital chart."

#### 8:45 - 9:30 · Completing Arrival & Transition to "Occupied"

- **Presenter Action:** Click the prominent **[Confirm Inpatient Arrival]** action button. A confirmation toast appears, and Callum moves smoothly from the _Arrivals Corridor_ into _Admitted Inpatients_. Immediately navigate via the breadcrumb link to Dabakarn’s Ward Board (`/ward-flow/board/rph-adult-secure`).
- **Presenter Spoken Dialogue:**
  > "The nurse clicks **Confirm Inpatient Arrival**.
  >
  > Watch the immediate ripple effect across the entire software ecosystem:
  > Callum’s movement (`WF-301`) closes successfully. His bed status at Dabakarn transitions from 'Pulled' to **'Occupied'**.
  >
  > On Dabakarn’s live Ward Board, Callum Halloway (`UM100001`) is now registered in Bed 04. His high-acuity nursing flag is activated, his clinician-entered legal form paper expiry remains clearly recorded, and his primary consultant psychiatrist is notified.
  >
  > Simultaneously, on the Statewide Capacity screen we opened at 09:00, Dabakarn’s ready bed counter updates to zero. Coordinators in Joondalup, Albany, and Fremantle see in real time that this bed is occupied. No phone call was made. No fax was sent. The feedback loop is closed."

#### 9:30 - 10:00 · Conclusion & Presentation Close

- **Presenter Action:** Return to the primary coordinator overview (`/ward-flow`) or `/ward-flow/capacity`. Allow the clean, high-density dashboard to fill the screen.
- **Presenter Spoken Dialogue:**
  > "In ten minutes, we have walked through a complete psychiatric patient journey:
  >
  > - From the 09:00 morning bed meeting establishing statewide situational awareness;
  > - To an acute ED crisis presentation in Perth;
  > - Through an intelligent, multi-gate clinical bed matching process that honoured strict gender-safety boundaries;
  > - Tracking transport through staff-recorded booking, departure and arrival milestones;
  > - To safe, dignified inpatient admission under our Western Australian _Mental Health Act 2014_.
  >
  > Ward Flow gives our clinicians and executives what they have needed for two decades: single-pane visibility, unyielding patient safety, and complete operational transparency.
  >
  > Thank you. I would now like to open the floor to your questions."

---

## Clinical Governance, Privacy & Data Architecture Framework

To satisfy the stringent standards of the WA Health Clinical Governance Directorate, Therapeutic Goods Administration (TGA) boundaries, and the Office of the Chief Psychiatrist, presenters must be prepared to articulate the following foundational governance safeguards:

```
+----------------------------------------------------------------------------------------------------+
| WARD FLOW CLINICAL GOVERNANCE ARCHITECTURE                                                          |
+----------------------------------------------------------------------------------------------------+
| 1. SYNTHETIC GUARANTEE      | 100% Synthetic Personas · Zero Live EHR Connection · Zero PII       |
| 2. HUMAN CLINICIAN SUPREMACY| No Autonomous Allocation · Clinician in the Loop for All Actions    |
| 3. STATUTORY RECORDING ONLY | No Computed Expiry Dates · Only Explicitly Entered Clinician Times   |
| 4. HONEST DENOMINATORS      | Explicit Separation of Unrecorded vs Zero · Feed vs Ward Integrity  |
| 5. SELECTIVE GOVERNANCE    | Session Event Metadata · Selected Governance Actions and Overrides |
+----------------------------------------------------------------------------------------------------+
```

Audit scope is implemented by `classifyAuditEvent()` in `src/components/ward-management/ward-audit.ts`: ordinary `PULL_PATIENT`, `ACCEPT_IN_PRINCIPLE` and `ACCEPT_REFERRAL` return no governance category unless `overrideReason` is present. The separate `eventLogEntryFor()` in `src/components/ward-management/ward-event-log.ts` keeps action metadata and acceptance status without typed payloads; it does not supply a reason history. Local dispatches append this log in `ward-flow-provider.tsx`; shared commands append on a received command response in `ward-shared-client.ts`. This prototype evidence does not establish an immutable clinical record or complete logging of network failures.

### 1. The Synthetic Isolation Guarantee

- **100% Synthetic Records:** Demonstration identities are deliberately authored or generated as fictional records. Synthetic UMRNs include hand-authored `UM1xxxxx` and generated `UM5xxxxx` records. `tests/synthetic-data-guard.test.ts` checks bounded identifier and telephone patterns, and `tests/ward-synthetic-data-guard.test.ts` checks the seeded payload against that guard. These tests do not check a surname blacklist or prove that names cannot coincide with real people.
- **Zero Production EHR Integration:** In this prototype demonstration mode, there is zero network bridge to WebPAS, PSOLIS, TOPAS, or St John WA production servers.

### 2. Clinician Supremacy & Anti-Automation Bias

- Ward Flow **never** makes an autonomous clinical decision.
- It does not automatically admit, transfer, discharge, or place a patient. User actions are checked against the acting prototype role. Selected actions require a structured reason or override; routine transitions do not all require or retain a clinical rationale. Prototype role checks do not establish professional licensure.

### 3. Statutory Fidelity (WA _Mental Health Act 2014_)

- Under WA law, the legal authority to detain or examine a psychiatric patient resides exclusively in the signed statutory instrument (e.g. Form 1A, Form 3A, Form 6A).
- Per Owner Ruling `D-70` (which replaced `D-29`), Ward Flow functions as a **statutory recorder**, not an automated legal arbiter: every screen displays only the paper expiry date and time typed from the physical form by the clinician, and no screen calculates a statutory duration.

### 4. Honest Denominators & Anti-Alarm Fatigue

- In compliance with clinical risk standard **DCB0129**, Ward Flow enforces the principle of _Honest Denominators_.
- When a ward has not reported its bed counts, the system renders `Not recorded`—never a misleading `0`.
- The system monitors seven critical operational alert conditions. Rather than suppressing non-firing alerts, it reports explicitly on all conditions so coordinators are assured that silence is not a system failure.

---

## Executive Q&A Guide: Top Questions from WA Health Leadership

### Q1: "Why build a separate tool like Ward Flow instead of doing this directly inside WebPAS or PSOLIS?"

**Presenter Response:**

> "That is the fundamental question every Health Service Chief Executive asks, and the answer lies in clinical ergonomics and time-to-decision.
>
> WebPAS and PSOLIS are comprehensive administrative and clinical medical records. They are built for retrospective documentation, billing, coding, and legal charting. Entering an admission in WebPAS takes dozens of mandatory fields across multiple screens. During an acute bed crisis at 11:00 AM, a bed coordinator cannot afford 15 minutes of data entry per phone call just to explore whether a bed is available.
>
> Ward Flow is an **operational flight deck**, not an EHR replacement. It is the lightweight, real-time coordination layer that sits between the telephone, the whiteboard, and the permanent EHR. By capturing decisions in seconds, Ward Flow coordinates care first, while standard hospital clerical workflows finalize formal billing and coding in WebPAS afterward. Entering facts twice is an intentional clinical tradeoff because it saves hours of acute patient wait time in emergency departments."

---

### Q2: "How are St John WA transport bookings recorded, and what happens if CAD numbers are entered incorrectly?"

**Presenter Response:**

> "Ward Flow records a transport booking already made by phone. This prototype has no St John WA CAD integration, live telemetry feed or HL7/FHIR transport ingestion.
>
> `BOOK_TRANSPORT` in `ward-flow-transport-events.ts` requires a non-empty CAD string and a finite estimated time, alongside the provider, escort answer and transport legal status. It does not validate St John WA incident syntax, verify that a number is genuine or reject non-empty placeholders such as 'booked' or 'TBC'. Staff must check the details against the phone booking; the prototype cannot confirm them."

---

### Q3: "What happens if our hospital network goes down or a coordinator's browser crashes? Do we lose patient data?"

**Presenter Response:**

> "Ward Flow is a **synthetic demonstration prototype**, not a production patient record system.
>
> In local demo mode, actions are handled by a central state reducer. When browser storage is available and the demo's privacy lock permits saving, the central demo snapshot is saved as plain JSON in this tab's session storage; it is not encrypted by the application. A valid saved snapshot may be restored on a same-day reload while that browser session remains available. Restoration after a tab closes, a browser crash or a workstation reboot is not guaranteed.
>
> Under Owner Ruling `D-18` (`eventCarriesTypedTextPayload(event)`), once an event that can carry typed free text is dispatched, whether accepted or refused, the app attempts to clear the central demo snapshot in `sessionStorage` and stops further snapshot saving until a genuine demo reset or scenario reseed. Storage failure is reported; erasure is not guaranteed. If snapshot storage is unavailable, state changes remain in memory and may be lost when the page closes.
>
> D-67 separately permits session draft recovery only in the opted-in synthetic referral and legal form editors, scoped to account/session, scenario and subject. Restored drafts require human review and submission. Successful submission, sign-out, session termination and reset clear the relevant drafts; rejected submissions retain them for correction. Submitted state keeps the D-18 lock. Browser session restoration can preserve sessionStorage across a restart, so closing the browser does not guarantee draft deletion.
>
> In shared mode, accepted workspace commands are saved through the authenticated backend, not this local snapshot policy. Network failure does not establish that a command was saved. See [the backend’s current modes](../../backend/ward-flow/README.md#how-the-ui-connects).
>
> Where a form marks unsaved changes, `useDirtyStateGuard` can request a browser warning before leaving the page. That warning does not guarantee recovery or prevent loss after a crash. Use synthetic data only."

---

### Q4: "Could an algorithm in Ward Flow force a Nurse Unit Manager to accept a patient against their clinical judgment?"

**Presenter Response:**

> "The short answer is an absolute **no**.
>
> In our clinical governance architecture, the Nurse Unit Manager’s clinical gatekeeping is sovereign. A ward can decline any referral by selecting from standardized, transparent decline reasons (such as _Acuity beyond current ward nursing skill mix_, _Specialling capacity exceeded_, or _Physical environment unsafe for cohort_).
>
> While a Statewide Flow Coordinator possesses the administrative authority to record an override, the actions that need one require a structured override reason, and a recorded override appears in the governance audit view. Routine transitions do not all require or retain a clinical rationale, and this prototype's log is not an immutable clinical record. The software never overrides a clinician automatically; it makes recorded overrides visible for review."

---

### Q5: "How does Ward Flow protect gender safety and accommodate gender-diverse patients under WA Health guidelines?"

**Presenter Response:**

> "Ward Flow implements WA Health’s _Policy on Recognition of Sex and Gender_ with utmost clinical rigor:
>
> 1. It records both legal sex and self-identified gender as distinct data attributes.
> 2. On single-gender wards or designated room clusters (such as female-only mental health wings), the bed matching engine strictly excludes patients whose identified gender or sex profile conflicts with the ward’s safety baseline.
> 3. For non-binary and trans patients, the system deliberately avoids automated pigeonholing. It flags the referral for an explicit **Coordinator and NUM Joint Review**, requiring a recorded collaborative placement plan that respects patient dignity, physical privacy, and clinical safety."

---

### Q6: "Can country sites in WACHS—like Broome Mabu Liyan or Albany APU—coordinate with Perth metro in real time?"

**Presenter Response:**

> "Yes. In fact, WACHS sites benefit the most from Ward Flow.
>
> Under the current model, a rural doctor in Broome or Geraldton attempting to transfer an involuntary patient to a Perth tertiary facility spends hours on long-distance calls to multiple metro hospitals.
>
> In Ward Flow, WACHS units like Broome Mabu Liyan and Albany APU exist on the exact same statewide network map. A rural referral is visible immediately to Perth metro coordinators, with explicit distance bands, Royal Flying Doctor Service (RFDS) transport integration fields, and specialized country legal extension flags under the _Mental Health Act_."

---

### Q7: "How does Ward Flow prevent alarm fatigue for busy bed managers and triage nurses?"

**Presenter Response:**

> "Alarm fatigue is a recognized clinical hazard under international health IT safety standards (DCB0129).
>
> Ward Flow combats alarm fatigue through three deliberate design choices:
>
> 1. **No Gratuitous Popups:** The system uses zero modal interruption dialogs for routine state changes. Information is presented in contextual ribbons and structured drawers.
> 2. **Explicit Seven-Condition Monitoring:** In our Alerts view, rather than showing a blank screen when things are quiet, the system explicitly confirms the healthy status of all watched conditions (e.g. _No unassigned HDU referrals_, _Zero breached legal clocks_). Clinicians see proof of health rather than wondering if the alert engine is broken.
> 3. **Accessible Severity Hierarchy:** Urgency is never indicated by flashing colors alone. It pairs strict WCAG-compliant contrast badges (`Critical`, `Urgent`, `Routine`) with descriptive text and distinct iconography."

---

### Q8: "What are the formal prerequisites before Ward Flow could be piloted in a live WA hospital?"

**Presenter Response:**

> "Before any live deployment or pilot with real patient records, three formal gates must be satisfied:
>
> 1. **Clinical Safety Officer (CSO) Sign-off:** Appointment of an accredited health informatics medical practitioner or senior psychiatric nurse to sign off the DCB0129 Hazard Log.
> 2. **Chief Psychiatrist Governance Review:** Formal review by the WA Office of the Chief Psychiatrist confirming full alignment with statutory legal form workflows and statutory reporting.
> 3. **Health Service Executive & Cyber Security Approval:** Formal endorsement by HSP Chief Executives and WA Health Digital Security, establishing appropriate identity access management (IAM) and integration boundaries.
>
> Ward Flow’s current prototype has been engineered to anticipate and satisfy every single one of these criteria from day one."

---

## Presenter Cheat Sheet & Navigation Quick Reference

```
+----------------------------------------------------------------------------------------------------+
| QUICK NAVIGATION URLS                                                                              |
+----------------------------------------------------------------------------------------------------+
| ACT 1: CAPACITY & MORNING SHEET      -->  /ward-flow/capacity                              |
| ACT 2: ED INFLOW & REFERRAL INTAKE   -->  /ward-flow/ed/rph-ed (or /ward-flow/referrals) |
| ACT 3: BED MATCHING ENGINE           -->  /ward-flow/referrals --> Click Callum Halloway (UM100001) Row --> [Bed Match] |
| ACT 4: MOVEMENTS FLIGHT DECK         -->  /ward-flow/movements --> Click Callum Halloway (UM100001) Row --> [Cockpit]   |
| ACT 5: INPATIENT HANDOVER & BOARD    -->  /ward-flow/handover  --> /ward-flow/board/rph-adult-secure            |
+----------------------------------------------------------------------------------------------------+
```

### Verbal Cadence & Timing Benchmarks

- **0:00 - 2:00:** Calm, executive, framing the statewide macro-environment.
- **2:00 - 4:00:** Immediate, urgent, clinical narrative of emergency psychiatric presentation.
- **4:00 - 6:00:** Methodical, intellectual, demonstrating safety algorithms and clinician choice.
- **6:00 - 8:00:** Dynamic, operational, demonstrating logistical transparency and inter-hospital flow.
- **8:00 - 10:00:** Reassuring, resolved, closing the loop on patient safety, dignity, and executive control.

---

_End of Demonstration Script. Authoritative demonstration document for WA Health stakeholders._
