---
name: interleaving-fingerprint-needs-newlines
description: "A regex hunting PDF column-interleaving with [^\\n] can never match, because interleaved fragments land on separate lines; measured 2026-09-17 on the live corpus"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7ffe825e-f7a6-4e6b-a414-472027b6ac70
  modified: 2026-09-17T05:40:57.139Z
---

The cloud handover's "fingerprint A" (`stop…[^\n]{0,40}…WBC <`) returned ZERO documents on the live corpus, including the RKPG clozapine guideline whose page-16 chunk visibly reads "Stop clozapine. Contact WBC < 1.5" once whitespace is collapsed. The spliced fragments are separated by newlines in the stored text, so `[^\n]` blocks exactly the case it hunts. `[\s\S]{0,40}` found it (1 doc). Fingerprint B (bare % between lowercase words) flagged 787 of 2,851 docs — almost all ordinary prose, useless as a worklist.

**Why:** a zero-hit scan was about to be reported as "no clozapine damage found". See [[checks-that-cannot-fail]].

**How to apply:** before trusting a zero from a text-shape regex, run it against one known-bad record first. For re-read scope, count PDFs with `document_images.source_kind='table_crop'` (1,915 of 2,065 on 2026-09-17) rather than regex fingerprints. Re-reads reuse `image_caption_cache` by image hash, so cost is mostly embeddings.

**Re-read traps measured 2026-09-17 (4-document trial):** all 2,851 corpus documents have `owner_id` null, so `request_ingestion_reindex_if_agent_idle` and both reindex API routes cannot queue them (the RPC raises on a null owner; the routes filter by owner). `src/lib/ingestion-enqueue.ts` handles null owners; the trial mirrored it in SQL. The worker's atomic swap for `indexed` documents worked and tables came back as clean rows. BUT finished jobs were reopened to `pending` (stage `indexed + enrichment backfill v3` / `enrichment deferred`, from the DB repair function near schema.sql:7255) and the worker re-read them in full again, attempts 1→2→3 — for `good` quality documents too. Do not bulk-queue until that loop is understood: it triples the work.
