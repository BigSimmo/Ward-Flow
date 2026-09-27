# Q004 — Ward Flow product refinement

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

Owner commissioned 2026-09-13. Continue the existing local Ward line and plan mechanics. Current checkpoint: [product-refinement/PROGRESS.md](product-refinement/PROGRESS.md). Prior Q001–Q003 evidence remains historical; reuse only unchanged compatible checks. This plan records the full request, including requirements added during clarification.

## Outcome and authority

Create a polished, compact operational product using every relevant served HTML drawing as its design reference. Command is a useful reference, with the owner's new corrections applied first. The owner explicitly authorises larger redesigns for the named overhaul pages below and UI/journey improvements elsewhere. Record deviations and reasons; do not silently replace drawing types or operational behaviour.

Confirmed clarifications: remove product explanations/mockup commentary, retain concise decision reasons, warnings, missing-data states and one unobtrusive synthetic-data indicator. Governance includes NEW audit capture and review actions. Capacity includes NEW patient-linked discharge records and access controls, not only anonymous bed-release summaries. These are local prototype changes: no hosted integration, production data, real authentication/security assurance, provider operation, commit, push, merge, deployment, protected deletion or movement is authorised.

## Global constraints

- Branch: `codex/task-ward-flow-live-state-20260831`; workspace `D:/Worktrees/Database/ward-lead`. Preserve all pre-existing dirty work; snapshot scoped inputs for each task. Do not change other tasks' files or runtime processes.
- Read the served HTML mockup before editing EACH screen, including relevant tabs, drawers and selection states. Never view a drawing as `file://`. Use SCREEN-MAP and MANIFEST to resolve current drawings; superseded patient search drawings are excluded.
- Preserve Q003: page-specific desktop bounds, readable minimum body heights, aligned neighbouring bottoms, stationary headers/controls and independent keyboard-accessible panel-body scrolling. Release bounds for narrow/mobile document flow and print. Do not squeeze Command's lower register.
- A compact product removes narration, not information needed to act safely. No fabricated timestamps, patient links, counts, capabilities or review history. Colour encodes actual state and is paired with text/icon; no colour-only meaning. Interpret the owner's “cover” as colour.
- Keep the Ward typefaces/palette and mockup identity. Refine consistent spacing, legibility, button hierarchy, restrained borders, tables and segmented controls. Shared improvements are learned from rendered screens, then documented in the design standard. Do not create competing token systems or change PsychSift.
- Existing clinical eligibility, ordering, override checks, max-parallel-referral rules and action guards survive. Explicit new audit/discharge behaviour must pass focused domain tests, including disallowed roles, before UI claims it works. Presentation permissions alone are insufficient.
- Do not introduce no-op settings/buttons or infer patient links from matching names/positions. Existing unsupported data stays explicitly unavailable. Synthetic fixtures remain clearly synthetic.
- Owner-approved lean coverage replaces blanket six-view checking: every changed page gets a served-reference desktop comparison in light/dark; phone/tablet checks cover each shared layout and every complex or materially changed responsive composition. Follow product-refinement/VISUAL-REVIEW.md. Record actual cells, named reused family evidence, deferred checks and drawing hashes. Numerical scoring is inactive; retain historical scores for later polishing.

## Tasks and dependencies

### Task 1: Command reference refinement

Owned scope: coordinator screen, shortlist, flow/key, pressure strip and lower register local modules. Improve Capacity/key spacing beneath statewide flow; remove exception-coverage and candidate-ordering commentary. Colour-code true ED wait/deadline status. Start with shortlist compact/closed until an explicit queue selection; allow flow to occupy freed width and increase useful height. Preserve meaningful restored/deep-linked selection and distinct referral subject. Expose Update record and Refer/Override/Confirm action hierarchy without long scrolling. Use candidate summaries/badges and tabs/disclosures for detailed checks, without dropping reasons or selection constraints. Improve eligibility-edge spacing, declines and escalation padding. Include close/deselect and keyboard/focus behaviour.

### Task 2: Movements refinement

Owned scope: movements local modules. Redesign The day into a compact, precise metric treatment; reduce attention items and show reason/status concisely. Attention click should focus/reveal the corresponding worklist record rather than interrupt with a redundant popup; preserve access to detailed record actions. Replace the grey Order strip with a refined compact grouping/sort toolbar. Improve row typography, padding, action proportions and scanning. Make Stage in Shape of the day use available space with useful non-duplicated information grounded in current data. Preserve traffic/corridor distinctions, compact legend and Transport right now/summary switcher.

### Task 3: Patient-linked discharge and audit contracts

Bounded domain task before dependent Capacity/Discharges/Governance UI. Inspect current patient, admission, bed release, legal record, action, role, rejection and audit contracts. Specify explicit patient linkage (no inference), role-scoped reads and writes, safe legacy anonymous records, event provenance, append-only history, review state/actions and reset/persistence semantics matching the existing local prototype. Implement the smallest coherent contracts and focused allowed/denied/legacy/stale-state tests. Record which events are captured and limitations; do not claim network-wide security or historical events never captured. Parent approves design after independent adversarial review before engine edits.

### Task 4: Capacity and Discharges

After Task 3 interfaces settle. Capacity: visually distinguish health services in bed map, refine mismatch metrics, remove surface-band commentary, show honest last-update time. Match/refine the mockup ward table and eliminate excess blank lower area. Selecting ward/bed opens a ward summary with expected discharges, Ward/Discharges tabs and network fallback; keyboard equivalent. Network fallback has compact Ready now then a Beds freeing/Attention switcher, with useful existing-data filters. Integrate authorised patient-linked discharge data and access controls. Discharges page: larger owner-authorised redesign around actionable current/expected discharges and high-yield filters, following the drawing's identity and new contract.

### Task 5: Ward operational family

All wards directory is a complete redesign. Individual ward overview remains drawing-led but condenses Awaiting answer, Attention, Coming in/Going out; Today's return is high-yield and compact. Avoid full-width low-yield Record for today/Where to refer blocks; put Handover prominently. Bed board matches individual-ward drawing with polish. ED and Community team screens match their drawings; improve team structure/spacing and preserve all necessary data and journeys. Include ward-answer improvements to required behaviour, maturity, simplicity and layout. Scope includes related index pages where navigation/copy needs consistency.

### Task 6: Search and patient records

Search hub, Patient search, Patient Now match current drawings with polish. Put a real search control at the top of Patient search, connected to existing search behaviour, not a competing search store. Wire Add patient from search/empty results with safe prefill. Add a patient is owner-authorised redesign using the drawing and current registration behaviour; remove non-operational components. Patient Now retains clinical/operational facts and actions.

### Task 7: Referral journeys

Referrals register: drawing-guided refinement plus useful grounded missing features. Raise a referral: modestly wider supporting panel, polished controls/free text, particularly step one; autofill only details already held by the system with clear source/editability and no overwrite of user changes. Preserve eligibility, patient identity, source and submission gates.

### Task 8: Operational registers

Delays and Transport officer match drawings with polish. Handover: simple rapid filter bar, actual update date/time, high-yield columns grounded in current data, concise copy and accessible print. Out of area, On-call/contacts, Alerts and Legal Forms receive owner-authorised redesigns, using current drawings and actionable data. No fictional contact information or new clinical rules.

### Task 9: Governance

After Task 3. Redesign Governance around legal/operational audit records and review work. Wire new captured events/review actions with exact provenance, filters, detail and role guards. Keep review decisions distinguishable from clinical authorisation and original event history. Include legal-status/form changes, overrides and supported audit categories; preserve missing historical coverage honestly without long product narration.

### Task 10: Statistics family

Landing, Statewide overview, Service, Ward, Community and ED statistics match drawings with compact operational copy, polished chart/table treatment and layout. Ward & ED comparison is an owner-authorised redesign. Remove repeated narrative while retaining definitions/denominators/suppression/missingness needed to interpret statistics. Preserve existing calculations and populations.

### Task 11: Settings and Sign in

Complete owner-authorised redesigns. Reference PsychSift's in-repository `clinical-dashboard/settings-dialog.tsx` and `settings-sections.ts` structure (searchable categories, organised controls), adapted to Ward's real preferences/roles. Use existing stores/actions; only add settings with actual consumers. Sign-in remains the existing Ward prototype session model, with polished clear entry, role/scope selection and accessible errors. No new hosted auth connection.

### Task 12: Estate consistency, design rules and acceptance

Apply shared proven metric, badge, table, action, spacing and copy patterns across affected routes, including residual meta copy on Network/Digest where present. Update required mirrors/manifests when edited; record owner-approved design departures. Integrate each batch, resolve material findings, run focused checks for changed behavior, perform owner-approved risk-based visual acceptance, then one appropriate final domain gate. Preserve earlier Q003 outstanding cells until actually superseded by new evidence.

Current shared patterns and the explicit phone-rail implementation exception are recorded in [Q004 shared design notes](product-refinement/DESIGN-NOTES.md).

## Execution and review

### Current accelerated sequence (owner approved)

**Latest owner decision supersedes the earlier execution notes below:** up to three workers own complete disjoint screen families, including initial visual checks, with batches of 4–6 related screens where practical. Controller integrates and performs consolidated independent review. Use one planned correction pass, then defer minor aesthetics to the final consistency pass; material defects still block. Follow the active lean coverage policy in VISUAL-REVIEW.md. The former two-writer cap, controller-only browser review, numerical thresholds and blanket six-view requirement are inactive. Preserve their historical rationale and evidence below.

Additional efficiency boundaries: finish the commissioned features without speculative additions; reuse existing components/mockup styles without creating a new design system; do not extract abstractions or restructure working components solely for elegance. Choose one representative per reusable layout, finish that pattern, and apply it to siblings. Keep shared files stable during family implementation and capture. Report blockers and changed files in one concise batch handoff, not per-screen essays. Unsupported tooling checks stay explicitly unverified unless core to the requested outcome.

Final efficiency pass: assign work by actual shared-file ownership, not page count. Statistics screens share `StatisticsSectionFrame` and `statistics-sections.module.css`; one family owner controls those files. Other owners keep changes in their local modules and queue shared-shell requests for one controller integration. Do not introduce duplicate overrides to avoid coordination. Start reviewing a coherent completed subset without waiting for the slowest family or a minimum batch size. Workers continue with the next already-assigned disjoint subset while finished files remain frozen for review. A blocker parks only its dependent work, not the whole estate; domain/access blockers still block every affected journey. Independent review should inspect the worker's captured evidence and consequential source changes rather than repeat the entire browser walkthrough; reproduce ambiguous findings only. Keep one captured source boundary so later edits invalidate only affected evidence.

### Earlier execution notes — historical, superseded where different

Close Capacity's current visual acceptance first, then Command and Movements. Finish existing Discharges and Governance work without reopening their reviewed domain contracts except for correctness blockers. Do not start another screen family until one current screen has completed visual acceptance. Use at most two implementation workers while the controller closes a stable screen; independent review uses a free slot for a concrete handoff. This is an adaptive limit, not a permanent rule: add a third writer when disjoint work can shorten completion without growing the acceptance backlog or destabilizing reviewed files. Track accepted screens and corrective rework, not source-ready screens or agent count, and base remaining-time estimates on observed acceptance throughput.

Keep one consolidated review per coherent batch. Fix broken actions, clipping, misleading information and material reference mismatches immediately; collect non-blocking polish for one final consistency pass. No additional rubric or orchestration development. Reuse valid checks, healthy services and unaffected visual evidence; confirm capture dimensions/scroll state before treating screenshots as proof. This sequence supersedes the initial three-worker dispatch below.

One controller owns plan, shared design files, integration, gates and canonical visual records. At most three temporary children; exact disjoint paths and acknowledgement before writes, no recursive delegation. Astra/high for original design, domain/access contracts and consequential reviews; Sol/medium-high for grounded bounded implementation/extraction after the pattern/interfaces are established. Escalate for unresolved complexity, not task duration. Use independent task review after each coherent batch and scoped fixes; no repeated whole-estate review loops. Controller schedules tests and browser use serially to avoid contention; independent source work can run in parallel. User-authorised parallel ownership overrides the generic SDD ban on parallel implementers. No commits/deletions from generic skill workflows.

Initial parallel work: Task 1 Command; Task 2 Movements; Task 3 contract design/review. Root owns served-mockup capture, shared design decisions and plan integration. Capacity/Discharges/Governance wait for Task 3 contracts. Later disjoint screen batches follow the reference patterns. Every brief names its drawing/evidence, acceptance, input fingerprint, exact files and report path. No page is complete until implementation, review, applicable behaviour tests and six-view visual checks are recorded.

## Verification budget

**Active:** no numerical scoring. Preserve past scores for a later polish phase. Use the lean visual policy above, focused behavior/access-control checks, and one final domain gate. Reuse unchanged evidence, run no equivalent duplicate checks, and record reduced/deferred coverage explicitly. The following paragraph records the earlier owner request and is inactive.

Owner requested a simple design score during execution. Use [the visual review rubric](product-refinement/VISUAL-REVIEW.md): five categories scored 0–2, at least 9/10 with no blocking defect, supported by actual screenshots and all six required cells. Scores are reviewer judgements and never replace evidence. Promote only visually proven improvements to shared design rules.

Reuse existing dependencies, healthy task preview and compatible evidence. Preserve scoped dirty-input snapshots. Capture each lean-policy required cell once; inspect additional states only at the viewport/theme where their interaction or layout risk requires it. Recapture changed or unresolved states only. Unit/DOM tests focus on changed journeys/guards. New domain contracts warrant one final Ward domain gate with `files handed in` equal to `files that ran`. No repeated full test/build/lint stacks. Record reduced/deferred coverage explicitly; unperformed checks are never passing checks.
