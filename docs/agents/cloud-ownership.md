# Ward Flow ownership on isolated Cloud hosts

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

Use `./LICENSE` or `./Dockerfile` for an extensionless root filename; the checker normalises the explicit `./` prefix. Separate repository metadata with `;`, rather than appending a sentence to an extensionless filename. The legacy log format cannot express whitespace or comma/semicolon characters in exact paths. Do not invent quoting for such a path; coordinate a supported parent-directory claim where that scope is authorised, or report the exact-path limitation. A directory claim is never an exact-file takeover approval.

Run `node scripts/ward-flow/sign-out-check.mjs <exact-files>` with that same `WARD_SIGNOUT_FILE` before claiming/editing files. It checks available local branch history and the supplied log; it cannot discover other hosts. An overlap requires the other owner's release or Josh's already-applicable exact-file takeover authority. Sign out new files as the task scope grows. Pass the same environment to formatting, admission and commit commands; a readable empty log does not supply your claims.

At handoff, preserve the checkpoint, log path and exact outstanding ownership. A plain `RELEASED` record clears **all earlier claims for every named branch in this repository scope**, regardless of the owner field or files mentioned in its reason. Use it only when every affected claim can be released; the receiving session then validates the current branch/files and appends the complete set of claims still needed by the coordinating group. Use this format for a complete branch handoff:

```text
RELEASED <date> | <owner> | <task-branch> | <handoff/integration reason>; repo=BigSimmo/Ward-Flow
```

To hand back only some files, add a `files=` field naming the exact paths. It closes those paths in the branch's earlier claims and keeps the rest active; files named only in the reason are not released. It matches claimed paths exactly, so a directory claim such as `docs/**` stays whole until a plain RELEASED line; an empty `files=` releases nothing. Obtain the existing exact-file takeover authority if ownership overlaps.

```text
RELEASED <date> | <owner> | <task-branch> | files=<path>, <path> | <reason>; repo=BigSimmo/Ward-Flow
```

An ordinary task-local commit or PR does not integrate another host's changes, prove deployment or authorise provider use. Recheck overlapping work at the authorised integration boundary. Never set `SKIP_SIGNOUT_GUARD=1` for concurrent Cloud work or bare-publication admission.
