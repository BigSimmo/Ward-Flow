# Interrupted heavyweight-run recovery candidate

Repository: `BigSimmo/Ward-Flow`. This is a maintenance candidate pending
complete publication gates. It changes no admission limit,
test gate, passing receipt, or product behaviour. No process is killed.

## Evidence and authority

Use this only for the exact interrupted run authorised by the task owner. Obtain
a fresh dry-run after review, then explicitly apply its exact plan hash. Current
repository maintenance rules and exact file ownership still apply. A dry-run is
read-only; an eligible report is not permission to recover unrelated work.

The supported proof is a Windows native job with KILL_ON_JOB_CLOSE and no
breakaway permission, plus launch-time guardian/adapter PID and creation-time
identities. The adapter creates the root suspended, assigns the job before
resuming, and keeps its non-inherited job handle until termination. Absence or
proved reuse of that exact adapter then establishes closure of the contained
job. The owner and guardian must also be dead. A live identity, unavailable CIM
query, malformed record, unknown contract, unknown directory, or changed bytes
blocks application. POSIX descendant recovery needs a different proof and is
not implemented here.

`windowsJobAttestation` is recorded by `scripts/owned-child.mjs` before native
root resume. Original owner task
`01a0fefc-3402-7e71-bbaa-f074dce91a72` confirmed release, no active writer and
normal parser `[]`; the retained `codex/workflow-remediation-main-6181` diff is
historical. That confirmation is recorded in the normal append-only handoff log.
Josh approved takeover of only the guardian and native adapter; the unchanged
normal ownership checker accepts both exact files. The earlier malformed
annotation and premature partial edits are acknowledged in an approved append-only
audit correction. The previous owner's historical branch remains untouched.
The native adapter creates and assigns the root suspended, then atomically
publishes a flushed launch receipt containing actual guardian and adapter
creation identities. The guardian flushes and rereads the bound child record,
then atomically publishes its acknowledgement. Only then may the adapter resume
the root, after checking cancellation again. A failed or missing handshake
retains unknown admission; it never invents a passing test result.
The native acknowledgement read retries only Windows sharing/lock violations
within the existing15-second deadline. The root stays suspended, cancellation
is checked on each attempt, and mismatch, other I/O errors or an expired deadline
retain unknown completion. Real synthetic exclusive-file-lock tests cover release,
cancellation while locked and deadline expiry. This repairs the recorded sharing
failure class; the original interfering process remains unattributed.
The adapter may be born after the
child record's timestamp; that timestamp must never be used to infer adapter PID
reuse. Adapter bytes must remain bound to the launched code, including protection
against replacement between hashing and launch: the guardian executes the exact
hashed bytes through EncodedCommand rather than reopening their pathname.
Native launch/terminal scratch receipts live outside coordinator evidence; the
child record retains the attestation and terminal status. Adapter replacement
after launch makes recovery refuse a different current hash, rather than assume
that the new source ran historically. Full runner compatibility and required
publication gates remain prerequisites; focused evidence is separate below.

Do not add retrospective `recoveryIdentity` fields to legacy shared records. A
freshly inspected source file is not launch-time proof. Original native terminal
proof or verified historical launch/containment evidence must be reviewed by the
original owner before any supported legacy recovery extension is considered.
Approval alone cannot turn unknown descendants into proved-dead work.

## Commands

Run from the verified Ward task worktree using its normal Node environment.
The CLI verifies both remote destinations and derives the coordinator from the
actual Git common directory and the normal Windows temporary directory.

```powershell
node scripts/recover-heavy-run.mjs --repository <worktree> --run <exact-run-UUID> --ticket <exact-ticket-UUID> --output <new-report.json>
```

`--ticket` is optional. When supplied, the ticket must belong to the same repository,
worktree and command, and its waiter must be dead. All other tickets remain in
their exact original order and bytes. Inspection does not reclaim even an old gate.

After independent review, a fresh eligible report and the owner's maintenance
authority, apply explicitly:

```powershell
node scripts/recover-heavy-run.mjs --repository <worktree> --apply <report.json> --expect <planHash> --backup <new-sibling-audit-directory>
```

The audit directory must be a new sibling of the coordinator on the same
filesystem. Application exclusively creates the existing `gate.lock`; a busy,
partial or stale gate is refused. It rechecks the complete directory topology,
exact record hashes and fresh process evidence under exclusion, saves all exact
original bytes as base64 in a flushed, write-once `original-manifest.json`,
checks again, and renames only the target lease and optional target ticket into
that archive. Original archived child bytes are never rewritten. Derived
`terminal/` records reconcile unfinished children to terminal `complete` with
outcome `interrupted` and null status. Unique flushed progress receipts are
atomically published under `progress/`; final `journal.json` is published once.
An interrupted progress write cannot truncate the original-byte manifest.
It creates no passing test evidence. The sentinel and coordinator remain
for the normal admission path to maintain. The external audit survives normal
coordinator cleanup.

Before any shared mutation, recovery installs a gate owner with the existing
OS-lifetime compatibility PID (Windows4) plus a flushed unfinished child marker.
The current normal coordinator's `registeredWorkIsActive` protects that marker
even if the recovery PID exits; older PID-based gate readers also preserve the
OS-lifetime owner. No coordinator admission logic is changed. Every success
verifies its own exact gate bytes before release. Any exception after gate
creation intentionally retains exclusion, including backup/preflight failures.

If interrupted during application, retain the gate and all evidence. Normal
stale-gate cleanup cannot reclaim the durable recovery gate. The immutable
manifest, published progress receipts and archive identify what happened;
partial operations require a separate reviewed owner reconciliation procedure.
This command deliberately provides no force-release, automatic resume or partial
rollback option. Never remove a gate or replay a move based on age. A move can
have completed just before its progress receipt, so inspect both exact paths and
original hashes. Unpublished `.tmp` receipts are diagnostic, never authority.
Do not apply with participating legacy runners that do not honour the existing
OS-lifetime sentinel or unfinished-child contract; establish compatibility first.

Rollback of a completed transaction is deliberately restrictive:

```powershell
node scripts/recover-heavy-run.mjs --repository <worktree> --rollback <audit-directory/journal.json>
```

Rollback reacquires exclusion, refuses any later coordinator change, refuses any
existing target, validates original hashes/paths, and restores only this run's
exact original bytes. It never overwrites a later lease/ticket. Unknown partial
transactions, removed coordinators, altered manifests, and concurrent work
require owner review. The original archive and journal remain recoverable.
Rollback validates the original manifest hash and coordinator identity, publishes
its own immutable receipt, and also retains the durable gate on partial failure.
No successful rollback truncates or replaces an earlier audit receipt.

## Verification

The synthetic suite uses Node's built-in test runner, no dependencies, provider,
shared test controller or live coordinator mutations:

```powershell
node --test tests/heavy-run-recovery.test.mjs
```

It covers active owner/guardian/adapter/waiter, PID reuse, adapter creation after
record start, multiple repository identities, malformed records, unknown evidence,
stale-ticket attribution, live peer jobs and queue order, gate exclusion, byte
and process races, exact original-byte backups, interrupted terminal outcomes,
rollback and refusal to overwrite later legitimate work. This focused evidence
does not replace mandatory publication gates or prove any browser journey passed.
Fault injection covers failures before/after lease and ticket moves, each progress
publication stage, terminal reconciliation, final publication, gate release and
partial rollback. It checks the unchanged real coordinator's stale predicate
against each synthetic retained gate (even with a probe returning all PIDs dead),
and checks torn progress writes cannot damage the immutable original-byte backup.

## Exact Settings reservation

The interrupted Settings run is
`25756bb1-d14d-4c8b-a43b-4a3ba08ba455`, child
`c891104f-6581-460e-b537-4ab747972cd8`, queued waiter
`8fc16566-4554-45ce-bbcd-20b0c483e3a0`, under coordinator
`D:/Temp/clinical-kb-heavy-locks/f208004b9cb8d686acf1.lock`.
Its original owner is task `01a0fd62-8d8e-71fa-b982-b0f71175f0e5` on
`codex/settings-truthful-controls-20261005` in
`D:/Temp/ward-pr15-review-repair-20261002`.

The legacy child lacks the required launch-time job and creation identities.
The candidate therefore refuses this reservation. Keep the browser reruns with
their existing owners; admission remains blocked and no browser pass is implied.

The original Settings owner confirmed no retained launch-time creation identities,
native assignment receipt or terminal descendant/job-closure proof. No native
receipt survived in the lease tree or immediate temporary receipt location.
The readiness log ends31/118, SHA256
`B1CAFECBDA52AB8A3D48C0B6B5443A6535358B2A99C368C9990BF2777E4E16AC`.
Source describing containment is not run-specific proof. Do not repeat that
evidence hunt or add retrospective attestation fields.

## Exact-run full-kernel-boot extension

A trustworthy later full kernel boot can establish a distinct local process
termination boundary without fabricating historical launch attestation. Josh
approved implementing this exact-run extension. No PC restart or application to
the real legacy reservation is authorised by that implementation approval.

`ward-reviewed-local-full-boot-v1` requires a prospective baseline before the
separately authorised restart. The read-only collector uses supported CIM and
Get-WinEvent APIs: host hardware UUID/name, UTC observation and boot timestamps,
Kernel-Boot counter, and the raw-byte hash/record identity of the System log
head. Baseline preparation preserves all coordinator bytes and target launch
timestamps, checks the snapshot again, and creates a new flushed external file.
It acquires no gate and grants no restart or recovery permission.

```powershell
node scripts/recover-heavy-run.mjs --repository <worktree> --run <exact-run-UUID> --prepare-boot <original-owner-task-UUID> --output <new-external-baseline.json>
```

Name an existing exact ticket only if attributable and still present. Do not
restore an absent ticket. Preserve the returned baseline hash independently.
After a separately authorised restart, a fresh collector must retain that exact
anchor and a complete contiguous System record sequence through its collected
head. More than8192 records, retention loss, duplicate/gapped IDs, failed queries
or unknown schemas refuse recovery. A larger/unavailable history is not silently
sampled. The host must match, boot UTC must be later than the baseline and all
target launch timestamps, and the boot counter must increase. Target PID
identities predating the new kernel start contradict the proof and are refused.

Require exactly one structured User32/1074 version0 restart request, one
Kernel-General/12 version0 start agreeing with CIM boot time, Kernel-Boot/27
version1 cold BootType0, and Kernel-Boot/20 version1 successful shutdown/boot with
the same new counter. Provider GUIDs, System channel, event versions, UTC times
and relevant XML fields are checked, not localised display messages. Sleep,
resume, cleared-log and clock-change events block. Unknown/localised restart
values, multiple starts or ambiguous chronology also block. A changed
LastBootUpTime or absent PID alone is insufficient. The supported restart/full
shutdown distinction is documented by [Microsoft system power states](https://learn.microsoft.com/en-us/windows/win32/power/system-power-states);
the System event schemas are pinned to the inspected installed Windows provider
metadata. Other schema versions are deliberately unsupported.

**Boot evidence cannot prove historical scope.** Eligibility additionally needs
an independently reviewed, exact-hash-pinned postboot receipt and companion
artifacts. It must bind this baseline, repository/run/ticket, actual kernel-start
event and a preserved postboot event head, name the original owner and a distinct
reviewer, and support four verified assessments: historical local work only, no
persistent/automatic continuation, no restore/reactivation, and compatible
participating runners. Historical locality requires original launch evidence
plus an original source snapshot with its historical Git commit. Current source
or permission alone cannot supply that missing provenance. Each assessment
requires nonempty, preserved evidence artifacts; unknown conclusions refuse.

This receipt is a trusted human review boundary, not an automatically generated
claim: the validator checks its bindings and exact evidence bytes, but cannot
establish that a named reviewer actually reviewed them or that their factual
conclusions are true. Only pin a hash after the actual owner and independent
reviewer have verified the original run's provenance and these scope facts.
Do not self-author a passing receipt to substitute for missing history. External
work or unverifiable checkpoint/continuation control leaves the run blocked.

Receipt schema: version1, contract `ward-reviewed-local-full-boot-v1`,
`baselineSha256`, `repositoryIdentity`, `run`, `ticket` (null when absent),
`kernelBootEventSha256`, `ownerTask`, distinct `reviewerTask`, UTC `reviewedAt`,
`reviewedHeadRecordId`/`reviewedHeadSha256`, and four `assessments`. Each assessment
has `subject`, `conclusion: verified`, and `artifacts` naming regular sibling
files, exact SHA256 and evidence kind. Supported artifact filenames contain
letters/digits/underscores/hyphens and end in json/log/txt/patch. The historical
assessment requires kinds `original-launch-log` and `original-source-snapshot`;
the latter also supplies its40-character `sourceCommit`. Missing evidence or
changed receipt/companion bytes refuses. No template filled with assertions is
proof. Preserve the reviewed receipt hash independently.

```powershell
node scripts/recover-heavy-run.mjs --repository <worktree> --run <exact-run-UUID> --boot-baseline <baseline.json> --expect-baseline <baseline-hash> --scope-review <reviewed-receipt.json> --expect-scope <reviewed-receipt-hash> --output <new-dry-run.json>
```

Application needs the same four boot/scope options in addition to the existing
`--apply`, exact `--expect`, and new sibling `--backup` arguments, plus separately
established exact-run maintenance authority. Current boot evidence is always
collected directly; no CLI accepts an asserted postboot observation. Application
rereads the baseline, receipt and every companion artifact and recollects boot
evidence twice under exclusion. Any change/ambiguity retains the durable barrier.
The immutable manifest preserves baseline, review bytes and artifacts together
with the exact original coordinator evidence. Both fresh application observations,
including raw event XML and CIM values, are flushed to write-once
`boot-observation-1.json` and `boot-observation-2.json` before the first target move.
The manifest binds the first observation hash; write-once `boot-evidence.json`
binds both observation hashes, the manifest hash and stable plan hash. Published
progress and the final journal bind its hash. These volatile observations stay
outside the stable dry-run hash so harmless new events need no new scope review.
Every move and rollback verifies this audit chain. Failed evidence publication
retains exclusion with target records untouched. Preboot binding covers only this
target; application CAS uses the fresh postboot snapshot so legitimate unrelated
jobs and tickets are preserved. Queue order/admission limits stay unchanged.
No gate, check or passing receipt is weakened. Full boot proves termination,
not success: reconciliation still produces only terminal `interrupted`, and
rollback still refuses later legitimate state. Partial failures require separate
reviewed reconciliation; no force-release, boot-triggered auto-run or partial
rollback is added.

Focused synthetic verification includes negative boot/scope evidence, cold versus
Fast Startup/hibernation, log gaps/caps/schema ambiguity, PID reuse, scope-byte
races under exclusion, immutable backups, interruption and unrelated postboot
leases/tickets. These tests do not establish a real boot or a real scope receipt.

The previously recorded boot observation was2026-10-04T11:44:11.5000000Z, before
the Settings run. No qualifying later full boot or independently verified
historical scope receipt has been established for it. No new evidence hunt,
restart, real baseline/application or reservation mutation was performed to
implement this extension. It does not promise that a restart will clear the run.

At11:01:55UTC on5October2026 the entire original coordinator directory was
observed absent, including this lease. It remained absent at the6October
publication-preparation check. This recovery task did not remove it. Actor,
preservation location and descendant closure remain unknown; absence is not a
recovery receipt or permission to recreate the coordinator or resume tests.
The parent must reconcile its owner's audit before any admission-dependent
publication checks or original browser jobs resume. Separate draft-PR authority
does not authorise real recovery, restart or coordinator recreation.
