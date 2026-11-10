# PC-only documents copied 10 November 2026

**Historical records. Not current guidance.** These files were untracked in Josh's Windows checkout
of Ward Flow and never reached Git. Josh approved copying the worth-keeping ones here on 10 November
2026 (D-121 item 7). The originals on his PC were left untouched. Each file is copied as it was,
apart from formatting.

Claims inside them (test counts, "ready" verdicts, commit SHAs, file paths) describe that day only
and were not re-checked. The tests and scripts they mention were not copied, so their commands may
not run. For current work start at [`docs/README.md`](../../README.md).

| File                                                                                       | Original path on the PC                                | Why it is kept                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`TASK-HANDOVER-2026-10-17.md`](TASK-HANDOVER-2026-10-17.md)                               | `docs/ward-flow/handovers/TASK-HANDOVER-2026-10-17.md` | The 17 October five-task handover brief and its baseline.                          |
| [`audit-prompts-2026-11-02.md`](audit-prompts-2026-11-02.md)                               | `audit-prompts-2026-11-02.md`                          | The five self-contained audit prompts (A1 to A5) of 2 November.                    |
| [`audit-evidence-2026-11-02-A1-REPORT.md`](audit-evidence-2026-11-02-A1-REPORT.md)         | `audit-evidence/2026-11-02-A1/REPORT.md`               | A1 run-through and code-review findings, with questions for Josh.                  |
| [`audit-evidence-2026-11-02-stress-REPORT.md`](audit-evidence-2026-11-02-stress-REPORT.md) | `audit-evidence/2026-11-02-stress/REPORT.md`           | Reducer pressure-test findings (F1 to F4) and what was not tested.                 |
| [`TEST_INFRA.md`](TEST_INFRA.md)                                                           | `TEST_INFRA.md`                                        | Layout and design of the November `tests/e2e-swarm/` suite (never committed).      |
| [`TEST_READY.md`](TEST_READY.md)                                                           | `TEST_READY.md`                                        | That suite's self-reported results. Its "ready for release" verdict is unverified. |

Not copied: screenshots, raw sweep and auditor JSON, probe scripts and their raw output, run logs, a
`.tgz` archive and the uncommitted test files. They are raw tool output or code, not lasting notes.
