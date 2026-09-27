# Research reports behind the third-edition build master plan

Eight extraction reports written by Sonnet subagents for the design-review chat, committed here on
2026-09-11 with the owner's approval because Ward Lead asked for them in git rather than in one
session's scratchpad. **They are inputs to the plan, not rulings, and they are dated: each names the
SHA it read.** Where a report and the master plan's second edition
(`../2026-09-11-third-edition-build-master-plan-v2.md`) disagree, the plan is later and corrected;
where the plan and the line's errata disagree, the errata is later still. Read them as what was
believed on the day, with the SHA that makes the belief checkable.

| Report                              | Written    | Read at      | What it extracted                                                                          |
| ----------------------------------- | ---------- | ------------ | ------------------------------------------------------------------------------------------ |
| `A1-app-map.md`                     | 2026-09-10 | `20eb850792` | Routes, components, shell mount, provider and reducer shape                                |
| `A2a-gap-operational.md`            | 2026-09-10 | `20eb850792` | Drawing-versus-app gaps: command, delays, movement, capacity, ward, board, ED, community   |
| `A2b-gap-search-patient-stats.md`   | 2026-09-10 | `20eb850792` | Drawing-versus-app gaps: search, hub, patient, referral, four statistics screens           |
| `A3-process.md`                     | 2026-09-10 | `20eb850792` | How Ward Flow work runs: line, folds, lanes, claims, hooks                                 |
| `A4-model-and-data.md`              | 2026-09-10 | `20eb850792` | `WardFlowState`, seeds, derivations, the referral model                                    |
| `A5-tests-and-gates.md`             | 2026-09-10 | `20eb850792` | Ward test runner, expected-reds, journeys, mutation, which gates are heavy                 |
| `B1-widened-check-dry-run.md`       | 2026-09-11 | `a387cdbdfb` | Dry run of the widened D-31 sourcing condition over v2 §6: 37 reached, 9 flagged, 9 false  |
| `B3-shell-stylesheets-vs-tokens.md` | 2026-09-11 | `a387cdbdfb` | Every literal the design-system gate counts in the three shell stylesheets, and the tokens |

Known corrections the plan already made to these reports, so nobody re-imports them: the four
ED-tally facade names in A1/A2a never existed (errata §CF); `legalDeadlineMinutes` has readers; the
movement figures reconcile; `Admission`/`Referral` carry `patientId` at `ba81fd2109` and the seed sets
it on one occupant deliberately (§DG). The B1 report's own recommendation — do not build the widened
check as a gate — was adopted in v2 §1. The B3 report's findings are written up in
`../2026-09-11-o7-shell-stylesheet-exemption-finding.md`.

Tier, stated once for all eight: Sonnet, extraction. Nothing here was run; every count is a read.

**Instruction, not disclaimer: a claim in these reports is a claim about its read-SHA, and any reader must re-derive it against the current tree before acting on it.** A report's claims age from the moment it is read, not the moment it is written, and the gap between the two can contain the fix — the `referralId` claim in A4 was true at `20eb850792` and false by the end of the same day (annotated in place, 2026-09-11).
