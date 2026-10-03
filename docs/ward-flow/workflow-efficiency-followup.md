# Workflow efficiency follow-up

Original objective: `ward-policy-audit-20261003-9034`. Continuation of the policy audit and the merged workflow remediation, not a new competing task ledger.

## Merged baseline

PR #23 merged on 3 October 2026 at 13:31:54 UTC as `67ce382f`. Its reported head checks passed. This task uses verified dedicated Ward Flow main `3051498` on `codex/workflow-efficiency-current-9034`; the previous detached snapshot and its task branch are preserved.

## Exact-file claims

Use `node scripts/ward-flow/claim-files.mjs <exact-file> [<exact-file> ...]` before edits. This explicit helper uses the existing ownership parser and branch checker, serializes cooperating claim writers, appends only missing claims, and reuses current owned claims. It refuses active peer conflicts, wildcard/directory/escaping paths, unknown log formats and busy locks. It grants no takeover, never releases peers and never commits shared notes. Manual writers must still coordinate: they do not participate in its lock, and the final content comparison cannot prevent a manual write occurring after the comparison. Existing per-edit inspection remains necessary when ownership changes.

## Resolved recheck dependencies

`test-module-dependencies.mjs` resolves actual TypeScript module paths, aliases, re-exports and transitive helper imports. A same-named production helper or prose is not a test dependency. Unknown local imports, computed imports, parse/config failures and exported test helpers keep the conservative full gate. Dependency/environment/population completeness checks remain required; this helper never manufactures passing evidence.

Josh approved the exact-file takeover on 3 October 2026. The existing recheck runner now uses this resolver. Focused fixtures exercise same-name separation, transitive imports, extension substitution, aliases and uncertainty refusal. Existing receipt completeness and environment gates remain intact.

## CI scope decision

Policy-only changes already run meaningful policy contracts without application/browser jobs after PR #23. Broader application leaf narrowing remains unproved: runtime imports are not the only consumers. Tests also read source/CSS, generated contracts and shared fixtures. Existing related-test fan-out caps explicitly delegate omitted coverage to the batch gate. That focused selector therefore cannot replace the full CI gate. Preserve current application gates until equivalence evidence covers those consumers; no performance saving is claimed.

## Activation and external delivery

The installed Codex app-server `hooks/list` reports all five user hooks enabled/trusted with no loader warnings/errors. Eight offline contract groups passed. An exact Windows shell-launch replay found WSL `bash` could not open the Windows adapter path (exit 127). With Josh's explicit approval, the four shell registrations now use `C:/Users/joshs/ai-rules/run-ward-shell-hook.mjs`, which passes the payload as data to the same four existing scripts through the absolute Git Bash executable. Only those four trust records changed; original bytes are backed up privately. Four exact registered command replays pass denial/context contracts, and unknown bridge targets are refused. This proves launcher execution and native registry loading; it does not prove every event matcher firing in an existing GUI conversation. Existing chats do not hot-reload instruction edits.

All locally checked shared-rule sources/copies match. The same-identity Library mirror is stale; this client exposes no supported replacement capability. A new upload would not replace it. Cursor GUI rules and cloud/phone context activation need their supported client interfaces; native apps are unavailable to this task. No private application databases, credentials or protection settings were altered to work around this limit.

Canonical ledger reconciliation is available through the configured Notion connection. The original objective is recorded under Ward Flow with current evidence; implementation completion remains distinct from publication, merge and deployment.

## Local completion evidence

The focused claim, dependency and FULL-recheck contract tests pass. Normal commit hooks check the staged source with lint/typechecking and generated-document checks. Installed dependency parity covers 526 package locations and 32,146 files. Private launcher backups, native loader results and exact command replays are under `C:/Users/joshs/Documents/Codex/audits/2026-10-03-ward-flow-policy/`. No broad-suite performance claim, hosted follow-up CI verdict, publication, merge or deployment is inferred from these local checks.
