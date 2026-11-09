# Ward Flow ownership on Cloud hosts

_Updated 2026-11-09 - cut to what still applies since Q374; claims live in AGENTS.md hard rule 7 and HOW-WE-WORK §2 (D-107); Documentation owns._

The claim rule has one home: [AGENTS.md hard rule 7](../../AGENTS.md#hard-rules), with detail in [HOW-WE-WORK §2](../ward-flow/HOW-WE-WORK.md#2-branches-and-worktrees). This page adds only what is specific to a Cloud thread.

- **Your branch and its open PR are the claim** (Q374, 3 Nov 2026). Write no claim lines, claim files or issue comments. The old cloud claims folders are archived under `/mnt/project-files/ward-flow/signout/archive/`.
- **Check overlap first.** Before editing, check open PRs and branches for one already changing the same files. An overlap needs that owner's release or Josh's scoped takeover.
- **A Cloud clone cannot see another host's desktop log.** Do not create a new log or claim store to make up for it. Say in your report that other-host ownership was not visible.
- **An existing optional log still blocks.** If `WARD_SIGNOUT_FILE` or `WARD_FLOW_LOGS` points at an existing log, the commit hook blocks a file another branch holds there; run `node scripts/ward-flow/sign-out-check.mjs <files>` before editing, with the same `WARD_SIGNOUT_FILE` on every commit-time command. Never clear or change that setting to hide a known peer hold. A missing log does not block; an unreadable one does. An unknown checkout owner or an overlap across hosts needs coordination before editing.
- **Document handoffs** follow [document coordination](shared-context-and-memory.md#autonomous-document-coordination) and [drafts](document-drafts.md). Silence never releases work.
- Never set `SKIP_SIGNOUT_GUARD=1` for concurrent Cloud work or bare publication.
