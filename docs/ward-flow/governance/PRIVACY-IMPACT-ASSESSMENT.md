# Privacy impact assessment (draft)

_Created 2026-11-10 - audit item M60 (source A34), go/no-go rows P1 to P6; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** working draft, **not a PIA**. Nobody has assessed or signed it. It gathers what the
repository already knows so a privacy officer (or an outside adviser, which costs money and needs
Josh's spending approval first) can start from it. Nothing here is legal advice. Every law and
policy reference must be checked as current on the day the PIA is done.

**Done when:** a privacy officer is named (P1), this PIA is completed and signed (P2), and go/no-go
rows P1 to P6 are ticked with evidence ([go/no-go section 2](REAL-DATA-GO-NO-GO.md#2-privacy-impact-assessment-pia)).
This is the real-data gate in D-111 item 8 (audit item 34).

## 1. Who

| Role                  | Name                    |
| --------------------- | ----------------------- |
| Privacy officer       | **To be named** (P1)    |
| Clinical safety owner | **To be named**         |
| System owner          | Josh (repository owner) |
| Records manager       | **To be named**         |

## 2. Laws and policies to check

Each line needs the privacy officer to confirm whether and how it applies, and **which parts are in
force on the PIA date**.

| Source                                                                                                                  | Why it may apply                                                                                             | In force? (confirm)                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Privacy and Responsible Information Sharing Act 2024 (WA) (PRIS Act)                                                    | Information Privacy Principles (IPPs) for WA public entities, and its information breach notification scheme | Commenced in stages. **Confirm** the date the IPPs and breach scheme started |
| State Records Act 2000 (WA) and the WA Health retention authorities                                                     | Retention and disposal ([RETENTION-AND-BACKUP.md](../RETENTION-AND-BACKUP.md))                               | Confirm current authority numbers (see that page's version check)            |
| Health Services Act 2016 (WA)                                                                                           | Confidentiality of information held by health service providers                                              | Confirm the section                                                          |
| Mental Health Act 2014 (WA)                                                                                             | Confidentiality and legal status information                                                                 | Confirm the provisions                                                       |
| WA Health mandatory policies (information use and disclosure, information security, patient confidentiality, retention) | Policy framework for any system holding patient information                                                  | Confirm current policy numbers and versions                                  |
| Privacy Act 1988 (Cth), Australian Privacy Principles and the Notifiable Data Breaches scheme                           | Only if a private hospital or provider takes part                                                            | Applies only in that case                                                    |

## 3. What Ward Flow holds

- **Patient fields:** see the [field list](DATA-MINIMISATION-FIELD-LIST.md) (row P3). Names in full
  on screens, prints and TV (D-83); none in downloads (D-102).
- **Staff:** sign-in accounts, roles, places, access requests, audit trail, record access log,
  break-glass records.
- **Retention:** [RETENTION-AND-BACKUP.md](../RETENTION-AND-BACKUP.md) (row P4).

## 4. Where it goes

From [go/no-go section 4](REAL-DATA-GO-NO-GO.md#4-subprocessors-and-regions), which is the one home
for the provider and region list. Each row needs a privacy officer view:

| Flow                                      | Offshore?                 | Question for the PIA                                               |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Browser to Railway (app and backend)      | **Yes, Singapore** (D-84) | Accept offshore processing in transit, or move onshore             |
| Backend to Supabase (database, sign-in)   | No, Sydney                | Data processing terms; organisation AI options off                 |
| Server errors to Sentry                   | **Yes, US** if kept       | Keep off, or accept scrubbed events offshore                       |
| Push alerts through browser push services | Yes, global               | Accept fixed text with counts and a place name, or turn off        |
| Device storage, clipboard, downloads      | On the device             | [Device walkthrough](DEVICE-AFTER-SESSION-WALKTHROUGH.md) findings |

## 5. Known risks to assess

| Risk                                           | Source                                        | Draft treatment                                       |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Drafts with typed text in sessionStorage       | Go/no-go C1                                   | Code change before real data                          |
| Sign-in refresh token readable by page scripts | Go/no-go C5, H-0044                           | Move to HttpOnly cookie, or accept with time limit    |
| Names on TV views seen by passers-by           | Row P6, D-68, D-83                            | TV privacy review                                     |
| Unauthorised access                            | H-19, row P5                                  | [Access review](ACCESS-REVIEW.md), break-glass review |
| Copies and prints leave the system             | H-20, D-71 item 7                             | Decide before real data whether names may be copied   |
| Breach                                         | Go/no-go section 3                            | [Breach plan](../pilot/breach-plan.md)                |
| Aboriginal status display                      | H-24, D-6                                     | Not displayed until the cultural safety review        |
| The sites open without sign-in                 | [Front door decision](FRONT-DOOR-DECISION.md) | Front door required before real data                  |

## 6. Sign-off

| Item                            | Name and role | Date | Signature |
| ------------------------------- | ------------- | ---- | --------- |
| PIA scope and version agreed    |               |      |           |
| PIA completed                   |               |      |           |
| Privacy officer approval        |               |      |           |
| Rows P1 to P6 ticked (go/no-go) |               |      |           |
