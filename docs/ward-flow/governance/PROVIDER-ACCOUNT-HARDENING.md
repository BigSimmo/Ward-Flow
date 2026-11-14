# Provider account hardening: Josh's settings checklist

_Created 2026-11-10 - audit item M125; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**For:** Josh. **Status:** checklist, **nothing confirmed yet**. Every setting below is in a
provider dashboard, so only Josh (or someone he asks, with his yes) can check or change it. Agents
must not touch these settings (AGENTS.md rule 3). None of it costs money.

**Done when:** each row has a date and "confirmed", and the admin list below is copied into the
[access review](ACCESS-REVIEW.md#admin-list).

Last known state comes from repository records, not a fresh look.

## Settings

| #   | Service  | Setting                                                                                      | Last known state (source)                                                                                                                                            | Confirmed on (date) | State seen |
| --- | -------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| H1  | Supabase | Authentication: "Allow new users to sign up" **off**                                         | **Off** since 14 Nov 2026 (D-173; [runbook known gaps](../OPERATIONS-RUNBOOK.md#known-gaps))                                                                         |                     |            |
| H2  | Supabase | Organisation settings: AI assistant SQL, log and data-sharing options **off**                | **On** at 3 Nov 2026 ([go/no-go section 4](REAL-DATA-GO-NO-GO.md#4-subprocessors-and-regions)), Q391                                                                 |                     |            |
| H3  | Supabase | Second sign-in step (MFA) on every organisation owner and admin                              | Not recorded                                                                                                                                                         |                     |            |
| H4  | GitHub   | Two-factor authentication on the owner account; required for the organisation if one is used | Not recorded                                                                                                                                                         |                     |            |
| H5  | GitHub   | Dependabot security updates on                                                               | Off (STATUS Waiting on Josh item 8)                                                                                                                                  |                     |            |
| H6  | Railway  | Two-factor authentication on every member of the **Ward Flow** project's workspace           | Not recorded                                                                                                                                                         |                     |            |
| H7  | Sentry   | Two-factor required for the organisation, or the organisation removed if not kept            | Organisation `clinibase-xz`, US region, switched on 26 Oct 2026 per project notes ([operations-readiness](../operations-readiness.md#server-error-reporting-sentry)) |                     |            |
| H8  | App      | `NEXT_PUBLIC_WARD_OPEN_SIGNUP` not `"true"` on the signed-in site                            | Default hidden ([account process](../pilot/account-process.md#public-sign-up-must-be-off))                                                                           |                     |            |
| H9  | All      | Recovery codes for each second sign-in step stored offline, not in the repository            | Not recorded                                                                                                                                                         |                     |            |

Where a dashboard label has changed, record the label you saw.

## Admin list

Roles only, no email addresses. Keep it short: fewer admins, less to review.

| Service             | Owner and admin roles | Members with write or deploy | Date |
| ------------------- | --------------------- | ---------------------------- | ---- |
| GitHub `Ward-Flow`  |                       |                              |      |
| Railway `Ward Flow` |                       |                              |      |
| Supabase org        |                       |                              |      |
| Sentry org          |                       |                              |      |
