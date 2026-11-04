# Consolidated audit repairs — 4 November 2026

Repository: `BigSimmo/Ward-Flow`. Task branch: `codex/consolidated-audit-repairs`.
Implementation base: `559f22589` (fetched main), later than the audit's `2f71bc9b`.
The original checkout at `b6aa5cdef` is preserved. This is local repair evidence,
not a claim of hosted CI, merge, live release or physical-device acceptance.

## Repair scope

- **WF-CAP-001:** account for numbered reservations on movements and accepted
  referral arms before allocating pull/planned-admission capacity. Deduplicate
  linked owners and admissions, exclude one's own reservation, and respect bed kind.
  Ordinary acceptance without a numbered reservation remains waitlisting.
- **WF-CAP-002:** successful release clears both linked numbered owners;
  acceptance withdrawal clears the referral reservation even before first pull.
  Refused release remains atomic.
- **WF-OBS-001:** persist accepted observation operation order in history while
  retaining minute display times. Arrival compares that order. Unrecoverable legacy
  disagreements retain the ward record and show an explicit confirmation warning;
  confirming the current observation records a new ordered decision. Arrival remains
  possible and earlier history remains intact.
- **WF-TEST-02:** include `WARD_STORAGE_VERDICTS_FULL` in evidence identity, so
  sampled evidence cannot satisfy an explicitly exhaustive request. Compatible
  same-mode evidence remains reusable.
- **WF-TEST-01:** reuse the existing AST dependency parser for focused selection,
  including immutable variable imports. Unresolved dependencies mark selection
  incomplete rather than presenting exhaustive coverage.

## Bounded gaps

- **H-IMPORT-AWAY / H-IMPORT-DUPLICATE:** actual scenario export and Zod/parser
  round trips reproduced inconsistent away-state and duplicate active stays/beds.
  The repair rejects these conflicts, including independent reservation owners, while preserving all eight scenarios, actual reducer-generated transfers, linked claims and historical departed records.
- **WF-TRN-001:** new DOM tests use the real provider/reducer and real shared client
  with a mocked server for cancellation/rebooking on the same movement. Old CAD
  drafts and late old-job acknowledgements cannot overwrite replacement drafts;
  pending acknowledgement retains the interaction lock. This verifies the ancestor
  `inert` attribute and duplicate-command refusal, not browser-native inert behaviour.
- **CG-001:** new run evidence includes named-suite passed/failed/skipped/todo/unknown
  assertion counts and executed totals. Intentional skipped suites remain possible;
  this inventory is not a new blanket policy or retroactive hosted artifact proof.
- **WF-UNDO-001:** retain the existing downstream dependency guard.
- **WF-REL-01:** retain the audit's historical disposition; no current legacy-target
  trigger was demonstrated and no release workflow or deployment was changed.

## Local evidence

Pinned isolated toolchain: Node `24.22.1`, npm `11.17.0`. Locked install, with
lifecycle scripts disabled, verified 499 frontend package locations / 32,891 files
and 34 backend package locations / 1,134 files. Earlier exploratory runs using the
old dependency tree are not current acceptance evidence.

Initial focused checks:

- Tooling: 6 files / 89 tests passed.
- Observation: 8 files / 68 tests passed.
- CAD DOM/shared client: 2 files / 10 tests passed.
- Capacity: 8 files / 174 tests passed, including 11 new regressions and controls.
- Import: 19 actual export/parser tests passed. A five-file neighbouring run passed
  52 tests before two final reservation controls were added.
- Exhaustive actual Zod storage sweep: 1 file / 5 tests passed in 88.74 seconds
  with `WARD_STORAGE_VERDICTS_FULL=1`; existing verdict fixtures were unchanged.
- Integrated focused selection: 21 files / 214 tests passed. The selector explicitly
  reports unresolved module loads and fan-out limits; this is not exhaustive coverage.
- After extracting unchanged observation schemas to keep the validator within its
  1,500-line lint limit: 3 files / 30 import, sampled-storage and ordering tests passed.

Independent source and test-design review found no blocking findings, including
re-review of historical ED-away retention and equivalent schema extraction.
Runtime/toolchain parity, frontend/backend typechecks, formatting, lint, diff integrity
and maintained documentation gates are checked locally; final exit results are
recorded in the task checkpoint.

Initial integration checks caught a temporary Zod-mini API mistake, missing backend
dependencies, unused test variables and the validator line limit. These were repaired
without loosening gates. The exhaustive storage run predates the equivalent schema
extraction; the 30-test integration run follows it.

At the initial focused checkpoint, the full unit population, PostgreSQL integration,
production build, browser journeys, hosted CI/artifact retrieval and physical-device
checks had not run. The extended results below supersede that initial boundary. No publication, merge, database change or deployment was performed. Raw local output is retained outside Git in `/tmp/ward-flow-*` and
the ignored `.local/consolidated-audit-repairs/` checkpoint.

## Extended verification and privacy-boundary correction

On the owner's request to continue, the full offline gate ran on `eae1d2d97`:
2,028 files, 20,102 passed assertions, one failure and three explicit skips.
The failure was `ward-patient-link-default-deny.test.ts`: the new restore helper
read patient links outside the approved validator file. The guard was correct.

The correction keeps active-stay identity grouping inside the approved restore
validator and passes only stay ID, ward ID and state projections to the structural
helper. No privacy allowlist, clinical rule or test threshold was weakened. The
validator remains under its 1,500-line limit. Independent review found equivalent
acceptance conditions; the unchanged D-14 guard, all 19 actual import tests and
neighbouring storage/transfer controls passed (six files, 58 tests).

Offline backend verification: 360 passed, zero failed, 42 skipped without a local
PostgreSQL target. The three full-unit skips were a historical diff-integrity check
whose old commit is absent and two opt-in timing probes for inactive reporting.

At this intermediate checkpoint the production build and corrected-source full rerun were pending; their completed results follow below.
Pinned Chromium is absent. Approval was requested for its download and a disposable
PostgreSQL 16 image; it has not yet been received. No hosted runtime or database was contacted; the earlier authorised GitHub fetch and ownership reads remain separate.
Earlier queued backend/build attempts timed out on the shared heavyweight lock and
were not counted as execution evidence.

## Final extended result

The corrected product source is commit `d1cfd8f45`. The subsequent evidence update
changes this report only; it does not claim a fresh code run on that documentation commit.

- **Full offline gate:** 2,028 files; 20,106 collected assertions; **20,103 passed,
  zero failed, three skipped**. All expected-red and execution floors passed.
  Every one of the 21 batches executed afresh on the corrected source, including
  all eight legal-provenance sweeps. `VITEST_MAX_WORKERS=4` was included in its
  separate evidence identity. No failing checkpoint was reused as passing evidence.
- **Production build:** passed webpack compilation, TypeScript and route generation
  with the offline environment and telemetry disabled. A CSS optimiser warning about
  `optgroup::label` was non-blocking; no unrelated styling was changed.
- **Fresh exhaustive storage sweep:** `WARD_STORAGE_VERDICTS_FULL=1` on corrected
  source passed all five tests in 83.42 seconds, with zero skips and no verdict
  fixture changes.
- **Offline backend:** 360 passed, zero failed, 42 skipped without a local PostgreSQL
  target. These skips are not database integration evidence.
- **Boundary repair:** the unchanged privacy guard and actual import/transfer controls
  passed in both the focused 58-test run and the corrected full gate.
- **Review and admission:** independent source review found no blocking issue;
  formatting, owned lint, staged typechecks, safety and ownership admission passed.

Full-gate receipt (retained locally):
`.local/consolidated-audit-repairs/full-gate-corrected/receipt-1793818278379-33699.json`.
SHA-256: `c264729ad699c32579ec5886e92fde14f265fa63a6610760c3cbf33e61186c0c`.
The named-suite populations are retained in the adjacent batch JSON files.

The three unit skips are explicit: the historical diff-integrity regression requires
unavailable commit `d1485d6e8`; two inactive reporting timing probes are opt-in.
They are not passes, and no current critical-suite all-skipped result was found.

**Still unavailable:** native browser journeys, local PostgreSQL integration,
physical-phone/installed-PWA checks, and hosted CI artifact/deployment observation.
The pinned browser and a database image are absent; download approval remains
pending under the repository's verification guidance. No download, live database,
push, PR, merge or deployment was performed. No actionable source defect remains
open after the repairs and the corrected full gate.
