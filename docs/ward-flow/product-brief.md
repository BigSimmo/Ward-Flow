# Ward Flow — product brief

Written 25 September 2026 from the ward line at `663a66484a`. It is drawn from what the code, the
documents and the drawings already say. Anything marked **(Guess — Josh to confirm)** is my
inference, not a recorded decision. Every patient, ward and figure in the app is invented.

Updated the same day with Josh's answers to the questions at the end: the pilot site, who the users
are, and what success means. Those answers are marked **(Josh, 25 September)**.

## In one paragraph

Ward Flow is a lightweight bed-coordination tool for Western Australian public mental health
services. It is meant to be the thing a bed coordinator opens on a weekday morning instead of a
whiteboard, a spreadsheet or a round of phone calls. It covers who needs a bed, who was asked, who
said yes or no and why, who is in transit, and what is holding a discharge up. It is also where
those decisions are **communicated**. The hospital's formal record still holds the same facts, and
entering them twice is accepted on purpose: Ward Flow exists because the formal system is too slow
to fill in during a bed search (Josh's answer of 4 September, recorded in project memory; see also
[`README.md`](README.md)).

Two rules shape everything: it **never places a patient by itself** (every placement is a person's
recorded decision), and it **never shows something the data does not hold** (no computed legal
deadlines, no guessed figures).

## Who uses it

**The Coordinator is the main user, and the app is built around the Coordinator's view (Josh, 25
September).** The other people who will use it are community staff (doctors and psychiatric
nurses), ED psychiatry staff, ward psychiatry staff, transport officers and others. The first
version to build is the Coordinator version; because the Coordinator sees the whole network, that
is in effect the whole app. The other roles' own views come after it.

These are the seats the engine knows about today ("roles"). A role is what a decision is recorded
against; it is not yet a signed-in person.

1. **Flow coordinator.** The main user. Sees the whole network: referrals waiting, beds, the delays
   board, capacity, alerts, and the handover sheet. Can place a patient against a ward's refusal,
   but only with a recorded reason.
2. **Ward (nurse unit manager or ward manager).** Answers requests for a bed, states how many beds
   it can take and what limits who can come in (a fixed checklist), marks arrivals and discharges,
   and owns its own bed board.
3. **ED mental health team.** Raises a bed search for a patient in the emergency department, logs
   the transport booking, and sends outcome notices to the ward, the officer and every ward asked.
4. **Community service.** One seat covering community teams, crisis services, police, ambulance,
   other hospitals and GPs (the actual source is recorded on the referral). Raises referrals,
   answers ones sent to it, and can book or cancel its own transport.
5. **Authorised officer (transport).** Sees transport jobs with the CAD number, voluntary or
   involuntary status and the estimated time.
6. **Bed manager and executive.** The roles exist, and there are statistics and command screens.
   What they would do day to day in a pilot is not written down. **(Guess — Josh to confirm:
   read-only viewers of capacity and statistics.)**

There is also an on-call screen. **(Guess — Josh to confirm: for the after-hours coordinator or
on-call psychiatrist.)**

## The main bed flow journeys

The full map, generated from the engine, is the [journey explorer](journey/README.md). The
journeys that matter most:

1. **A referral comes in.** Seven kinds of referrer. One referral can go to up to three places at
   once (a community team, a psychiatric ward, an emergency department). Each place accepts or
   declines from a fixed list of reasons. When one ward accepts, the other waiting ward requests are
   cancelled. The referrer can withdraw the whole referral, or just the community part.
2. **From the ED to a ward bed.** Placement requested, wards asked, a ward accepts in principle,
   the bed is pulled and held (default hold 4 hours, set in Settings), transport is booked by
   logging the phone call (CAD number, voluntary or involuntary, estimated time — all required),
   handover ready, crew collects, ward marks arrived, patient is on the ward.
3. **When it goes wrong.** A ward declines, an acceptance is withdrawn, the held bed is given back,
   transport is cancelled or stopped after collection, or the bed search is abandoned. The
   coordinator can place anyway with a recorded reason; a non-binary patient can be placed on a
   single-gender ward with a coordinator's reason and a nurse unit manager's tick. The one bed check
   that can never be forced is a bed whose sex or gender designation does not match the patient's
   record; every other check can be overridden with a recorded reason.
4. **Leaving the ward.** Two tracks run side by side: the person leaves (to the community, another
   ward, a general hospital, residential care, custody, and other endings) and the bed is released
   and prepared. What is holding a discharge up is recorded and shown on the delays board.
5. **Alongside the journey.** Legal status and paperwork (the app shows only times a person typed,
   never a computed deadline), urgent flags, escalations, two patients wanting one bed, the
   coordinator's inbox, ward capacity, the shift handover sheet, and statistics.

## Where it stands today

- **Built on synthetic data only.** 34 screens each have a design drawing, and all 34 were looked
  at in a browser on 21 September; some still differ from their drawing in detail (see
  [`STATUS.md`](STATUS.md)).
- **It runs inside one browser.** Nothing is sent to a server; each browser holds its own copy for
  the session. So two people on two computers do not see the same board.
- **There is no real sign-in.** The sign-in screen lets you pick a role; it does not prove who you
  are.
- **Notices stay inside the app.** Nothing goes out by SMS, email or pager.
- **The ward test suite had known failures** at its last full count (21–22 September). It was not
  re-run for this brief.

## What a first pilot in a WA hospital needs

### 1. The outside reviews Josh has parked (hard prerequisites)

Josh parked these before any real patient (owner answer OA-63,
[`owner-answers-2026-09-17.md`](archive/dated-notes/owner-answers-2026-09-17.md)). They are not
started.

1. **Medical device check with the TGA.** Whether Ward Flow counts as a medical device, and what
   follows if it does. The current "not a medical device" line has not been tested against what the
   tool actually does.
2. **Clinical safety officer.** Appoint one, run a hazard workshop with liaison nurses, bed
   managers and consultants, and get the residual risk signed off by the health service. A draft
   safety case exists ([`governance/CLINICAL-SAFETY-CASE.md`](governance/CLINICAL-SAFETY-CASE.md)).
3. **Privacy.** A privacy impact assessment, approval to hold real patient details, and a named data
   custodian. The decision on internal patient codes (OA-58) must be made again before real data.
4. **WA legal advice on the forms.** Confirmation that how the app names and handles Mental Health
   Act forms, and the legal-status gates on placement, are right. A draft mapping exists
   ([`governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md`](governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md)).
5. **Catchment and reference data.** The suburb-to-service tables, ward capacities and distances
   are not approved for real use: every record is marked not approved for operational use, and the
   step that would load them into the app has not started
   ([`reference-data/PACK_README.md`](reference-data/PACK_README.md)). About a third of the
   sources have no recorded freshness, and one source link is dead.
6. **Post-incident review**, also on Josh's parked list.

⚠️ **Both draft governance documents were written by an AI and need checking, not trusting.** For
example, the legal mapping describes a countdown clock on one form and quotes Act section numbers,
while Josh's rulings say the app shows only typed times and no section numbers. The reviewers should
treat them as starting drafts.

### 2. Build work before any real patient (my inference from the code)

1. **Real sign-in and permissions**, so each action is tied to a person and each person sees only
   what their role allows.
2. **A shared, secure server** so everyone sees the same board at the same time, hosted somewhere
   WA Health approves. **(Guess — Josh to confirm the hosting rules.)**
3. **A permanent audit trail** of who decided what and when, kept beyond the browser session.
4. **The pilot site's real wards, beds and teams** loaded in place of the invented ones, once the
   catchment data above is approved.
5. **A downtime plan**: what staff do if Ward Flow is unavailable (the whiteboard stays until the
   pilot proves itself).
6. **Settle three open design points** listed in the repository's issue list (they may already be
   settled elsewhere): ward eligibility is not checked when a patient is placed (Josh ruled on 21
   September to keep "invite, then the ward refuses"); sex and gender identity are one field that
   drives bed matching; and whether the tool should ever suggest a ward.

### 3. The shape of the pilot

- **Pilot site: East Metropolitan Health Service (EMHS) (Josh, 25 September).** The app keeps its
  options for switching between health services and sites for now; EMHS is the pilot, not the only
  site the app can show.
- **Built for the Coordinator first (Josh, 25 September).** See "Who uses it" above.
- One coordinator desk, weekday business hours. **(Guess — Josh to confirm.)**
- Start with the coordinator and a small number of EMHS wards and one ED, then widen. **(Guess —
  Josh to confirm.)**
- Whether to run it beside the whiteboard first is still open (question 3 below).
- Success is judged by the measures in the next section.

## Success measures

**Josh agreed the three main measures on 25 September and asked for them to be fleshed out.** The
definitions, baseline methods and targets below are **proposals** for Josh and the pilot site to
settle. No figure here comes from real data; every target is a starting suggestion to be reset once
the baseline is measured.

**One dependency first.** Most of these can be counted from Ward Flow's own time stamps, but only
once it keeps a permanent record on a shared server (build work items 2 and 3 above). Today it
forgets everything when the browser closes, so it cannot yet measure anything.

**How the baseline is gathered.** Before Ward Flow goes live, collect the same figures for a fixed
period (four to eight weeks is suggested) from what already exists: the ED information system's
referral and departure times, the coordinator's log or whiteboard photographs, the transport
booking records and incident reports. Where nothing records a time, coordinators keep a short
time-stamped tally sheet for that period. The same figures are then collected during the pilot,
reported weekly and compared.

### The three main measures

1. **Faster ED referral to bed allocation.**
   - **Definition:** the time from the ED mental health team raising a bed request for a patient to
     a ward accepting and a bed being held for that patient. Report the median and the 90th
     percentile (the wait that only one patient in ten exceeds) each week.
   - **Counted from:** Ward Flow's "placement requested" and "bed held" times during the pilot; the
     ED referral time and the coordinator's record of when a bed was found for the baseline.
   - **Proposed target:** the median falls by at least a fifth, and the 90th percentile does not
     get longer.
2. **Fewer missed or duplicate bed requests.**
   - **Definitions:** a _missed_ request is a patient waiting in ED for a mental health bed with no
     active bed request, or with a request no ward has been asked about within two hours. A
     _duplicate_ is the same patient with two active bed requests at once, or one bed offered to
     two patients at once. Count both per 100 bed requests.
   - **Counted from:** a daily check, once each weekday morning, of the ED's list of patients
     waiting for a mental health bed against the requests on the board; plus incident reports.
     The same check is done during the baseline period against the whiteboard.
   - **Proposed target:** duplicates close to none; missed requests halved.
3. **Coordinators prefer it to the whiteboard.**
   - **Definition:** at the end of the shadow period (if there is one) and at the end of the pilot,
     each coordinator answers one question, "Which would you rather use tomorrow: Ward Flow or the
     whiteboard?", and fills in the System Usability Scale (a standard ten-question usability
     survey scored out of 100). Also record whether coordinators keep using Ward Flow when using it
     is optional.
   - **Proposed target:** most coordinators choose Ward Flow, and the usability score is 68 or more
     (68 is the commonly quoted average for the survey).

### Supporting measures

4. **Time patients wait in ED for a mental health bed.** From arrival in ED to leaving ED for a
   mental health bed, from the health service's own ED reporting, limited to mental health
   admissions. Report the median, and the number of waits over 12 hours and over 24 hours. This
   is the measure patients feel; Ward Flow can only speed up the bed-finding part of it.
5. **Bed-hold expiries.** Beds held for a patient where the hold ran out (the default hold is four
   hours) or was given back before the patient arrived, per 100 holds. The whiteboard has no
   formal hold, so there is no before figure: the first month of the pilot sets the baseline.
6. **Transport delays.** The time from transport being booked to the crew collecting the patient,
   and to the patient arriving on the ward; the number of collections more than an hour later
   than the estimated time; and the number of cancelled bookings. Baseline from the transport
   booking records if they hold times.
7. **Data completeness.** The share of placements with every step recorded (referral source,
   reasons for every decline, reasons for every override, transport details and arrival time); the
   share of ward bed boards updated at least once a shift; and a monthly spot check of a sample of
   placements (20 is suggested) against the hospital's formal record. Proposed target: at least
   95% on each.
8. **Staff effort per day.** Minutes coordinators spend on bed coordination per shift, and phone
   calls per placement, sampled on a few shifts a week (for example two) before and during the
   pilot. Include the time spent entering the same facts twice, since that is accepted on purpose.
   Proposed target: no increase in total effort, and fewer phone calls per placement.
9. **Safety check.** Incidents or near misses where Ward Flow played a part (for example the wrong
   patient or the wrong bed), reviewed one by one. Proposed target: none serious. This is a check
   that the pilot is not causing harm, not a measure of success.

## Questions only Josh can answer

1. ~~Which health service or hospital would pilot first?~~ **Answered: EMHS, with site switching
   kept in the app for now.**
2. ~~On day one, is it the coordinator alone, or wards and the ED as well?~~ **Answered: the
   Coordinator is the main user and is built first. Whether wards and the ED also use it on day
   one of the pilot is still to confirm.**
3. **Still open.** Should the pilot start by running Ward Flow alongside the existing whiteboard
   (both kept up to date for a few weeks, with the whiteboard still the one relied on), or should
   the ward team switch to Ward Flow straight away?
4. **Still open.** Who will sponsor it inside the health service, and who will be the clinical
   safety officer and the data custodian? None is named yet (Josh, 25 September).
5. ~~What result would count as success for the pilot?~~ **Answered: see "Success measures"
   above; the targets there are still proposals.**
