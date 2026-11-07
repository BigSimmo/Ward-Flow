---
name: auto-mode-classifier-is-inconsistent
description: "The auto-mode classifier blocked live-Supabase writes and gh workflow dispatch in one session and allowed them in another, days apart — plan for it, don't assert it either way"
metadata:
  node_type: memory
  type: feedback
---

On 2026-08-20 the auto-mode classifier **denied** `supabase db push` (staging), the MCP `execute_sql` equivalent, and `gh workflow run live-drift.yml` — each with "Blocked by classifier", read-only `supabase db query` unaffected. A briefing was written from that, saying auto mode blocks live-Supabase writes and workflow dispatch. On 2026-08-21 a later session ran a staging `db push` and a workflow dispatch **in auto mode without being blocked**, and its handoff recorded the earlier briefing as simply wrong.

Both observations are real. The honest reading is that the classifier is context-dependent, not a fixed rule, so neither "auto mode blocks this" nor "auto mode allows this" is safe to state as fact.

**Why:** stating it as a rule sent a whole prompt down the wrong path — "run this in a NON-AUTO session" was presented as a hard requirement when it was one session's experience. That is the same error as reporting an inference as a direct reading.

**How to apply:** for a task needing live writes, say "auto mode may refuse this; if it does, rerun outside auto mode" rather than asserting either behaviour. Never carry a single denial forward as a documented capability limit. Related: [[checks-that-cannot-fail]], [[local-test-failures-windows]].
