# Workflow efficiency follow-up

Original objective: `ward-policy-audit-20261003-9034`. Continuation of the policy audit and the merged workflow remediation, not a new competing task ledger.

## Merged baseline

PR #23 merged on 3 October 2026 at 13:31:54 UTC as `67ce382f`. Its reported head checks passed. This task uses verified dedicated Ward Flow main `3051498` on `codex/workflow-efficiency-current-9034`; the previous detached snapshot and its task branch are preserved.

## Exact-file claims

Use `node scripts/ward-flow/claim-files.mjs <exact-file> [<exact-file> ...]` before edits. This explicit helper uses the existing ownership parser and branch checker, serializes cooperating claim writers, appends only missing claims, and reuses current owned claims. It refuses active peer conflicts, wildcard/directory/escaping paths, unknown log formats and busy locks. It grants no takeover, never releases peers and never commits shared notes. Manual writers must still coordinate: they do not participate in its lock, and the final content comparison cannot prevent a manual write occurring after the comparison. Existing per-edit inspection remains necessary when ownership changes.

## Resolved recheck dependencies

`test-module-dependencies.mjs` resolves actual TypeScript module paths, aliases, re-exports and transitive helper imports. A same-named production helper or prose is not a test dependency. Unknown local imports, computed imports, parse/config failures and exported test helpers keep the conservative full gate. Dependency/environment/population completeness checks remain required; this helper never manufactures passing evidence.

Integration into the existing recheck runner requires exact-file ownership clearance. Focused fixtures exercise same-name separation, transitive imports, extension substitution, aliases and uncertainty refusal.

## CI scope decision

Policy-only changes already run meaningful policy contracts without application/browser jobs after PR #23. Broader application leaf narrowing remains unproved: runtime imports are not the only consumers. Tests also read source/CSS, generated contracts and shared fixtures. Existing related-test fan-out caps explicitly delegate omitted coverage to the batch gate. That focused selector therefore cannot replace the full CI gate. Preserve current application gates until equivalence evidence covers those consumers; no performance saving is claimed.

## Activation and external delivery

The installed Codex app-server `hooks/list` reports all five user hooks enabled/trusted with no loader warnings/errors. Eight offline contract groups passed. Registration discovery does not prove event execution: an exact shell-launch replay found WSL `bash` cannot open the Windows adapter path (exit 127). Corrected Git Bash registration/trust needs explicit approval. Existing chats do not hot-reload instruction edits.

All locally checked shared-rule sources/copies match. The same-identity Library mirror is stale; this client exposes no supported replacement capability. A new upload would not replace it. Cursor GUI rules and cloud/phone context activation need their supported client interfaces; native apps are unavailable to this task. No private application databases, credentials or protection settings were altered to work around this limit.

Canonical ledger reconciliation is available through the configured Notion connection. The original objective is recorded under Ward Flow with current evidence; implementation completion remains distinct from publication, merge and deployment.
