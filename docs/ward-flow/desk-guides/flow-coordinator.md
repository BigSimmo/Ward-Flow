# Desk guide: Bed coordinator

<!-- last-checked: 2026-11-10 -->

_Updated 2026-11-05 — queue order, recorded-time and departure guidance reconciled against source. Other screen prose was not browser-rechecked._

You see the whole network (statewide) or your own health service. You decide referrals and keep
patients moving from referral to arrival.

## What you see first

**Home** opens the **Needs you** tab. It shows **Act now**, **Since you last looked** and **Referrals to
decide**. Waiting lists stay in wait order. Flags highlight a row but never move it. Nothing is
pre-selected for you.

Your main menu: **Home, Capacity, Movements, Waiting, All EDs, Referrals, Handover**. Other pages are under
**More** (desktop) or **Menu** (phone).

On a phone, the bar at the bottom has **Home, Capacity, Create, Alerts, Tools**. **Create**
holds **New referral**. **Referrals** and **Activity** are under **Menu**.

## How lists and recorded times work

Home's movement queue shows the longest wait first; equal waits use the record ID to keep a
stable order. Waiting keeps longest waits first within the selected groups. The clinician's tier,
an urgent flag and a recorded form time do not move a person ahead of a longer wait. Filtering a
list changes which rows you see, so check the selected view when comparing lists.

A form time is the time somebody typed from the paper, shown as **as typed** and **Not legally
checked**. A due-soon highlight uses the configured warning window; it does not calculate or
validate a Mental Health Act deadline. The long-wait reminder is an operational reminder, not a
legal deadline or a finding that a standard was breached.

Source: [Home queue order](../../../src/components/ward-management/ward-priority.ts),
[Waiting list](../../../src/components/ward-management/delays/delays-board.tsx) and
[operational reminders](../../../src/components/ward-management/ward-operational-defaults.ts).

## Jobs you do most

1. **Decide a referral.** Press **Decide** on a referral. Read it, then **Accept referral** or
   **Decline referral**. A decline needs a reason from the one decline list.
2. **Ask more wards.** Use **Ask more wards** and tick wards from the list. Wards are listed in a
   fixed order. The app never ranks or suggests a ward. The screen shows how many may wait at once.
3. **Pull the bed.** Once a ward accepts, press **Pull the bed**. The bed is kept for that patient
   until arrival or release, within the pull time limit set in Settings.
4. **Book transport.** Press **Book transport**, or record that none is needed. Use
   **Cancel transport** before **Release the pulled bed** if plans change.
5. **Log a call.** On a referral, use **Log a call** so the next person can see who was rung.
6. **Hand over.** Open **Handover** to see what the next shift needs, then **Sign off**.
7. **Record departure.** On **Discharges**, use **Record departure** for a confirmed discharge.

## What you cannot do

- You cannot place a patient automatically. A person always chooses.
- The app does not work out Mental Health Act times. It shows only times someone typed from the
  paper form, marked "Not legally checked".
- Ward acceptance and admission remain with the ward unless an authorised override is recorded.
- On **Discharges**, you can record departure for a confirmed discharge with **Record departure**.
  This records that the patient has left; it does not choose or approve their clinical discharge.

## Saved, or not

- After an action, a short message says it was recorded. In the demo it adds "Saved on this
  device only."
- On a shared board the status line reads "Saving shared changes…", then your desk name again.
- If it reads "Connection unavailable — changes are disabled." and shows **Retry**: stay on the
  page and press **Retry**. Do not reload. Reloading loses the unconfirmed action.
- A message saying an action was not recorded means nothing changed. Read the reason and try again.
- If Retry keeps failing, use the ward whiteboard and phone, and tell your team.

New here? Open **Help** and choose **Take the tour**.

_Prototype on synthetic data. Not for real patients._
