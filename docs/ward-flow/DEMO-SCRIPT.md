# A Day in the Life: Western Australia Psychiatric Bed Flow Demonstration Script

**Document ID:** WF-60  
**Version:** 1.0.0  
**Target Audience:** Clinical Directors, Mental Health Executive Directors, Emergency Department Directors, Nurse Unit Managers (NUMs), and Statewide Bed Flow Coordinators across WA Health (NMHS, SMHS, EMHS, and WACHS).  
**Presenter Persona:** Dr Josh / Senior Statewide Mental Health Flow Consultant  
**Run Time:** 10 Minutes (600 Seconds)  
**Synthetic Data Guarantee:** **100% Synthetic Demonstration Data**. Zero real patient records, zero real EHR/WebPAS/PSOLIS connectivity, zero live patient identifiers. Fictionalized identities comply with the synthetic-only protocol.

---

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
- **Scenario Fixture:** Defaulting to `EMHS demo` or `Standard night` scenario (`NOW_ANCHOR = 10:42` / Synthetic Day: `15 Aug 2026`).
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

| Act       | In-Story Clock | Stage Duration          | Route Path                                                          | Core Clinical Focus                                                |
| --------- | -------------- | ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Act 1** | 09:00 - 09:12  | Min 0:00 - 2:00 (120s)  | `/mockups/ward-flow/capacity`                                       | 09:00 Morning Statewide Bed Meeting & Network Capacity Rollup      |
| **Act 2** | 10:30          | Min 2:00 - 4:00 (120s)  | `/mockups/ward-flow/ed/rph-ed` & `/mockups/ward-flow/referrals`     | Acute ED Presentation, Triage & Form 1A Paper Expiry Recording     |
| **Act 3** | 11:45          | Min 4:00 - 6:00 (120s)  | `/mockups/ward-flow/referrals` (Bed Match)                          | Intelligent Bed Matching, Acuity Gates & Bed Reservation           |
| **Act 4** | 13:15          | Min 6:00 - 8:00 (120s)  | `/mockups/ward-flow/movements`                                      | St John WA Transfer Booking, CAD Integration & Transit Flight Deck |
| **Act 5** | 14:30          | Min 8:00 - 10:00 (120s) | `/mockups/ward-flow/handover` & `/mockups/ward-flow/board/[unitId]` | Inpatient Ward Arrival, ISBAR Handover & Real-Time Board Occupancy |

---

## Act 1: The 09:00 Morning Bed Meeting & Statewide Capacity

### Clinical Scenario & Setting

- **Time:** 09:00 AM (Duration: 2 Minutes / 0:00 - 2:00)
- **Clinical Role:** Statewide Mental Health Bed Flow Coordinator
- **Screen:** Capacity Screen & Morning Bed-Meeting Sheet (`/mockups/ward-flow/capacity`)
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

- **Presenter Action:** Display the primary navigation shell at `/mockups/ward-flow/capacity`. Ensure the Service Scope bar is set to `All Services`. Hover cursor gently across the top metric ribbon.
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
- **Presenter Action:** Press `Esc` to close the modal. Transition via primary navigation to `/mockups/ward-flow/ed/rph-ed` (or `/mockups/ward-flow/referrals`).

---

## Act 2: Acute ED Psychiatric Presentation & Referral Triage

### Clinical Scenario & Setting

- **Time:** 10:30 AM (Duration: 2 Minutes / 2:00 - 4:00)
- **Clinical Role:** Emergency Psychiatric Liaison Nurse (EPLN) / ED Psychiatric Registrar
- **Screen:** Emergency Department Console (`/mockups/ward-flow/ed/rph-ed`) & Referral Intake Drawer (`/mockups/ward-flow/referrals/new` or `/mockups/ward-flow/referrals`)
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
| - Paper Form Expiry: Clinician-entered paper expiry timestamp (Not legally checked; per D-29)      |
| - Catchment: East Metropolitan Health Service (Home Suburb: Bayswater)                             |
| - Bed Requirement: Adult Acute (Secure / HDU Capable requested due to acute behavioural acuity)     |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 2:00 - 2:45 · ED Inflow & Clinical Crisis Presentation

- **Presenter Action:** Navigate to the RPH Emergency Department screen (`/mockups/ward-flow/ed/rph-ed`). Point to the acute mental health patient corridor. Click on patient card `Callum Halloway (UM100001)` (seeded on RPH ED movement `WF-301`).
- **Presenter Spoken Dialogue:**
  > "It is now 10:30 AM. At Royal Perth Hospital Emergency Department, an acute clinical crisis has arrived.
  >
  > Meet Callum Halloway (`UM100001`). Callum was brought in by ambulance, accompanied by WA Police. He is presenting with acute persecutory delusions, intense behavioural agitation, and marked distress. The ED triage team categorised him as **ATS Category 2**—requiring emergency intervention within 10 minutes.
  >
  > Following medical clearance by the ED team, Dr Chen, the emergency consultant, determined that Callum lacks capacity, presents a significant risk of physical deterioration and self-harm, and requires an involuntary psychiatric examination under the Western Australian _Mental Health Act 2014_."

#### 2:45 - 3:30 · Recording the Form 1A Paper Expiry (Owner Ruling D-29)

- **Presenter Action:** Open the Referral Intake Drawer. Show the **Legal Forms** selector and the clinician-entered paper expiry field (`legalFormExpiryIso`). Note how statutory duration reference calculators are isolated to `/mockups/ward-flow/legal-forms`.
- **Presenter Spoken Dialogue:**
  > "Observe how Ward Flow handles Western Australian statutory recording under Owner Ruling `D-29`.
  >
  > In the intake drawer, the emergency team records the legal status (`Referred for psychiatric examination`) and the form identifier (**Form 1A**).
  >
  > Notice what Ward Flow does—and what it steadfastly refuses to do:
  > The ED movement row **does not** calculate a 72-hour Form 1A countdown from duration. Per `D-29`, the main operational engine never computes deadlines from statutory durations: the movement row displays only the **clinician-entered paper expiry time** written on the physical form (labelled _Not legally checked_).
  >
  > Meanwhile, statutory duration reference tables and calculators live solely in the isolated `/mockups/ward-flow/legal-forms` reference demo. In operational screens, the software never makes an autonomous legal duration assumption."

#### 3:30 - 4:00 · Catchment Routing, UM1xxxxx Identifiers & Clinical Acuity Indicators

- **Presenter Action:** Highlight the automated catchment resolver and the synthetic UMRN format (`UM100001`, or sibling synthetic UMRNs such as `UM100041` per `D-39`). Show that Callum’s home suburb of Bayswater routes his primary psychiatric catchment to East Metropolitan Health Service. Point to the High Acuity and Specialling requirement flags.
- **Presenter Spoken Dialogue:**
  > "Every patient on screen is identified by a synthetic `UM1xxxxx` UMRN—such as `UM100001` for Callum Halloway or `UM100041` for another synthetic cohort record—while internal movement IDs like `WF-301` govern the journey behind the scenes. Callum resides in Bayswater, and Ward Flow’s internal catchment engine instantly resolves his home catchment to East Metro Health Service.
  >
  > Because Callum is severely agitated and requires intensive nursing supervision, the triage team marks his clinical requirements: **Adult Acute**, **HDU / Secure Capable**, and **High Acuity Nursing Ratio**.
  >
  > The referral is signed off in ED and submitted to the statewide flow queue. Instantaneously, without a single phone call or faxed referral sheet, Callum Halloway (`UM100001`) appears on the Statewide Flow Coordinator’s radar. Let us step into the Coordinator’s shoes."
- **Presenter Action:** Close the intake drawer and navigate to `/mockups/ward-flow/referrals`.

---

## Act 3: Statewide Bed Matching & Placement Allocation

### Clinical Scenario & Setting

- **Time:** 11:45 AM (Duration: 2 Minutes / 4:00 - 6:00)
- **Clinical Role:** Senior Statewide Bed Allocation Coordinator
- **Screen:** Statewide Referral Inspector & Bed Match Engine (`/mockups/ward-flow/referrals` -> Click Row `Callum Halloway (UM100001)` -> Inspector Tab `Placement / Bed Match`)
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

- **Presenter Action:** On `/mockups/ward-flow/referrals`, click the row corresponding to `Callum Halloway (UM100001)`. The right-side inspector drawer smoothly expands. Click the **[Bed Match]** tab.
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
  > Third, an auditable clinical log is generated: who held the bed, at what minute, and against what clinical criteria.
  >
  > The bed is secured. Now, we must coordinate safe inter-hospital logistics."
- **Presenter Action:** Transition via navigation to `/mockups/ward-flow/movements`.

---

## Act 4: Inter-Hospital Transit & Flight Deck Tracking

### Clinical Scenario & Setting

- **Time:** 13:15 PM (Duration: 2 Minutes / 6:00 - 8:00)
- **Clinical Role:** Transport Logistics Officer & Mental Health Flight Deck Controller
- **Screen:** Movements Flight Deck & Transit Cockpit (`/mockups/ward-flow/movements`)
- **Key System Mechanics:** St John WA CAD transfer integration, departure verification, real-time transit status, structured `sessionStorage` persistence and `D-18` free-text privacy guard.

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
| - Patient Status: In Transit [ LIVE ]     |  Escort: 2x Paramedic Crew + Mental Health Nurse       |
| - State Invariant: Bed Held at Dabakarn (Cannot be given away during transit)                      |
+----------------------------------------------------------------------------------------------------+
```

### Script & Presentation Actions

#### 6:00 - 6:45 · The Movements Flight Deck & Transport Bottlenecks

- **Presenter Action:** Navigate to `/mockups/ward-flow/movements`. Point out the horizontal corridor visualization (`MovementHorizonGantt`) and the active transit rows.
- **Presenter Spoken Dialogue:**
  > "It is now 13:15 PM. We are on the **Movements Flight Deck**.
  >
  > In mental health operations, the period between deciding to admit a patient and their physical arrival on the ward is historically a black hole. Patients get stuck in ED corridors waiting for transport; beds on wards sit empty and staffed while charge nurses wonder if the patient is ever coming.
  >
  > Ward Flow eliminates this blindness through the Movements Flight Deck. Every active movement across Western Australia is tracked across distinct clinical milestones from referral acceptance and bed hold through transport booking, departure, and ward arrival."

#### 6:45 - 7:30 · St John WA CAD Integration & Live Transit

- **Presenter Action:** Click on Callum Halloway’s (`UM100001`, movement `WF-301`) active movement row. The **Movement Workspace Cockpit** drawer expands. Highlight the **Transport Details** card showing dispatch identifier `CAD-20260815-8842` and the live ETA counter.
- **Presenter Spoken Dialogue:**
  > "Look at Callum’s transport record. At 12:45, the ED liaison team booked an inter-facility transfer with St John WA.
  >
  > Notice that Ward Flow requires a genuine Computer Aided Dispatch—or CAD—incident number: here, `CAD-20260815-8842`. Our clinical safety audit rules specifically reject generic placeholders like 'ambulance called' or 'pending'.
  >
  > At 13:12, the St John transfer vehicle departed the ED ambulance bay. The transfer officer tapped 'Confirm Departure'.
  >
  > Instantly, Callum’s status shifted to **In Transit**. Look at the destination ward: Dabakarn’s dashboard immediately updated with an ETA countdown: arrival expected in 10 minutes. The receiving ward nurse unit manager can see the vehicle is rolling, prepare the seclusion room or high-dependency bed, allocate the 1:1 admitting nurse, and ensure the medical registrar is present for reception."

#### 7:30 - 8:00 · Structured Session Persistence & The D-18 Free-Text Privacy Safeguard

- **Presenter Action:** Perform a **structured action** (such as toggling a bed state or assigning a structured blocker/step—do **not** type into a free-text note field), then press `F5` (or `Ctrl+R`) to demonstrate `sessionStorage` recovery of structured actions. Separately point out the `D-18` privacy safeguard (`eventCarriesFreeText()`).
- **Presenter Spoken Dialogue:**
  > "A quick word on session persistence and clinical privacy: when a coordinator performs **structured actions**—such as holding a bed, toggling a bed state, or assigning a structured blocker or step—and refreshes the tab (`F5`), Ward Flow restores that structured state from `sessionStorage`.
  >
  > Equally important is Owner Ruling **`D-18`** (`eventCarriesFreeText()`): if anyone types into a **free-text note field**, Ward Flow intentionally wipes `sessionStorage` and disables browser persistence for the remainder of that session as a strict privacy safeguard against leaving free-text notes in shared workstation browser storage.
  >
  > Now, Callum’s transport vehicle has arrived at Dabakarn. Let us move to the inpatient unit for receiving and handover."
- **Presenter Action:** Close the movement cockpit and navigate to `/mockups/ward-flow/handover`.

---

## Act 5: Inpatient Receiving, Handover & Bed Occupancy

### Clinical Scenario & Setting

- **Time:** 14:30 PM (Duration: 2 Minutes / 8:00 - 10:00)
- **Clinical Role:** Nurse Unit Manager (NUM) & Inpatient Admitting Psychiatric Nurse
- **Screen:** Clinical Handover Flight Deck (`/mockups/ward-flow/handover`) & Inpatient Ward Bed Board (`/mockups/ward-flow/board/rph-adult-secure`)
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

- **Presenter Action:** On the `/mockups/ward-flow/handover` screen, select `Dabakarn` from the Ward Scope dropdown. Highlight the arrivals corridor card for `Callum Halloway (UM100001)`.
- **Presenter Spoken Dialogue:**
  > "It is 14:30 PM. Callum Halloway (`UM100001`) has arrived at the sally port of Dabakarn Secure Unit.
  >
  > The admitting psychiatric nurse opens Ward Flow’s **Handover Flight Deck**. In mental health, handover is the most vulnerable point in patient care. Ward Flow structures this exchange around the national Australian clinical standard: **ISBAR**—Identification, Situation, Background, Assessment, and Recommendation.
  >
  > With one glance, the admitting nurse verifies Callum’s identifiers, his ATS triage history, his allergy status, and the physical handover of the statutory Form 1A paper order from the transport crew.
  >
  > The nurse checks the legal form verification box, confirming that the hard-copy Form 1A is in the physical hospital chart."

#### 8:45 - 9:30 · Completing Arrival & Transition to "Occupied"

- **Presenter Action:** Click the prominent **[Confirm Inpatient Arrival]** action button. A confirmation toast appears, and Callum moves smoothly from the _Arrivals Corridor_ into _Admitted Inpatients_. Immediately navigate via the breadcrumb link to Dabakarn’s Ward Board (`/mockups/ward-flow/board/rph-adult-secure`).
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

- **Presenter Action:** Return to the primary coordinator overview (`/mockups/ward-flow`) or `/mockups/ward-flow/capacity`. Allow the clean, high-density dashboard to fill the screen.
- **Presenter Spoken Dialogue:**
  > "In ten minutes, we have walked through a complete psychiatric patient journey:
  >
  > - From the 09:00 morning bed meeting establishing statewide situational awareness;
  > - To an acute ED crisis presentation in Perth;
  > - Through an intelligent, multi-gate clinical bed matching process that honoured strict gender-safety boundaries;
  > - Tracking live transit via St John WA CAD telemetry;
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
| 5. AUDIT TRAIL IMMUTABILITY | Every Override, Hold, and Movement Logged with Role and Reason       |
+----------------------------------------------------------------------------------------------------+
```

### 1. The Synthetic Isolation Guarantee

- **100% Synthetic Records:** Every patient identifier (`UM100001`, `UM100041`), name (`Callum Halloway`), address (`No. 7, Bayswater`), and clinician name is generated from curated synthetic dictionaries. Surnames are deliberately chosen and checked by unit tests against common Western Australian surnames so that no real citizen is identified.
- **Zero Production EHR Integration:** In this prototype demonstration mode, there is zero network bridge to WebPAS, PSOLIS, TOPAS, or St John WA production servers.

### 2. Clinician Supremacy & Anti-Automation Bias

- Ward Flow **never** makes an autonomous clinical decision.
- It does not automatically admit, transfer, discharge, or place a patient. Every state transition requires a licensed health practitioner or authorized bed coordinator to click, confirm, and provide an auditable clinical rationale.

### 3. Statutory Fidelity (WA _Mental Health Act 2014_)

- Under WA law, the legal authority to detain or examine a psychiatric patient resides exclusively in the signed statutory instrument (e.g. Form 1A, Form 3A, Form 6A).
- Per Owner Ruling `D-29`, Ward Flow’s operational engine functions as a **statutory recorder**, not an automated legal arbiter: movement screens display only the paper expiry date and time typed from the physical form by the clinician, while statutory duration reference calculators live solely in the isolated `/mockups/ward-flow/legal-forms` demo.

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

### Q2: "How does the St John WA CAD integration work, and what happens if CAD numbers are entered incorrectly?"

**Presenter Response:**

> "In live operation, Ward Flow is architected to ingest real-time webhook feeds from St John WA’s Computer Aided Dispatch (CAD) system via standard HL7/FHIR messaging protocols.
>
> To ensure patient safety during manual or semi-automated booking, our clinical safety guard enforces strict validation:
>
> 1. It checks the CAD format against St John WA incident syntax (e.g., `CAD-YYYYMMDD-XXXX`).
> 2. It rejects empty inputs, placeholders like 'booked' or 'TBC', and refuses to mark a transfer as 'Booked' without an estimated departure timestamp.
> 3. If a patient’s transit is canceled or diverted, the coordinator must select from a mandatory list of clinical change reasons (e.g., _Medical deterioration in ED_, _Ambulance diverted to higher acuity case_), generating an immediate audit trail and re-evaluating the held bed."

---

### Q3: "What happens if our hospital network goes down or a coordinator's browser crashes? Do we lose patient data?"

**Presenter Response:**

> "Ward Flow is a **synthetic demonstration prototype**, not a production patient record system.
>
> Actions are handled by a central state reducer. When browser storage is available and the demo's privacy lock permits saving, the central demo snapshot is saved as plain JSON in this tab's session storage; it is not encrypted by the application. A valid saved snapshot may be restored on a same-day reload while that browser session remains available. Restoration after a tab closes, a browser crash or a workstation reboot is not guaranteed.
>
> Under Owner Ruling `D-18` (`eventCarriesFreeText()`), once an event that can carry typed free text is dispatched, whether accepted or refused, the central demo snapshot in `sessionStorage` is wiped and further snapshot saving stops until a genuine demo reset or scenario reseed. If snapshot storage is unavailable, state changes remain in memory and may be lost when the page closes.
>
> Eligible unsaved drafts in forms configured with `useDirtyStateGuard` can still be cached independently as unencrypted text under separate `wf-draft:*` session-storage keys and restored on reload while that browser session remains available. For example, a refused broadcast can retain its draft even after the central snapshot is cleared. Draft caching does not guarantee recovery.
>
> Where a form marks unsaved changes, `useDirtyStateGuard` can request a browser warning before leaving the page. That warning does not guarantee recovery or prevent loss after a crash. Use synthetic data only."

---

### Q4: "Could an algorithm in Ward Flow force a Nurse Unit Manager to accept a patient against their clinical judgment?"

**Presenter Response:**

> "The short answer is an absolute **no**.
>
> In our clinical governance architecture, the Nurse Unit Manager’s clinical gatekeeping is sovereign. A ward can decline any referral by selecting from standardized, transparent decline reasons (such as _Acuity beyond current ward nursing skill mix_, _Specialling capacity exceeded_, or _Physical environment unsafe for cohort_).
>
> While a Statewide Flow Coordinator possesses the administrative authority to record an override, the system forces that override to be explicitly documented with a detailed clinical justification. The software never overrides a clinician automatically; it ensures that when administrative overrides occur, they are transparent, peer-reviewed, and clinically auditable."

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
| ACT 1: CAPACITY & MORNING SHEET      -->  /mockups/ward-flow/capacity                              |
| ACT 2: ED INFLOW & REFERRAL INTAKE   -->  /mockups/ward-flow/ed/rph-ed (or /mockups/ward-flow/referrals) |
| ACT 3: BED MATCHING ENGINE           -->  /mockups/ward-flow/referrals --> Click Callum Halloway (UM100001) Row --> [Bed Match] |
| ACT 4: MOVEMENTS FLIGHT DECK         -->  /mockups/ward-flow/movements --> Click Callum Halloway (UM100001) Row --> [Cockpit]   |
| ACT 5: INPATIENT HANDOVER & BOARD    -->  /mockups/ward-flow/handover  --> /mockups/ward-flow/board/rph-adult-secure            |
+----------------------------------------------------------------------------------------------------+
```

### Verbal Cadence & Timing Benchmarks

- **0:00 - 2:00:** Calm, executive, framing the statewide macro-environment.
- **2:00 - 4:00:** Immediate, urgent, clinical narrative of emergency psychiatric presentation.
- **4:00 - 6:00:** Methodical, intellectual, demonstrating safety algorithms and clinician choice.
- **6:00 - 8:00:** Dynamic, operational, demonstrating logistical transparency and inter-hospital flow.
- **8:00 - 10:00:** Reassuring, resolved, closing the loop on patient safety, dignity, and executive control.

---

_End of Demonstration Script (WF-60). Authoritative demonstration document for WA Health stakeholders._
