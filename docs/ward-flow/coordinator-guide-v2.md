# Ward Flow: a guide for the bed flow coordinator

**Audience:** coordinators exploring the synthetic prototype. **Status:** maintained guide with dated evidence.
**Owner:** Documentation. Navigation in section 2 was checked against source at
`fc30c90c9cdae9a208786ade6e885750f770a7ea` on 21 October 2026; it has not been checked in a browser at that revision.
The menu description covers the coordinator view in local demo mode; shared mode additionally filters access
by the signed-in role and place. Other sections retain their stated evidence dates.

<details>
<summary>Historical screen-check scope — 26 September 2026</summary>

A plain-English guide for the bed flow coordinator, written from the app's own wording on the
ward line of 26 September 2026. Everything in the app is made-up demo data. The app is called Ward
Flow.

**Checked on screen, 26 September:** the side rail Delays wording, the All wards labels, the
Referral Board buttons, reload keeping the day, the officer's named job cards, the Capacity columns,
the bed board text, Settings labelling each hour rule as your default, and no screen saying
"breach". Lines marked _(not yet checked on screen)_ are taken from the code and the
owner's rulings and are confirmed by the next screen check.

</details>

_Updated 2026-10-19 - corrected urgency, identifier and persistence guidance from source; Documentation owns. The screen-check dates above are unchanged._

_Updated 2026-10-21 - current coordinator menu checked from source; Documentation owns. No new screen-check claim._

---

## 1. What Ward Flow is, and what it is not

Ward Flow shows one picture of mental health beds, referrals and patient movements across a
health service. It is a prototype.

- **Every patient, ward and figure is made up.** No real patient data is ever entered.
- **The app shows only what someone recorded.** If nothing was recorded, the screen says
  "Not recorded". It never guesses, and it never shows a made-up figure as if it were real.
- **Legal times are typed, not calculated.** The app does not work out Mental Health Act time
  limits and does not quote section numbers. It shows only times a person typed. Those times carry
  the notice "Not legally checked". Do not rely on them.
- **Words come first, colour second.** Every status is written out; colour only backs it up.

---

## 2. Finding your way: the side rail

The coordinator's main menu contains **Home, Capacity, Movements, Waiting, Referrals and Handover**.
Use **More** on the desktop rail for the other available pages. On a phone, open **Menu**.
The remaining pages use the groups **Today, Where, Work and Checks**; empty groups and pages
outside the current role's access are omitted. Feature flags can also hide unfinished pages,
including Bed meeting TV.

This wording comes from [`ROLE_MENUS` and `roleMenu`](../../src/components/ward-management/shell/ward-rail-entries.ts),
which the [desktop rail](../../src/components/ward-management/shell/ward-rail.tsx) and
[phone menu](../../src/components/ward-management/shell/ward-phone-menu.tsx) use. It is source evidence,
not a new visual walkthrough. The current legal-time boundary is
[D-70](decisions.md#d-70-no-computed-mental-health-act-periods-show-only-the-recorded-due-time-20-october-2026).

<details>
<summary>Historical navigation and badge descriptions — superseded for current navigation</summary>

<!-- docs-script-refs:historical-start -->

The rail on the left (`shell-18` in `src/components/ward-management/ward-rail-entries.ts`) has four groups:

- **Now:** `Coordinator`, `Capacity`, `Waiting`.
- **Where:** `EDs`, `Wards`, `Community`, `Out of Area`.
- **Work:** `Referrals`, `In Transit`, `Discharges`, `Handover`.
- **Oversight:** `Officer`, `Statistics`, `Governance`, `Legal Forms`, `Settings`.

Two numbers on the rail are worth knowing:

- **The Waiting badge** reads "N at a time limit or with nowhere to go". It counts only the most
  serious delays: a recorded form time that has passed or is running out, and a patient with no
  suitable bed anywhere.
- **Occupancy** for each site and service. _(not yet checked on screen)_

In the top bar, the simulation status chip reads **Demo** (never `'Live'`), with controls labelled **"Pause demo updates"** and **"Resume demo updates"** (per PR #258).

<!-- docs-script-refs:historical-end -->

</details>

---

## 3. How urgent is this patient? The three tiers

Every referral has one of three tiers:

- "Tier 1 · most urgent"
- "Tier 2 · urgent"
- "Tier 3 · least urgent"

The tiers put patients in order. The prototype marks referral decisions overdue after 1 hour for
Tier 1, 4 hours for Tier 2 and 24 hours for Tier 3 (`ward-clinical-values.ts`, D-54). These are
synthetic prototype markers, not guaranteed placement deadlines or legal limits. _(not yet checked on screen)_

---

## 4. Legal status

The app records one of four legal statuses, in these words:

- "Voluntary"
- "Referred for psychiatric examination"
- "Detained awaiting examination"
- "Involuntary inpatient"

Operational screens display the clinician-recorded form number and paper expiry (`src/lib/form-register.ts`) with the notice "Not legally checked". No screen auto-calculates statutory deadlines (`D-70`).

The app will not let you discharge a patient recorded as involuntary or detained awaiting examination
until their legal status is changed. _(not yet checked on screen)_

---

## 5. A patient's journey through the app

A movement goes through these stages, in the app's words:

1. "Placement requested"
2. "Destination review"
3. "Accepted, awaiting bed". On the Movements list this shows as "· accepted".
4. "Bed pulled"
5. "Handover ready"
6. "Moving"
7. "Arrived"

Wherever a movement is linked to a patient record, screens display the patient's name with their synthetic `UM` plus six-digit UMRN (including `UM1xxxxx` hand-authored and `UM5xxxxx` generated seed records)—for example `"Name (UM100001)"` per `D-39`—whereas `WF-…` is the internal journey/movement ID and is never shown as a patient identifier on screen.

### Referrals

On the Referral Board, open a referral to decide it. The right-hand panel lists every ward with
its own button: "Accept at <ward>" where the ward fits, or "Accept anyway at <ward>" where it does
not and you are overriding. "Decline referral" is at the bottom. Scroll the panel to reach them.
(Checked live on 26 Sept.) On Command, the placement panel for a referral names the patient.

To decline, choose a reason:

- "No suitable bed"
- "Age band not provided here"
- "Sex designation unavailable"
- "Secure bed unavailable"
- "Belongs to another service"
- "Referred elsewhere"
- "Another reason — needs follow-up"

### From accepted to arrived

- **"Pull the bed"** pulls a bed for an accepted patient. It stays theirs until they arrive or it is released, within the pull time limit.
- **"Book transport"** records the transport job. If no transport is needed, record that instead.
  The ED screen then stops warning that transport is not booked.
- **"Release the pulled bed"** gives the bed back. It is hidden while transport is booked. Cancel the
  transport first.
- **"Confirm Arrival"** records the patient arriving. It works even if the ward's other beds are
  full, because the pulled bed is theirs. It is blocked if the patient was diverted elsewhere.

### The transport officer's screen

The officer moves each job through "Accepted", "En route", "Collected" and "Delivered". Each job card
names the patient. After each step, a short message says whether it was recorded or why it was
refused. A step is refused if the patient's examination order was revoked while their bed was still
pulled. That bed must be released first.

Transport can be cancelled by the coordinator, or by the community team that booked it. The movement
screen says which. _(not yet checked on screen)_

---

## 6. The screens you will use most

### Home

Your starting point. Its left column, **My list**, shows the alerts and referral decisions waiting
for you. Choose a patient to open their placement panel. There is no
suggested-ward shortlist: it was removed in D-71, and you choose the ward.

### Capacity

Beds across the service in four boxes: Ready, Pulled, Closed and Occupied (a bed kept for its own
patient on leave counts inside Occupied), and what is expected to free up. Where a
ward has not recorded a figure, it says "Not recorded". The ward table has two columns added on
26 September (Josh's bed board rulings, D-21):

- **Discharges due today** counts the stays whose own discharge record falls on today.
- **Transfers today** always says "Not recorded", because nothing in the app records which ward a
  transfer comes from. It will stay that way until that is recorded.

An out-of-service bed says its reason is not recorded.

### Movement

Every transfer in progress, by stage. Open one to see the whole movement, with the patient's name at
the top.

### Waiting

What is holding patients up (`D-41`). Rather than separate Delays tabs, the screen presents a **unified Waiting table** with filter chips (such as escalations, attention items, and waits over 24 hours) and a **right-hand detail rail** for inspecting and acting on the selected patient's delay. Waits over
24 hours are grouped as "Over 24 hours" in a neutral colour: 24 hours describes the wait, not a limit. The causes, in the
app's words:

- "Form due time already passed"
- "Form due time running out"
- "No suitable bed anywhere in the network"
- "Awaiting a ward's answer"
- "Pull expired, bed still pulled"
- "Awaiting the bed itself"
- "Awaiting transport"
- "Patient or family factors"
- "Awaiting a decision from the coordinator"

### All wards and the bed board

All wards lists each ward with its security label, taken from how its beds are set: "All open",
"All locked" or "N locked, M open". Forensic wards read "Forensic Secure".

On a ward's bed board, each bed uses the `R-B-05` 4-state partition: **`Ready`**, **`Pulled`**, **`Closed`**, or **`Occupied`**. The side panel names the patient in the bed. Beds on leave are linked to the
patient's stay. If the app refuses a board action, the message says why and that nothing was
changed; it never claims success. _(not yet checked on screen)_

On the ward screen, **"Discharged"** (on a bed flagged to come free) asks where the person is going,
then records that they have left. Nothing is recorded until a destination is chosen, and a refusal
(for example, an involuntary patient to the community) shows its reason. _(not yet checked on screen)_

The ward screen's Tasks & Buzzes panel names each linked patient. A movement not linked to any
patient record reads "Unknown Patient"; the app does not guess who it is.

### Search

Search matches a person's own record only. Typing a ward's name no longer lists everyone referred or
sent there (Josh's ruling D-23). _(not yet checked on screen)_

### Discharges, Handover and Alerts

Discharges lists the day's expected and confirmed departures. Handover gathers what the next shift
needs. Alerts holds broadcast messages and their acknowledgements.

---

## 7. The morning roll-up

Each morning, wards confirm their discharges and ready beds by the roll-up time. It is set to 9:30 am
and can be changed between 8:00 and 11:00 in 15-minute steps, under Settings. Settings labels it as
your default, not a legal limit. The same goes for every other hour rule the app uses: each is a
setting your service chose, labelled that way, and none is a legal limit. The app does not use the
word "breach".

Settings also lets you change the two warnings before a recorded legal due time: "First warning
before a legal due time" (1 hour by default) and "Second warning before a legal due time" (3 hours
by default). Each is labelled "Your default, not a legal limit." They only change when a typed due
time is shown as due soon; operational screens still display only the clinician-recorded form number and paper expiry (`form-register.ts`), and no screen calculates a statutory period (`D-70`).

---

## 8. What is saved, and what is not

In local demo mode, Ward Flow can save structured work in this tab’s session storage while
browser storage is available and the privacy lock permits it. A valid same-day snapshot can return
on reload; recovery after a crash, tab closure or restart is not guaranteed.

- Structured actions such as accepting or pulling a bed can be saved while saving remains enabled.
- Dispatching an event that carries typed text locks central snapshot saving, whether the action is
  accepted or refused (D-18). The app attempts to remove the saved snapshot and reports storage
  failure. The lock remains until a genuine reset or scenario reseed. Booking transport carries
  the typed CAD field and also triggers this lock.
- D-67 separately permits session draft recovery only in the opted-in synthetic referral and legal
  form editors, scoped to account/session, scenario and subject. Restored drafts require human
  review and submission. Successful submission, sign-out, session termination and reset clear the
  relevant drafts; rejected submissions retain them for correction. Submitted state keeps the
  D-18 lock. Browser session restoration can preserve these drafts across a restart.

In shared mode, accepted workspace commands save through the authenticated backend. The local
snapshot lock does not govern server saving. See [the backend’s current modes](../../backend/ward-flow/README.md#how-the-ui-connects).
These source-based corrections have not been rechecked on screen.

---

## 9. Words the app uses

- **Not recorded:** nobody has entered this. The app does not guess.
- **Not legally checked:** a time someone typed from the paper form (`form-register.ts`), not checked against the Act. Ward Flow holds no statutory period table (`D-70`).
- **Ready (`R-B-05`):** a bed the ward has confirmed is clean and staffed for an admission.
- **Pulled (`R-B-05`):** a bed taken and held for one named, accepted patient, from pull until arrival or release.
- **Closed (`R-B-05`):** a bed that is out of service / closed and cannot be allocated.
- **Occupied (`R-B-05`):** a bed with an admitted inpatient currently in it.

---
