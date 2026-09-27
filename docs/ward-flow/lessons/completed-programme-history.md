---
name: completed-programme-history
description: "RAG, DB remediation, ingestion review, Care Plan, Developer Hub, Caring Contacts and the Ward Flow design foundation: all closed, with dates and residuals"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 11 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 11 index lines for one subject crowd out 10 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# rag-programme-coordination-state

> Coordinator board for the Clinical KB RAG programme (S-packets, #212 tranches, governance, #231 re-scope) — decisions 2026-08-17 to 2026-08-22 and where the master plan lives

Master plan v2 artifact (live-verified 2026-08-17): https://claude.ai/code/artifact/d5dba709-0df3-40e3-8a45-15997231533d
Founding docs: #212 primary 1f5f29ed-14d3-4ab9-b4db-d34447794ed5; RAG handover 2d8a08cd-4445-423d-8058-fdb6a5a0f854; S1 brief 200e2c41-a79b-40d2-8b24-e2bbe241db6b. Repo docs win: docs/rag-improvement/{README,HANDOVER,COORDINATION}.md.

State 2026-08-17 (later): #2022 (S1) merged squash 2bd146eed, #2023 (T3) merged 440a34f71 — both landed by content. #2024 (D1 docs sync) MERGED by coordinator as squash 78fe906b8 — HANDOVER/COORDINATION/H5a + 6 inbox requests landed by content; R0 reconcile now unblocked. Post-S1 canary (C1) DONE and GREEN: owner approved, dispatch run 32025082010 vs baseline 31964560921 — 36/36 per-case retrieval metrics and 44/44 answer routes byte-identical, recall 1.0/1.0, mrr 0.8921, zero regressions, $0.06. Non-inferiority proven, not the win: generation fallbacks stayed 2/44 on the same two cases (neuroleptic-side-effect-escalation, summary-discharge-guidance), which are not dosing cases — the S1 win evidence remains the live probe pair in #2022's body. C1 needs no re-run. Wave 0 dispatch: D1 (Sonnet 5 med), S4 (Opus 5 med), S1b (Fable 5 high, plan), T4 (Fable 5 high, plan). R0 reconcile after D1. R1–R3 + 33243037 follow-ups queued via D1.

S1b (#2035, merge 92f7618c0) canary pair: first run 32038751592 RED on summary-discharge-guidance only (final_quality_gate:provider_source_gap, 0 citations) — diagnosed as pre-existing finalizer hole (rag-extractive-answer.ts finalizeRagAnswerQualityCore broad gapLikeAnswer regex converts a hedged cited low-confidence fast answer to evidence_gap with NO extractive recovery, unlike in-loop fast failures) + model nondeterminism; index unchanged; 3/3 probes take the extractive-fallback branch. Re-run 32039841070 GREEN 45/45, retrieval 36/36 zero regressions → S1b pair CLOSED, S1c unblocked. New packet S1d (final-gate gap recovery) proposed before S2. S4 #2036, T4 #2037 merged; #212 closed at R0 (#2043).

Later 2026-08-17: R0 landed as #2045 (my #2043 closed superseded); D2 #2048 merged (S1d packet in HANDOVER); S5 #2056 merged (merge 093f9340c) — post-S5 canary 32049952885 GREEN 45/45, retrieval zero regressions; D3 docs PR #2061 open (S5 row merged, S2 blocker = S1c+S1d, 4 inbox requests: 3 KNOWN_DIVERGENCES pins + RAG_TELEMETRY_EXTENDED prod decision). Still not started as of then: S1c, S1d, G1, S6. Then S1c #2052 (merge b8e774bcd) and S6 #2057 merged; D3 #2061 conflict resolved (2dd15f90a). Post-S1c canary 32052479537 on 084f63799 GREEN 45/45, zero rr regressions → S1c pair closed. Latest green canary = 32052479537. Remaining not started: S1d, G1; S2 after S1d + canary.

2026-08-18: S1d #2054 (0bbd64fbc), G1 #2053 (125e98526), S1c follow-ups #2063/#2065, D3 #2061 all merged. Post-S1d canary 32097916649 (9904fbda8) RED: agitation-im-po-route-short-terms extractive path deterministic 5→0 citations; bisected live to #2065 (964869fc3, condition-first for/in regex in rag-claim-support.ts). Revert PR #2088 open (branch claude/revert-2065-claim-condition-regression, afbf14737+ledger) — probe restores 5 citations, offline 614/614. Owner merges → confirmation canary → S2 unlocks. D4 reconcile PR #2089 open (17 applied, 0 pending; G1/S1c/governance rows closed; HANDOVER G1 merged, S1d canary red→#2065 revert recorded). #2054 prlanded by content OK. Wave 1 complete. #2088 + #2089 merged; confirmation canary 32100681177 (4ea310e48) GREEN 45/45, zero rr regressions → S1d pair closed (baseline 32052479537 → 32100681177; also covers G1, #2063, revert). Latest green baseline = 32100681177. S2 dispatched next (Fable 5 high plan mode); then S3, S7+.

2026-08-18 S2 (this session, worktree review-merge-open-prs-0cd8ea, branch claude/s2-rag-composition-7330b0): A2+A3 shipped together — src/lib/rag/answer-composition.ts (class authoritative; intent refines only medication_dose_risk/table_threshold on escalation_risk; document_lookup + unsupported_or_general = none), one related_information_menu line in buildAnswerInput, one prompt bullet, 60-110 words / three-to-six sections, schema maxItems 6, prompt v19 + schema v4, openai.ts fallback prompt_cache_key v19, adversarial baseline re-captured at code commit b7aa925f0 (v19). rag.ts exactly 4362/4362. Offline: 26 suites/623, adversarial 25/25 (3 pins kept). Traps learned: prompt bump forces baseline re-record (validator cross-check); ci-change-scope rag_eval_changed regex misses src/lib/rag/** (inbox request queued); scoreAnswerQualityEvalCase 220-word total ceiling confounds A3 (left untouched, owner adjudicates). S2 = PR #2097, MERGED 2026-08-18 06:38Z as squash dda4956ff (landed by content, all key files byte-identical); ci-change-scope gap reconciled as issue #SDQSFD (#2098). As of ~07:00Z the S2 post-merge canary had NOT been dispatched (latest eval-canary run still 32100681177 on 4ea310e48) — pair 32100681177 -> <owed>; eval:answer-quality before (needs checkout at 4ea310e48, prompt v18) / after (main) + Gate E owed. HANDOVER S2 row on main still reads "PR open" — S3 session must mark it merged + add the post run id. Next: owner dispatches canary → S3 (A4).

2026-08-19 B4 (S7) — Gate B PASSED 2026-08-18 (run 32176604314, PR #2154). B4 shipped as PR #2170 (branch claude/docling-worker-shadow-mode-b6fa17, head ad3fb7448; code commit 7a30ec3f8): WORKER_DOCUMENT_EXTRACTOR_MODE=legacy|shadow (default legacy), WORKER_SHADOW_EXTRACTION_COHORT_PERCENT 1-5 (owner-approved 2), WORKER_DOCLING_PYTHON_BIN; shadow runs only after commitDocumentIndexGeneration, aggregate numbers-only record in documents.metadata.shadow_extraction via the existing deep-merge, bounded 120 s / 40 pages / 1 process, fail-open. Owner decisions in-session: signals tables+OCR+layout proxy; docling venv + models provisioned in Dockerfile.worker in the SAME PR (from eval/docling/requirements.txt lock, ~+5-8 GB image — CI Docker job disk/time risk flagged; fallback = split provisioning out, never weaken the gate); the unreconciled B4 inbox add was CANCELLED with a resolution reason (issues:done needs a canonical row) → request dc18b947-…; reconcile after merge. Reviewer approve-with-nits. Enabling shadow in prod = operator Railway variable + runbook preconditions (memory headroom for docling ~1.4 GiB peak). Traps: fresh worktree node_modules was empty → run `node scripts/setup-codex-worktree.mjs` before verify:pr-local (check:installed-lock-parity fails otherwise); heavy-lock contention with a sibling worktree gate returns exit 75 (ADMISSION_BUSY) / EPERM rename — wait and retry, not a code failure. Remaining programme: S8+ (B5/B6/B7) still gated on owner decision; docling-lab-fixtures.v2 precedes any table-quality promotion argument.

2026-08-18/19: S3 #2108 merged (511d22f4d) — Track A complete. S2 canary 32111839806 green; Gate E automated neutral (owner blinded read still owed). #2121 restored source_metadata .nullable() pin after #2107 loosened it. A #2127 (ci-change-scope RAG regex), B #2130 (7 ledger requests), C #2128 (canary protocol docs), D #2129 (readability split) all merged; reconcile #2138. Gate B PASS (#2154, run 32176604314). B4 shadow mode #2170 merged 5437c309f, landed by content, default legacy (owner flips WORKER_DOCUMENT_EXTRACTOR_MODE=shadow on Railway after RAM check). Owed: reconcile (2 pending incl. #9DGA6R done), HANDOVER S7 row → merged, S8+ (B5/B6/B7) owner decisions, docling-lab-fixtures.v2 before any table-quality promotion, later "B4 readout" (provider read).

2026-08-21 Gate E tooling (this session, worktree gate-e-blinded-eval-b6076d): PR #2208 MERGED as squash 588191c06 (prlanded: squash tree byte-identical to final head 985b80092, ledger record appended). Ships: eval-answer-quality --extra-cases (owner capture-only questions, structurally excluded from metrics via summarizeAnswerQuality) + gate-outcome/cited_sources dump fields (v18-compatible single-file drop-in, verified byte-identical deps at 4ea310e48); new scripts/blind-answer-pairs.ts build/unblind (content-digest A/B assignment, swap-proof, pair-level field-presence normalization after Codex P1s, question-mismatch guard). Owner procedure = HANDOVER §2a. STILL OWED for Gate E closure: owner-approved paid capture (v18 worktree at 4ea310e48 + current main, ~80 answers, est $4–8 cap $15) → blinded read → unblind → record verdict in HANDOVER S2+Gate E rows → close #E0N0QC. Also owed: HANDOVER Gate E row says "(this PR)" → #2208 in next docs pass; an uncommitted prlanded record file sits in the MAIN checkout (docs/branch-review-records/0265c1cb…record.md) and must ride a future PR. Traps this session: a concurrent "cleanup" agent DELETED the in-use worktree twice (once mid-build, once post-push) — commit+push early; heavy-lock coordinator saturated for hours by the agent fleet; whole-tree prettier and even git push can time out under that load.

2026-08-22 #231 RE-SCOPED (worktree review-unblock-open-prs-323731, PR #2264 OPEN, not merged, CI not watched). Offline diagnosis against the 60 Gate E answers (dump-v18 4ea310e48 / dump-v19 cdfcbaccd) at code 226bd32cc. THE ROW'S TIMEOUT PREMISE IS FALSE — do not let any session 'fix' #231 by raising answerRouteBudgetMs. answerRouteBudgetMs.fast binds in 3 of 60 case-runs; three of six provider_timeout instances sit on the 35 s STRONG budget (budgets are fixed once at rag.ts:2839 from the FIRST routing token; note strong_routine_retrieval is mode fast, rag-routing.ts:1288). Defect population is 9-10 of 30, not ~~20: 12 of 30 cases never call the provider (provider_attempted false), and 4 of the 8 identical source_only cases are CORRECT answers to source-lookup questions. provider_timeout is a MIXED label (see correction below), and for the response-bearing subset the fault is the quality-retry ladder — and the label only says whether it ran out of wall-clock or out of retries (lamotrigine-rash-action carries the same gate reason missing_query_overlap under both labels; delivered answers byte-identical). Root cause: fast_quality_retry_strong (rag.ts:3623/3660) and strong_quality_retry (rag.ts:3709/3721) call generateWithModel with NO deadline admission check — deadlineAllowsGenerationRetry is wired only to the truncation self-heal at rag.ts:3542 — and the sole guard (rag.ts:3698) compares against generationTotalBudgetMs 60000 ms inside a 35 s deadline so can never fire. This is residual R1, open for every class except dosing. 34%/48% of input tokens bought discarded answers. NEW DEFECT, own row: a GROUNDED first-choice extractive answer is never quality-checked — generatedAnswerQualityFailureReason is called only inside the !finalizedAnswer.grounded branch at rag.ts:3107 — so the two worst answers in the capture (both incoherent, e.g. 'The guidance for metabolic is that compliance, monitoring and evaluation.') carry no fallback_reason and every fallback_reason-based metric INCLUDING THE GATE E TALLY scored them clean. Second new row: duress-pathway and agitation-im-route answered with a document list. Also corrected: the both-runs model_synthesis contrast set is 7 cases (not the 6 circulated) and only 2 of them are unambiguous grounded wins. Evidence doc docs/rag-improvement/231-diagnosis-2026-08-22.md with a paste-ready packet prompt in section 8. LEDGER TRAP HIT: request 0a0ab127 (Phase 5 close-out, PR #2250) was already pending on #231; two pending mutations block reconcile and update REPLACES detail, so I merged its content forward as Part A and queued a cancel. Its production numbers help — retrieval is down to 955-6720 ms of the 25 s fast budget, leaving 16-22 s: enough for ONE attempt, not for the retry. CORRECTED AT REVIEW, 2026-08-22 — PR #2264 MERGED 05:38Z as 00cdfa85, but a reviewer pushed 6d227d0b9 'correct timeout diagnosis scope' first and TWO of my conclusions were narrowed. Read the merged doc, not my original. (i) THE GUARD-ONLY FIX IS REFUTED. The reviewer ran the focused predicate test that the diagnosis itself named as the kill condition: generatedAnswerQualityFailureReason returns NULL for both incoherent grounded answers when called with their actual query classes (medication_dose_risk and document_lookup). So the current predicates ACCEPT them and moving the call outside the !grounded guard at rag.ts:3107 would NOT catch either one. The code-path fact stands (a grounded first-choice extractive answer does bypass that call site) but it is not a demonstrated remedy. My inbox row 47f8e3bf was cancelled and superseded by a PREDICATE-STRICTNESS row: diagnose the missing predicate or threshold first; a reachability change is justified only once some grounded extractive answer is shown to FAIL an existing predicate while bypassing the call site. (ii) THE 'ONE MECHANISM' CLAIM WAS TOO BROAD. It holds for the response-bearing subset only. Three timeout instances (benzodiazepine-agitation-dose v18, ect-source-gap-specific v18, quetiapine-dose v19) recorded ZERO provider responses, so no answer existed for a gate or retry to reject and retry admission control cannot explain them. Next step there is per-attempt response/latency telemetry to separate initial-attempt timeouts from retry-ladder exhaustion, BEFORE any deadline-admission change. My update fe5acdef was cancelled and superseded by 1f2a0d03 on the same grounds plus a stale baseRowFingerprint. Everything else survived: the falsified fast-budget premise, the 12-of-30 provider-never-called split, the 4/2/2 split of the source_only eight, rag.ts:3698's unreachable 60 s guard, and the discarded-token figures. LESSON: the diagnosis doc's explicit 'if this test fails, stop and report' stop condition is what caught this — write the kill condition into the packet, and never let a plausible unexecuted predicate claim become a prescribed fix. RECONCILE IS DONE (someone ran it): all four of my requests are in inbox/applied, #231 now reads 'Re-scoped: separate initial provider timeouts from quality-retry exhaustion before changing the RAG path' (P2), the predicate-strictness row is P2, and my document-list row survived intact as P3. STILL OWED: HANDOVER section 1 still calls #231 a budget problem, pointer deferred because PR #2257 edits that file; then the predicate-strictness packet (NOT a guard-only edit), then per-attempt timeout telemetry, then only afterwards a ladder-admission-control packet, then the document-list packet — each needing its own canary. Owner declined both paid re-captures (~~$0.66 each) as unnecessary for the diagnosis.

Owner decisions (2026-08-17): R1 (S1b strong routing pre-deadline) BEFORE S2; governance = Option B (new similarity_origin "document_context" tag on doc-summary rows, confidence label unchanged, no canary).

**Why:** three streams share src/lib/rag/**; without one board, sessions duplicate work (#292) or bundle canaries.
**How to apply:** verify PR state via fetch before trusting this; queue = W0 land 2022/2024/2023 → W1 S4 + S1b + T4 → W2 S1c, G1, S2 → W3 S5/S6/S3. Coordinator never implements; owner merges and approves each canary. See [[clinical-kb-provider-boundary]].

---

# db-remediation-coordination-state

> Live-drift remediation (#316) is CLOSED 2026-08-21 — live-drift green, pinned issue #1963 auto-closed, 33-day red streak ended. Do not reopen. Residuals: explain_retrieval_rpc _v2 coverage, the idx_scan=0 ANALYZE question, PITR off, #Q5JHBJ

**THE #316 PROGRAMME IS CLOSED. Do not reopen it.** Verified independently 2026-08-22, not taken on trust: live-drift run `32514326022` **success** on `main` (2026-08-21T18:37:51Z — first green since 2026-07-19, a 33-day red streak), pinned issue #1963 **CLOSED** 18:38:42Z, and `#316` moved out of the open table into resolved on `origin/main`.

Landed: #2250 (Phase 5 close-out), #2258 (superseding review record), #2261 (reconcile that closed `#316`), #2263 + #2268 (further reconciles — the handoff listed #2263 as open; it merged).

Final verified production state (8/8 against the 2026-08-21 baseline): 210 public indexes, 0 invalid, 211 `supabase_migrations` rows, 20 no-statement rows, `migration_history_versions()` probe ok / 211 versions, `search_schema_health()` ok. Staging at parity (211 rows, function present). Latency: text fast path 31,610 → **955 ms**; hybrid 21,757 → **6,720 ms**.

**Residuals, each on its own row — none reopens `#316`:**

- **`explain_retrieval_rpc` accepts only four RPC names and raises 22023 otherwise**, so `document_index_units` (a §1.2 outlier) has NO EXPLAIN baseline and there is no query-specific plan-flip evidence. Both are OPEN Phase 5.1 deliverables. Extending it needs a migration → an approved window (D4 is ON: merging deploys).
- **OPEN QUESTION — the indexes may not be what fixed the 2026-08-14 incident.** All 22 restored indexes report `idx_scan = 0`, including both trigram indexes credited with the fix (OIDs 1491258/1491257, unchanged since restoration). Retrieval is actually served by `document_chunks_search_idx` (37,717 scans), the HNSW index (4,906) and `documents_title_search_idx` (37,299). This points at the co-administered **ANALYZE**, not the indexes. **Consequence for triage: check planner statistics BEFORE hunting missing indexes.** CAVEAT — strongly supported, NOT proven: `pg_stat_reset_single_table_counters(oid)` resets per-index counters invisibly, and PG 17.6 lacks `pg_stat_all_indexes.stats_reset`. Settle with a controlled before/after ANALYZE measurement. **DO NOT DROP those indexes** — they are repo-defined; dropping reopens live drift.
- PITR still OFF on production (owner cost decision). The fifteen no-statements history rows: RESOLVED — PR #2185/#2187 shipped six validation guard migrations 20260819110000-110500 + fifteen `validation` allowlist entries (Phase 6.2 worker handover verified 2026-08-31); `#Q5JHBJ` follow-ups only.
- **2026-08-25 → 2026-09-01 relapse, now CLOSED.** Two findings in sequence, both mirror/repo problems rather
  than live ones. (1) `unexpected_live` zero-arg `purge_expired_rag_response_cache()`; dropped by
  `20260831100000` in PR #2477. (2) `correct_clinical_query_terms(text,real)` def_hash mismatch, surfaced
  2026-09-01: that same migration redefined the function with a duplicated
  `and length(canonical) between 4 and 40` predicate while `supabase/schema.sql` stayed byte-identical to
  `20260828000000`. Fixed by codifying live (PR #2493, merged `be7946d1`) — schema.sql + regenerated
  manifest, no migration and therefore no production deploy. Live-drift run `33490736761` green,
  pinned issue `#2375` auto-closed 2026-09-01T09:10:17Z.
  Root cause of the _class_ is ledger `#QCNE6N`: CI replays the migration chain and regenerates the
  manifest but never diffs the chain against schema.sql, so a migration that edits a function body without
  a matching mirror edit clears every pre-merge gate. Second occurrence after the `#316` `SET work_mem` gap.
  Auto-deploy is ON per AGENTS.md (dashboard-confirmed 2026-08-21): merge approval IS deploy approval.

- **Production corpus ownership, measured 2026-09-01 (owner-approved read-only GET, ref `sjrfecxgysukkwxsowpy`):**
  2851 documents, **0 privately owned** — every row has `owner_id IS NULL` and every row carries
  `metadata.public_corpus = true`. The whole corpus is deliberately published. **Use this before answering any
  "is X exposed?" question:** several privacy hazards keyed on private documents (e.g. `#ZBAC9D`'s
  orphaned-document republication via `ON DELETE SET NULL`) are armed but cannot fire, because there is no
  privately-owned document for them to leak. That changes severity, not correctness — the code defect in
  `#ZBAC9D` is real (retrieval path checks no `public_corpus` marker at any layer, and
  `src/lib/documents/is-public-document.ts` is dead code with no production caller). The condition to watch is
  **the first privately-owned document in production**; after that the hazard is live and silent.
  I escalated `#ZBAC9D` to P1 on the code evidence before running the count, and had to walk it back to P2 —
  measure the exposure before you re-prioritise on a code reading.

- **`#ZBAC9D` CLOSED IN PRODUCTION 2026-09-01.** The orphaned-document republication hazard is fixed:
  `documents`, `document_labels`, `document_summaries` and `document_table_facts` owner FKs moved
  `on delete set null` -> `on delete restrict` (PR #2502, merged `5cfda8033`, owner-approved window).
  Deleting an auth user who owns rows in those four now FAILS instead of silently republishing them —
  an account-deletion flow must reassign or delete their documents first. Scope was **four** tables, not the
  six first analysed: `document_sections` and `document_embedding_fields` filter on the PARENT document's
  owner, never their own, and got onto the list via an ambiguous SQL table-alias match. **Also found:**
  `retrieval_owner_matches_v2` is a SECOND predicate with the same null-means-public flaw (`include_public`
  defaults true); any future repair of the predicate instead of the FK must fix BOTH versions.
  `src/lib/documents/is-public-document.ts` is still dead code with no production caller — recommended for
  wiring in as defence in depth, in its own PR with its own canary.
- **THE POST-MERGE `live-drift` RUN IS NOT A VERDICT — IT RACES THE APPLY.** Twice now (2026-08-31 PR #2477,
  2026-09-01 PR #2502) the automatic run fired on the merge commit ~1 s after merge, BEFORE the Supabase
  integration applied the migration (~34 s), and reported the pre-migration state as unexpected drift.
  Both times a manually dispatched re-run minutes later was clean and the pinned issue auto-closed.
  **Always `gh workflow run live-drift.yml --ref main` and read THAT result before concluding a migration
  failed to apply.** Reporting the automatic run's red as a real finding would be a false alarm on the
  exact signal this programme exists to trust.

**Why:** the drift was three mechanisms — mirror gap, out-of-band index drops, chain-vs-mirror objects — plus routing that told nobody. All closed, and the alarm has now been _observed_ green rather than assumed.
**How to apply:** treat `#316` as history. Related: [[rag-programme-coordination-state]], [[local-test-failures-windows]], [[claude-session-accumulation-starves-machine]].

---

# db-coordination-chat-handover

> Handover to re-seed the database coordination chat (2026-09-01) — what the closed #316 programme did, live-drift green again 2026-09-01 after the mirror-gap fix, and how to coordinate

Seed for a NEW database coordination chat. Written 2026-09-01 by the outgoing coordinator (session database-0a). Verify everything against `origin/main` before acting — worker self-reports and this file both go stale.

**Role.** Coordinator, never executor: dispatch worker chats with pasted prompts, verify returns against `main` + `docs/audit/live-drift-forensics-2026-08.md`, keep `docs/database-remediation-coordination.md` (ON MAIN) current via fresh-base docs-only PRs, queue ledger updates via `npm run issues:update -- '#id' --detail …` (id POSITIONAL), one serialized `issues:reconcile` after batches land. Board edits: always re-cut from current `main` (squash-merge race hit once).

**What the programme did (CLOSED 2026-08-21, do not reopen `#316`):** ten "diverged" RPCs were a mirror gap (`SET work_mem` absent from schema.sql); 20 missing + 2 orphan indexes restored/dropped in Phase 4; 8 schema-only objects + chain-stale columns codified; staging at parity; 6 validation guard migrations + 20 allowlist entries closed the migration_history findings; live-drift green 2026-08-21, #1963 closed, latency 31,610→955 ms. Full detail: [[db-remediation-coordination-state]], forensics file, board doc.

**OPEN NOW (2026-09-01):**

- **RESOLVED 2026-09-01 — live-drift is GREEN again and `#2375` auto-closed at 09:10:17Z.** The
  `correct_clinical_query_terms(text,real)` def_hash mismatch was a **schema.sql mirror gap**, not a live
  problem: migration `20260831100000` (PR #2477) redefined the function with a duplicated
  `and length(canonical) between 4 and 40` predicate and the mirror was never updated (it was still
  byte-identical to `20260828000000`). Closed by PR #2493 (merged `be7946d1`) — schema.sql aligned +
  manifest regenerated, **no migration, no production deploy**. Proven entirely OFFLINE: regenerating the
  manifest yielded def_hash `2ebaf978b69f3de0c47d9d0924419c74`, exactly the live value, and moved that one
  entry and nothing else. Run `33490736761`: "No unexpected schema drift between live and supabase/schema.sql."
  **Method worth reusing: a live/repo def_hash mismatch can be fully classified and proven without any live
  read — regenerate the manifest locally and compare against the hash the CI log already printed.**
- **Auto-deploy is ON** (AGENTS.md, dashboard-confirmed 2026-08-21): merging a migration to `main` deploys to production in ~30 s. Merge approval = deploy approval. Josh chose OFF on 08-19 but the current documented state is ON — do not relitigate silently; if it matters, ask him.
- PITR OFF on production (owner cost decision, open). No DATA-mutating window until decided (#022/#036/#191/#057).
- `idx_scan=0` open question and `explain_retrieval_rpc` `_v2` coverage gap (Phase 5.1 residuals, own ledger rows).
- Owner-only dashboard items: Supabase automatic-branching limit 3→1; CodeRabbit spend cap (P1 `#CCZ4HB`).

**Traps (each paid for):** never `check:drift --prune-stale` against staging; never seed vault secrets into staging; main checkout may be linked to staging — dedicated worktree + `supabase unlink` for prod; `supabase db query` needs `--file` for SQL starting with a comment; `db push` may need `--include-all` (confirm pending set first); duplicate migration version pairs apply old bodies over new on plain push; `CREATE OR REPLACE FUNCTION` drops un-restated `SET` attributes; a hand-repair on one tier leaves the chain wrong — only a guard migration surfaces it; env-flaky Windows tests: session-start-hook, worker-observability, codex-cloud-setup, document-viewer-page-virtualization.

**Why:** the coordination chat pattern (verify from main, one ledger row per worker, prompts with stop rules) is what got 33 days of red to green without an incident.
**How to apply:** paste into the new chat: "You are the database coordination chat for BigSimmo/Database. Read memory db-coordination-chat-handover and db-remediation-coordination-state, then docs/database-remediation-coordination.md and the tail of docs/audit/live-drift-forensics-2026-08.md on origin/main. Verify the current live-drift state (latest run + issue #2375) yourself before anything. Do not execute phases; dispatch and verify. First job: the correct_clinical_query_terms def_hash mismatch."

---

# ingestion-review-remediation-state

> Ingestion pipeline review 2026-08-18 — live corpus quality signal is synthetic, PR A′/C landed locally, operator steps and canary decisions still open

Full ingestion review completed 2026-08-18 (repo + read-only live audit of `sjrfecxgysukkwxsowpy`). Plan: `C:\Users\joshs\.claude\plans\please-can-you-review-playful-crane.md`. 14 findings queued as immutable inbox requests (unreconciled).

**The finding that reframes everything else:** the live quality signal is synthetic. `repair_enrichment_quality_batch` (in `20260712171500_codify_live_ahead_functions.sql`) overwrites `document_index_quality` with a hardcoded `0.84`/`good` computed from row _presence_, discarding `assessDocumentIndexQuality`'s real verdict. Live: **all 2,851 documents read `good`, and zero rows carry a `needs_ocr_page_count` metric key.** So corpus-health numbers from that table prove nothing — never quote them as evidence of ingestion quality.

**Why that is a ranking problem, not just a reporting one:** `document_index_quality.quality_score`/`issues` feed `indexQualityRankSignal` in `src/lib/clinical-search.ts` into the ranking sum. With every document at 0.84 the boost is a **constant across the whole corpus — the signal is dead**. Restoring honest quality therefore moves every document onto a different boost tier: it is a corpus-wide RAG ranking change needing an `RAG impact:` line and a live eval-canary pair, not the no-RAG-impact chore it first looks like.

Other live facts not visible from the repo: 65% of summaries are non-LLM prefixes; 43% of memory cards are repair-manufactured, and repair cards carry a _chunk's_ embedding rather than an embedding of their own text; 48% of documents have one synthetic whole-document section; 98.5% of `document_index_units` have a NULL `index_generation_id` so reindex never retires them; 760 documents hold duplicate document-level embedding rows (worst: 18 copies) because the dedup unique index is keyed on a nullable `source_chunk_id`.

**Landed locally, not pushed, no PR opened:**

- `claude/ingestion-transient-openai-retry` — every transient OpenAI failure was classified terminal because the classifier read `mapOpenAIError`'s prose, not its code. Plus vision retries and the never-called `checkEmbeddingDimension`.
- `claude/edge-worker-ingestion-review-1adaa9` — retired the `ingestion-worker` Edge Function (it claimed the extraction queue without extracting). Carries the 14 inbox requests.

**Open, needs the operator:** unschedule the live `cron.job` row calling `invoke_ingestion_worker` (was jobid 7) and delete the deployed function — _before_ that, identify what redeployed both edge functions twice in 30 minutes on 2026-08-18 with no repo change, because a cache-based deployer would resurrect it.

**Watch out:** `ops.toggle_worker_jobs_by_backlog` runs every minute on live, is `SECURITY DEFINER`, arms cron jobs 5/6/8 whenever a document is uploaded, and has **zero occurrences anywhere in the repository** — so the repo cannot tell you what actually runs against a new upload. Related: [[db-remediation-coordination-state]], [[local-test-failures-windows]], [[rag-programme-coordination-state]].

---

# care-plan-build-state

> Care Plan — COMPLETE and merged to main 2026-08-26 (PR #2383, e15b250cf); what remains is a copy pass and four owner decisions, not engineering

**Care Plan** is a synthetic, memory-only, reset-on-refresh clinical prototype at
`/mockups/care-plan`, behind `DeveloperAreaGate`. An ED clinician finds someone who presents
repeatedly in psychiatric crisis, sees whether a Current Plan exists, reads its first-minute
guidance, and reaches the community team — in about thirty seconds. Reading is the primary use;
authoring is supporting machinery.

**DONE.** All eleven tasks built, independently reviewed, verified in Chromium, and merged to `main`
on 2026-08-26 as squash commit `e15b250cf` via PR #2383. 100 files. Verified 2026-09-01 by comparing
blobs: the branch and `main` differ only by `main`'s own later PsychSift rename. Do not rebuild it.

**Read first, every time:** `docs/care-plan/HANDOFF-START-HERE.md` on `main` — rewritten 2026-09-01
around the landed state. The three older entry documents were all stale and now carry SUPERSEDED
banners pointing at it; a stale handover is worse than none, because the next session rebuilds
finished work from it.

**Where to build:** `D:\Worktrees\Database\care-plan-next`, branch `claude/care-plan-next`, cut from
`origin/main` @ `d3074946a`. **It IS installed** — corrected 2026-09-02 against
`scripts/check-installed-lock-parity.mjs` (exit 0, 783 package locations, 74,766 files, versions
matching the lockfile). Both the handover and the ownership registry said "no `node_modules` yet,
budget an hour"; that was wrong when written and the hour was never needed. Skip `npm ci`, go to
`npm run ensure`. If it has gone stale, cut a fresh worktree off current `origin/main` rather than
merging drift.

**Pushed and open, 2026-09-02.** Branch is on `origin` and open as
[PR #2528](https://github.com/BigSimmo/Database/pull/2528) — ten files, all `docs/care-plan/**`,
classified `clinicalRisk: false` so no governance preflight. Not merged; merging is Josh's.

**Cloud work goes through `docs/care-plan/cloud-session.md`** — the brief a cloud session reads first
and the append-only progress log it writes to. The three printed sheets are now committed at
`docs/care-plan/patient-facing-sheets/` because the atlas is git-ignored on one disk, so a cloud
container could not otherwise read the artefacts the copy pass is about.

**Never delete `claude/care-plan-stage-b-9-11`** (worktree `D:\Worktrees\Database\care-plan-impl`).
`main` has the product but not its 209-commit build history, which the squash flattened, and its
remote was deleted on merge — so `origin` cannot give it back. Same for `D:\CarePlanHandoff` (the
four raw build transcripts and fourteen review packages, outside git) and `.local/care-plan/atlas`.
All three are covered by the protect hook and by `backup-work.sh` since 2026-09-01.

**What actually remains, all of it Josh's, none of it engineering:** the patient-facing copy pass
(every replacement wording from decision D4 is provisional), real patient-facing fixture prose so the
captured Patient Plan sheet shows words rather than filler, and four decisions recorded in the
handover. The ledger also carries 65 deferred minors, none blocking.

**The boundary, verified by import scan 2026-09-01.** Care Plan owns `src/components/care-plan/**`,
`src/app/mockups/care-plan/**`, `tests/care-plan-*`, `tests/ui-care-plan-mockup.spec.ts`,
`docs/care-plan/**` and `docs/care-plan-context.md`. It **reads** thirteen shared UI primitives and
writes none, so a shared-UI PR can move its rendered output without touching a Care Plan file.
`CONFIDENTIAL_DOCUMENT_FOOTER` looks shared and is not — all three consumers are Care Plan's own
prints.

`docs/care-plan/sdd-ledger.md` is still authoritative for all 65 rulings and 9 systemic lessons; only
its branch and worktree headers were out of date. See [[care-plan-local-build-only]] for the build
instruction that is now discharged, and [[claude-worktrees-get-deleted]] for why local commits stay
non-negotiable.

---

# care-plan-local-build-only

> DISCHARGED 2026-08-26 — the Care Plan stay-local instruction ended when Josh said publish; kept for the rule it taught about scoped instructions

**DISCHARGED.** While Care Plan was being built (2026-08-24 onward) Josh asked that the work stay
local — no pushes, no PR, and none of the long gates (`verify:cheap`, `verify:ui`, `verify:pr-local`,
`build`, whole-tree `format`) — because each costs tens of minutes on this machine and contends with
the three or four other AI sessions holding the repository's heavy lease. He wanted the time going
into the build, not into branch ceremony he had not asked for.

**That instruction ended on 2026-08-26 when he said "go ahead and publish".** The gates were then run
in full, the branch pushed, and PR #2383 merged the same day. Do not carry the restriction into new
Care Plan work; see [[care-plan-build-state]] for where things stand.

**Why this is kept rather than deleted:** the shape recurs. An instruction scoped to a phase of work
("while you are building X") looks permanent once it is written down, and a later session reading it
would refuse to run a gate Josh has since asked for. **Write the discharge condition into the memory
at the same time as the instruction** — the thing that will end it, not just the thing it forbids.

**How to apply:** the general preference underneath it still holds and is not discharged — run the
smallest gate that covers the change, and ask before spending tens of minutes on a broad one. What is
discharged is the blanket ban. See [[heavy-lock-refusal-looks-like-failure]] for the lease traps the
focused runs still hit, and [[observations-expire]] for the same idea about measurements.

---

# developer-hub-build-state

> Developer Hub merged 2026-08-26; environment strip (#2495) and clinical answer-failures panel (#2498) both MERGED 2026-09-01; hazard register and phone proof still unbuilt

The Developer Hub build was **complete and merged** as of 2026-08-26 (PRs #2176, #2269, #2292,
#2359, #2366, #2371, #2372, #2382). Two of its gaps were closed on **2026-09-01**; two remain.

**Closed 2026-09-01:**

- **The environment strip is wired.** `src/lib/developer-area/environment-facts.ts` reads demo
  mode, the signed-in email and an owner-scoped `documents` count in one round trip, which made
  the hub page an async Server Component. Josh approved the Supabase read that the Phase 2 spec
  had reserved. Two rules are mutation-proven: the count is scoped by RLS (`documents owner read`),
  never the admin client; and every failure — including a **rejected** promise, not just a returned
  `{ error }` — reports `null`, never `0`. The rejection case was found by Codex review, not by me.
- **A clinical answer-failures panel exists** (`/mockups/development/clinical-answer-failures`)
  plus a hub band. It intersects open ledger items with the eval case list. **Matching must be
  whole-token:** case ids nest (`discharge-documentation` inside `quality-discharge-documentation`,
  `patient-safety-plan` inside `quality-patient-safety-plan-documents`), and a plain `includes`
  put two clinical questions on screen that nothing had reported broken.

**Still unbuilt:** the `hazard-register` placeholder (`phase: 4`; Josh ruled 2026-08-26 that it
belongs here — that settled _where_, not _whether_), and any phone/tablet verification of the hub.

**State to re-check before acting:** both MERGED 2026-09-01 and both verified on main by content
rather than by the word "merged" — #2495 (environment strip + a design-sync test timeout fix) as
`ce07c4242`, #2498 (the answer-failures panel, including the reference-not-verdict correction) as
`33bfca886`. Auto-merge was armed on both and fired the moment each went green. Verify against git
before trusting any of this ([[observations-expire]], [[squash-merge-lands-a-subset]]).

The 2026-09-01 handover at `C:/Users/joshs/.claude/handovers/2026-09-01-developer-hub-handover.md`
still describes the pre-2026-09-01 state and its §4 "lost note" is now **moot**: the ledger row it
worried about (`#NPQJKP`) is already resolved and archived. Do not re-queue it.

---

# caring-contacts-phase-2b-state

> Caring Contacts Phase 2B — MERGED to main 2026-08-29 as PR #2451, squash 17df388e8; three human reviews still block any pilot

**Phase 2B is merged.** [PR #2451](https://github.com/BigSimmo/Database/pull/2451) squash-merged to
`main` on 2026-08-29 as `17df388e8`, all 18 required checks green. Verified by content on `main`, not
by PR state. Branch `claude/browser-test-gate-handoff-d5c1db` was kept, not deleted.

**Nothing reached the live clinical database.** The squash touched **0** files under the repo's own
`supabase/migrations/` (the directory that auto-deploys to `Clinical KB Database` within seconds of a
merge) and 4 under the isolated `caring-contacts/supabase/migrations/`. Merging did deploy the app to
Railway production, which the owner was told before the merge.

Final gates: unit `11587 passed`, database `213 passed` (Postgres 17, chain replayed from empty),
browser `631 passed` locally plus all four CI Production UI jobs, lint/typecheck clean, cold build,
bundle within tolerance.

Decision record: `docs/caring-contacts/phase-2b-build-record.md`, rulings [1]–[161].

**Two merges with `main` each produced a defect invisible on either branch alone** — 22 the first
time (ruling [149]), one the second (ruling [161], an error-boundary message substring read as an
overlay wiring). Treat any catch-up merge on this repo as defect-generating, not routine.

**Still open, and none of it is code:** `#1S81R8` — safety officer, lived-experience and Aboriginal
health reviews block any real-patient pilot. Owner-visible residuals: a replay after retention
clearance now returns a named refusal rather than the original value, and `plans.created_at` is
mutable while the unclaimed-work escalation depends on it.

Supabase is the intended eventual database — ruling [158]. **Never move these migrations into the
repo's own `supabase/migrations/`**; two committed tests block it.

See [[read-the-failure-message]], [[measure-the-thing-not-a-proxy]], [[hand-picked-test-subsets-ship-red]].

---

# ward-flow-design-foundation-state

> Ward Flow Board design foundation COMPLETE 2026-09-04 on codex/task-ward-flow-live-state-20260831; what landed, what is pinned as backlog, and what is still open

**The Board design foundation is built and committed** on
`codex/task-ward-flow-live-state-20260831`, commits `ade5cfaa7..5071b76c4`. **Never pushed — one
disk only.** See [[protected-work-and-backups]].

**What landed:** one canonical token layer (`ward-tokens.module.css`, consolidating four
declaration sites), and four primitives each in its own module — `ward-panel`, `ward-chip` (state
chip + kind chip), `ward-figure`, `ward-shared` (seven hoisted classes). Plus two gates:
`ward-primitives-shared.test.ts` and `ward-design-language-contract.test.ts`.

**The ten approved prototypes are committed** at `docs/ward-flow/design/prototypes/` with a README.
They had been living in a session temp directory. **The shared design-language block is 14,025
characters, byte-identical across all ten**, sha256 prefix `ffea7bce424f5346`.

**Measured 2026-09-04, 177 ward vitest files, 2435 tests, ONE failure** —
`ward-flow-chat-control.test.ts`, pre-existing and environmental: the control plane records a
`ward-verifier` checkout path that no longer exists. Not caused by this work.

## Facts that cost time to establish, and will again

- **`--ward-space-N` is N PIXELS.** `--ward-space-4` is 0.25rem = 4px, `--ward-space-16` is 1rem.
  I told four builders it was a 4-point scale and was wrong; a reviewer settled it by noting that
  at 1 unit = 1rem, `--ward-space-16` would be 256px of padding.
- **The surfaces are `--ward-ground`, `--ward-canvas`, `--ward-chrome`, `--ward-subtle`.** There is
  no `--ward-panel` and no `--ward-sunken` — those came from the prototype palette.
- ⚠️ **`--ward-ground` is declared and consumed by NOTHING.** It is the token the whole direction
  rests on (panels float on a ground, not white on white). **The navigation shell must be what
  paints it** — see the plan below. Until then the design silently reverts.
- **`--ward-z-phone` was split into `--ward-z-phone-bar` (30) and `--ward-z-phone-header` (20)**
  because one name was carrying two layers: the fixed phone bar sits above the sticky sub-headers
  that tuck under it. Collapsing them would have let the header cover the bar. The test asserts the
  ORDERING, not the numbers.
- **`--ward-border-subtle` is used in `search/search.module.css` and declared nowhere in `src/`.**
  It renders via a `currentColor` fallback, i.e. at full text contrast under a name saying subtle —
  see [[fields-with-no-producer]] for the mirror of this.

## Pinned as known backlog, deliberately not fixed

Four screens declare `.field`/`.wardName` locally (`search`, `statistics`, `statistics-sections`,
`wards/ward-index`); eight distinct breakpoints exist (40, 40.0625, 52, 60, 64, 76, 84, 90rem);
plus raw-hex and font-family offender lists. **All pinned as sorted lists with no-new-member
assertions, never counts** — a count survives a move between files and survives a shrunken walk.

## Still open

1. **The navigation shell** — plan committed at
   `docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md`, not built. Ruled: all 31 ward
   routes, place stays in the page, role switch is forced, `.workspaceHeader` loses its sticky.
2. **The ten screens themselves.** Nothing user-visible has changed yet.
3. ⚠️ **Ward Flow already stacks two phone bars and no committed guard checks it** — the
   header-scroll-hide contract asserts only against hard-coded non-ward paths.
4. **A hydration mismatch on every ward page in dev** — the layout mounts `WardFlowProvider` with
   no `initialNow`. Recorded, not fixed.
5. **The two sensitive patient-record fields** (Aboriginal or Torres Strait Islander status,
   interpreter need) have had their PLACEMENT reviewed only. **Presence is still open with the
   Aboriginal health review and the layout fix must never be cited as settling it.**

Related: [[ward-flow-coordination-state]], [[ward-flow-ledger-system]],
[[a-baseline-from-the-subject-vouches-for-it]], [[ward-flow-referral-model]].

---

# ward-statistics-and-community-handover

> State of the Ward Flow statistics + community work as at 2026-09-05, fully merged, and the four things the next chat must pick up

Ward Builder One's work is **fully merged** into `codex/task-ward-flow-live-state-20260831`
as at 2026-09-05. Six commits, verified by reading the files out of master rather than
trusting a merge message: `3f126a357`, `c067535bb`, `9a1bd4efb`, `668833ecb`, `ffde81bcb`,
`6b4775e87`. Worktree `D:/Worktrees/Database/ward-builder-community-route` is clean.

**Landed:** the community team page states when a team name is spelled more than one way in
the S2015 source and refuses to merge the spellings; four statistics prototypes
(`docs/ward-flow/design/prototypes/mockup-statistics-{overview,ward,ed,cmht}-v1.html`) on one
shared style block; viewport/charset meta across 19 prototype files; three files that silently
dropped a CSS rule (missing opening `/*`); and the owner's ruling that all four Inner City
spellings are one service, recorded as a signed table in
`community-ratified-aliases.ts` — deliberately unreachable from the similarity relation.

**Four things outstanding, all written up in
`docs/ward-flow/statistics-primitive-reconciliation.md`:**

1. The five statistics **screen** rebuilds — not started deliberately; the shared layer changed
   under them. ⚠️ `WardFigureStrip` throws above two `flagged` tiles; adding a general `tone`
   prop routes around that count and leaves the constraint green and untrue. Both changes go
   together or neither.
2. `ward-bar.module.css` has **no `forced-colors` and no `@media print`** while its three
   siblings carry a print block — and it is the primitive whose whole meaning is coloured fill.
   ⚠️ **Do not quote a ratio for how many ward stylesheets handle forced-colors.** Five figures
   were produced (8/19, 9/19, 30/48, 31/51) and **none was an arithmetic error** — modules were
   folded between the walks, so the ratio is not a stable property of the repository and is stale
   the moment it is written. State the finding as four per-file facts instead, each checkable in
   one command. See [[observations-expire]] and [[never-produce-a-figure-while-writing]].
3. DONE by Ward Lead in `31514fdfa` — the note at the top of
   `tests/ward-community-near-duplicate-warning.dom.test.tsx` saying what it does
   NOT cover — see [[a-property-whose-operands-can-coincide]]. Measured: truncating
   `communityNameCollisions()` to five families drops five real families, including
   Midland/Midalnd, and **every assertion stays green**. It proves the page agrees with the
   predicate and nothing about whether the predicate is right.
4. Two team-name questions needing a person, not code: the **bracketed qualifier**
   (`Alma Street (Fremantle)` vs `(Melville)` — probably two clinics; `Armadale (Mead)` vs
   `Armadale (Mead Centre)` — probably not), and the fact that **no string rule can ever reach
   an initialism**, which is why ICC had to go to the owner.

**CLOSED BY OWNER DECISION 2026-09-05, not fixed:** the ICC copy on Ward Builder Three's two
community prototypes. He is replacing the team data wholesale, so it is superseded rather than
outstanding.

🔴 **WHEN HE REPLACES THE TEAM LIST, FOUR THINGS GO RED BY DESIGN. They are the system working,
and afterwards they will arrive as a wall of failures with no context:**

1. `ratifiedDecisionsOnMovedFigures()` — the consent guard. It asserts the suburb counts the
   owner was shown (Inner City 16, ICC 3, Inner City Clinic 1, Inner City (central) 1) still
   match the data. New data almost certainly moves them. ⚠️ **Do NOT update `shownCounts` to
   make it green** — his ruling covered twenty-one suburbs under four specific spellings, and if
   those move his ruling has stopped being about the thing he saw. Put it back to him.
2. `ratifiedAliasesWithNoSuchTeam()` — red if any of the four spellings leaves the vocabulary.
   Retire the entry with a note; do not delete the guard.
3. `RECORDED_COLLISIONS` in `ward-community-vocabulary.test.ts` (now 10 families / 24 names) will
   be wholly wrong. ⚠️ **Re-derive BY HAND from the new names, never paste the module's output** —
   pasting recreates the tautology it exists to replace.
4. Ward Builder Three's independent implementation must be re-run and the **symmetric difference
   taken BY NAME**, not by count. That comparison found both real bugs on 2026-09-05.

🔴 **HALF-DONE, FOUND 2026-09-05 AFTER CLOSE-OUT AND NOT FIXED: the owner's ICC ruling is
recorded and NO SCREEN RENDERS IT.** Measured on master: no component imports
`community-ratified-aliases`, and `ICC` is in no computed near-duplicate family. So a reader on
the `ICC` page sees **nothing at all** — the exact gap the ruling was made to close — and a reader
on `Inner City` sees `Inner City Clinic` described as a near-duplicate _spelling_ when a person
has ruled it the same _service_. Both halves are individually correct; the combination is the
defect, the same shape as the `WF-008` patient-status defect found the same night.

The wiring is small — `ratifiedSameServiceNames(team.name)`, rendered in a visibly different
register from the near-duplicate sentence — **and the judgement is not: the two claims must not
look alike on the page.** It belongs to whoever holds the community screens. ⚠️ **It survives the
coming team-data replacement**: whatever the new list is, a ratified alias that nothing renders is
a decision made and not shown.

Related: [[ward-flow-coordination-state]], [[ward-flow-changeable-data-rule]],
[[relayed-numbers-lose-attribution]], [[establish-the-unit-before-counting]].

---

# ward-lead-handover-2026-09-05

>

# Ward Flow — start here. Written by Ward Lead, 2026-09-05.

**Everything from five chats is merged onto one line. This file is what a new chat reads first.**

## 1. Where the work is

    master line   codex/task-ward-flow-live-state-20260831
    worktree      D:/Worktrees/Database/ward-lead
    tip           0bb857564   (re-read it; see §6 on stale SHAs)

⚠️ **Ward Flow is never pushed.** Both ward branches exist on this disk only. Never `git add -A`,
never bare `git stash`, never delete a worktree. Providers (OpenAI, Supabase, GitHub, hosted CI)
need the owner's explicit say-so every time.

**All five contributing branches read zero unfolded** as of the tip above:
`claude/ward-builder-community-route`, `claude/ward-builder-three`, `claude/ward-builder-two`,
`build/ward-space-ladder-2026-09-05`, `ci/ward-journeys-inert-by-default`.

## 2. THE ONE DELIBERATE RED. Do not "fix" it by deleting tests.

`tests/ward-mode-workspace-reachability.test.ts` — **left red on purpose. It is the only expected
red in the suite.** Any other red is a real failure, including any second red inside this same file.

### What it is red about

**Seven test files render `WardModeWorkspace` modes that no route reaches any more**, because four
merges moved those screens out from under them. They pass forever, describing screens no coordinator
can open.

    capacity     ward-bed-release.dom.test.tsx              -> CapacityScreen
                 ward-capacity-freshness-source.dom.test.tsx
                 ward-capacity-sexmix-release.dom.test.tsx
                 ward-capacity-view.dom.test.tsx
    movements    ward-flow-clock-consistency.dom.test.tsx   -> MovementsScreen
    queue        ward-flow-queue-selection.dom.test.tsx     -> DelaysScreen
                 ward-pull-vocabulary.dom.test.tsx
    exceptions   ward-pull-vocabulary.dom.test.tsx          -> DelaysScreen

⚠️ **THE LIST GREW AFTER THIS DOCUMENT WAS FIRST WRITTEN, AND THAT IS THE GUARD WORKING RATHER THAN
DRIFTING.** It said five files and two modes. **MERGE 01 then folded the priority queue, the
exceptions inbox and the escalation board into `DelaysScreen`** and turned
`/mockups/ward-flow/queue` and `/mockups/ward-flow/exceptions` into redirects — so two more modes
became unreachable and the guard picked them up with no edit. **Do not trust a file count in prose
over the guard's own failure message; run it and read the list it prints.**

### The exact condition that makes it legitimately green

The guard scans `src/` and `tests/` for `WardModeWorkspace mode="…"` and fails on any mode that
appears in `tests/` and not in `src/`. **It goes green when, for every mode rendered anywhere under
`tests/`, some file under `src/` renders that same mode** — nothing weaker.

In practice there are exactly two honest ways to satisfy it, per file:

1. **Re-point the render at the replacement screen** in the table above — `<CapacityScreen />`,
   `<MovementsScreen />` or `<DelaysScreen />` in place of `<WardModeWorkspace mode="…" />` — and
   carry the assertions across, adjusting them to the new screen's structure.
2. **Retire the test deliberately**, because the clinical property it asserts no longer applies to
   anything a coordinator can see.

Today `src/` renders only two modes — `governance` and `network`, from their own route files. So a
third way exists on paper (give the orphaned modes routes again) and **is not what anyone should
do**: those modes were merged away on purpose, with the owner's approval.

⚠️ **A GREEN FROM DELETING THE FILES IS THE FAILURE MODE, NOT THE FIX.** Deleting drops the clinical
question silently and the guard cannot tell the two apart — both make a mode stop appearing under
`tests/`. Four of these seven assert clinical properties: that a capacity figure says who confirmed
it; that a note fires when a ward's occupancy and recorded sex mix disagree; that a lapsed bed
reservation is called a pull and never a hold. **Each needs a decision, not a deletion.**

### 🔴 THE GATE THAT STOPS TESTS VANISHING CANNOT SEE THIS ONE VANISH

Found by Ward Builder One and re-measured here before being written down, because it decides how the
next chat should close this out.

`check:diff-integrity` exists to stop tests being deleted quietly. Its config today:

    maxRemovedFraction        0.25        perFileMaxRemovedFraction   0.5
    minRemovedCases           3           perFileMinRemovedCases      3
    approvedReductions        []          (empty)

And `scripts/check-diff-integrity.mjs` says in terms: _"Deleted files are exempt here and answer to
the aggregate."_ So a whole deleted file skips the per-file floor and must clear the aggregate one —
which needs the loss to exceed **both** a quarter of the changed-file case total **and** three cases.

⚠️ **`tests/ward-mode-workspace-reachability.test.ts` CONTAINS EXACTLY TWO `it(...)` CASES.** Two is
below `minRemovedCases` of three. **Deleting the guard that reports these seven files therefore
cannot trip `check:diff-integrity` at all, whatever else is in the same diff.** The cheapest thing in
this repository to make disappear is the thing holding the list of what still needs answering, and
the gate built to prevent exactly that is structurally blind to it.

**Deleting one of the seven flagged files is only caught if the rest of the diff is small.**
`ward-pull-vocabulary.dom.test.tsx` has 16 cases, which clears the three-case floor — but it must
also exceed a quarter of the changed-file total, so bundling the deletion into a large legitimate
change hides it. That is not a contrived scenario: it is what an ordinary _"re-point the tests and
tidy up"_ commit looks like.

**So each of the two honest routes gets a receipt, and the third leaves a mark:**

1. **Re-pointing** shows up as changed cases in a file that still exists — visible in the diff.
2. **Deliberate retirement** is recorded as an `approvedReductions` entry in `diff-integrity.json`,
   which the script validates for `path`, integer `before`/`after`, a reason of at least twelve
   characters, and an `approvedOn` date. **That array is empty today.** A retirement that leaves no
   entry in it is indistinguishable from a deletion nobody noticed.

### It has now earned itself twice, and the second time was a live hole

The first time, checking rather than re-pointing found a fold that had dropped who confirmed each
capacity figure.

**The second time is worth reading before anyone judges this red to be bookkeeping.**
`ward-pull-vocabulary.dom.test.tsx` pins the ward vocabulary rule — _a lapsed bed reservation is a
**pull**, never a **hold**_ — against `<WardModeWorkspace mode="exceptions" />`. MERGE 01 moved that
inbox into `DelaysScreen`. **Measured 2026-09-05: `ward-delays-screen.dom.test.tsx` asserted nothing
whatever about pull-or-hold wording.** The live label reads `"Bed pull expired"` because the copy was
carried across, not because anything defended it — renaming it to _"Bed hold expired"_ on the screen a
coordinator actually reads would have left **every test in the repository green.**

Closed in `43c56d6c5`, which carries the pin across to `DelaysScreen`. Control run, not asserted:
mutating the live title fails exactly that one test by name, 13 others in the file untouched, source
hash `569a60ef` before and `569a60ef` after. **The other six files have not had this treatment — the
red is still pointing at six unanswered questions of the same shape.**

### One vocabulary question this surfaced, for the owner

The same catalogue entry carries the note _"the hold lapsed before the bed was used"_. That is honest
copy about a **bed reservation**, not about detaining a person, so the new pin deliberately does not
ban the word outright — a blanket ban would go red on truthful copy and the tempting repair would be
to weaken the guard. **Whether that note should say "pull" too is a wording decision, not a defect.**

### THE DEBT DID NOT GROW. The guard's own commit message understated it from the start.

Ward Verifier raised this and it was the right thing to settle before touching anything: the guard's
commit says _"five test files now guard two screens no user can reach"_, and the same unchanged guard
reports **seven files across four modes**. If modes were being retired faster than their tests were
re-pointed, that would matter more than the backlog. **They are not.** Measured:

    MERGE 01   e31c9c462   2026-09-05 16:17:06 +0800   queue/exceptions become redirects
    the guard  e54a58526   2026-09-05 18:31:44 +0800   landed two hours later
    ancestry   MERGE 01 is a strict ancestor of the guard commit

At the guard's own commit, `ward-flow-queue-selection.dom.test.tsx` already rendered `mode="queue"`
and `src/app/mockups/ward-flow/queue/page.tsx` was already a redirect. **So the guard was already
reporting more than its message claimed, on the day it was written.**

⚠️ **The message was prose describing a guard's output, written without running the guard — the same
defect as this section's own stale "five files across two modes", found the same day by the same
means.** Two independent instances in one document. **Read the guard's printed list. Never a count in
prose, including the count in the commit that created it.**

### ⚠️ THE TWO "EXPECTED FAIL" RESULTS, because a number in a status line is not a record

Raised by Ward Builder One, who was right that documenting the red while leaving these two as a bare
count is inconsistent. A full run reports **1 failed, 2 expected fail** — three different objects, and
the next chat meets all three at once.

**There are exactly two, in exactly two files** — `grep -cE "^\s+(it|test)\.fails\(" tests/ward-*`
confirms no third is hiding, and that is checkable in one command by whoever reads this.

⚠️ **THE POPULATION IS 265 FILES, AND TWO CHATS DISAGREED BY 15 BEFORE ANYONE CHECKED THE UNIT.**
Ward Verifier measured 263 and could not reproduce my 278; neither figure was wrong, and both were
honest measurements of **different units**. Discover it as the union of the `ward-*` glob and files
**IMPORTING** ward code:

    { git ls-files 'tests/ward-*'; \
      grep -rlE 'from "[^"]*ward-(management|flow)' tests --include=*.ts --include=*.tsx; } \
      | grep -v "^tests/ui-" | grep -E "\.(test|spec)\.tsx?$" | sort -u

The glob alone gives 263 and **misses two files that exercise ward code without carrying the name** —
`pressure-strip.dom` and `tracker-derivations`. That is why the union exists: a glob is a
name-matching detector. But my first union matched any textual **mention** of "ward-flow", which
swept in 13 files that only name it in a comment and inflated the figure to 278 / 3553.
**IMPORT, not mention. Union, not glob.** Neither half is optional and the loose half was mine.

⚠️ **THEY ARE REPORTED SEPARATELY BY VITEST AND ARE NOT INSIDE THE PASSING COUNT.** A full run reads
`1 failed | 3310 passed | 2 expected fail (3313)` — the three numbers sum to the total, so the two
are their own category. **A status line that stops itemising them looks identical to one where they
disappeared**, so any figure quoted anywhere should carry all three or none.

Both are `it.fails` tripwires. Neither is a defect; both are pins on work that is deliberately
unbuilt:

    tests/ward-flow-reducer.test.ts:812
      "deletes the pulled admission and clears movement.admissionId when a pulled bed's
       examination is revoked"
      -> the assertion is the CORRECT post-condition; the reducer does not do it yet.

    tests/ward-movement-fixture-reducer-reachable.test.ts:130
      "every one of them carries an admissionId resolving to a wardAdmissions record with
       state pulled — NOT YET TRUE (5b unimplemented, ward-admissions-seed.ts out of scope)"

**What makes each legitimately green, and it is NOT the same answer for both:** when the behaviour is
built, the tripwire starts passing, and a passing `it.fails` is reported as a FAILURE. So green here
means _go and delete the tripwire, replacing it with an ordinary `it`_ — not _leave it alone_.

🔴 **AND THE HAZARD THAT MAKES THEM WORTH FOUR LINES RATHER THAN A COUNT: `it.fails` passes when its
body throws for ANY reason.** A typo, a renamed field, a dispatch the reducer rejects for an entirely
unrelated cause — all of them keep it green and reporting "expected fail" long after the thing it
pins has been fixed or has rotted. **This codebase has already recorded one case where both halves of
an `it.fails` tripwire went false and it stayed green** (see `ward-community-corrected-claims.test.ts`
and the control at `ward-flow-reducer.test.ts:758`, which exists precisely because the tripwire cannot
provide it for itself). **Neither of the two above should be trusted without running its control.**

### This is NOT Ward Verifier's inert CI flag — they are unrelated

Ward Verifier's `vars.WARD_JOURNEYS_BLOCKING` is a **separate matter with nothing in common but the
word "expected"**. It is a repository variable that is unset, which makes the seven browser journeys
non-blocking in CI; it becomes live only when the owner sets it after seeing those journeys green
once, and it can only take effect on `main`. **It produces no red locally and no failing assertion
anywhere.** A red you can run and a flag you cannot are different objects, and conflating them would
let a real failure hide behind "that one's expected".

## 3. Outstanding work, with owners

| Item                                                                                                                  | Owner                                                                                                  | Note                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Eight ward test files never reviewed — 65 pinned sentences, **20 of them negative**, `expectNeverSaysAgain` unused    | Ward Verifier's list, in `docs/ward-flow/archive/dated-notes/redesign-brittleness-audit-2026-09-05.md` | **The most valuable item here, because it records what was NOT done.** The 20 negatives fail in the silent direction |
| Five statistics screen rebuilds                                                                                       | not started, deliberately                                                                              | plan + traps in `docs/ward-flow/statistics-primitive-reconciliation.md`                                              |
| `WardFigure` gains `tone`/`delta` **and** the flagged ceiling moves, in the same commit                               | —                                                                                                      | see §5                                                                                                               |
| Two chip vocabularies, one renderer underneath                                                                        | —                                                                                                      | so the wordless-child throw is inherited, not re-derived                                                             |
| `ward-bar.module.css` has no `forced-colors` and no `@media print`, with 11 background declarations                   | —                                                                                                      | ⚠️ **do not quote a ratio**; four figures were produced and all four differed. Re-measure and state the walk         |
| `TransportLeg` — two types, one name, four states vs five                                                             | Ward Lead ruling: collapse to the five-state union                                                     | flagged in the file                                                                                                  |
| Six unreachable `WardModeWorkspace` branches; the `WardMode` union; the Delays nav entry still carrying `id: "queue"` | E9 dead-code                                                                                           | `command` is UNKNOWN, not zero — do not count it                                                                     |
| `/not tracked/i` wording pin in `ward-capacity-screen.dom.test.tsx`                                                   | Ward Builder Two, diagnosed                                                                            | property right, literal phrase wrong                                                                                 |
| The sex-mix integrity signal                                                                                          | Ward Lead                                                                                              | ruling in §5                                                                                                         |
| About 26 of ~30 ward screens never opened since the white ground landed                                               | —                                                                                                      | one that leaned on the old tint will look flat                                                                       |

### BACKLOG — the deletion gate's blind spot: a proposal with a cost, NOT a decision made

**Not implemented. It needs the owner, because it changes a repository-wide gate and its obvious fix
has a price the proposal did not name.** Recorded here naming the specific file, because _"the
deletion gate has a floor"_ is a fact somebody will read as safe.

**The gap, verified by reading both rules rather than the summary:**

    scripts/check-diff-integrity.mjs
      per-file   "A deleted file (exists: false) never fails here — judged by the aggregate"
      aggregate  if (removed < config.minRemovedCases) return { ok: true }
    diff-integrity.json      minRemovedCases 3     approvedReductions []
    the guard in question    exactly 2 it(...) cases

**Two below three, so the aggregate returns OK before it computes a fraction, and the per-file rule
exempted the file already. Both doors closed by construction.** And the gate exists precisely because
tests were once silently deleted (`#Y30AXB`) — its own header records that the deletion reaching
`main` was stopped by an unrelated merge conflict, _"luck, not a gate."_

**Ward Builder Two's proposal:** judge a deleted test file **categorically** — any deleted test file
that had cases requires an `approvedReductions` entry, whatever the counts. It does not touch
`minRemovedCases`, which is right: lowering that would make the gate noisy enough to be turned off.

⚠️ **THE COST THE PROPOSAL DID NOT PRICE, AND IT IS THE REASON THIS IS NOT DONE.** The per-file
exemption is not an oversight — the script states its rationale: _"so that deleting a spec while
adding its replacement in the same commit is not treated as lost coverage."_ **Renaming or moving a
spec is exactly that shape, it is common, and under the proposal every one of them would need an
approval entry.** That is the same noise argument the proposal correctly makes against lowering
`minRemovedCases`, arriving at its own recommendation from the side.

**A narrower form probably threads it** — require the entry only when a deleted test file's cases do
not reappear elsewhere in the same diff — but that is a real piece of design, not two lines, and it
is a repository-wide gate rather than a Ward Flow one.

**Whoever takes it: `approvedReductions` is empty today, so it is provable immediately.** Add the
rule, delete `tests/ward-mode-workspace-reachability.test.ts` in a scratch diff, and **watch it go
red.** If it stays green the rule did not land — and on this gate that is worth watching rather than
assuming.

## 4. 🔴 FOUR GUARDS WILL FIRE WHEN THE OWNER REPLACES THE TEAM DATA. They are the system working.

He has said he will. **Full detail is pre-registered at the top of
`tests/ward-community-ratified-aliases.test.ts`.** In short:

1. **`ratifiedDecisionsOnMovedFigures()` is SUPPOSED to fire.** ⚠️ **Do not update `shownCounts` to
   make it green.** The owner signed a ruling about 21 suburbs under four specific spellings; if
   those move, his ruling has stopped being about what was in front of him. **Take it back to him.**
2. `ratifiedAliasesWithNoSuchTeam()` — retire the entry with a note; do not delete the guard.
3. `RECORDED_COLLISIONS` (10 families / 24 names) will be wholly wrong. ⚠️ **Re-derive BY HAND.
   Never paste the module's output** — that recreates the tautology it exists to replace.
4. Ward Builder Three's independent implementation — re-run both and take the **symmetric difference
   BY NAME**. That comparison found both of 2026-09-05's real bugs; two agreeing counts found neither.

## 5. Owner decisions of 2026-09-05, with the question that produced each

**Quote the question when relaying a ruling.** The same decision asked two ways gets two honest
answers, and this project has been caught by it.

- **Ready beds.** _"Some beds counted as Ready are still being cleaned and the system refuses to
  admit into them — how should the screen handle it?"_ → **show the cleaning count beside the
  figure; do not change the number.** Built against `bedsPendingPreparation`, the reducer's own
  helper, so the screen and the refusal cannot disagree.
- **Inner City.** _Shown all four spellings with suburb counts, and told plainly that merging ICC
  pulls in plain `Inner City` — 16 suburbs he had not been asked about._ → **all four are one
  service, 21 suburbs.** Held as an owner-confirmed synonym GROUP (not pairs — pairs smuggle the
  transitivity back in), attributed and dated, kept separate from the three string relations, with
  raw values untouched and referrals still findable under any spelling.
- **Scratch files / `.next`** — approved by name, per file. An approval for two named files does not
  stretch to a third.
- **Browser tests** — keep them, do not run them. Now behind `vars.WARD_JOURNEYS_BLOCKING`,
  inert until deliberately enabled.
- **White ward ground** — asked for three times; done in the one shared token.

**Rulings I made that are not yet built:**

- **Sex-mix signal.** Carry the SIGNAL, not the data. `RELEASE_BED` raises `allocatable` and `empty`
  together (`ward-flow-reducer.ts:1703`), and `allocatable` is what `ready` reads — so a ward whose
  mix disagrees with occupancy is mid-update and `ready` has just moved. Sentence: _"this ward's bed
  records are mid-update — this figure may not be settled."_ Renders only when true; guard over the
  property with a fixture each way; preserve the direction check.
- **`WardFigureStrip` ceiling.** It throws above two `flagged` tiles. **A new `tone` prop routes
  straight around that count** — the constraint stays in the file, stays green, stops being true.
  Both changes together or neither. **Control: classify every member of the tone union in ONE place
  so a new tone fails to COMPILE**; failing that, enumerate the union at runtime and floor on its
  size, then add a tone without classifying it and require red.

## 6. ⚠️ Instruments that lied to us. All of them fail toward ABSENCE or false success.

    git rev-parse <ref>:<path>        prints its argument back instead of failing
    git show <ref>:<path>             MSYS mangles the colon into a Windows path; reports "missing"
    git merge-base --is-ancestor      same answer for "not folded" and "not in my object store"
    node -e '...'                     the shell eats \b, \n, \t; a mutation never runs and reports
                                      the UNMUTATED result as a pass
    gate-receipts cache               reuses a prior pass; use GATE_RECEIPTS=refresh for anything
                                      you will quote in a commit

**Use `git ls-tree` + `git cat-file blob`. Check the object exists before calling something
unfolded. Write probes to a FILE and hash the subject either side.**

**And re-read a branch tip inside the same command as the action.** Four tips went stale under a
measurement of mine within minutes; three chats made the mirror-image error. A SHA in a message is a
claim with a timestamp.

## 7. The night's actual finding, and it is not any single bug

**Every serious defect found was invisible to the thing that should have caught it, and visible to a
second, independent look.**

- The whitespace fold and the four-way Armadale split — found by an independent implementation, not
  by the biconditional that is structurally blind to them.
- A prototype's self-contradiction — found by an agent whose brief could not act on it.
- Duplicated primitives — found by the agent that built them, reporting rather than burying.
- Albany unclickable, and a name rendering as a one-character column at 390px — **green in every
  suite, found by opening the page.**
- A tint justified in the token layer as providing separation, measured at 1.08:1.

> **A correctly-scoped brief produces a correctly-scoped omission, and nothing inside the brief can
> see it.**

**So: every brief should name the thing the work could silently duplicate or contradict, and require
a REPORT rather than a decision when it does.** For UI work that means naming the primitives
directory and saying _"compose what exists; if what exists is weaker, say so and stop."_

## 8. Standing test policy — the owner made this binding

> _"Please can you ensure that all testing works with the redesigns rather than fighting them since
> i am going to redesign many pages."_

    GUARD THE CLAIM AND THE CLINICAL PROPERTY. NEVER THE RENDERING.

**A guard that goes red on a legitimate redesign gets deleted — and the honest guards go with it in
the same tidy-up.** The test for whether a guard is a fighter is a control, not a judgement: **mutate
the subject to state the SAME FACT differently and require the guard to SURVIVE.**

⚠️ **And the two failure modes found today when acting on that rule:**

- **A guard broader than its own stated rationale forbids the correct fix.** The index's numeral
  guard forbade every digit; its own message was about a count labelled as _services_.
- 🔴 **A narrowing can go GREEN on the very defect the guard exists for.** Mine required a numeral
  and a service noun in the same element; the page puts them in a button and a nested span, so the
  predicate could never match. **It would have shipped — page green, noun honest — had the mutation
  not been run.** Always re-run the original defect after narrowing anything.
