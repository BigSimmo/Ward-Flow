---
name: lighthouse-mobile-root-cls-flake
description: The Lighthouse budget CI gate flakes bimodally on mobile-root CLS (0.236 vs 0.013 baseline) and can block an unrelated PR — rerun the job before believing it
metadata:
  node_type: memory
  type: project
  originSessionId: 3b6b32c4-e01e-4cf3-8abe-b4c0c5ca2f14
  modified: 2026-08-17T12:09:16.982Z
---

`check:lighthouse-budget` in CI reports `mobile-root cls +0.223 vs baseline (max +0.02)` intermittently. Measured 2026-08-17 on PR #2022 (a server-only RAG diff with zero UI files): 0.236 / 0.236 / 0.013 across three samples of the same merge ref. The two failures were identical to three decimals, so the shift is quantized, not noisy — it either happens or it does not.

Controls run the same hour: PR #2028's merge ref measured 0.013, and PR #2026 (which _did_ touch `ClinicalDashboard`, `ClinicalSidebar` and `globals.css`) passed its own pre-merge Lighthouse. So `main` was clean and the block was flake.

Mechanism is almost certainly the phone overlay chrome reserve race that `/issues` `#147` claims RESOLVED — that row records mobile `/` at exactly 0.013, the same baseline value, and describes the reserve round trip that produces one large shift when it fires.

**Why:** the gate feeds the `PR required` aggregate, so a flake presents as a hard merge block on a PR that cannot have caused it, and the obvious-but-wrong response is to hunt the diff or raise the budget.

**How to apply:** when `Lighthouse budget` fails, first check whether the PR's diff can even reach the client bundle (grep the changed modules for imports from client components). If it cannot, rerun that single job — `gh run rerun --job <id>` — and compare against a same-hour control PR before treating it as real. Never raise the CLS budget to clear it. `#147` looks due for a reopen; the flake is not captured in `/issues` yet.

**2026-08-21 update — a rerun does not always clear it.** On PR #2226 (three unreferenced
functions deleted from `src/lib/specifiers-content.ts` plus two docs files — nothing reaching the
client bundle) the gate passed once at head `569c8fe11`, then failed twice on head `571ed200c`
whose only delta was a ledger markdown file. Both failures reported `mobile-root cls 0.223` against
baseline `0.016`, identical to three decimals, and the second escalated to `3/3 samples breached`.

So the quantized bad mode can persist across consecutive reruns on the same head. Treat "rerun the
job" as the first attempt, not the remedy: if two reruns both land in the bad mode with the same
value, stop rerunning, state plainly that the gate is red for a reason unrelated to the diff, and
leave the merge decision to the user. Do not raise the CLS budget, and do not start hunting a diff
that cannot reach client JavaScript.

**Same day, the remedy that worked: sync the branch, don't rerun the job.** PR #2226 was 53
commits behind. After merging current `main` in (the user did it via GitHub's Update branch
button), `Lighthouse budget` passed in 5m37s on the very next run with no change to any
client-reachable code — the branch delta was still exactly 9 deleted lines in
`src/lib/specifiers-content.ts` plus two docs files.

So the ordering is: **sync a behind branch onto current `main` first, and only rerun the job if
it still fails.** Two same-head reruns both landed in the bad mode while a fresh run on an updated
base landed in the good one, which suggests the bad mode is tied to the base the measurement runs
against rather than to the sample. Do not raise the CLS budget, and note that a green `main` CI run
proves nothing here: `Lighthouse budget` is path-scoped and is skipped on `main` pushes entirely.

## Second observed cell, 2026-09-01 (PR #2498)

`desktop-documents-search` **tbtMs** is bimodal too: the SAME commit measured **327 ms** (failing,
"confirmed regression; 2/3 samples breached") and then **4 ms** on a plain re-run, against a 7 ms
baseline. So the flake is not confined to mobile-root CLS, and "2/3 samples breached" does NOT mean
a real regression — the confirmation sampling can land in the slow mode repeatedly.

A tempting wrong reading, which I published before re-running: that the 7 ms desktop baseline was
unrepresentative because mobile measured ~330 ms for the same page. The re-run's 4 ms shows 7 ms is
perfectly representative of the fast mode; desktop and mobile genuinely differ. **Re-run first, then
theorise** — the second sample was free and settled it.
