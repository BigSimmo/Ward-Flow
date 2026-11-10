# Decision for Josh: when to switch on the sign-in front door

_Created 2026-11-10 - audit item M128; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** open question for Josh. **Not decided.** When he rules, it goes into
[decisions.md](../decisions.md) as the next D entry, and the setting is confirmed on both sites.

## Where things stand

- Both hosted sites can require a pass before any page or API answers
  ([front door switch](../OPERATIONS-RUNBOOK.md#front-door-switch)). It is **off** on both.
- D-88 approved a demo code for the public demo once the front door is on, but left switching it
  on undecided.
- So anyone with either address sees the whole synthetic network. No real data is at risk, but
  the demo is found by chance rather than shared on purpose, and the signed-in site's pages load
  before sign-in.
- Turning it on is a Railway setting: `WARD_FRONT_DOOR=required`, `WARD_PASS_SECRET` (32 or more
  random characters) and, on the public demo, `WARD_DEMO_CODE`; then a restart. It costs nothing.
  It needs Josh's yes to set (AGENTS.md rule 3). Turning it off again is the same change.

## Question

When should the front door be switched on, on each site?

| Option                                              | What happens                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A. Now, both sites**                              | The signed-in site needs an account before any page. The demo needs the code. Demo links must carry the code with them. |
| B. Now on the signed-in site; demo before the pilot | The signed-in site is closed. The demo stays open for easy showing until the first pilot site is named.                 |
| C. Before the first pilot, both sites               | Nothing changes now. Both are switched on as a pilot launch step.                                                       |
| D. Only before real data                            | Least effort now. The synthetic network stays public through the pilot.                                                 |

**Recommendation: A.** It is a free, reversible setting already built and tested in source. It
makes the demo shared on purpose (the reason for D-88), and it means the pilot and any later
breach containment ([breach plan step B](../pilot/breach-plan.md#2-containment-steps-that-work-today-b2))
start from a site that is already closed, rather than changing it under pressure.

## After Josh rules

| Step                                                                      | Who                                 | Date | Seen |
| ------------------------------------------------------------------------- | ----------------------------------- | ---- | ---- |
| D entry recorded                                                          | The thread that asked               |      |      |
| Railway variables set on `ward-flow` and `ward-flow-shared`               | Hosting maintainer, with Josh's yes |      |      |
| Signed-in site: page without a pass goes to `/sign-in`; API call gets 401 | Whoever checks                      |      |      |
| Public demo: `/sign-in` asks for the code; a right code opens it          | Whoever checks                      |      |      |
| `/api/health` still answers on both                                       | Whoever checks                      |      |      |
