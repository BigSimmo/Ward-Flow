# Ward Flow: what's new for staff

<!-- last-checked: 2026-11-03 -->

Plain-English notes on what changed on screen, for the clinicians and staff testing Ward Flow.
Newest first. The [desk guides](desk-guides/README.md) show each desk's steps in full.

_Ward Flow is a prototype on synthetic data. Not for real patients._

## Source changes since 24 October 2026

These describe implemented source behaviour checked on 3 November. Check the live release before
assuming a change is available on the hosted board.

- The coordinator menu includes **Home**, **Waiting** and **All EDs**.
- Coordinators can use **Record departure** for a confirmed discharge on **Discharges**.
- Help includes searchable instructions and printable desk guides. Its task instructions distinguish
  the desks that can perform each job; global rule changes belong to the statewide coordinator.
- **Help → Report a problem** (added to this page on 10 November) copies a short note for the pilot
  team, with the screen, desk, browser and time added for you. A picture of the screen is optional
  and off by default; it blurs the page content and shows a preview first. Nothing is sent anywhere.

## Keeping this history

This page is the enduring staff history. The app's **What's new** list is a shorter, capped display;
older entries are retained in the dated history below. When a visible step changes, update this page and the
matching desk guide in the same change. A source entry is not proof of a live release.

## Earlier announcements retained on 3 November 2026

- 2026-10-31 (2026-10-31-redesign-ed-transport): The ED board, All EDs, Transport and Out of area have a new look, with a simpler actions menu on the ED board.
- 2026-10-31 (2026-10-31-redesign-records): Waiting, Alerts, Legal forms, Patients, Movements and the patient record have a new look for each desk.
- 2026-10-31 (2026-10-31-redesign-referrals): Referrals and Ward answer are tidier: rows wrap in full, and Accept and Decline sit in a bar at the foot.

## 21 to 24 October 2026

### Every desk

- Each desk now has its own short tour. Open **Help** and choose **Take the tour**.
- If a change has not saved yet, a message with **Retry** stays on screen. Press **Retry** and do
  not reload, or the change is lost.
- Some screens now wait until a save is confirmed before saying it worked, and keep what you typed
  until then.
- A bed kept for an incoming patient now says **Pulled**, not "held".
- Wards and coordinators now choose from one shared list of decline reasons.
- Observation levels replace the old specialling tick, from General to Two staff constant.
- Printed and saved pages now show the full date and the time in AWST.
- Phone buttons are larger, focus is easier to see, and Help is easier to read.
- The demonstration keeps saving after you type text. Typed fields come back as "Typed text not
  kept on this device".
- The Demo menu now sits under the Synthetic label.

### Flow coordinator

- **My list** (Home) no longer pre-selects anything for you.
- The desktop decision pane now matches the phone list.
- **Ask more wards** is a tick list, and works on community referrals too.
- **Log a call** records who was rung about a referral.
- You can withdraw an acceptance that still has a pulled bed in one step.
- Statistics: Summary and Overview are now one **Network** page.

### Ward

- You now see the full referral, with name, UMRN and documents, before you answer.
- Tap the patient's name on the incoming card to open the referral.
- The card shows the patient's checks and your ward's own state on separate lines.
- When you accept, you choose the pull time limit: standard or extra travel.
- On the phone, the bed board shows every bed.
- Ward notices now appear in the shared Alerts drawer.
- A new seclusion and restraint view shows your room and what is in use now.
- When your ward sent a referral, you can correct it, mark information provided, or change urgency
  or legal status.

### Emergency department

- The ED board shows where each referral stands.
- Examination, medical clearance, paper expiry and referral saves now confirm before saying done.
- The ED board's personal list is now called **My list**.

### Community team

- The referral form is shorter. It asks for a purpose and first contact time, with team search.
- A **Sent** tab shows the referrals you sent and whether a ward accepted.
- An accepted referral can now be moved, transported and arrived, and you can follow it on a new
  **Movements** screen.
- Phone alerts tell you when a referral is answered.
- Contacts show as saved only once the save is confirmed.

### Site bed manager

- You can now confirm beds, manage bed releases and discharge blockers, close or reopen a ward to
  admissions, and mark bed meeting actions done.
- **Referrals** is now a read-only list of your site's incoming referrals.
- **Discharges** now opens under your own desk.
- A seclusion and restraint view shows your site's rooms and what is in use.
- Each ward's bed figure now shows who confirmed it.

### Transport officer

- You now see only your own service's jobs, with the flags recorded on each referral.
- Phone alerts tell you when a job is new or changes.

### Executive

- Your desk is now view only, with no actions and no broadcast alerts.

---

## How to add an entry

- Add a line when a change alters what staff see or do. Put it under the newest date heading, or
  start a new one.
- Group lines by desk. Use "Every desk" for changes everyone sees.
- One line each, in plain English, for clinicians. Say what they will notice, not how it was built.
- No PR numbers, branch names, code names or decision numbers.
- Use the app's own button and screen names, in bold.
- No patient details, and no real staff names or endorsements.
- Never describe risk scores, suggested wards, automatic placement, queue re-sorting, computed
  legal times or automatic release of beds. Ward Flow does none of these.
- A bed kept for an incoming patient is **Pulled**, with a pull time limit. "Held" is only for a
  patient's own bed while they are on leave or absent.
- Avoid counts that change. Point to the screen instead.
- If a step changes, update the matching [desk guide](desk-guides/README.md) too.

## Retained app announcements

These entries moved from the capped app source list into this history on 3 November 2026. Their
text and identity are retained here; this is not evidence of a live release.

- 2026-10-31 (`2026-10-31-redesign-capacity`): Capacity has a new look: beds ready first, the bed forecast, a bed map of every ward and this shift's checks.
- 2026-10-31 (`2026-10-31-redesign-referrals`): Referrals and Ward answer are tidier: rows wrap in full, and Accept and Decline sit in a bar at the foot.
