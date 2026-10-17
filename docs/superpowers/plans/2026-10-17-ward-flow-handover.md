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
- `FLAG_MOVEMENT_TURNAROUND_PRIORITY` payload: `{ movementId: string; unitId: string }` plus the normal role/time/event metadata.
- `FLAG_REFERRAL_TURNAROUND_PRIORITY` payload: `{ referralId: string; unitId: string }` plus the normal metadata, for a referral without a movement. Never create a movement merely to flag priority. Preserve the preference through the existing referral-to-movement conversion.
- A second pure selector resolves the source from live CLD or a confirmed/departing, unreleased bed release. An expected date alone is insufficient. A departure source must not receive a CLD badge.
- Exhaustive integration includes `ward-flow-storage-validation.ts` (strict optional preference schema and existing unit reference), `ward-flow-referral-send-events.ts` (conversion), `ward-history.ts`, `ward-reanchor.ts` (flag timestamp), and local schemas in `backend/ward-flow/command-schemas.ts`. These are Agent A's additional owned paths with corresponding focused tests; no hosted backend call is required.

- [ ] Write failing tests for eligible CLD, partial/empty/lapsed/paused criteria, involuntary/CTO/unknown status, wrong unit and departed admissions.
- [ ] Add reducer tests for a pre-movement referral, an existing movement, confirmed departure, no qualifying departure, stale eligibility, closed referral/movement, duplicate clicks and invalid IDs. Assert that capacity, allocation, acceptance, urgency and transport booking remain unchanged.
- [ ] Run `npx vitest run tests/ward-cld-turnaround-priority.test.ts tests/ward-event-permissions.test.ts`; confirm the new behaviour fails before implementation.
- [ ] Implement selectors and preference events with coordinator authority, current-state validation and existing concurrency/refusal conventions. Register the event in every exhaustive event/permission/persistence registry used by the local and shared paths. Persist fixed IDs/enums/times only and validate restored preferences.
- [ ] Re-run the focused tests. Inspect direct event consumers for exhaustive handling; run their exact focused tests where affected. Hand B the final payloads and selectors.
- [ ] Commit named owned files after the required local admission checks. Root records the package evidence.

## Package B: Turnaround control and queue badge

**Files:** modify `referrals/referral-match-tiers.tsx`, `referrals/referral-match.tsx` and `coordinator/priority-queue.tsx`; add `tests/ward-cld-turnaround-priority.dom.test.tsx`. All source paths are under `src/components/ward-management/`.

**Consumes:** A's selectors and event payloads. **Produces:** enabled human-triggered priority control and a source-accurate queue badge.

- [ ] Write failing DOM cases for qualified CLD, qualifying departure, blocked action with a readable reason and duplicate flag feedback. Assert an explicit click dispatches exactly one preference event and no placement/transport event.
- [ ] Run `npx vitest run tests/ward-cld-turnaround-priority.dom.test.tsx` to establish the failing behaviour.
- [ ] Replace the inert scheduling notice with actual eligibility and handler wiring. Use the referral event until a linked movement exists. Render “Turnaround Candidate: Bed clearing via Criteria-Led Discharge” only for a currently valid CLD source; label departures separately. Expired preferences must not continue to imply a clearing bed.
- [ ] Run both turnaround test files. Preserve existing clinical/legal/gender/capacity gates, human confirmation and refusal feedback.
- [ ] Commit the package. Root hands the touched UI paths to E after integration.

## Package C: Scoped Ward and ED deltas

**Files:** modify `coordinator/since-last-look.ts`, `coordinator/since-last-look-panel.tsx`, `ward/ward-screen.tsx`, `ed/ed-screen.tsx` and `ed/ed-overview.tsx`; add a small shared `since-last-look-pill.tsx` and its CSS module under `src/components/ward-management/`. Extend `tests/ward-since-last-look.test.ts` and `tests/ward-since-last-look.dom.test.tsx`.

**Interfaces:** add an optional third hook argument `{ scopeKey: string; windowMinutes?: number }`. Existing coordinator callers retain current semantics. Ward uses `ward:<unitId>` and ED uses `ed:<edId>`, both with `windowMinutes: 15`. Preserve existing account, scenario and world-generation fences, and isolate leave timers by scope. Extend snapshots with fixed status fingerprints needed for arrivals, releases, referral decisions and transport arrivals/departures. Use a versioned parser with safe fallback for older snapshots.

**Window decision:** Ward/ED compare changes since the later of the last review and `now - 15` synthetic minutes. Display that actual start time. When an old snapshot cannot locate a transition in the window, use recorded event/timestamp evidence; do not invent when it happened. Leave the coordinator's shift/last-visit behaviour unchanged.

**Scope decision:** Fingerprint only the ward's own addressing on a multi-destination referral. Another ward's decision on the same referral must not create an update. ED scope includes explicit ED addressing and linked movements' `originEdId`; an origin site alone does not establish a department or self-addressing.

- [ ] Write failing pure tests for status changes without new IDs, scope filtering, the 15-minute boundary, older/malformed snapshots and account/scenario resets.
- [ ] Write failing DOM tests for Ward and ED header pills, unrelated-unit isolation, independent scope acknowledgements, opening/closing/focus behaviour and a second update arriving while the sheet is open.
- [ ] Run `npx vitest run tests/ward-since-last-look.test.ts tests/ward-since-last-look.dom.test.tsx`.
- [ ] Implement scope-aware storage/subscriptions and a shared accessible pill/sheet. Capture the displayed changes before acknowledging on open; keep those captured rows visible after the live badge clears. Do not acknowledge later arrivals automatically.
- [ ] Use narrow provider selectors and stable derived values. Reserve header space or keep a stable zero-state slot so badge changes do not shift adjacent controls. Reuse the existing Sheet and `SinceLastLookSheetBody`; there is no existing component named `SinceLastLookSheet` to import.
- [ ] Run the focused tests and inspect the affected headers on phone/tablet widths with synthetic state during implementation. Commit the package.

## Package D: Synthetic session draft recovery

**Files:** modify `use-dirty-state-guard.ts`, `referrals/referral-draft-store.ts`, `referrals/use-ward-referral-drawer-state.ts`, `referrals/ward-referral-drawer.tsx`, `legal-forms/legal-forms-screen.tsx` and the owning legal record sheet in `legal-forms/legal-forms-sheets.tsx`. Update the local session cleanup in `use-ward-supabase-shared.ts` and the provider/demo storage cleanup paths as required. No live auth/provider calls are part of this work.

**Tests:** add `tests/ward-draft-recovery.test.ts` and `tests/ward-draft-recovery.dom.test.tsx`; update the intentional memory-only expectations in `tests/ward-use-dirty-state-guard.dom.test.tsx` and `tests/ward-referral-drawer-sheet.dom.test.tsx` only for the new opt-in behaviour.

**Interfaces:** add optional `storageKey?: string` to `DirtyStateGuardOptions`; reuse its `value`, `onRestore` and `clearDraft` APIs. Return `draftRestored: boolean`. Use versioned `wf-draft:` entries scoped to account/session, scenario, form kind and subject ID. Only explicitly enabled synthetic forms may save typed drafts. Non-opted-in guards retain existing privacy behaviour.

- [ ] Write failing storage tests for the exact 500ms debounce, malformed/version-mismatched entries, blocked storage/quota, subject/account/scenario separation and no localStorage writes.
- [ ] Write failing integration tests for unmount/remount restoration with “Draft restored from this session” and Clear, successful submission clearing, rejected submission retaining the draft and sign-out/reset invalidating pending writes.
- [ ] Add delayed-auth/world-adoption tests: restore only after identity and the matching synthetic world are settled, with no transient local-demo fallback. Check envelope save/expiry timestamps, reject future timestamps and expire drafts no later than the existing session/workstation limit.
- [ ] Run `npx vitest run tests/ward-draft-recovery.test.ts tests/ward-draft-recovery.dom.test.tsx`.
- [ ] Add narrowly scoped opt-in persistence. Do not let another mounted dirty guard purge an active permitted draft. Consolidate the drawer's 800ms memory autosave and new 500ms storage writes through one owner/session fence; avoid competing restore paths.
- [ ] Restore values only into the matching form draft, never directly into clinical state or a submitted legal record. Revalidate before submit. Clear cancels pending saves and resets the draft/notice; successful submit clears only after reducer acceptance. Do not claim recovery for keystrokes inside the unelapsed debounce.
- [ ] Replace the legal sheet's synchronous success boolean with an observed command outcome before clearing. A delayed shared refusal must keep the form draft available for correction; test that path with a mocked command.
- [ ] Wire local cleanup for explicit sign-out, auth expiry/account switch, demo reset and scenario reset. An old timer or unmount callback must not recreate a deleted draft.
- [ ] Root documents the user-requested, synthetic-form exception to D-18 in the owned decision documentation; the general event-based typed-state privacy lock stays in force. Browser session restore can retain sessionStorage after a browser restart, so do not promise guaranteed erasure on browser close. Clear on observed session termination and sign-out; a stronger browser-close guarantee requires a different recovery design.
- [ ] Re-run the new tests plus `npx vitest run tests/ward-use-dirty-state-guard.dom.test.tsx tests/ward-referral-drawer-sheet.dom.test.tsx`. Commit the package.

## Package E: Canonical placement controls and 48px sizing

**Files:** modify `src/components/wf/button.module.css`, its stale size comment in `button.tsx`, and the live placement controls in `ward/ward-home-tab.tsx`, `ward/ward-screen.tsx`, `coordinator/shortlist-panel.tsx`, `referrals/referral-match.tsx` and `referrals/referral-match-tiers.tsx`. Restrict CSS changes in screen modules to the migrated controls.

**Tests:** extend `tests/ward-wf-v10-parts.dom.test.tsx`; retain `tests/ward-style-drift-ratchet.test.ts`. Add targeted placement interaction cases to the existing screen tests if the primitive tests do not exercise the actual callbacks.

- [ ] Write failing cases for actual Accept, Pull and Decline controls using the canonical primitive; blocked actions must expose the real gate reason, remain discoverable and dispatch nothing. Preserve explicit submit types, confirmation steps and mandatory decline/override rationale.
- [ ] Run `npx vitest run tests/ward-wf-v10-parts.dom.test.tsx tests/ward-style-drift-ratchet.test.ts`.
- [ ] Migrate primary actions to `Button variant="pri" size="md"` and secondary/Decline actions to `variant="sec"`. Preserve handlers and derive `disabledReason` from the actual gate; do not hard-code “Waiting on Form 1A medical clearance” for every failure.
- [ ] Give migrated placement control containers a shared token override of `--wf-h-md: var(--ward-tap, var(--spacing-tap, 3rem))`. This makes their canonical medium controls 48px at all viewport widths without enlarging unrelated desktop buttons. Ensure screen CSS cannot reduce that minimum and permit action groups to wrap.
- [ ] Verify focused suites. Inspect computed target bounds at phone and tablet widths, keyboard focus, tooltip/inline explanations, text clipping and loading behaviour. CSS-only assertions or jsdom do not prove rendered dimensions.
- [ ] Commit the package and provide exact affected controls to the reviewer.

## Root integration and completion

- [ ] Recheck drift from the assessed baseline before execution; refresh the plan only where new source changes matter. Do not force main back to the handover SHA.
- [ ] Carry one task identity and shared ownership log; integrate packages A, B, C, D, E in that order after their focused checks.
- [ ] Root owns updates to the relevant code-map sections and the D-18 exception note; workers supply factual snippets instead of concurrently editing shared documentation.
- [ ] Run required local static/admission checks selected from the current check guidance. Keep provider-backed checks mocked or explicitly pending. Do not start whole-suite checks, CI or deployment.
- [ ] Obtain the fresh independent review of the integrated behaviour and diff. Address supported findings and rerun only affected suites.
- [ ] Report exact test files/counts that ran, browser observations, main/task branch state and any limitation. Deployment and clinical production status remain unverified.

## Planning receipt

Task identity: Ward Flow five-task handover review, 17 October 2026. Assessed head: `aa3a78b9ecfd1132a7ff48867bac5f1d366dbccc`. Main is clean and aligned to the fetched origin/main. Plan branch: `docs/ward-flow-handover-plan`; checkout: `/workspace/ward-flow-handover-plan`. Only this plan is changed. Product work and subagent execution remain planned. Local coordination/checkpoint: `/tmp/ward-flow-handover-review/`. No test suite, hosted CI, deployment or paid service was run for this review.
