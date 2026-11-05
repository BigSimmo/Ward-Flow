# Copy-first document drafts

Maintained operational guide for coding agents; Documentation owns. Updated 2026-11-05.
The governing scope and exclusions are in [shared context](shared-context-and-memory.md#autonomous-document-coordination).

The portable helper in `scripts/document-drafts.py` keeps recoverable drafts outside the source checkout. It writes no originals, contacts no service, and needs Python 3 plus Git for three-way merges. Windows and Linux use the same code. Use the host's `python3` or `python` command; no package install is needed.

From the verified repository root, choose an existing task scratch path outside the checkout and an exact authorised text document:

```sh
python3 scripts/document-drafts.py prepare . ../task-scratch/document-draft --task current-task --file docs/example.md
python3 scripts/document-drafts.py status ../task-scratch/document-draft --source .
python3 scripts/document-drafts.py reconcile ../task-scratch/document-draft --source .
python3 scripts/document-drafts.py export ../task-scratch/document-draft --source .
```

Replace the synthetic document argument with the actual document. Edit only its copy under `draft/`. Resume the same scratch workspace; preparation preserves existing drafts. Reconciliation keeps the baseline, source/draft input snapshots and earlier candidates. It carries reviewed candidate edits forward when an input changes and merges compatible changes. Inspect and resolve reported conflicts, then acknowledge the candidate with `reconcile ... --resolved docs/example.md`. When both source and draft move, export requires review of the retained inputs and new candidate even if the text has no conflict markers. Editing an already clean candidate also requires explicit review; ordinarily edit the draft and reconcile again.

Older workspaces can gain input snapshots by reconciling once while their inputs still match the last reconciliation. If those inputs have already changed and snapshots are unavailable or altered, export is blocked: preserve the old workspace and reconcile its reviewed work in a fresh task-owned workspace against the current source. Never discard the earlier candidate or request another takeover permission merely to prepare that recovery.

Export emits absolute `path`, current `before_sha256` and `after_base64` fields for the existing integrator. It is a proposal. The integrator must check claims and required gates, establish a serial write, compare the current original hash immediately before applying, and re-reconcile changed inputs. The helper has no apply command and grants no release, takeover, publication or additional authority. Keep governing-rule and substantive conflicts for their authorised decision-maker.

Supported inputs: UTF-8 `.md`, `.txt`, `.rst`, `.adoc`; at most 100 exact paths and 10 MiB total. Traversal, hidden/sensitive/configuration names, links/reparse points, changed baselines, stale exports and busy locks fail closed. Filename screening does not certify contents safe. Never copy secrets, private sessions or data outside the task purpose/audience. Never reclaim an uncertain lock by age.

Run the synthetic safety/merge checks with `python3 scripts/test-document-drafts.py`. The dedicated Document drafts workflow runs the same checks on a hosted Linux runner after relevant PR changes. That proves helper behaviour on that runner; it does not prove any chat loaded or followed the rules.

This copy reuses the reviewed shared helper, SHA-256 `f9f919523098e8ac0a00d8082e593c0bfca969bb05163f5d1f957f31262c39fe`. Maintain helper and tests together; compare reviewed hashes before updating another copy. No private instruction source or Windows installation is required on cloud hosts. A checkout containing the helper can run it directly; a PR does not update existing checkouts. For an older checkout that must remain untouched, use the pinned public snapshot procedure below. Coordinate only task-safe metadata through supported native task tools with destination authority. If a host is offline, preserve the draft and continue independent authorised work; do not collect raw sessions or create a replacement chat service.

## Use a pinned public snapshot on an older checkout

When the current task requires preserving an older branch, first check whether the required files already exist in its local Git objects or task scratch. Reuse a verified snapshot instead of fetching it again. Otherwise, within existing provider-read authority, use a supported repository connector to read only `AGENTS.md`, `docs/agents/shared-context-and-memory.md`, this guide, the helper and its tests from the verified public repository at one immutable commit. Keep the files together under the existing task scratch area outside the source checkout. Do not switch branches, reset the checkout, replace governing files or copy private shared-rule sources to obtain the helper. If source access is unavailable, report that dependency and continue independent work.

Before executing the snapshot, compare the helper and test file hashes with the reviewed hashes supplied by the existing source owner. If a shared-context hash identifies its managed public prefix, hash the exact bytes before `<!-- BEGIN:project-context-and-memory -->`; the whole project file also contains its retained addendum. Stop on a missing boundary or mismatched expected hash. Open the pinned project `AGENTS.md`, the document coordination sections of shared context and this guide under the actual host's instruction hierarchy; a snapshot does not replace loaded host instructions or grant new authority.

Run the snapshot's `scripts/test-document-drafts.py` offline, then use that same snapshot's helper for the prepare, status, reconcile and export commands above. Pass the intended source root explicitly and keep the draft workspace outside both that root and the pinned snapshot. Check that decoded exports match the reviewed candidate and carry the current original hash. Test stale-input rejection with synthetic files in task scratch, keeping the actual source documents unchanged. Native-document writes still require their real supported revision or block guards; a file export does not provide those guards.

Record the repository, pinned commit, files opened, verified hashes and actual test results in the existing task checkpoint. Distinguish source delivered, guidance read, synthetic behaviour checked, changes integrated and instructions loaded. A successful scratch probe does not install global rules, update another checkout, hot-reload other chats or establish universal compliance. A coordinator can retrieve this receipt from the recipient's normal final response even when that recipient has no task-reply tool; no extra service or connector installation is required for that existing route.
