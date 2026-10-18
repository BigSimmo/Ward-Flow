# Ward Flow Handover Implementation Plan

> **For agentic workers:** Use the installed `superpowers:executing-plans` skill to implement each package. The root agent coordinates bounded subagents, integrates their work in order, and requests an independent final review.

**Goal:** Complete the four remaining handover improvements without changing placement authority or silently weakening draft privacy.

**Architecture:** Reuse the reducer, discharge eligibility functions, last-look comparisons, referral drawer draft store and canonical Button. Add narrowly scoped state and adapters where the existing interfaces cannot express the requested behaviour. Keep product work separate from this review and plan.

**Tech stack:** TypeScript, React, Next.js, Vitest, Testing Library and CSS modules.

**Spec:** The user's 17 October 2026 five-task handover and subsequent request to assess it, remove resolved issues and prepare a plan using multiple subagents. This document records the retained requirements and corrections for execution.

## Global constraints

- 100% synthetic data only. Never use real patient identifiers or put typed form text in logs, URLs, screenshots or handovers.
- The system proposes; a human confirms or overrides. Nothing auto-allocates; timeouts never default a placement. Clinical overrides require a rationale.
- MHA destination authorisation applies to the receiving hospital. ED detention under Form 3A/3B remains a valid waiting location.
- Use focused `npx vitest run <exact-paths>` commands. Do not run a heavy whole-suite lock.
- Read AGENTS.md and the relevant code-map and check guidance. Use isolated task worktrees from verified Ward Flow main, one shared coordination log and exact file claims.
- Local checks use mocks and synthetic state. No hosted services, paid calls, CI, publication or deployment is implied by this plan. Follow the repository's separate authority and spending rules for any such run.
- Execution is authorised by the user's follow-up: update the plan, launch it now and autonomously fix all confirmed issues. Native implementation subagents are explicitly requested; no external paid/provider workflow is authorised.

## Assessment at aa3a78b9

| Original task                  | Disposition                                                         | Source evidence and correction                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hygiene and fast-forward    | Complete; remove from open work                                     | Initial checkout was clean on `work` at `23e2883a`, with no local main or remote-tracking main. Fetched the authorised Ward Flow remote and created tracking `main` at `aa3a78b9`. Both origin URLs identify BigSimmo/Ward-Flow. The tooling changes and result-reuse tests already landed in `5875823b` (#395). `6358371c` is an ancestor, not the current target.                                                 |
| 2. CLD turnaround priority     | Retain, correct design                                              | The inert control is now `referrals/referral-match-tiers.tsx:244`, called by `referral-match.tsx`. No `FLAG_MOVEMENT_TURNAROUND_PRIORITY` event exists. The two-argument helper cannot evaluate current expiry or patient/movement legal eligibility. A pre-acceptance referral may have no movement.                                                                                                               |
| 3. Ward/ED last-look deltas    | Retain, extend shared model                                         | Neither screen mounts `useSinceLastLook`. The coordinator hook uses one storage key and module-global pending leave timer. It compares record IDs, ready-bed counts, delays and escalations; it does not detect all status transitions or implement a rolling 15-minute window.                                                                                                                                     |
| 4. Refresh draft recovery      | Retain refresh gap; replace obsolete targets and privacy assumption | `referral-intake.tsx` does not exist. The live drawer uses `use-ward-referral-drawer-state.ts` and `referral-draft-store.ts`, with 800ms memory-only autosave and Keep draft. `useDirtyStateGuard` intentionally purges `wf-draft:` storage under D-18. The current request authorises designing a narrow synthetic-session draft exception, not disabling the general typed-state lock.                            |
| 5. Canonical placement buttons | Retain, narrow scope                                                | `candidate-card.tsx` does not exist. Live actions appear in referral match tiers/phone flows, coordinator shortlist and `ward/ward-home-tab.tsx`. Button already provides loading and disabled explanations. Its medium token is 36px, 44px for coarse pointers, with a 48px floor only below 48rem; tablet sizing still needs work. Do not migrate every raw button or accept the unsupported “260 classes” count. |

The assessment is static source review, not a reproduced runtime failure or deployment assessment. No tests were run for this planning task. No GitHub issues were deleted or closed; removal means exclusion from this plan's open work.

## Review focus

1. A CLD record can expire or become ineligible between render and click; the reducer must recheck and refuse stale requests.
2. Referral/ward/ED changes can share record IDs; status transitions must still count, while unrelated unit updates must not.
3. Reviewing one scope must not clear another scope or erase the evidence currently shown in the open sheet.
4. A debounced draft callback can fire after submit, reset or sign-out; session fencing must stop it recreating the draft.
5. A tablet can be wider than the phone breakpoint; actual placement buttons must retain 48px targets and accessible blocked reasons.

## Subagent allocation and integration order

The root remains coordinator and owns the integration worktree, shared documentation and receipts. Use five bounded workers and a fresh final reviewer. The user has approved execution. Independent packages may be prepared concurrently in separate worktrees; integrate in clinical priority order.

1. **Agent A — turnaround domain.** Own selectors, event/model/reducer changes, persistence classification and domain tests.
2. **Agent B — turnaround UI.** Start after A's interface is integrated. Own match tiers/parent wiring and coordinator queue badge. Do not edit placement styling in this package.
3. **Agent C — last-look.** Own shared last-look model/hook and Ward/ED header integration. Prepare independently alongside A; integrate after B.
4. **Agent D — drafts.** Own draft storage/guard, referral drawer and legal form wiring. Prepare independently alongside A; integrate after C. Coordinate any provider-file change before editing it.
5. **Agent E — placement controls.** Own canonical Button sizing and live placement controls. Start after D; this avoids shared-file conflicts with B and C.
6. **Fresh reviewer.** Review the integrated diff, clinical refusal paths, session/privacy boundaries and focused evidence. Root fixes reproducible findings and reruns only affected checks.

Do not give two agents concurrent ownership of a file. Each worker receives the baseline, exact claimed paths, interfaces, synthetic-only constraint and acceptance tests below. Create dependent worktrees from the integrated predecessor. A worker releases all claims before root integrates its changes. Record actual model/tool usage; do not promise pricing or unsupported spending caps. Existing installed dependencies may be shared from this same repository only; a package/lock mismatch must be reported rather than repaired through an unauthorised dependency upgrade. No gate bypasses.

## Package A: Safe turnaround preference state

**Files:** create `src/components/ward-management/ward-turnaround-priority.ts`; modify `ward-model.ts`, `ward-flow-events.ts`, `ward-flow-reducer.ts` and `ward-flow-persistence-classification.ts` in that same directory. Follow existing reducer delegation if a small dedicated handler is needed. Test `tests/ward-cld-turnaround-priority.test.ts` and extend `tests/ward-event-permissions.test.ts`.

**Interfaces:**

- `unitHasCldReadyDeparture(state: Pick<WardFlowState, "admissions" | "patients" | "movements">, unitId: string, now: Instant): boolean` in `ward-turnaround-priority.ts`.
- Reuse `admissionCriteriaEligibility` from `ward-discharge-records.ts` and `dischargeCriteriaStatus` from `ward-discharge-criteria.ts`; only an occupied admission with `all_met` qualifies. Respect the CLD feature flag at the calling domain boundary. Do not infer readiness from display labels.
- Turnaround preference: `{ unitId: string; flaggedAt: Instant; source: "cld" | "departure" }`, attached to its waiting referral or movement. This proposes priority only; it does not reserve a bed or book transport.
- `FLAG_MOVEMENT_TURNAROUND_PRIORITY` payload: `{ movementId: string; unitId: string; source?: "cld" | "departure" }` plus the normal role/time/event metadata. The optional source preserves what the device displayed and is independently revalidated.
- `FLAG_REFERRAL_TURNAROUND_PRIORITY` payload: `{ referralId: string; unitId: string; source?: "cld" | "departure" }` plus the normal metadata, for a referral without a movement. Never create a movement merely to flag priority. Preserve the preference through the existing referral-to-movement conversion.
- A second pure selector resolves the source from live CLD or a confirmed/departing, unreleased bed release. An expected date alone is insufficient. A departure source must not receive a CLD badge.
- Exhaustive integration includes `ward-flow-storage-validation.ts` (strict optional preference schema and existing unit reference), `ward-flow-referral-send-events.ts` (conversion), `ward-history.ts`, `ward-reanchor.ts` (flag timestamp), and local schemas in `backend/ward-flow/command-schemas.ts`. These are Agent A's additional owned paths with corresponding focused tests; no hosted backend call is required.

- [x] Write failing tests for eligible CLD, partial/empty/lapsed/paused criteria, involuntary/CTO/unknown status, wrong unit and departed admissions.
- [x] Add reducer tests for a pre-movement referral, an existing movement, confirmed departure, no qualifying departure, stale eligibility, closed referral/movement, duplicate clicks and invalid IDs. Assert that capacity, allocation, acceptance, urgency and transport booking remain unchanged.
- [x] Run `npx vitest run tests/ward-cld-turnaround-priority.test.ts tests/ward-event-permissions.test.ts`; confirm the new behaviour fails before implementation.
- [x] Implement selectors and preference events with coordinator authority, current-state validation and existing concurrency/refusal conventions. Register the event in every exhaustive event/permission/persistence registry used by the local and shared paths. Persist fixed IDs/enums/times only and validate restored preferences.
- [x] Re-run the focused tests. Inspect direct event consumers for exhaustive handling; run their exact focused tests where affected. Hand B the final payloads and selectors.
- [x] Commit named owned files after the required local admission checks. Root records the package evidence.

## Package B: Turnaround control and queue badge

**Files:** modify `referrals/referral-match-tiers.tsx`, `referrals/referral-match.tsx` and `coordinator/priority-queue.tsx`; add `tests/ward-cld-turnaround-priority.dom.test.tsx`. All source paths are under `src/components/ward-management/`.

**Consumes:** A's selectors and event payloads. **Produces:** enabled human-triggered priority control and a source-accurate queue badge.

- [x] Write failing DOM cases for qualified CLD, qualifying departure, blocked action with a readable reason and duplicate flag feedback. Assert an explicit click dispatches exactly one preference event and no placement/transport event.
- [x] Run `npx vitest run tests/ward-cld-turnaround-priority.dom.test.tsx` to establish the failing behaviour.
- [x] Replace the inert scheduling notice with actual eligibility and handler wiring. Use the referral event until a linked movement exists. Render “Turnaround Candidate: Bed clearing via Criteria-Led Discharge” only for a currently valid CLD source; label departures separately. Expired preferences must not continue to imply a clearing bed.
- [x] Run both turnaround test files. Preserve existing clinical/legal/gender/capacity gates, human confirmation and refusal feedback.
- [x] Commit the package. Root hands the touched UI paths to E after integration.

## Package C: Scoped Ward and ED deltas

**Files:** modify `coordinator/since-last-look.ts`, `coordinator/since-last-look-panel.tsx`, `ward/ward-screen.tsx`, `ed/ed-screen.tsx` and `ed/ed-overview.tsx`; add a small shared `since-last-look-pill.tsx` and its CSS module under `src/components/ward-management/`. Extend `tests/ward-since-last-look.test.ts` and `tests/ward-since-last-look.dom.test.tsx`.

**Interfaces:** add an optional third hook argument `{ scopeKey: string; windowMinutes?: number }`. Existing coordinator callers retain current semantics. Ward uses `ward:<unitId>` and ED uses `ed:<edId>`, both with `windowMinutes: 15`. Preserve existing account, scenario and world-generation fences, and isolate leave timers by scope. Extend snapshots with fixed status fingerprints needed for arrivals, releases, referral decisions and transport arrivals/departures. Use a versioned parser with safe fallback for older snapshots.

**Window decision:** Ward/ED compare changes since the later of the last review and `now - 15` synthetic minutes. Display that actual start time. When an old snapshot cannot locate a transition in the window, use recorded event/timestamp evidence; do not invent when it happened. Leave the coordinator's shift/last-visit behaviour unchanged.

**Scope decision:** Fingerprint only the ward's own addressing on a multi-destination referral. Another ward's decision on the same referral must not create an update. ED scope includes explicit ED addressing and linked movements' `originEdId`; an origin site alone does not establish a department or self-addressing.

- [x] Write failing pure tests for status changes without new IDs, scope filtering, the 15-minute boundary, older/malformed snapshots and account/scenario resets.
- [x] Write failing DOM tests for Ward and ED header pills, unrelated-unit isolation, independent scope acknowledgements, opening/closing/focus behaviour and a second update arriving while the sheet is open.
- [x] Run `npx vitest run tests/ward-since-last-look.test.ts tests/ward-since-last-look.dom.test.tsx`.
- [x] Implement scope-aware storage/subscriptions and a shared accessible pill/sheet. Capture the displayed changes before acknowledging on open; keep those captured rows visible after the live badge clears. Do not acknowledge later arrivals automatically.
- [x] Use narrow provider selectors and stable derived values. Reserve header space or keep a stable zero-state slot so badge changes do not shift adjacent controls. Reuse the existing Sheet and `SinceLastLookSheetBody`; there is no existing component named `SinceLastLookSheet` to import.
- [x] Run the focused tests and inspect the affected headers on phone/tablet widths with synthetic state during implementation. Commit the package.

## Package D: Synthetic session draft recovery

**Files:** modify `use-dirty-state-guard.ts`, `referrals/referral-draft-store.ts`, `referrals/use-ward-referral-drawer-state.ts`, `referrals/ward-referral-drawer.tsx`, `legal-forms/legal-forms-screen.tsx` and the owning legal record sheet in `legal-forms/legal-forms-sheets.tsx`. Update the local session cleanup in `use-ward-supabase-shared.ts` and the provider/demo storage cleanup paths as required. No live auth/provider calls are part of this work.

**Tests:** add `tests/ward-draft-recovery.test.ts` and `tests/ward-draft-recovery.dom.test.tsx`; update the intentional memory-only expectations in `tests/ward-use-dirty-state-guard.dom.test.tsx` and `tests/ward-referral-drawer-sheet.dom.test.tsx` only for the new opt-in behaviour.

**Interfaces:** add optional `storageKey?: string` to `DirtyStateGuardOptions`; reuse its `value`, `onRestore` and `clearDraft` APIs. Return `draftRestored: boolean`. Use versioned `wf-draft:` entries scoped to account/session, scenario, form kind and subject ID. Only explicitly enabled synthetic forms may save typed drafts. Non-opted-in guards retain existing privacy behaviour.

- [x] Write failing storage tests for the exact 500ms debounce, malformed/version-mismatched entries, blocked storage/quota, subject/account/scenario separation and no localStorage writes.
- [x] Write failing integration tests for unmount/remount restoration with “Draft restored from this session” and Clear, successful submission clearing, rejected submission retaining the draft and sign-out/reset invalidating pending writes.
- [x] Add delayed-auth/world-adoption tests: restore only after identity and the matching synthetic world are settled, with no transient local-demo fallback. Check envelope save/expiry timestamps, reject future timestamps and expire drafts no later than the existing session/workstation limit.
- [x] Persist a bounded referral projection without attached chart bytes. Keep files in memory during ordinary drawer use; after refresh clearly require reattachment. Test attachment/size/quota behaviour and never restore metadata that falsely marks an absent chart as ready to submit.
- [x] Run `npx vitest run tests/ward-draft-recovery.test.ts tests/ward-draft-recovery.dom.test.tsx`.
- [x] Add narrowly scoped opt-in persistence. Do not let another mounted dirty guard purge an active permitted draft. Consolidate the drawer's 800ms memory autosave and new 500ms storage writes through one owner/session fence; avoid competing restore paths.
- [x] Restore values only into the matching form draft, never directly into clinical state or a submitted legal record. Revalidate before submit. Clear cancels pending saves and resets the draft/notice; successful submit clears only after reducer acceptance. Do not claim recovery for keystrokes inside the unelapsed debounce.
- [x] Replace the legal sheet's synchronous success boolean with an observed command outcome before clearing. A delayed shared refusal must keep the form draft available for correction; test that path with a mocked command.
- [x] Wire local cleanup for explicit sign-out, auth expiry/account switch, demo reset and scenario reset. An old timer or unmount callback must not recreate a deleted draft.
- [x] Root documents the user-requested, synthetic-form exception to D-18 in the owned decision documentation; the general event-based typed-state privacy lock stays in force. Browser session restore can retain sessionStorage after a browser restart, so do not promise guaranteed erasure on browser close. Clear on observed session termination and sign-out; a stronger browser-close guarantee requires a different recovery design.
- [x] Re-run the new tests plus `npx vitest run tests/ward-use-dirty-state-guard.dom.test.tsx tests/ward-referral-drawer-sheet.dom.test.tsx`. Commit the package.

## Package E: Canonical placement controls and 48px sizing

**Files:** modify `src/components/wf/button.module.css`, its stale size comment in `button.tsx`, and the live placement controls in `ward/ward-home-tab.tsx`, `ward/ward-screen.tsx`, `coordinator/shortlist-panel.tsx`, `referrals/referral-match.tsx` and `referrals/referral-match-tiers.tsx`. Restrict CSS changes in screen modules to the migrated controls.

**Tests:** extend `tests/ward-wf-v10-parts.dom.test.tsx`; retain `tests/ward-style-drift-ratchet.test.ts`. Add targeted placement interaction cases to the existing screen tests if the primitive tests do not exercise the actual callbacks.

- [x] Write failing cases for actual Accept, Pull and Decline controls using the canonical primitive; blocked actions must expose the real gate reason, remain discoverable and dispatch nothing. Preserve explicit submit types, confirmation steps and mandatory decline/override rationale.
- [x] Run `npx vitest run tests/ward-wf-v10-parts.dom.test.tsx tests/ward-style-drift-ratchet.test.ts`.
- [x] Migrate primary actions to `Button variant="pri" size="md"` and secondary/Decline actions to `variant="sec"`. Preserve handlers and derive `disabledReason` from the actual gate; do not hard-code “Waiting on Form 1A medical clearance” for every failure.
- [x] Mark migrated canonical controls with `data-placement-action`; the shared Button CSS applies `--wf-h-md: max(3rem, var(--ward-tap, var(--spacing-tap, 3rem)))` and minimum width/height. This enforces 48px across viewports without enlarging unrelated desktop buttons. Ensure screen CSS cannot reduce that minimum and permit action groups to wrap.
- [x] Verify focused suites. Inspect computed target bounds at phone and tablet widths, keyboard focus, tooltip/inline explanations, text clipping and loading behaviour. CSS-only assertions or jsdom do not prove rendered dimensions.
- [x] Commit the package and provide exact affected controls to the reviewer.

## Root integration and completion

- [x] Recheck drift from the assessed baseline before execution; refresh the plan only where new source changes matter. Do not force main back to the handover SHA.
- [x] Carry one task identity and shared ownership log; integrate packages A, B, C, D, E in that order after their focused checks.
- [x] Root owns updates to the relevant code-map sections and the D-18 exception note; workers supply factual snippets instead of concurrently editing shared documentation.
- [x] Run required local static/admission checks selected from the current check guidance. Keep provider-backed checks mocked or explicitly pending. Do not start whole-suite checks, CI or deployment.
- [x] Obtain the fresh independent review of the integrated behaviour and diff. Address supported findings and rerun only affected suites.
- [x] Report exact test files/counts that ran, browser observations, main/task branch state and any limitation. Deployment and clinical production status remain unverified.

## Planning receipt

Task identity: Ward Flow five-task handover review, 17 October 2026. Assessed head: `aa3a78b9ecfd1132a7ff48867bac5f1d366dbccc`. Main is clean and aligned to the fetched origin/main. Plan branch: `docs/ward-flow-handover-plan`; checkout: `/workspace/ward-flow-handover-plan`. Only this plan is changed. Product work and subagent execution remain planned. Local coordination/checkpoint: `/tmp/ward-flow-handover-review/`. No test suite, hosted CI, deployment or paid service was run for this review.

## Completed implementation receipt

All packages A–E are integrated on `feat/ward-flow-handover` in `/workspace/ward-flow-handover-plan`; main remains untouched after the initial remote alignment. Independent source review at `44615659` found three defects (receiving gate validation, incoming ED arm isolation and repeated-refresh attachment reminders); all have failing-then-passing regressions and were closed by fresh offline reviewer probes. A subsequent behaviour-preserving extraction keeps attachment metadata with the draft store.

Local evidence: final required-focused selection, 9 files/118 tests passed; four additional drawer/gender/Undo suites, 47 tests passed; recovered draft extraction, 2 files/20 tests passed. Earlier integrated provider/privacy/auth checks passed, with exact commands retained in the private task checkpoint. Full source TypeScript, changed-file lint and normal commit admission checks are recorded separately; no whole-suite lock, hosted CI, push, protected-branch merge or deployment was run.

Local Chromium verified Ward and ED headers at 390px and 1024px: contained stable pills, independent acknowledgement, visible sheet and Escape/focus restoration, with no application errors. A real browser reload restored an edited synthetic referral, displayed its notice and allowed Clear. Visible Pull, Accept and Decline controls on two wards measured at least 48px high at both widths without clipping. Screenshots and logs stay outside Git under `/tmp/ward-flow-handover-review/`. All browser outbound requests were blocked.

Known limits: the final unelapsed 500ms debounce may lose recent keystrokes; chart bytes require reattachment after refresh; browser session restore can retain storage across restarts, bounded by the draft lifetime and observed session cleanup. No real data use, deployment or physical-device/browser-family acceptance is claimed.

## PR #402 repair proposal — 18 October 2026

Hosted CI and review exposed additional contract/inventory gaps, accessibility assertions, recovery edge cases and first-load size growth. The local follow-up integrates main commit `7dd715aa` after resolving its one code-map conflict and preserves the automated Qodo fixes with regressions. New fixes cover phone turnaround, live receiving requests, production flag authority, unreviewed navigation, day labels, malformed recovered forms, account fences, missing UUID support and legal-save completion after session cleanup. Event generators, legal-figure sweeps, history and producer inventories exercise the new commands. Tooltip portals hide in print.

The prepared draft modules keep one memory owner and separate lifecycle cleanup from deferred form validation/hooks. Current caller APIs remain available through the existing entry point. Josh approved the scoped module relocation check on 18 October 2026 ("Go ahead with all recommendations please and fix all issues"). One invocation of `DEAD_CODE_OWNER_APPROVED=1 npm run check:dead-code-candidate -- --diff HEAD` evaluated the prepared refactor against `0e7b4487` and permitted its 16 retained declarations. This is an explicit owner-approved exception for that run; the default guard was not relaxed and no other override was used. Hosted CI remains a separate verdict.

Evidence on the combined proposed source: production build including TypeScript passed; all five initial-script budgets passed (Home 559/560 KB, Referrals 576/577 KB, ED 531/532 KB, Ward 583/587 KB, Movements 617/623 KB). No budget was raised. The two originally failing production Chromium journeys passed with zero retries. Local Chromium also verified 48px scoped update triggers with a smaller inherited tap token, sheet review and focus return at 390px and 1024px. The unused-code check reports no new items. Focused root checks passed 238 cases across 13 domain/referral/update suites, 43 cases across five main/recovery integration suites, 121 cases across eight draft/guard/legal-event suites and 53 cases across four legal/auth/account/drawer suites; these selections overlap and must not be summed as unique coverage. All eight exhaustive legal-form sweep files passed 16 cases. Exact commands, source boundaries and artefact paths remain in the private task checkpoint.

The old 500ms and chart-reattachment limitations still apply. No whole-suite local run, protected-main merge, deployment, real patient data or paid-review upgrade is included. The verified repair round is ready for publication; the next hosted run must be checked separately.

Remote reconciliation: preserved the concurrent repair/revert history through `29551723` with a normal merge. Removed duplicate auto-merge declarations and retained the verified direct-movement/open-referral distinction, production feature policy and scoped explicit-review persistence. The resulting application source matches `f4bd3ad0`; added remote coverage includes weighted turnaround fuzz events, precise disabled descriptions and D-67 storage leak checks. Fresh reconciliation checks passed 14 focused files/234 cases, engine safety 1 file/5 cases, seven changed-test-file lint and scoped TypeScript. The merge does not replace earlier build/browser evidence with a claim of hosted CI success.

A push race exposed a second concurrent repair batch through `ccc0d7a3`. Its history is preserved in a further normal merge. Overlapping fixes retain the already verified full validator, UUID fallback, scoped owner fencing, CLD override policy and small lifecycle module; the existing per-form accepted-command fixture covers both movement/referral branches and supplied/derived expiry. The remote browser session-key leak assertion and pre-debounce call assertion were added. Five affected focused files passed 117 cases, and both production Chromium journeys passed again with zero retries. Application source remains identical to `f4bd3ad0`.

Hosted run `39102875807` verified the production build/budgets, all three browser groups, release gate and seven unit shards. Its related-tests, eighth shard and coverage jobs all identified the same remaining assertion: the existing technical autosave-timer exclusion still named the pre-extraction store. The exclusion now names the cache module and remains restricted to `REFERRAL_DRAFT_AUTOSAVE_MS`; an added anti-vacuity case keeps other constants, shown clinical claims and the old path guarded. Two focused files passed 40 cases. The application source and prior runtime/build evidence are unchanged; the next hosted head needs its own verdict.

## Final review round — 18 October 2026

Hosted run `39103582715` on `3e81d905` passed every required job, including all eight unit shards, coverage, static checks, production build/budgets, three browser groups and release gate. Subsequent review confirmed three further improvements: rejected legal-save completions now use the existing warning while retaining an editable draft; fresh phone candidates with no free locked bed now name that actual reason; recovery-key handoff retires only matching subject/scope copies and preserves other drafts through failed writes, restoration and discard. Current memory edits outrank older aliases. Explicit Send/Clear removes matching historical copies in the exact account/session/scenario/form scope, including opaque movement IDs, after full projection validation. Initial and returning focus are both asserted for deferred patient dialogs.

The proposed referral-only eligibility change and generic-selector follow-up were dismissed: their reproduction mixed ward recipients that intake validation rejects. Named candidate filtering and the existing open-request check keep supported UI/reducer requests aligned. No clinical rule changed for an invalid fixture.

Independent review caught and closed cross-subject recovery deletion in an intermediate worker patch before publication. Final integrated focused selection passed 10 files/201 cases; additional worker/root checks overlap and are not summed. The historical-alias regression failed before the final scoped cleanup. Production-build and pushed-head CI results are recorded separately below.

Final review-round runtime evidence: a fresh production build including TypeScript passed; all five budgets remained 559/560, 576/577, 531/532, 583/587 and 617/623 KB. Both focused production Chromium journeys passed again with zero retries. Independent review of the final scoped opaque-alias cleanup found no further issue; historical cleanup no longer needs patient-ID inference. No whole-suite local lock, clinical allocation automation, paid review upgrade, protected-main merge or deployment was used.

The normal push guard caught the legal screen exceeding its existing 1,500-line limit. Naming the local rejection callback reduced the implementation without changing behaviour; whole-file ESLint and the warning/editability regression passed. A fresh production build including TypeScript and all script budgets passed on this final callback implementation. The guard was retained, with no static-check override.
