# Access review

_Created 2026-11-10 - audit item M59 (source A41), for go/no-go row P5; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** draft procedure and blank record. **No review has been done yet.** The item is done
when the first dated record below is filled in, with the reviewer and any removals.

**How often:** every quarter while Ward Flow holds synthetic data; every month during a pilot
(the pilot's monthly review in [account process section 5](../pilot/account-process.md#5-monthly-access-review)
is the same review, so do it once and record it here).

**Who:** Josh (repository owner) reviews until a pilot lead and privacy officer are named. During
a pilot the pilot lead and an access admin review, and the privacy officer gets a copy.

## What is reviewed

| Area                          | Where to look                                                                                          | Asked                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Ward Flow roles               | **Settings > Access > Everyone with a role** on the signed-in site                                     | Still needed? Right desk and place? "Switched off, not used" removed?     |
| Ward Flow record access       | **Settings > Access log** and **Governance** "Waiting for review" (break glass)                        | Any odd pattern? More than 3 break-glass openings by one desk in 12 hours |
| Supabase sign-in accounts     | Supabase dashboard, Authentication users                                                               | Any account with no Ward Flow role, or a leaver, to block                 |
| GitHub admins and writers     | `BigSimmo/Ward-Flow` settings, collaborators and teams                                                 | Who can merge, change settings or secrets                                 |
| Railway members               | Railway project **Ward Flow**, members                                                                 | Who can deploy, change variables or see logs                              |
| Supabase organisation members | Supabase organisation **members**                                                                      | Who can read the database or change Auth settings                         |
| Sentry members                | Sentry organisation, if it is kept ([provider map](REAL-DATA-GO-NO-GO.md#4-subprocessors-and-regions)) | Who can see error events                                                  |
| Second sign-in step           | Each provider's member list ([hardening checklist](PROVIDER-ACCOUNT-HARDENING.md))                     | Does every admin have it on?                                              |

Looking at provider member lists is a read-only provider action. An agent needs Josh's yes before
doing it (AGENTS.md rule 3). Removing anyone is a live change and needs Josh's yes at the time.

Write roles and job titles in this record, not personal email addresses. Never paste a key,
token or password.

## Record

Copy this block for each review. Newest first.

### Review on \_\_\_\_\_\_\_ (date)

- Reviewer (role): \_\_\_\_\_\_\_ Second person (role, if any): \_\_\_\_\_\_\_
- Data held at the time: synthetic only / pilot (circle)

| Area                          | Accounts seen | Removed or changed, and why | Second sign-in step on all admins? | Checked how |
| ----------------------------- | ------------- | --------------------------- | ---------------------------------- | ----------- |
| Ward Flow roles               |               |                             | n/a                                |             |
| Record access and break glass |               |                             | n/a                                |             |
| Supabase sign-in accounts     |               |                             | n/a                                |             |
| GitHub                        |               |                             |                                    |             |
| Railway                       |               |                             |                                    |             |
| Supabase organisation         |               |                             |                                    |             |
| Sentry                        |               |                             |                                    |             |

Anything to follow up: \_\_\_\_\_\_\_ Copy sent to privacy officer: yes / no / not named yet

## Admin list

Kept short, by role. Filled from the [hardening checklist](PROVIDER-ACCOUNT-HARDENING.md#admin-list)
and rechecked at each review.

| Service  | Admin or owner roles | Last checked |
| -------- | -------------------- | ------------ |
| GitHub   |                      |              |
| Railway  |                      |              |
| Supabase |                      |              |
| Sentry   |                      |              |
