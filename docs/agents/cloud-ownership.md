# Ward Flow ownership on isolated Cloud hosts

_Updated 2026-11-03 - autonomous exact-file document handoffs and isolated takeovers; Documentation owns._

[AGENTS.md](../../AGENTS.md) governs safety and ownership. The commit hook and owned-file formatter require a readable coordination log on every host; an unset variable or absent implicit Linux/macOS log never grants clearance.

## Establish the actual boundary before editing

Use the shared log for the people/agents that can edit or integrate this checkout. Set `WARD_SIGNOUT_FILE` to its existing path, or `WARD_FLOW_LOGS` to its directory. Defaults are `D:/Repos/ward-flow-logs/sign-out.md` on Windows and `~/ward-flow-logs/sign-out.md` elsewhere. An explicitly configured missing/unreadable log blocks; do not clear the variable to evade it.

An isolated Cloud clone cannot inspect an owner's desktop log. Continue with environment-local coordination only when the existing task authority establishes a separate checkout, a verified Ward Flow main base and exclusive or explicitly divided ownership among the active Cloud sessions. Use the task's existing private scratch/checkpoint area for the coordination file. This records actual task ownership, not the state of sessions on other hosts. An unknown owner of the current checkout, a known cross-host overlap or conflicting claims still needs coordination; creating an empty log resolves none of them.

Before the first edit, record the repository, checkout, branch/base, original task, coordinator/owner, exact owned files and how concurrent Cloud ownership was established in the existing checkpoint. Record that desktop/other-host ownership is unavailable. Keep one log for the actual coordinating group and give every writer its same explicit path. Do not create separate logs for agents sharing a checkout or overlapping work.

## Record and check claims

Use an append-only log outside Git. Its active section and exact claim format are:

```text
# Ward Flow Cloud task coordination
Boundary: <actual Cloud checkout/group>; <ownership source/checkpoint>.
Desktop/other-host sign-outs unavailable; no global clearance claimed.

## Active sign-outs
- <date> | <owner> | <task-branch> | <absolute-checkout> | path/to/file, ./LICENSE; repo=BigSimmo/Ward-Flow
```

On a shared sync folder, where near-simultaneous appends to one file can overwrite each other, write each claim or `RELEASED` line instead as a new file in the `claims/` folder beside the log (for example `claims/<UTC timestamp>-<branch>.md`). Never edit or delete such a file. The hook, `sign-out-check` and formatter read every `claims/*.md` claim and `RELEASED` line into the log's Active section in time order, and keep reading the log too. Start each file name with its UTC time (`20261025T1015Z-…`) so it sorts against the log's dated lines; a release then clears only claims made before it. Once you switch to claim files, stop appending to the log. An unreadable `claims/` folder or file blocks the check rather than being skipped.

Use `./LICENSE` or `./Dockerfile` for an extensionless root filename; the checker normalises the explicit `./` prefix. Separate repository metadata with `;`, rather than appending a sentence to an extensionless filename. The legacy log format cannot express whitespace or comma/semicolon characters in exact paths. Do not invent quoting for such a path; coordinate a supported parent-directory claim where that scope is authorised, or report the exact-path limitation. A directory claim is never an exact-file takeover approval.

Run `node scripts/ward-flow/sign-out-check.mjs <exact-files>` with that same `WARD_SIGNOUT_FILE` before claiming/editing files. It checks available local branch history and the supplied log; it cannot discover other hosts. An overlap requires the other owner's genuine exact-file release or applicable exact-file takeover authority, including the routine document standing permission below; a claimed document alone needs no renewed permission. Sign out new files as the task scope grows. Pass the same environment to formatting, admission and commit commands; a readable empty log does not supply your claims.

At handoff, preserve the checkpoint, log path and exact outstanding ownership. A plain `RELEASED` record clears **all earlier claims for every named branch in this repository scope**, regardless of the owner field or files mentioned in its reason. Use it only when every affected claim can be released; the receiving session then validates the current branch/files and appends the complete set of claims still needed by the coordinating group. Use this format for a complete branch handoff:

```text
RELEASED <date> | <owner> | <task-branch> | <handoff/integration reason>; repo=BigSimmo/Ward-Flow
```

To hand back only some files, add a `files=` field naming the exact paths. It closes those paths in the branch's earlier claims and keeps the rest active; files named only in the reason are not released. It matches claimed paths exactly, so a directory claim such as `docs/**` stays whole until a plain RELEASED line; an empty `files=` releases nothing. A partial release still clears those exact paths across every earlier claim on the named branch, regardless of the owner field. Verify every affected claim is owned by or explicitly cleared with the releasing coordinator; never manufacture another owner's release. Use applicable exact-file takeover authority for remaining overlaps.

```text
RELEASED <date> | <owner> | <task-branch> | files=<path>, <path> | <reason>; repo=BigSimmo/Ward-Flow
```

An ordinary task-local commit or PR does not integrate another host's changes, prove deployment or authorise provider use. Recheck overlapping work at the authorised integration boundary. Never set `SKIP_SIGNOUT_GUARD=1` for concurrent Cloud work or bare-publication admission.

## Routine document handoffs

Updated 3 November 2026 under Josh's standing document permission. An authorised task includes routine exact-file document handoffs and isolated takeovers within its existing project, purpose and audience: editorial corrections, task receipts, status updates and documentation of already-authorised work. Prefer a genuine owner-agreed exact-file release through an available supported task channel. If the owner cannot be reached, preserve a recoverable current version and prepare in an isolated branch/worktree. Use the existing exact-file `(approved takeover by Josh: <scope>)` record, truthfully citing the standing permission dated 3 November 2026 and original task; do not claim case-specific owner consent. Record source version and one integration owner in the existing checkpoint, retaining all unreleased claims. Missing or unreadable required logs still block admission; never create an empty replacement to evade them.

Exchange only necessary task/owner IDs, safe exact paths, revision/content hashes, intended scope, status and safe evidence links. Use this metadata solely for the authorised task in its existing appropriately access-controlled checkpoint and claim store, under that store's existing retention policy; create no collector or extra copies. Paths and links can reveal sensitive information: use safe identifiers or redacted labels where needed. Public claim-board entries must remain safe public task/file metadata. This permits relevant task coordination, not unrelated messaging, new access grants, raw chat collection or forwarding private document contents.

One integrator compares original, latest and proposed versions, reconciles compatible edits and runs required checks. Re-read current content and claims immediately before applying; if either changed, reconcile again. Keep shared-file writes serial using a supported lock/version precondition where available. A claim log is coordination metadata, not an atomic lock. If serial integration cannot be established, retain the reviewable patch, report that technical dependency and continue independent work; repeated takeover approval is not the remedy. Silence, age and apparent inactivity never release work or permit discarding edits.

The standing permission excludes governing instructions and policy, new clinical/product/legal/security decisions, non-document claims, protected or append-only history, deletion/moving of others' work, sensitive data/access, publication, merge/deployment, provider use, credentials, permissions, billing and spending. These keep their own authority and project gates, which the current request may separately supply. Ask only when a substantive conflict or materially missing decision about scope, authority, safety, exposure or cost remains. Ward Flow's synthetic-only boundary remains binding.
