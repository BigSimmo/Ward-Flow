# A1 audit — 2026-11-02 — run-through, simulation, and (after pivot) code review

**Checkout:** `BigSimmo/Ward-Flow` @ `af8ed800f` (branch `fix/audit-remaining-authority-checks`), 24 dirty entries in the working tree, untouched throughout. Server: `npm run ensure` → `http://localhost:4467`, identity verified via `/api/local-project-id` (`clinical-kb:5862bad73b4c`).

**Scope change (owner, mid-run):** the browser and simulator passes were dropped on Josh's instruction ("avoid all the browser use and just review the actual code"). Everything already gathered was kept, and the remainder became a code-level review. Subagent dispatch was attempted twice for parallel review and refused by the host ("user concurrency limit exceeded"); the work continued solo.

---

## 1. What ran before the pivot (evidence kept)

### 1.1 Lean route sweep — complete but infrastructure-terminally-flawed

`lean-sweep.mjs` (this directory) swept 54 routes × 3 combos (desktop-light, phone-light 390×844, desktop-dark) = **162 loads, all completed** into `lean-sweep-results.json`. Screenshots on failure in `lean-sweep-shots/`.

**158 of 162 loads are flagged, but the flags are infrastructure, not the app**: sequential `page.goto` timeouts and `ERR_CONNECTION_REFUSED`/`RESET` from the dev server dying under first-compile load. The **dev server died twice** during this audit (once mid-way through the repo's own `audit-all-screens-visual.mjs` run, once at the end of this sweep); both times the log ends mid-compile with no error (`dev-server.log`, 27 900 lines). Box had ~9.4 GB free of 32 GB at the second death.

**Genuine signal extracted from the sweep (2 findings):**

- One real console warning on `/ward-flow/bed-meeting`: React "Can't perform a state update on a component that hasn't mounted yet" — see §2.3.
- The repo's own 34-screen auditor (`audit-all-screens-visual.mjs`) completed only 2 screens before the first server death; its summary (`.audit-reports/screen-audit-summary.json`) shows 186 connection-refused/reset entries and **zero real rendering defects** — recorded as an incident, not app evidence.

### 1.2 Manual desktop observation (before tools were withdrawn)

Coordinator home (`/ward-flow`) rendered correctly in local synthetic mode: figures from state (85.2% modelled occupancy gauge, per-ED tiles, Act Now queue, beds-that-fit), "Synthetic" pill and Demo controls present, zero console errors. Screenshot taken (transcript only — the MCP tool refused all disk paths outside its workspace roots; both `audit-evidence/` and the visualization directory were rejected).

### 1.3 Not run (dropped with the browser pivot, or blocked)

- Phone emulation pass, Android emulator walk (emulator `wf_qa_pixel` was booted and reached the app over `10.0.2.2:4467` but never completed a page load before saturation; it has since exited), iOS simulator (unavailable on Windows — plugin requires macOS/Xcode; recorded as **unavailable evidence**, not skipped).
- Playwright suites (`test:e2e:pr`, `test:e2e:release-gate`, ward journeys) — not started; they reuse the dev server that died twice.
- Role/desk matrix (`role-matrix.mjs`, written, not run — browser use dropped).

---

## 2. Code review findings (the post-pivot audit)

### 2.1 Working-tree diff review — `sign-out-check.mjs` (+185) and `.githooks/pre-commit` (+14/−8)

**Verdict: sound.** Details:

- New `--historical-path-ack <file> --sha256 <checksum>` admission path for historical clashes on `.githooks/pre-commit` across exactly 20 named backup/codex/ward refs. Validation is defence-in-depth: record schema checks, SHA-256 pins of record + working hook + guard/parser sources, git patch-id evidence per historical commit, bounded merge evidence (≤6), and re-verification (`verifyAcknowledgementStillCurrent`) at three points to close TOCTOU windows. Fails closed on every mismatch.
- Hard interlock: the ack cannot be combined with an active takeover of the hook path (`sign-out-check.mjs:192-196`).
- The in-code comment is honest that a checksum "is not proof of approval"; `approvalReference` is free text the script cannot verify — acceptance rests on owner authority, which matches the design intent.
- New import `isCanonicalWardFlowRemote` resolves (exported from `scripts/pre-commit-checks.mjs:306`); `LINE`/`standaloneWardFlow` defined in-file.
- Pre-commit change is a pure reorder: `working_files` (untracked+unstaged enumeration) now computed only for the legacy fallback (definition at line 152, all uses at 161/164/168 after it). Saves an untracked-file scan per staged commit; no behavioural change found.

### 2.2 Disclaimer-marker removals across 8 screens — one gap, one stale comment, one question

The diff removes per-hero "Prototype data, invented records"/"synthetic data" markers (mostly phone heroes) from coordinator, delays, ED index, movements, on-call, downtime pack, weekly report, community index, and updates `tests/ward-command-third-edition.dom.test.tsx` to match.

**Paper trail found:** `mockup-backup-2026-11-01/x/5b-rest-and-HANDOVER/build/lane-n/plan-oncall-community-team.md` §A11 Q-A1 records the removal as owner-approved-as-drawn, on the condition that "the foot line keeps the disclaimer word for word", with the instruction to "call it out in the PR for Josh".

- **P2 — delays-board has no foot line at all.** `WardPrototypeFooter` is mounted per-screen (35 screens opt in; it is not in the shell or `src/app/`). Every changed screen mounts it **except `delays-board.tsx`**, which now contains **zero** disclosure words anywhere in the file (verified by grep). Its phone hero line was its only in-page disclaimer, so Q-A1's condition is unmet for Delays specifically. It still has the app-level markers (top-bar pill, `ward-management-modes.tsx:194` "Synthetic prototype · not approved for clinical use"), but those are not the "foot line word for word" the approval relied on. Suggest: mount `WardPrototypeFooter` on delays (one-line change, matches the other 35 screens) or get an explicit owner ok.
- **P3 — stale comment:** `downtime-pack-screen.tsx:663-665` still says "the synthetic marker, as the desktop eyebrow carries it" — the eyebrow no longer carries it after this diff.
- **P3 — question:** `community-index.tsx` removes `titleMeta="Recorded names, not verified services"` (phone). That is a data-quality caveat, not a synthetic marker; Q-A1's scope line names on-call/coordinator/movements/delays/downtime, not community. Confirm it was approved.

### 2.3 `/ward-flow/bed-meeting` React warning — localised as far as code reading allows

The warning ("state update on a component that hasn't mounted yet… side-effect in render") fired on this route only. Every named suspect was read and is clean: `tv-lock.tsx` (setters only in handlers/effects), `tv-lock-guard.tsx` (correct `useSyncExternalStore` + effect-driven redirect), `bed-meeting-tv.tsx` custom hooks (`useFullscreen`, `useOnView`, `useScreenWakeLock` — all effect-scoped), `use-forecast-model.ts` (documented StrictMode-safe cleanup), `ward-service-store.ts`, `ward-feature-flag-store.ts`, `useSharedRefreshLate` (`wf/live.tsx:93` — external store). **P3, parked:** localising the remaining source needs one browser run with the component stack (the truncated console text loses it). Dev-mode-only symptom; no correctness risk identified from the code.

### 2.4 Event quadruple check — PASS

Across the composed union (main file + family files): **154 domain event types** (+3 internal provider/dispatch actions: `ADOPT_SAVED_SESSION`, `LOAD_SCENARIO_FILE_INTERNAL`, `WARD_FLOW_DISPATCH`, consistently absent from all domain legs).

- EVENT_ROLE (`ward-flow-event-roles.ts`, 163 keys incl. formatting): **no event missing**.
- Reducer cases across reducer + slices + family files: **no event missing**.
- Persistence classification: **no domain event missing** (the 3 internals absent, as expected for non-domain machinery).
- Permissions leg pinned by `tests/ward-role-permissions.test.ts` (11 `EVENT_ROLE` references). No `ward-event-persistence.test.ts` by that name; persistence enforcement appears type-level in `ward-flow-persistence-classification.ts` (generic constraints) — noted as observation, not a gap claim.

### 2.5 Authority model (spot check, code-level)

One positive containment verified in source: the role-switcher zeroes the referred-ward count off coordinator routes so the count cannot leak via `data-referred-ward-count` or the label (`ward-role-switcher.tsx:140-146`, owner answer 38). Deeper authority review overlaps the branch's own topic (commit `1e7652e2f`) and A2 of the prompt pack; not duplicated here.

---

## 3. Evidence classification

- **Fresh:** the diff review, quadruple check, disclosure greps, sweep JSON (162 loads), server-incident logs.
- **Reused:** repo's own auditor summary (incident evidence only), lane-n plan document (for Q-A1 provenance).
- **Skipped:** Playwright suites, lean-sweep re-run on a quiet server (browser use dropped by owner).
- **Unavailable:** iOS simulator (Windows), Android emulator completion (device exited), role-matrix run, screenshots on disk (MCP path restrictions).

## 4. Questions for Josh (each with a recommendation)

1. **Delays foot line (P2):** mount `WardPrototypeFooter` on `delays-board.tsx`? **Recommend yes** — one line, restores the Q-A1 condition, matches the other 35 screens.
2. **Community `titleMeta` removal:** was dropping "Recorded names, not verified services" approved? **Recommend confirming against lane B of the same plan, or restoring it** — it is a different kind of caveat than the synthetic markers.
3. **Dev-server stability:** two unlogged deaths under first-compile load today. **Recommend a standalone reproduction attempt later** (fresh server + the 34-screen auditor alone); not part of this audit's scope.
4. **Bed-meeting React warning (P3):** allow one short browser session (when browser work resumes) to capture the component stack? **Recommend yes** — reading has narrowed it; one run would finish it.
