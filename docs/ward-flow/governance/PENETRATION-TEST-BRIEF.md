# Independent penetration test: scope and brief

_Created 2026-11-10 - audit item M64 (source A44), real-data gate (D-111 item 8, audit item 44); drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** draft brief. **No tester engaged, no test run.** A penetration test costs money, so
it needs Josh's spending approval with a hard cap first. Testing live services also needs his
explicit yes (AGENTS.md rule 3) and a written authorisation for the tester.

**When:** after the known fixes from audit item M126 are merged and released, so money is not spent
finding gaps already known. Run it against synthetic data only.

**Done when:** the report and a retest letter are filed in `docs/ward-flow/evidence/` (with any
secrets or exploit detail removed), and every high finding is fixed and retested.

## 1. In scope

| Target                               | What to test                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public demo (`ward-flow` on Railway) | Front door and demo code (when on), rate limit on wrong codes, headers, content security policy                                                                                                                                                           |
| Signed-in site (`ward-flow-shared`)  | Sign-in, session expiry (12 hours), sign-out, pass cookie (`wf_pass`, go/no-go C4), token storage (C5), XSS                                                                                                                                               |
| Shared backend (`ward-flow-backend`) | Authorisation by role and place (the [permission matrix](../permission-matrix.md)), command replay, conflicts, break glass, `/readyz` and monitor token, rate limits, forwarded-address trust ([runbook known gaps](../OPERATIONS-RUNBOOK.md#known-gaps)) |
| Supabase sign-in                     | Open sign-up (should be off), password reset, account enumeration                                                                                                                                                                                         |
| Direct database access               | Whether the anonymous or a signed-in key can reach `ward_flow` tables directly, bypassing the backend; row level security; the `wardflow_backend` role's grants                                                                                           |
| Push alerts                          | Subscription abuse, alert content                                                                                                                                                                                                                         |

Addresses and resource names: [hosting.md](../../hosting.md) and the
[runbook](../OPERATIONS-RUNBOOK.md#what-runs-where). Give the tester those, not secrets from the repo.

## 2. Out of scope

Denial of service and load testing (a separate approved run, D-111 item 6); social engineering;
the providers' own platforms; PsychSift or any other project; any real patient data.

## 3. What the tester gets

- Synthetic test accounts, one per desk, made for the test and removed after.
- The permission matrix, the go/no-go code rows (C1 to C7) and the list of known gaps, so known
  issues are confirmed rather than rediscovered.
- A named contact (Josh) and a stop rule: stop and phone if anything looks like real data or a
  service goes down.

## 4. Choosing a tester

- Independent of anyone who wrote the code.
- Accredited (for example CREST, or a scheme the health service's IT names). Ask the health
  service's IT which accreditation they accept, so the report is usable for their approval.
- Fixed price with a hard cap, including one retest.

## 5. Record

| Item                                  | Who | Date | Notes |
| ------------------------------------- | --- | ---- | ----- |
| M126 known fixes released             |     |      |       |
| Spending approval and hard cap (Josh) |     |      |       |
| Tester chosen, authorisation signed   |     |      |       |
| Test window                           |     |      |       |
| Report received                       |     |      |       |
| High findings fixed                   |     |      |       |
| Retest letter received                |     |      |       |
