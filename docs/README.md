# Ward Flow documentation index

> **Current Ward Flow work belongs in `BigSimmo/Ward-Flow`.** Start with the repository's
> [`AGENTS.md`](../AGENTS.md) and [`docs/ward-flow/README.md`](ward-flow/README.md). This index
> retains historical PsychSift-era entries; its old local-prototype and provider descriptions are
> not current Ward Flow instructions. Verify the Ward Flow remote before Git writes.

Start with the maintained entry points below. The inherited catalogue preserves historical
discovery; it is not a complete current inventory or proof that every listed procedure applies.
The [task contract](task-receipts.md) preserves one original objective and existing task IDs.

`npm run check:ward-doc-links` checks relative paths in `docs/ward-flow`, including history.
For maintained Markdown elsewhere, use `node scripts/ward-flow/check-doc-links.mjs --file README.md`
(repeat `--file` for each owned file); `--anchors` additionally checks supported Markdown headings.
Explicit selection excludes paired historical sections. Web URLs, reference-style links and
renderer extensions are not validated. `npm run docs:check-scripts` checks maintained npm
references; generated inventory/index checks do not prove architectural truth or prose freshness.

## Start here

| Doc                                                                                                       | What it is                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [codebase-index.md](codebase-index.md)                                                                    | Maintained Ward orientation followed by preserved historical architecture                            |
| [README.md](README.md)                                                                                    | Maintained entry pointers and inherited discovery catalogue                                          |
| [site-map.md](site-map.md)                                                                                | **Generated** route map — regenerate with `npm run docs:update`, verify with `npm run sitemap:check` |
| [agents-guide.md](agents-guide.md)                                                                        | Ward agent entry points; historical foreign configuration is not current authority                   |
| [ward-flow/README.md](ward-flow/README.md) · [ward-flow/LOCAL-FIRST-RUN.md](ward-flow/LOCAL-FIRST-RUN.md) | **Ward Flow** local bed-flow prototype — product entry + UI boot on this machine                     |
| [DOCS-SYSTEM.md](DOCS-SYSTEM.md)                                                                          | **Documentation system** - pipeline, registry, Ward Flow tip lock, recheck triggers                  |
| [scripts-index.md](scripts-index.md)                                                                      | Curated map of `scripts/` and the `package.json` command surface by purpose                          |

## Historical discovery catalogue

Entries below include inherited and dated material. Open a document's boundary and current
consumers before applying its advice; keep original incident commands/results as evidence.

<!-- docs-script-refs:historical-start -->

## Architecture

- [wiring-conventions.md](wiring-conventions.md) — page/button wiring conventions and the dead-button / orphan-route gates
- [search-chrome-behaviour.md](search-chrome-behaviour.md) — shared search-chrome contract: composer ownership, phone edge-to-edge dock, hide/reveal reserves
- [mockup-retirement-policy.md](mockup-retirement-policy.md) — when a mockup may be deleted, who decides, what evidence is required, and the three tiers that keep developer-gated prototypes out of cleanup scope
- [deployment-architecture.md](deployment-architecture.md) — app/worker/Supabase deployment topology
- [design-system/README.md](design-system/README.md) — front door for the v2 design system (tokens, components, gates)
- [design-system/SPEC.md](design-system/SPEC.md) — the complete v2 design system: roles, rules, rationale (never values)
- [design-system/TOKENS.md](design-system/TOKENS.md) — reconciled token inventory: every role, winning name, owner, and what it replaces
- [design-system/COMPONENTS.md](design-system/COMPONENTS.md) — the eight safety-component specifications plus the maturity matrix
- [brand/brand-mark.md](brand/brand-mark.md) — the PsychSift mark: arc-by-arc construction, colours, file set, and usage rules
- [design-system/DECISIONS.md](design-system/DECISIONS.md) — conflicts C1–C5 resolved, clinical Q&A record, assumptions, blocked items
- [design-system/GATES.md](design-system/GATES.md) — every design-system rule paired with its enforcement status
- [design-system/FIX-GUIDE.md](design-system/FIX-GUIDE.md) — Hazard 1–2 sweep dispositions (Fixed / Documented / Deferred / Out-of-scope)

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (architecture and design, plus the `design-system/` and `decisions/` folders), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [design-system/HANDOVER-2026-08-07.md](design-system/HANDOVER-2026-08-07.md) — Design system — handover, 7 August 2026 — Read AGENTS.md first — it is the highest-priority source of truth for rules and gates.
- [decisions/ccz4hb-review-coverage.md](decisions/ccz4hb-review-coverage.md) — Decision: restoring automated review coverage (#CCZ4HB) — the row closed — but see the 2026-09-02 correction below, which removes the premise that decision rested on.

## Governance, safety, privacy

## Process and review

- [process-hardening.md](process-hardening.md) — verification gates, CI expectations, known debts
- [testing.md](testing.md) — test execution, focused/live commands, Playwright ownership, flake policy
- [development-speed-playbook.md](development-speed-playbook.md) — going faster without weakening any gate: arbiter, receipts, narrow selection, worktree reuse
- [ward-flow-clinician-check.md](ward-flow-clinician-check.md) — one-page plain-English check of the four-stage bed model, for a ward clinician
- [ward-flow-phase-6-7-decisions.md](ward-flow-phase-6-7-decisions.md) — owner decisions settled before Phases 6 and 7 are designed
- [ward-flow-phase-6-7-kickoff-prompt.md](ward-flow-phase-6-7-kickoff-prompt.md) — paste-in prompt to open the Phase 6 and 7 design conversation
- [phone-chrome-physical-acceptance.md](phone-chrome-physical-acceptance.md) — labelled Safari and cold-launch PWA acceptance matrix
- [productivity-workflows.md](productivity-workflows.md) — repo workflow planners (flightplan, triage, rag-lab, …)
- [codex-review-protocol.md](codex-review-protocol.md) — historical inherited review protocol; current handling is in [agents/codex-github-review.md](agents/codex-github-review.md)
- [branch-cleanup-guide.md](branch-cleanup-guide.md) — branch hygiene workflow

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (process, plus the `agents/` rule files `AGENTS.md` delegates to), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [agents/bug-hunter-shortcut.md](agents/bug-hunter-shortcut.md) — Bug-Hunter Shortcut — When the user types exactly bug-hunter as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for targete…
- [agents/claude-hook-scripts.md](agents/claude-hook-scripts.md) — Claude Code Hook Scripts — .claude/hooks/*.sh runs on Linux web containers as well as on the Windows workstation, and the workstation cannot see the thing that breaks…
- [agents/codex-cloud-environment.md](agents/codex-cloud-environment.md) — Codex Cloud Environment — Codex Cloud uses an isolated Linux container and does not inherit desktop files, credentials, OAuth sessions, MCP authentication, local serv…
- [agents/codex-dependency-shortcut.md](agents/codex-dependency-shortcut.md) — Codex Dependency Shortcut — When the user types exactly dependency as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for safe de…
- [agents/codex-desktop-worktree-setup.md](agents/codex-desktop-worktree-setup.md) — Codex Desktop Worktree Setup — It must work before node_modules exists, validate Node 24/npm 11, reuse only a complete byte-identical local installation, and otherwise run…
- [agents/codex-github-review.md](agents/codex-github-review.md) — Codex GitHub Review Behavior & Auto-Fixer — These instructions apply to Codex GitHub pull request reviews and Codex tasks started from PR comments.
- [agents/codex-productivity-defaults.md](agents/codex-productivity-defaults.md) — Codex Productivity Defaults
- [agents/codex-reasoning-effort.md](agents/codex-reasoning-effort.md) — Codex Reasoning Effort Calibration
- [agents/codex-review-throttling.md](agents/codex-review-throttling.md) — Codex Review Throttling & Thread Resolution — Do not review branches opportunistically.
- [agents/cursor-cloud.md](agents/cursor-cloud.md) — Cursor Cloud Specific Instructions — Durable notes for Cloud Agents.
- [agents/dead-code-deletion.md](agents/dead-code-deletion.md) — Deleting Code You Believe Is Dead — "Nothing imports it" is necessary and nowhere near sufficient.
- [agents/external-skill-precedence.md](agents/external-skill-precedence.md) — External Skill Precedence and Evidence — User-global skills and output-style plugins are installed outside this repo and know nothing about its contracts.
- [agents/pull-request-workflow.md](agents/pull-request-workflow.md) — Pull Request Workflow — Open PR heads go stale whenever main advances.
- [agents/repository-skills-and-issues.md](agents/repository-skills-and-issues.md) — Repository Skills and Outstanding-Work Memory — Automatically apply repo-local skills under .agents/skills/ when their descriptions match the user's request.
- [agents/test-deletion-guard.md](agents/test-deletion-guard.md) — Deleting tests, or letting a tool delete them for you — On 2026-08-31 a commit on PR #2481 titled "test(ui):
- [agents/upload-shortcut.md](agents/upload-shortcut.md) — Upload Shortcut — When the user types exactly:
- [agents/verification-gates.md](agents/verification-gates.md) — Verification Gates and the Gate Arbiter — check:gate-manifest enforces a one-way invariant:
- [agents/wiring-and-bundle-budget.md](agents/wiring-and-bundle-budget.md) — Page Wiring and Bundle Budget — Interactive controls and routes follow conventions the codebase already holds to.

## Plans and workstreams (living)

- [pr-handoff-stop-cross-agent-gap.md](pr-handoff-stop-cross-agent-gap.md) — why the PR-babysit budget is hook-enforced for Claude Code but prose-only for Codex and Cursor, and what parity would require (ledger `#258`)
- [superpowers/](superpowers/) — agent-authored plans and specs

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (the Ward Flow developer-gated prototype's context, decisions, roadmap, ledgers and dated handovers), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [ward-flow-complete-ledger.md](ward-flow-complete-ledger.md) — Ward Flow — the complete ledger, Phases 1 to 5 — The single cross-session record of everything built.
- [ward-flow-context.md](ward-flow-context.md) — Ward Flow — complete context — Everything a session needs to work on Ward Flow, in one file.
- [ward-flow-phase-2-kickoff.md](ward-flow-phase-2-kickoff.md) — Ward Flow Phase 2 — kickoff brief for a fresh session — Paste the block at the bottom of this file into a new chat.
- [ward-flow-phase-3-handover.md](ward-flow-phase-3-handover.md) — Ward Flow Phase 3 — session handover — Rewritten 2026-08-23, at the end of session 3.
- [ward-flow-phase-3-ledger.md](ward-flow-phase-3-ledger.md) — ward-flow-phase-3-ledger
- [ward-flow-phase-3-rulings.md](ward-flow-phase-3-rulings.md) — Ward Flow Phase 3 — every decision made on the product owner's behalf — 73 rulings, made across three sessions while executing the 12-task plan.
- [ward-flow-phase-5-handover.md](ward-flow-phase-5-handover.md) — Ward Flow Phase 5 — session handover — Written 2026-08-26, before the merge;
- [ward-flow-phase-5-kickoff-prompt.md](ward-flow-phase-5-kickoff-prompt.md) — Ward Flow Phase 5 — kickoff prompt — Paste the block below into a fresh session as its first message.
- [ward-flow-phase-handoff.md](ward-flow-phase-handoff.md) — Ward Flow — phase handoff — Durable record of decisions taken while executing the Ward Flow phase plans.
- [ward-flow-pinned-clock-handover.md](ward-flow-pinned-clock-handover.md) — Ward Flow — the pinned-clock defect: session handover — Why this file exists.
- [ward-flow-roadmap.md](ward-flow-roadmap.md) — Ward Flow roadmap and settled decisions — What this file is for.
- [ward-management-context.md](ward-management-context.md) — Ward Flow — domain glossary — The ubiquitous language for the ward-management context.
- [ward-management-decisions.md](ward-management-decisions.md) — Ward Flow — architecture decisions — Decisions for the ward-management context that are hard to reverse, surprising without context, and the result of a real trade-off.
- [ward-management-mode-map.md](ward-management-mode-map.md) — Ward Flow mode map — Superseded: the nine-mode strip this document describes is superseded by the role-first structure (flow coordinator, ED, ward, transport off…

## Subdirectory map

| Directory                    | What lives there                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [agents/](agents/)           | Agent-rule reference files `AGENTS.md` delegates to by name — the full text of rules its always-loaded core only points at |
| [audit/](audit/)             | One kept point-in-time repository audit (the rest left with PsychSift on 26 September 2026)                                |
| [superpowers/](superpowers/) | Agent-authored plans and specs                                                                                             |

## Point-in-time records (historical — do not update)

Dated status reports, reviews, and operator decisions. They describe the repo
as it was on that date; supersede with a new dated document rather than editing.

- [audit/full-repository-audit-2026-09-02.md](audit/full-repository-audit-2026-09-02.md) — full repository audit (25 lanes, independently verified findings, closed-off sub-projects, machine evidence, Stage-5 adversarial review; audit only, nothing acted on except one-line documentation corrections). Kept past PsychSift's 26 September 2026 retirement because current security code cites its finding IDs; the other three dated repo audits and the `release-source-metadata-debt-2026-06-30.json` policy record left with PsychSift and remain on `origin/main`.

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (dated records and the `superpowers/` and `ward-flow-phase-3-workspace/` folders — historical; do not update), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [superpowers/plans/2026-08-14-ward-management-mockups.md](superpowers/plans/2026-08-14-ward-management-mockups.md) — Ward Management Mockup Generation Plan — Goal: Produce and validate three independent desktop visual directions for the approved synthetic WA mental-health ward-management command m…
- [superpowers/plans/2026-08-18-ward-flow-model-and-modes.md](superpowers/plans/2026-08-18-ward-flow-model-and-modes.md) — Ward Flow model correction and missing modes — Implementation Plan — Goal: Close the four model defects that let Ward Flow propose an unlawful or impossible placement, then add the four modes the WA pathway ne…
- [superpowers/plans/2026-08-18-ward-flow-phase-1-model.md](superpowers/plans/2026-08-18-ward-flow-phase-1-model.md) — Ward Flow Phase 1 — the model — Implementation Plan — Goal: Replace the flat hospital/patient fixture with a model that can express WA metro psychiatry patient flow correctly — sites that have e…
- [superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md](superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md) — Ward Flow Phase 2 — the coordinator screen — Implementation Plan — Goal: Build the flow coordinator's single screen — the one surface that replaces the phone-around — and retire Constellation into it.
- [superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md](superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md) — Ward Flow Phase 3 — the other three roles — Implementation Plan — Goal: Make Ward Flow move — add the emergency department, ward and transport officer screens plus the coordinator's live tracker, on top of…
- [superpowers/plans/2026-08-25-ward-flow-phase-4-specialist-boards.md](superpowers/plans/2026-08-25-ward-flow-phase-4-specialist-boards.md) — Ward Flow Phase 4 — specialist boards, implementation plan — Goal: Build the eleven Phase 4 items — a scarcer scenario, mid-flight urgency and legal-status changes, the undo the prototype has never had…
- [superpowers/plans/2026-08-25-ward-flow-sandbox-and-design-repair.md](superpowers/plans/2026-08-25-ward-flow-sandbox-and-design-repair.md) — Ward Flow — its own sandbox, and the design repair — Goal: Move Ward Flow into its own administrator-gated sandbox, reachable only through the developer page, and repair the navigation, landmar…
- [superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md](superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md) — Ward Flow — standalone prototype, and the navigation repair — Goal: Take Ward Flow out of the clinical application entirely — reachable only from the developer hub — and repair the navigation, landmark…
- [superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md](superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md) — Ward Flow Phase 5 — Bed availability becomes real — Goal: wards record when their beds are actually coming free, and the coordinator's capacity figure becomes a number that can be planned agai…
- [superpowers/plans/2026-08-26-ward-flow-sidebar-house-pattern.md](superpowers/plans/2026-08-26-ward-flow-sidebar-house-pattern.md) — Ward Flow sidebar — adopt the repository's house sidebar pattern — Goal: Give Ward Flow the same sidebar _approach and structure_ the clinical application already uses, tailored to Ward Flow's own tokens, st…
- [superpowers/specs/2026-08-14-ward-management-design.md](superpowers/specs/2026-08-14-ward-management-design.md) — Ward Management — Statewide Mental Health Patient Flow Design — Status: Approved design direction;
- [superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md](superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md) — Ward Flow — metro psychiatry patient flow, design — Status: Approved design, awaiting implementation plan.
- [superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md](superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md) — Ward Flow Phase 3 — the other three roles — Design — Status: approved in brainstorming 2026-08-19.
- [superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md](superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md) — Ward Flow Phase 4 — specialist boards, design — Date: 2026-08-25. Product owner:
- [superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md](superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md) — Ward Flow Phase 5 — Bed availability becomes real — Status: design, approved in chat 2026-08-26.
- [ward-flow-phase-3-workspace/README.md](ward-flow-phase-3-workspace/README.md) — Ward Flow Phase 3 — subagent-driven-development workspace (durable copy) — This directory is a committed copy of the live superpowers workspace at .superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/, taken 2…
- [ward-flow-phase-3-workspace/clinical-changes-report.md](ward-flow-phase-3-workspace/clinical-changes-report.md) — Clinical changes report — ED access target to 24h, and "Bed need confirmed" priority factor — Both changes came directly from the product owner (a practising psychiatrist), answering a direct question on 2026-08-22:
- [ward-flow-phase-3-workspace/concurrent-session-inventory.md](ward-flow-phase-3-workspace/concurrent-session-inventory.md) — Concurrent session inventory — ward-management-design worktree — Read-only diagnostic.
- [ward-flow-phase-3-workspace/flow-diagram-fix-brief.md](ward-flow-phase-3-workspace/flow-diagram-fix-brief.md) — Flow-diagram restriction-notice fix — brief — Standalone fix, split out of Task 8 at the user's request.
- [ward-flow-phase-3-workspace/flow-diagram-fix-report.md](ward-flow-phase-3-workspace/flow-diagram-fix-report.md) — Flow-diagram restriction-notice fix — report — Worked at C:\Users\joshs\.codex\worktrees\ward-management-design\Database, branch codex/ward-management-design, starting HEAD 3b4bf4152.
- [ward-flow-phase-3-workspace/handover-stage-coherence-report.md](ward-flow-phase-3-workspace/handover-stage-coherence-report.md) — Ruling R64 — handover-ready stage coherence fix — Five patients were recorded at handover_ready in a state the reducer's own rules make unreachable:
- [ward-flow-phase-3-workspace/preflight-tasks-9-to-12.md](ward-flow-phase-3-workspace/preflight-tasks-9-to-12.md) — Pre-flight scan of Tasks 9 to 12 — session 3, measured against the branch at a75c508f6 — Every number below was produced by running the real fixture and the real derivations, not by reading the code and reasoning.
- [ward-flow-phase-3-workspace/progress.md](ward-flow-phase-3-workspace/progress.md) — SDD ledger — plan: docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md — Spec: docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md (reachable, 19 sections) Worktree:
- [ward-flow-phase-3-workspace/task-1-brief.md](ward-flow-phase-3-workspace/task-1-brief.md) — task-1-brief
- [ward-flow-phase-3-workspace/task-1-report.md](ward-flow-phase-3-workspace/task-1-report.md) — Task 1 report — The model and the fixture — Branch: codex/ward-management-design Worktree:
- [ward-flow-phase-3-workspace/task-1-review.md](ward-flow-phase-3-workspace/task-1-review.md) — Task 1 review — the model and the fixture — Reviewed range: fbd9a8628..39042cd61 (commits f3b1f74f0, 39042cd61).
- [ward-flow-phase-3-workspace/task-10-brief.md](ward-flow-phase-3-workspace/task-10-brief.md) — task-10-brief
- [ward-flow-phase-3-workspace/task-10-report.md](ward-flow-phase-3-workspace/task-10-report.md) — Task 10 report — the coordinator's live tracker — Commit: b2e0a92aa on codex/ward-management-design.
- [ward-flow-phase-3-workspace/task-11-brief.md](ward-flow-phase-3-workspace/task-11-brief.md) — task-11-brief
- [ward-flow-phase-3-workspace/task-11-report.md](ward-flow-phase-3-workspace/task-11-report.md) — Task 11 report — the emergency department screen — Branch codex/ward-management-design, committed at 66c4f7b80 (parent dc5daffa0, itself on top of b2e0a92aa).
- [ward-flow-phase-3-workspace/task-12-addendum.md](ward-flow-phase-3-workspace/task-12-addendum.md) — Task 12 — controller addendum (read this WITH the brief; where they differ, this wins) — Task 12 is the last task and the one that proves the phase.
- [ward-flow-phase-3-workspace/task-12-brief.md](ward-flow-phase-3-workspace/task-12-brief.md) — task-12-brief
- [ward-flow-phase-3-workspace/task-12-journey-design.md](ward-flow-phase-3-workspace/task-12-journey-design.md) — Task 12 journey — defect verification and corrected design — Offline analysis only.
- [ward-flow-phase-3-workspace/task-2-brief.md](ward-flow-phase-3-workspace/task-2-brief.md) — task-2-brief
- [ward-flow-phase-3-workspace/task-2-report.md](ward-flow-phase-3-workspace/task-2-report.md) — Task 2 report: the reducer — ReferralDraft, the WardFlowEvent discriminated union (15 variants, one per spec §6 row), and EVENT_ROLE:
- [ward-flow-phase-3-workspace/task-2-review.md](ward-flow-phase-3-workspace/task-2-review.md) — Task 2 review: the reducer — difference is the brief's leading // tests/ward-flow-reducer.test.ts comment line, not present in the committed file).
- [ward-flow-phase-3-workspace/task-3-brief.md](ward-flow-phase-3-workspace/task-3-brief.md) — task-3-brief
- [ward-flow-phase-3-workspace/task-3-report.md](ward-flow-phase-3-workspace/task-3-report.md) — Task 3 report — Ward Flow Phase 3: the contracts — One file created, verbatim from the brief:
- [ward-flow-phase-3-workspace/task-3-review.md](ward-flow-phase-3-workspace/task-3-review.md) — Task 3 review — the contracts (WF-001 fix round) — Reviewed: e7faa7b5a..cbdd47f71 (two commits), file under review tests/ward-flow-contracts.test.ts.
- [ward-flow-phase-3-workspace/task-4-brief.md](ward-flow-phase-3-workspace/task-4-brief.md) — task-4-brief
- [ward-flow-phase-3-workspace/task-4-report.md](ward-flow-phase-3-workspace/task-4-report.md) — Task 4 report: the provider, the clock and the layout — the lazy third-arg form, so the fixture is deep-cloned exactly once at mount, never re-seeded on a later render.
- [ward-flow-phase-3-workspace/task-4-review.md](ward-flow-phase-3-workspace/task-4-review.md) — Task 4 review: the provider, the clock and the layout — NOW_ANCHOR), the useReducer(wardFlowReducer, undefined, seedWardFlowState) lazy-seed form, the clock's pin/tick contract, useWardFlow's cons…
- [ward-flow-phase-3-workspace/task-5-brief.md](ward-flow-phase-3-workspace/task-5-brief.md) — task-5-brief
- [ward-flow-phase-3-workspace/task-5-report.md](ward-flow-phase-3-workspace/task-5-report.md) — Task 5 report: the coordinator rewire — imports. Added useWardFlow() and destructured { movements, rejections, now, dispatch }.
- [ward-flow-phase-3-workspace/task-5-review.md](ward-flow-phase-3-workspace/task-5-review.md) — Task 5 review: the coordinator rewire — dispatch, cap-at-3 multi-select, restrictionNotice with the verbatim strings, refusals section present-when-empty) is implemented as specifi…
- [ward-flow-phase-3-workspace/task-6-brief.md](ward-flow-phase-3-workspace/task-6-brief.md) — task-6-brief
- [ward-flow-phase-3-workspace/task-6-fix-round-3-findings.md](ward-flow-phase-3-workspace/task-6-fix-round-3-findings.md) — Task 6 — fix round 3 findings (the last round for this task) — Two findings from the Task 6 review.
- [ward-flow-phase-3-workspace/task-6-re-review-rounds-3-4.md](ward-flow-phase-3-workspace/task-6-re-review-rounds-3-4.md) — Task 6 — Scoped re-review of fix rounds 3 and 4 — Reviewed at 845b7d456 (worktree C:\Users\joshs\.codex\worktrees\ward-management-design\Database, branch codex/ward-management-design, tree c…
- [ward-flow-phase-3-workspace/task-6-report.md](ward-flow-phase-3-workspace/task-6-report.md) — Task 6 report: the other ten routes — Branch codex/ward-management-design, base commit 868853b58.
- [ward-flow-phase-3-workspace/task-6-review.md](ward-flow-phase-3-workspace/task-6-review.md) — Task 6 review: the other ten routes — Reviewed diff 868853b58..18f57736f (3 commits) against task-6-brief.md and task-6-report.md.
- [ward-flow-phase-3-workspace/task-6a-brief.md](ward-flow-phase-3-workspace/task-6a-brief.md) — Task 6A — the post-examination clock counts up, and no deadline is claimed — Inserted between Task 6 and Task 7 by controller rulings F15–F17, in response to the clinician answering the phase's standing open question.
- [ward-flow-phase-3-workspace/task-6a-re-review.md](ward-flow-phase-3-workspace/task-6a-re-review.md) — Task 6A fix round 1 — scoped re-review — Reviewer session. Read-only re-review of commit f1e32dcd473eb435e5e952e7896fa4060e9be332 on branch codex/ward-management-design, worktree C:…
- [ward-flow-phase-3-workspace/task-6a-report.md](ward-flow-phase-3-workspace/task-6a-report.md) — Task 6A report — the post-examination clock counts up, and no deadline is claimed — Implementer session. Branch codex/ward-management-design, worked entirely in C:\Users\joshs\.codex\worktrees\ward-management-design\Database.
- [ward-flow-phase-3-workspace/task-6a-review.md](ward-flow-phase-3-workspace/task-6a-review.md) — Task 6A review — the post-examination clock counts up, and no deadline is claimed — Reviewer session. Read-only review of commit 2d8200a09b124ef61ee5692c812306bf5dd6c6fa on branch codex/ward-management-design, worktree C:\Us…
- [ward-flow-phase-3-workspace/task-7-addendum.md](ward-flow-phase-3-workspace/task-7-addendum.md) — Task 7 — controller addendum (read this WITH the brief; where they differ, this wins) — Four corrections found in a pre-flight scan of task-7-brief.md against the branch as it stands at Task 6A.
- [ward-flow-phase-3-workspace/task-7-brief.md](ward-flow-phase-3-workspace/task-7-brief.md) — task-7-brief
- [ward-flow-phase-3-workspace/task-7-report.md](ward-flow-phase-3-workspace/task-7-report.md) — Task 7 report — the coordinator's phone pins Confirm — coordinator-screen.tsx's nested double-requestAnimationFrame scrollIntoView effect (and the shortlistColumnRef it depended on) is deleted.
- [ward-flow-phase-3-workspace/task-8-addendum.md](ward-flow-phase-3-workspace/task-8-addendum.md) — Task 8 — controller addendum (read this WITH the brief; where they differ, this wins) — Written in session 3 after scanning task-8-brief.md against the branch as it stands at a75c508f6.
- [ward-flow-phase-3-workspace/task-8-brief.md](ward-flow-phase-3-workspace/task-8-brief.md) — task-8-brief
- [ward-flow-phase-3-workspace/task-8-report.md](ward-flow-phase-3-workspace/task-8-report.md) — Task 8 report — the ward screen — unit's own view, resolved via unitById(unitId).
- [ward-flow-phase-3-workspace/task-9-brief.md](ward-flow-phase-3-workspace/task-9-brief.md) — task-9-brief
- [ward-flow-phase-3-workspace/task-9-report.md](ward-flow-phase-3-workspace/task-9-report.md) — Task 9 report — the transport officer's phone — Worktree: C:\Users\joshs\.codex\worktrees\ward-management-design\Database, branch codex/ward-management-design.
- [ward-flow-phase-3-workspace/transport-leg-helper-report.md](ward-flow-phase-3-workspace/transport-leg-helper-report.md) — Transport leg helper — report — Scope: add one small pure function separating the discrete transport leg from transportStatusLabel's provider narrative, plus unit tests.
- [ward-flow-phase-3-workspace/transport-stage-coherence-report.md](ward-flow-phase-3-workspace/transport-stage-coherence-report.md) — Transport stage/stamp coherence fix — report — Commit: 1349c213fa6f3294a6a8fc22b0aded8c186e8429 Branch:
- [ward-flow-phase-3-workspace/whole-branch-review.md](ward-flow-phase-3-workspace/whole-branch-review.md) — Ward Flow Phase 3 — whole-branch review — Reviewer: independent whole-branch pass at 916816089, branch codex/ward-management-design.

## Maintenance rules

- Generated files (`site-map.md`) are updated only via their generator scripts.
- When adding a doc, add it to the matching section here; date the filename if
  it is a point-in-time record.
- When a maintained doc is superseded, mark it historical in place or replace
  it with a new dated document — there is no `archive/` folder on this line,
  and no automated check for inbound links, so update or remove them by hand.

<!-- docs-script-refs:historical-end -->
