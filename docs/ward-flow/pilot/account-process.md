# Pilot account process

For: the pilot lead, access admins and the staff who ask for accounts. Status: current guidance for
the shadow pilot. Owner: pilot lead (to be named).

_Updated 2026-11-08 - written for the shadow pilot from source at `d85618e6`; Documentation owns._

The shadow pilot runs beside the ward whiteboard with invented patients only. Nobody types a real
patient's details into Ward Flow, including on the request form below.

This page says how the app works today. The rules come from
`src/components/ward-management/ward-access-admin.ts` (who may give what),
`src/components/ward-management/settings/access-settings.tsx` (the **Access** section of
**Settings**) and `src/components/ward-management/ward-shared-role-gate.tsx` (**Ask for access**).
The decisions behind them are D-66, D-80 and D-86 in [decisions.md](../decisions.md).

## People in the process

| Job                   | Who                                                 | What they do                                                    |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Pilot lead            | To be named                                         | Agrees who joins the pilot. Runs the monthly access review.     |
| Line manager          | The person's own manager                            | Confirms the person needs this desk and place. Reports leavers. |
| Access admin          | To be named (one per health service, plus a deputy) | Gives, changes and removes roles in Ward Flow.                  |
| Trainer               | To be named                                         | Runs the [competency check](competency-check.md) before access. |
| Sign-in administrator | To be named (whoever runs the sign-in service)      | Creates and blocks the sign-in account itself.                  |
| Privacy officer       | To be named                                         | Reads the access review. Advises if something looks wrong.      |

A statewide bed coordinator can also give and remove roles. A service bed coordinator cannot.

## Roles and places

Every role is one desk at one place. The screen names are:

| Desk (role)       | Place it is given for     | Can the person ask for it on screen? |
| ----------------- | ------------------------- | ------------------------------------ |
| Bed coordinator   | Statewide, or one service | No. An access admin gives it.        |
| Site bed manager  | One hospital site         | Yes                                  |
| Nurse in charge   | One ward                  | Yes                                  |
| ED clinician      | One emergency department  | Yes                                  |
| Community team    | One community team        | Yes                                  |
| Transport officer | One health service's jobs | Yes                                  |
| Executive         | Statewide, or one service | Yes                                  |
| Access admin      | Statewide, or one service | No. An access admin gives it.        |

The TV board is not a role. A coordinator, site bed manager or ward opens it from **Capacity** with
**Open on TV**.

## Rules the app enforces

These are built in. Nobody can switch them off from the screen.

- Nobody gives themselves a role.
- Nobody gives a role wider than their own place. A service's access admin gives roles only inside
  that service.
- A role works as soon as it is given. There is no second approver (D-86).
- Every role has an end date: 30, 90, 180 or 365 days. A role lasts 12 months at most.
- A role not used for 45 days switches itself off. The list shows it as "Switched off, not used".
- A role ending within 14 days shows **Ending soon**.
- Changing access asks the access admin to sign in again if their last sign-in was not recent.
- Every grant, removal and cover is kept in the audit trail.

The day counts above are synthetic settings in
`src/components/ward-management/ward-clinical-values.ts`. The pilot lead confirms them before the
pilot starts.

## 1. Asking for an account

1. The line manager fills in the [request form](#request-form) and sends it to the access admin.
2. The pilot lead agrees the person is part of the pilot.
3. The sign-in administrator creates the sign-in account. Public sign-up stays off (see below).
4. The person does the [competency check](competency-check.md) in demo mode and passes.
5. The access admin gives the role (step 2 below).

A person who already has a sign-in but no role sees **No Ward Flow role yet** after signing in.
They can choose a role and place and press **Ask for access**. That request shows on the access
admin's screen. It does not replace the request form: the access admin still checks the form and
the competency sign-off first.

## 2. Giving a role

The access admin opens **Settings**, then **Access**.

- **Answering a request.** Under **Requests for access**, press **Give for 90 days** or
  **Decline**. Give it only when the form and competency sign-off are both on file.
- **Giving a role directly.** Under **Give a role**, choose **Person**, **Role**, **Place** and
  **Ends**, then press **Give role**. Nothing is chosen for you. Pick the shortest end date that
  covers the pilot.

A short message says what was given. Check the person now shows under **Everyone with a role**.

## 3. Cover for a shift

Cover lets a colleague look after a second ward or ED for part of a shift.

- Who gives it: a bed coordinator, or a nurse in charge or ED clinician for their own ward or ED.
  An access admin does not give cover. Cover needs no admin, because an admin is not on at 2 am.
- Who can hold it: only a colleague who already holds a ward or ED role. Cover is never a way in
  for a new account.
- How long: 4, 8 or 12 hours. It lasts one shift at most and ends by itself.
- How: in **Settings**, **Access**, under **Give cover**, choose **Cover of**, **Held by** and
  **For**, then press **Give cover**.
- Ending early: under **Cover now**, the person who gave it, or a bed coordinator, presses
  **End cover**.

## 4. Leavers and job changes: same day

When someone leaves, changes job or no longer works on the pilot ward:

1. The line manager tells the access admin the same day.
2. The access admin opens **Everyone with a role**, presses **Remove** on each of the person's
   roles, then **Remove role** to confirm. Access stops straight away.
3. The sign-in administrator blocks the sign-in account the same day. Removing the role alone
   leaves a sign-in that can still **Ask for access**.
4. The access admin notes the date on the request form.

For a job change, remove the old role first, then give the new one.

## 5. Monthly access review

Once a month the pilot lead and an access admin go through **Everyone with a role**:

- Is each person still on the pilot, in the same job and place?
- Remove anything marked "Switched off, not used" or no longer needed.
- Check roles marked **Ending soon**. Give again only if still needed.
- Look at the **Access log** in **Settings** and the **Governance** review list for anything odd.
- Record the date, who did the review and what was removed. The privacy officer gets a copy.

## Public sign-up must be off

Pilot accounts are made by the sign-in administrator only, never by people signing themselves up.

- In the app, the **Create a Ward Flow account** link is hidden unless the setting
  `NEXT_PUBLIC_WARD_OPEN_SIGNUP` is `"true"` and a coordinator email is also set. For the pilot it
  must not be `"true"`.
- In the sign-in service (<!-- fact:auth-provider -->Supabase Auth<!-- /fact -->), open sign-up
  must also be off.
- Checking or changing either setting is a provider action. It needs Josh's yes at the time, and is
  done by the sign-in administrator.

## Request form

Copy this table into the pilot's own form. Fill in staff details only. Never add patient details.

| Field                                     | Entry |
| ----------------------------------------- | ----- |
| Full name                                 |       |
| Work email or username                    |       |
| Job title                                 |       |
| Health service and site                   |       |
| Desk (role) needed                        |       |
| Place (ward, ED, team, site or service)   |       |
| Start date                                |       |
| End date (shortest that covers the pilot) |       |
| Reason this desk is needed                |       |
| Line manager name and signature           |       |
| Pilot lead agreed (name, date)            |       |
| Competency check passed (trainer, date)   |       |
| Role given by (access admin, date)        |       |
| Removed (access admin, date, reason)      |       |
| Sign-in account blocked (name, date)      |       |

_Prototype on synthetic data. Not for real patients._
