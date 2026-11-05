# Ward Flow ownership on isolated Cloud hosts

[AGENTS.md](../../AGENTS.md) governs safety and ownership.

**Since 3 Nov 2026 (Q374) the branch and its open PR are the claim.** A Cloud thread checks open PRs and branches for overlapping files before editing, then works on its own branch. It writes no claim lines, claim files or issue comments. The old cloud claims folders are archived under `/mnt/project-files/ward-flow/signout/archive/`. The rest of this page describes the optional shared log, which still blocks a file another branch holds in it; a missing log no longer blocks.

## Establish the actual boundary before editing

Use the shared log for the people/agents that can edit or integrate this checkout. Set `WARD_SIGNOUT_FILE` to its existing path, or `WARD_FLOW_LOGS` to its directory. Defaults are `D:/Repos/ward-flow-logs/sign-out.md` on Windows and `~/ward-flow-logs/sign-out.md` elsewhere. An absent optional log does not block, including when its path is explicitly configured. An unreadable existing log or claim store blocks. Do not clear configuration to conceal known peer holds.

An isolated Cloud clone cannot inspect an owner's desktop log. Continue with environment-local coordination only when the existing task authority establishes a separate checkout, a verified Ward Flow main base and exclusive or explicitly divided ownership among the active Cloud sessions. Use the task's existing private scratch/checkpoint area to record actual task ownership, not the state of sessions on other hosts; do not create a new log or claim-file system. An unknown owner of the current checkout, a known cross-host overlap or conflicting claims still needs coordination; creating an empty log resolves none of them.

Before the first edit, record the repository, checkout, branch/base, original task, coordinator/owner, exact owned files and how concurrent Cloud ownership was established in the existing checkpoint. Record that desktop/other-host ownership is unavailable. If the group already uses an optional log, retain its boundary and give every writer the same explicit path. Do not establish a new log or claim store merely to edit or hand off documents.

## Check existing optional claims

The following legacy formats apply only to an existing optional log or claim store holding relevant files. The branch and open PR supply the task claim; no new own-claim records are required. Preserve existing records outside Git. Their active section and exact format are:

```text
# Ward Flow Cloud task coordination
Boundary: <actual Cloud checkout/group>; <ownership source/checkpoint>.
Desktop/other-host sign-outs unavailable; no global clearance claimed.

## Active sign-outs
- <date> | <owner> | <task-branch> | <absolute-checkout> | path/to/file, ./LICENSE; repo=BigSimmo/Ward-Flow
```

When an existing coordinating group already uses a shared `claims/` folder beside its optional log, preserve that append-only mechanism for applicable release or takeover metadata (for example `claims/<UTC timestamp>-<branch>.md`). Do not create a new store or edit/delete existing records. The hook, `sign-out-check` and formatter read every `claims/*.md` claim and `RELEASED` line into the log's Active section in time order, and keep reading the log too. Start each file name with its UTC time (`20261025T1015Z-…`) so it sorts against the log's dated lines; a release then clears only claims made before it. If the existing group uses claim files, keep its established single recording route. An unreadable `claims/` folder or file blocks the check rather than being skipped.

Use `./LICENSE` or `./Dockerfile` for an extensionless root filename; the checker normalises the explicit `./` prefix. Separate repository metadata with `;`, rather than appending a sentence to an extensionless filename. The legacy log format cannot express whitespace or comma/semicolon characters in exact paths. Do not invent quoting for such a path; coordinate a supported parent-directory claim where that scope is authorised, or report the exact-path limitation. A directory claim is never an exact-file takeover approval.

Run `node scripts/ward-flow/sign-out-check.mjs <exact-files>` with that same `WARD_SIGNOUT_FILE` before editing files when checking existing optional holds. It checks available local branch history and the supplied log; it cannot discover other hosts. An overlap requires the other owner's release or Josh's already-applicable exact-file takeover authority. Recheck overlap as task scope grows. Pass the same environment to formatting, admission and commit commands; an empty log neither releases peer work nor proves cross-host clearance.

At handoff, preserve the checkpoint, log path and exact outstanding ownership. A plain `RELEASED` record clears **all earlier claims for every named branch in this repository scope**, regardless of the owner field or files mentioned in its reason. Use it only when every affected claim can be released; the receiving session then validates the current branch/files and any remaining peer holds. Do not append replacement own-claims merely to hand off the task. Use this format for a complete branch handoff:

```text
RELEASED <date> | <owner> | <task-branch> | <handoff/integration reason>; repo=BigSimmo/Ward-Flow
```

To hand back only some files, add a `files=` field naming the exact paths. It closes those paths in the branch's earlier claims and keeps the rest active; files named only in the reason are not released. It matches claimed paths exactly, so a directory claim such as `docs/**` stays whole until a plain RELEASED line; an empty `files=` releases nothing. Use applicable exact-file takeover authority if ownership overlaps, including the standing routine document permission below.

```text
RELEASED <date> | <owner> | <task-branch> | files=<path>, <path> | <reason>; repo=BigSimmo/Ward-Flow
```

An ordinary task-local commit or PR does not integrate another host's changes, prove deployment or authorise provider use. Recheck overlapping work at the authorised integration boundary. Never set `SKIP_SIGNOUT_GUARD=1` for concurrent Cloud work or bare-publication admission.

## Routine document handoffs

Josh's standing document permission covers routine exact-file handoffs and isolated takeovers within an authorised task's project, purpose and audience. A claimed document alone needs no renewed approval. Prefer an owner-agreed release; otherwise preserve the current version and prepare a task-owned draft. Q374's branch/PR claim remains in force: do not create a new log or claim-file system for a handoff. Use any existing optional log according to its actual boundary and guards, and never manufacture another owner's release.

Follow [Autonomous document coordination](shared-context-and-memory.md#autonomous-document-coordination) for authority, preservation and serial integration, and [the portable draft workflow](document-drafts.md) for copies, reconciliation and export. One integrator checks original/latest/proposed versions, exact claims and the latest source hash before applying. A log or PR is coordination metadata, not an atomic file lock. Governing rules, substantive decisions, protected history, sensitive access, deletion, publication, deployment and spending retain their own authority; the current request may separately supply it. Silence never releases work.
