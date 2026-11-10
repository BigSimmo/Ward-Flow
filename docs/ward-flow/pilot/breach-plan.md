# Breach plan for the shadow pilot

_Created 2026-11-08 - drafted for go/no-go items B1 to B4; checked against source at `main` `d85618e6`; Documentation owns._

_Updated 2026-11-10 - notification leads for the privacy officer and an approval record added (audit item M63); still a draft; Documentation owns._

**For:** pilot site leads, the bed coordinator on shift, the hosting maintainer and Josh.
**Status:** draft. Not yet approved by a privacy officer (none is named yet). It covers items
B1 to B4 in [REAL-DATA-GO-NO-GO.md section 3](../governance/REAL-DATA-GO-NO-GO.md#3-breach-plan).
Writing it down does not tick those items. Each needs its own evidence.

The shadow pilot uses invented patients only. The ward whiteboard stays the record. So the most
likely "breach" is one of these:

- someone types a real patient's details into Ward Flow;
- a photo or screenshot of a Ward Flow screen leaves the ward;
- a password, key or secret is exposed;
- someone who should not have access signs in.

Treat each as a possible privacy breach until the privacy officer says otherwise.

## 1. Who is told first, who decides (B1)

| Step | Who                                                                   | What they do                                                                                                                   |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Whoever notices                                                       | Tell the bed coordinator on shift straight away. Do not forward, repost or delete anything. Write down the time.               |
| 2    | Bed coordinator on shift                                              | Ring the repository owner (Josh). Start an entry in the [incident log](incident-log.md). Move the ward to the whiteboard only. |
| 3    | Repository owner                                                      | Decides which containment steps (section 2) to run now. Tells the privacy officer and the pilot site lead.                     |
| 4    | Privacy officer (**to be named**)                                     | Decides whether it is a reportable breach, and who must be told and by when.                                                   |
| 5    | Clinical safety owner (**to be named**)                               | Decides whether any patient could be harmed, and whether the pilot pauses.                                                     |
| 6    | Pilot site lead (**to be named**) and the hospital's incident process | Logs it in the hospital's own incident system, if the hospital's rules require that. Process **to be confirmed** by the site.  |

Until the privacy officer and clinical safety owner are named, Josh holds both decisions and must
get advice before telling anyone outside the pilot team. Naming them is on the
[Waiting on Josh list](../STATUS.md#waiting-on-josh).

## 2. Containment steps that work today (B2)

**Every step below is a live change. It needs Josh's yes first**
([runbook, who may do what](../OPERATIONS-RUNBOOK.md#who-may-do-what)). None has been rehearsed on
the hosted services. Never paste a secret value into a log, ticket, chat or this page.

| Step                                   | How (detail in the linked page)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Who can do it                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **A. Stop new releases**               | Set the repository Actions variable `WARD_RELEASE_PAUSED` to `true`, and cancel any release run in progress ([rolling back the app, step 2](../OPERATIONS-RUNBOOK.md#rolling-back-the-app)).                                                                                                                                                                                                                                                                                                                                           | Repository owner, or the hosting maintainer with his yes                                                                        |
| **B. Turn the front door to required** | On Railway, set `WARD_FRONT_DOOR=required` and make sure `WARD_PASS_SECRET` is set (32 or more random characters), then restart. Every page then needs a pass ([front door switch](../OPERATIONS-RUNBOOK.md#front-door-switch)). The public demo was seen shut on 10 November 2026 (D-126).                                                                                                                                                                                                                                            | Hosting and database maintainer, with Josh's yes                                                                                |
| **C. End every session**               | Change `WARD_PASS_SECRET` and restart: this signs everyone out of the front door. In the app, an access admin or statewide coordinator revokes the roles involved; an account with no role is refused. Each person's own sign-out ends their session on the server at once (migration 11, [backend README](../../../backend/ward-flow/README.md)). **Gap:** Ward Flow has no single "sign out everyone" control. Ending every Supabase sign-in at once needs a Supabase dashboard step that is **not written in this repository** yet. | Hosting maintainer (secret); access admin or statewide coordinator (roles); Supabase steps: hosting maintainer, with Josh's yes |
| **D. Rotate the keys**                 | Make new values for `WARD_PASS_SECRET`, the Supabase publishable key, the `wardflow_backend` database password and `WARD_FLOW_UPTIME_TOKEN`. Update them in Railway and Supabase only. The signed-in site reads its browser settings at build time, so a new publishable key there needs a rebuild ([how a deploy happens](../OPERATIONS-RUNBOOK.md#how-a-deploy-happens)). Setting names are in the [Supabase settings template](../../../backend/ward-flow/infra/supabase-settings.template.env).                                    | Hosting and database maintainer, with Josh's yes                                                                                |
| **E. Pause the Railway services**      | Stop `ward-flow-shared` and `ward-flow-backend` in the Railway dashboard ([what runs where](../OPERATIONS-RUNBOOK.md#what-runs-where)). The exact Railway steps are **not written in this repository**. Check the state afterwards with [RAILWAY-OPERATIONS.md](../RAILWAY-OPERATIONS.md#act-on-the-actual-state). The public demo (`ward-flow`) holds no shared data.                                                                                                                                                                 | Hosting and database maintainer, with Josh's yes                                                                                |
| **F. Real patient details typed in**   | Do not edit or delete the record yourself; history rows cannot be changed. Tell Josh. The fix follows [correction requests](../RETENTION-AND-BACKUP.md#correction-requests) and needs the privacy officer's advice.                                                                                                                                                                                                                                                                                                                    | Repository owner, with privacy officer advice                                                                                   |

Order of use: A first, then B and C together. D next if a secret may be exposed. E if the leak is
still going or the cause is unknown.

## 3. Evidence to keep (B3)

Keep it before changing anything else. Do not delete any of it without Josh's yes. Copy only what
is needed, and keep patient-like content out of tickets and chat.

| Evidence                               | What it shows                                                                                       | How long it is kept                                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Record access log (`record_access`)    | Who opened which patient, movement, referral, list or TV view, and when. Append-only (migration 11) | In the Ward Flow database. Retention plan in [RETENTION-AND-BACKUP.md](../RETENTION-AND-BACKUP.md#retention-plan).                                                                            |
| Audit history and break-glass records  | Every change, who made it and every break-glass opening of a record outside the person's own care   | In the Ward Flow database. The audit history is never pruned                                                                                                                                  |
| Supabase Auth and API logs             | Sign-ins and requests to Supabase                                                                   | **Unconfirmed.** Open question 7 in [RETENTION-AND-BACKUP.md](../RETENTION-AND-BACKUP.md#open-questions-for-a-records-manager-or-privacy-officer). Depends on the plan, which is not recorded |
| Railway logs                           | Request IDs, route types, status and timings. No tokens, user IDs or payloads                       | **Unconfirmed**                                                                                                                                                                               |
| Uptime runs and `backend-down` issues  | When the backend was up or down                                                                     | GitHub's own limits. **Unconfirmed**                                                                                                                                                          |
| The incident log entry, photos, emails | What happened, in time order                                                                        | Hospital's own rules. **To be confirmed** by the site                                                                                                                                         |

Save a copy of any provider log that matters on the day, because its retention is unknown.

## 4. Notification duties (placeholders)

The privacy impact assessment (PIA) must confirm every line here. Nothing below is legal advice
or a confirmed time limit.

| Duty                                       | Applies when                                           | Time limit          | Confirmed by                      |
| ------------------------------------------ | ------------------------------------------------------ | ------------------- | --------------------------------- |
| State scheme for WA public health services | **To be confirmed by the PIA**                         | **To be confirmed** | Privacy officer (**to be named**) |
| Federal Notifiable Data Breaches scheme    | Possibly, if a private hospital or provider takes part | **To be confirmed** | Privacy officer (**to be named**) |
| Telling affected people                    | **To be confirmed by the PIA**                         | **To be confirmed** | Privacy officer (**to be named**) |
| Hospital incident system and executive     | Site rules                                             | Site rules          | Pilot site lead (**to be named**) |

**Leads for the privacy officer to check** (drafter's memory, not verified, not legal advice):

- The WA Privacy and Responsible Information Sharing Act 2024 sets up an information breach
  notification scheme for WA public entities. Its parts commence in stages. Confirm whether the
  breach scheme is in force on the day, what makes a breach notifiable, who is notified (the
  regulator and affected people) and the time limits.
- The Commonwealth Notifiable Data Breaches scheme (Privacy Act 1988, Part IIIC) applies only if
  a private hospital or provider takes part. Under it a suspected eligible breach is assessed
  within 30 days, and the Commissioner and affected people are told as soon as practicable.
- The pilot site's own incident and executive reporting rules.

## Practice drill (B4)

**This is a tabletop drill, on paper.** It changes no live service. Nobody touches Railway,
Supabase, GitHub or any setting. Every name below is invented. Allow 60 minutes.

**Who takes part:** a facilitator, a note-taker, someone playing the bed coordinator on shift, the
hosting maintainer, Josh, and (if named) the privacy officer and pilot site lead.

**Scenario.** It is 10:05 on a Tuesday. A ward clerk sees a photo on a public social media page.
It shows the Ward Flow TV board in the ward's meeting room. Three invented names are readable:
"Ava Testpatient", "Leo Sample" and "Mia Fictional". The post went up at 09:40.

**Timed injects.** The facilitator reads each one out at its time.

| Time   | Inject                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------- |
| 0 min  | The ward clerk rings the bed coordinator about the photo.                                            |
| 10 min | The post has 40 shares. A local reporter emails the hospital asking whether these are real patients. |
| 20 min | A nurse says one name looks like a real patient's name on the whiteboard.                            |
| 30 min | The photo also shows a sticky note on the TV with what may be a sign-in password.                    |
| 45 min | The facilitator says Supabase's log retention for this plan is unknown.                              |
| 60 min | The post is taken down. The site executive asks for a one-paragraph summary by end of day.           |

**Questions to answer.**

1. Who was told first, and how long did it take to reach Josh?
2. Are the names invented? How do we check without spreading them further?
3. Who decides whether this is a privacy breach? Who holds that decision while no privacy officer is named?
4. Which containment steps (A to F) would we run, in what order, and who would run each?
5. What evidence do we keep, and where? What would we lose if we waited a day?
6. Who answers the reporter? What do they say?
7. Does the pilot pause? Who decides?
8. What would change in this plan?

**Drill record** (fill in on the day).

| Time | What happened or was decided | Who | Step or question | Lesson or gap |
| ---- | ---------------------------- | --- | ---------------- | ------------- |
|      |                              |     |                  |               |
|      |                              |     |                  |               |
|      |                              |     |                  |               |
|      |                              |     |                  |               |

Drill date: \_\_\_\_\_\_\_ Facilitator: \_\_\_\_\_\_\_ Started: \_\_\_\_ Ended: \_\_\_\_

Changes to make to this plan: \_\_\_\_\_\_\_

A tabletop drill is not the end-to-end drill that item B4 asks for. That needs a separate, approved
run on synthetic data.

## Approval and drill record

Items B1 to B4 are ticked only when each row below has a date and evidence.

| Item | What                                                                  | Who                      | Date | Evidence |
| ---- | --------------------------------------------------------------------- | ------------------------ | ---- | -------- |
| B1   | Plan approved; notification duties in section 4 confirmed             | Privacy officer          |      |          |
| B2   | Each containment step's owner confirmed                               | Josh, hosting maintainer |      |          |
| B3   | Each provider's log retention confirmed                               | Hosting maintainer       |      |          |
| B4   | 60-minute tabletop run once (record above), then the end-to-end drill | Facilitator              |      |          |
