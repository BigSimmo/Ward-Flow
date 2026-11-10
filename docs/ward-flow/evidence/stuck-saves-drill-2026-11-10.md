# Stuck saves drill (M43, absorbs M73): draft, not yet run

_Drafted 10 November 2026 for the master audit list. **Status: DRAFT. Nobody has run this drill.**_
_Synthetic data only. No step below touches Supabase, Railway or any hosted service._

**What it proves when run:** support can find and settle a stuck, conflicted or uncertain save
without editing the database by hand, using only the
[operations runbook](../OPERATIONS-RUNBOOK.md) "Saves failing, Retry banner" row and the app's
own receipt recovery. It also tries the new stuck-work check.

## What is already in place (checked from source, 10 Nov 2026)

| Piece                                 | Where                                                                                              | Checked how                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Retry banner and reload warning       | `src/components/ward-management/ward-shared-save-status.tsx`                                       | Read the source                                                  |
| Reload receipt recovery (ids only)    | `ward-command-recovery.ts`, `ward-command-recovery-words.ts`                                       | Read the source                                                  |
| Server receipts, partial outcome kept | `backend/ward-flow/postgres.mjs` (`receipt`)                                                       | Existing test `adversarial-receipt-recovery.test.mjs`            |
| In-app ageing flags                   | Decision targets (`ward-decision-targets.ts`): referral not answered, bed not pulled, no transport | Existing app behaviour                                           |
| **New:** stuck-work check             | `scripts/ward-flow/stuck-work-check.ts`                                                            | `tests/ward-audit-m43-stuck-work-check.test.ts`, 5 tests passing |

The stuck-work check reads one saved state file. It flags referrals waiting for an answer past
24 hours, ward-accepted referrals with no journey past 24 hours, and refusals rising (three or
more denied audit rows in the latest 6 hours, more than the 6 hours before). It prints ids, ages
and counts only, and exits 1 when anything is flagged.

Dry run on the synthetic seed (10 Nov 2026, local file only):
`node scripts/run-tsx.mjs scripts/ward-flow/stuck-work-check.ts <seed.json> --now 642` flagged one
seeded referral, `RF-015`, waiting for an answer for 4,500 minutes (75 hours). Nothing else.

## Gaps found while drafting

1. **No scheduled stuck-work check runs yet.** The check is offline. Running it on a schedule
   against the hosted workspace needs a read of hosted data, so it needs Josh's yes (provider
   rule). Until then it is a manual support step.
2. **Bulk acknowledge refusals are silent.** "Acknowledge visible" ignores each save's answer, so a
   refused acknowledgement after the Undo window is not said. See M13 and M37.
3. **Acknowledgements write no audit row.** A support person cannot find them in the audit log.
4. The runbook row names no step for "the referral has sat in one state for a day". The stuck-work
   check is the proposed step; add it to the runbook once Josh agrees.

## Drill steps (a person still has to do every one)

Do this on a local stack with a throwaway Postgres and the synthetic seed. Record the date, the
commit and who ran it.

1. Start the local shared stack ([LOCAL-FIRST-RUN.md](../LOCAL-FIRST-RUN.md)) on a throwaway
   database. Sign in as a synthetic coordinator desk.
2. **Seed a stuck save.** Make a change (for example accept a referral), then stop the backend
   before the reply arrives. Expect the Retry banner and the reload warning.
3. Follow the runbook row exactly: read the messages, keep the page open, press Retry after the
   backend is back. Expect "saved" or a clear refusal, never a silent loss.
4. **Seed an uncertain save across a reload.** Repeat step 2, then reload. Expect the recovery
   message to name the outcome ("saved", "partly saved", "not saved", "outcome not known").
5. **Seed a conflict.** From a second desk change the same referral first. Expect HTTP 409 and a
   conflict message, and the first desk's change not applied.
6. Save the local state to a file and run the stuck-work check with `--now` set a day later.
   Expect the referral from step 2 (if left unanswered) to be flagged.
7. Write down every point where you needed to look in the database by hand. Each one is a gap.

| Step | Expected | What happened | Pass or gap |
| ---- | -------- | ------------- | ----------- |
| 1    |          |               |             |
| 2    |          |               |             |
| 3    |          |               |             |
| 4    |          |               |             |
| 5    |          |               |             |
| 6    |          |               |             |
| 7    |          |               |             |

**Run by:** \_\_\_\_ **Date:** \_\_\_\_ **Commit:** \_\_\_\_
