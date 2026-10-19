# Ward Flow whole-message shortcuts

[AGENTS.md](../../AGENTS.md) governs safeguards. A shortcut applies only when the whole message is exactly one of these words.

- `run`: follow [Local server safety](building-ui.md#local-server-safety), execute `npm run ensure` and return its verified URL.
- `upload`: safe Git handoff. Inspect branch, status, remotes and worktrees first. Commit coherent, completed, owned changes with clear messages. Push only with separate authority naming the Ward target. Skip anything on the ask-first list and report the confirmation needed. Never commit secrets, logs, caches or build output.
- `dependency`: safe dependency maintenance, as set out in [codex-dependency-shortcut.md](codex-dependency-shortcut.md). No commit, push or deploy without confirmation.
- `bug-hunter`: targeted defect hunt on the touched code. Reproducible defects first. For each, give the trigger, expected behaviour, risk and smallest proof. No broad refactors. Say so if nothing high-confidence turns up.
- `Run PR`: disabled here. It targeted PsychSift's PR queue.

When the user says `safely`, preserve unrelated staged, unstaged and untracked work, stop only processes you clearly own, and verify the result instead of cleaning up broadly.
