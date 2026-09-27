# Ward Flow: a guide for the bed flow coordinator

A plain-English guide for the bed flow coordinator, written from the app's own wording on the
ward line of 26 September 2026. Everything in the app is made-up demo data. The app is called Ward
Flow.

**Checked on screen, 26 September:** the side rail Delays wording, the All wards labels, the
Referral Board buttons, reload keeping the day, the officer's named job cards, the Capacity columns,
the bed board text, Settings labelling each hour rule as your default, and no screen saying
"breach". Lines marked _(not yet checked on screen)_ are taken from the code and the
owner's rulings and are confirmed by the next screen check.

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

The rail on the left has four groups:

- **Operations:** Command, Movement, Capacity, Delays, Network.
- **Service Hubs:** Search Hub, ED Hub, Ward Hub, Community Hub, Transport Hub.
- **Care Coordination:** Patients, Make Referrals, Referral Board, Handover, Discharges.
- **Oversight:** Governance, Statistics, Legal, Out of area, Alerts, On-call.

Two numbers on the rail are worth knowing:

- **The Delays badge** reads "N at a time limit or with nowhere to go". It counts only the most
  serious delays: a recorded form time that has passed or is running out, and a patient with no
  suitable bed anywhere. The Delays screen's own "Attention" tab counts more, so the two numbers can
  differ. That is expected.
- **Occupancy** for each site and service. _(not yet checked on screen)_

---

## 3. How urgent is this patient? The three tiers

Every referral has one of three tiers:

- "Tier 1 · most urgent"
- "Tier 2 · urgent"
- "Tier 3 · least urgent"

The tiers put patients in order. They carry no hour targets: the app does not say a tier must be
placed within a set number of hours. _(not yet checked on screen)_

---

## 4. Legal status

The app records one of four legal statuses, in these words:

- "Voluntary"
- "Referred for psychiatric examination"
- "Detained awaiting examination"
- "Involuntary inpatient"

The app does not name forms by number, quote the Act's sections, or work out when an order ends. If a
form's due time has been typed in, it shows that time with "Not legally checked".

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

Wherever a movement is linked to a patient record, the screen shows the patient's name with their
code, for example "Name (WF-…)". A movement with no linked record shows its code alone.

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

- **"Pull the bed"** holds a bed for an accepted patient.
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
held. That bed must be released first.

Transport can be cancelled by the coordinator, or by the community team that booked it. The movement
screen says which. _(not yet checked on screen)_

---

## 6. The screens you will use most

### Command

Your starting point: the priority list of patients waiting for a bed, ED pressure, and the flow
diagram. Choose a patient to open their placement panel (the shortlist of possible wards).

### Capacity

Beds across the service: ready now, held, out of service, and what is expected to free up. Where a
ward has not recorded a figure, it says "Not recorded". The ward table has two columns added on
26 September (Josh's bed board rulings, D-21):

- **Discharges due today** counts the stays whose own discharge record falls on today.
- **Transfers today** always says "Not recorded", because nothing in the app records which ward a
  transfer comes from. It will stay that way until that is recorded.

An out-of-service bed says its reason is not recorded.

### Movement

Every transfer in progress, by stage. Open one to see the whole movement, with the patient's name at
the top.

### Delays

What is holding patients up. The tabs are "Escalations", "Attention" and "Resolved today". Waits over
24 hours are grouped as "Over 24 hours" in a neutral colour: 24 hours describes the wait, not a limit. _(not yet checked on screen)_ The causes, in the
app's words:

- "Form due time already passed"
- "Form due time running out"
- "No suitable bed anywhere in the network"
- "Awaiting a ward's answer"
- "Reserved time has passed, bed still held"
- "Awaiting the bed itself"
- "Awaiting transport"
- "Patient or family factors"
- "Awaiting a decision from the coordinator"

### All wards and the bed board

All wards lists each ward with its security label, taken from how its beds are set: "All open",
"All locked" or "N locked, M open". Forensic wards read "Forensic Secure".

On a ward's bed board, each bed shows as "Occupied", "Held", "Ready", "Out of service" or
"Empty, waiting". The side panel names the patient in the bed. Beds on leave are linked to the
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
time is shown as due soon; the app still works out no legal time itself. _(not yet checked on
screen)_

---

## 8. What is saved, and what is not

Ward Flow saves the day's work in this browser, so a reload brings it back.

- Actions you take (accepting, pulling a bed, booking transport) are saved.
- If the app refuses an action, your earlier work is still saved. The refusal itself is not kept.
- Anything typed as free text (notes and reasons you write yourself) is never saved. After text is
  typed, saving pauses for that session, and the screen says so. _(not yet checked on screen)_

This follows Josh's ruling that only typed text locks saving.

---

## 9. Words the app uses

- **Not recorded:** nobody has entered this. The app does not guess.
- **Not legally checked:** a time someone typed, not checked against the Act. Do not rely on it.
- **Held:** a bed kept for a named, accepted patient.
- **Ready:** a bed the ward has confirmed is clean and staffed for an admission.
- **Out of service:** a bed that cannot be filled.
- **Pulled bed:** a bed taken for one accepted patient, from pull until arrival or release.

---
