# Ward Flow documentation index

<!-- last-checked: 2026-10-24 -->

_Updated 2026-10-24 - removed a duplicated link-check paragraph, listed every agent topic file, marked the two historical process playbooks and added operations, facts and decisions to Start here; Documentation owns._

> **Current Ward Flow work belongs in `BigSimmo/Ward-Flow`.** Start with the repository's
> [`AGENTS.md`](../AGENTS.md) and [`docs/ward-flow/README.md`](ward-flow/README.md). This index
> retains historical PsychSift-era entries; its old local-prototype and provider descriptions are
> not current Ward Flow instructions. Verify the Ward Flow remote before Git writes.

Start with the maintained entry points below. The inherited catalogue preserves historical
discovery; it is not a complete current inventory or proof that every listed procedure applies.
The [task contract](task-receipts.md) preserves one original objective and existing task IDs.

| I want to…                       | Start here                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Understand the prototype         | [Product overview](ward-flow/README.md)                                                                         |
| Try it locally                   | [Local first run](ward-flow/LOCAL-FIRST-RUN.md)                                                                 |
| Explore the coordinator workflow | [Coordinator guide](ward-flow/coordinator-guide-v2.md), with its stated source/screen evidence                  |
| Change code                      | [AGENTS.md](../AGENTS.md), [workflow](ward-flow/HOW-WE-WORK.md), then [current architecture](codebase-index.md) |
| Continue commissioned work       | [Task/receipt contract](task-receipts.md) and [plan navigation](ward-flow/plans/README.md)                      |
| Find historical context          | [Historical collections](#historical-collections) and [preserved catalogue](#historical-discovery-catalogue)    |

`npm run docs:check-links` checks inline local paths and supported heading anchors in maintained
sections of **every Git-tracked Markdown file**, including root and nested agent instructions.
Paired historical markers exclude preserved sections; a banner alone does not exclude text. Stage
new documents before the check, because untracked files are not scanned. To check one file, use
`node scripts/ward-flow/check-doc-links.mjs --file <path> --anchors` (repeat `--file`). Web URLs,
reference-style links and renderer extensions are not validated. `npm run docs:check-scripts`
checks maintained npm references. None of these checks proves prose is current; the full rules are
in [DOCS-SYSTEM.md](DOCS-SYSTEM.md).

## Start here

| Doc                                                                                                       | What it is                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [codebase-index.md](codebase-index.md)                                                                    | Maintained Ward orientation followed by preserved historical architecture                            |
| [Operations runbook](ward-flow/OPERATIONS-RUNBOOK.md) · [DATABASE.md](ward-flow/DATABASE.md)              | Running the hosted prototype; the database provider and connection rules                             |
| [FACTS.md](FACTS.md) · [decisions.md](ward-flow/decisions.md)                                             | Generated current facts; the owner's recorded decisions                                              |
| [site-map.md](site-map.md)                                                                                | **Generated** route map — regenerate with `npm run docs:update`, verify with `npm run sitemap:check` |
| [ward-flow/README.md](ward-flow/README.md) · [ward-flow/LOCAL-FIRST-RUN.md](ward-flow/LOCAL-FIRST-RUN.md) | **Ward Flow** local bed-flow prototype — product entry + UI boot on this machine                     |
| [DOCS-SYSTEM.md](DOCS-SYSTEM.md)                                                                          | **Documentation system** - pipeline, registry, Ward Flow tip lock, recheck triggers                  |
| [scripts-index.md](scripts-index.md)                                                                      | Curated map of `scripts/` and the `package.json` command surface by purpose                          |
| [Context7](agents/context7.md)                                                                            | Maintained connector use, source identity and version verification                                   |
| [Backend](../backend/ward-flow/README.md)                                                                 | Separate synthetic shared-workspace backend and local API checks                                     |
| [Public CI](ward-flow/PUBLIC-CI.md)                                                                       | Ward workflow scope and acceptance evidence                                                          |
| [Railway operations](ward-flow/RAILWAY-OPERATIONS.md)                                                     | Diagnosis of separately authorised Ward hosting tasks                                                |

## Ward Flow Documentation Map

| Area                            | Key documents                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Root & AI Entry Points**      | [`../AGENTS.md`](../AGENTS.md) · [`../CLAUDE.md`](../CLAUDE.md) · [`../GEMINI.md`](../GEMINI.md) · [`ward-flow/README.md`](ward-flow/README.md)                                                                                                                                                                                                                          |
| **Builder & Coordinator Guide** | [`ward-flow/HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md) · [`ward-flow/LOCAL-FIRST-RUN.md`](ward-flow/LOCAL-FIRST-RUN.md) · [`ward-flow/coordinator-guide-v2.md`](ward-flow/coordinator-guide-v2.md) (`ward-flow/FOR-A-BED-COORDINATOR.md`) · [`ward-flow/START-LOCAL-CHAT.md`](ward-flow/START-LOCAL-CHAT.md) (kept stub, superseded) (`ward-flow/FOR-NEW-DEVELOPERS.md`) |
| **User Testing & Demo**         | [`ward-flow/clinician-check-questions.md`](ward-flow/clinician-check-questions.md) (`ward-flow/USER-TESTING-GUIDE.md`) · [`ward-flow/DEMO-SCRIPT.md`](ward-flow/DEMO-SCRIPT.md) (`ward-flow/DEMO-PRESENTATION-SCRIPT.md`)                                                                                                                                                |
| **Decisions & Task Ledger**     | [`ward-flow/OWNER-RULINGS.md`](ward-flow/OWNER-RULINGS.md) · [`ward-flow/decisions.md`](ward-flow/decisions.md) · [`task-receipts.md`](task-receipts.md) · [`ward-flow-task-ledger.md`](ward-flow-task-ledger.md) · [`ward-flow/STATUS.md`](ward-flow/STATUS.md)                                                                                                         |
| **Design System (v9/v10)**      | [`../design/v9/design-system-v9.md`](../design/v9/design-system-v9.md) · [`ward-flow/SCREEN-DEFINITION-OF-DONE.md`](ward-flow/SCREEN-DEFINITION-OF-DONE.md) · [`ward-flow/SCREEN-VERIFICATION.md`](ward-flow/SCREEN-VERIFICATION.md)                                                                                                                                     |
| **Screens, Routes & Code Map**  | [`ward-flow/SCREEN-MAP.md`](ward-flow/SCREEN-MAP.md) · [`ward-flow/code-map/README.md`](ward-flow/code-map/README.md) · [`codebase-index.md`](codebase-index.md) · [`site-map.md`](site-map.md) · [`ward-flow/organisation/registry.json`](ward-flow/organisation/registry.json) (`ward-flow/ORGANISATION.md`)                                                           |
| **Reference Data & Sources**    | [`ward-flow/reference-data/PACK_README.md`](ward-flow/reference-data/PACK_README.md) (`ward-flow/reference-data/README.md`) · [`ward-flow/reference-data/PROVENANCE-AUDIT-2026-09-18.md`](ward-flow/reference-data/PROVENANCE-AUDIT-2026-09-18.md) (`ward-flow/reference-data/SOURCES.md`)                                                                               |
| **Backend, CI & Hosting**       | [`../backend/ward-flow/README.md`](../backend/ward-flow/README.md) · [`ward-flow/PUBLIC-CI.md`](ward-flow/PUBLIC-CI.md) · [`ward-flow/RAILWAY-OPERATIONS.md`](ward-flow/RAILWAY-OPERATIONS.md) · [`hosting.md`](hosting.md)                                                                                                                                              |
| **Historical Archives**         | [`ARCHIVE.md`](ARCHIVE.md) (removed archives and how to restore them) · [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md) · [`ward-flow/RULES.md`](ward-flow/RULES.md)                                                                                                                                                                                            |

## Architecture

- [`codebase-index.md`](codebase-index.md) — maintained Ward Flow directory orientation and module map
- [`ward-flow/code-map/README.md`](ward-flow/code-map/README.md) — detailed code and test ownership snapshot across Ward Flow subsystems
- [`ward-flow/SCREEN-MAP.md`](ward-flow/SCREEN-MAP.md) — generated screen, route, and mockup inventory
- [`../design/v9/design-system-v9.md`](../design/v9/design-system-v9.md) — Ward Flow v9/v10 `--wf-*` design tokens and `src/components/wf/` primitive specification
- [`wiring-conventions.md`](wiring-conventions.md) — page/button wiring conventions, pre-commit checks, and dead-button / orphan-route gates
- [`../backend/ward-flow/README.md`](../backend/ward-flow/README.md) — synthetic-only shared-workspace backend contract; provider in [`ward-flow/DATABASE.md`](ward-flow/DATABASE.md)

## Governance, safety, privacy

- [`../SECURITY.md`](../SECURITY.md) — repository security policy, synthetic-data-only boundary, and vulnerability reporting
- [`ward-flow/governance/CLINICAL-SAFETY-CASE.md`](ward-flow/governance/CLINICAL-SAFETY-CASE.md) — ISO 14971 / DCB0129 clinical hazard log and safety case (stakeholder reference per Prototype Operating Mode §2)
- [`ward-flow/governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md`](ward-flow/governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md) — WA Mental Health Act 2014 statutory boundary and D5 / D-70 compliance reference
- [`ward-flow/governance/ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`](ward-flow/governance/ABORIGINAL-CULTURAL-SAFETY-CHARTER.md) — Aboriginal cultural safety charter, ALO coordination, and country/kinship design safeguards
- [`ward-flow/governance/PRODUCTION-READINESS.md`](ward-flow/governance/PRODUCTION-READINESS.md) — prototype vs production-pilot boundary and parked external review gates
- [`ward-flow/pre-pilot-site-checklist.md`](ward-flow/pre-pilot-site-checklist.md) — pre-pilot site readiness checklist for WA Health hospital deployments

## Process and review

- [`ward-flow/HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md) — picking up work, branches and file sign-out, commits, integration, testing and owner rules
- [`ward-flow/PUBLIC-CI.md`](ward-flow/PUBLIC-CI.md) — GitHub Actions workflow (`ward-flow.yml`) jobs, shards, and local equivalents
- [`testing.md`](testing.md) — local unit commands, run admission, Playwright projects and CI topology
- [`task-receipts.md`](task-receipts.md) — task lifecycle, canonical checkpoints, and sanitised receipt handoff
- [`agents/`](agents/) — topic rules `AGENTS.md` links to: [`git-publication.md`](agents/git-publication.md), [`checks-and-evidence.md`](agents/checks-and-evidence.md), [`task-efficiency.md`](agents/task-efficiency.md), [`building-ui.md`](agents/building-ui.md), [`wiring-and-bundle-budget.md`](agents/wiring-and-bundle-budget.md), [`cloud-ownership.md`](agents/cloud-ownership.md), [`shortcuts.md`](agents/shortcuts.md), [`shared-context-and-memory.md`](agents/shared-context-and-memory.md), [`dead-code-deletion.md`](agents/dead-code-deletion.md), [`test-deletion-guard.md`](agents/test-deletion-guard.md), [`codex-desktop-worktree-setup.md`](agents/codex-desktop-worktree-setup.md), [`codex-dependency-shortcut.md`](agents/codex-dependency-shortcut.md), [`context7.md`](agents/context7.md), [`figma-sync.md`](agents/figma-sync.md)
- Historical only, not current instructions: [`development-speed-playbook.md`](development-speed-playbook.md) (former PsychSift workflow, fully fenced as history); `process-hardening.md` was removed on 24 October 2026 (see [`ARCHIVE.md`](ARCHIVE.md))

## Maintenance rules

- Generated files ([`site-map.md`](site-map.md), [`scripts-index.md`](scripts-index.md), and the Ward Flow generated indexes listed in [`DOCS-SYSTEM.md`](DOCS-SYSTEM.md)) are updated only via their generator scripts.
- When adding a maintained doc, link it from the matching section here and follow the naming, lifecycle and evidence conventions in [DOCS-SYSTEM.md](DOCS-SYSTEM.md).
- When a maintained doc is superseded, mark it with a top `SUPERSEDED` banner, fence retired script/path sections with paired `docs-script-refs:historical-start` / `docs-script-refs:historical-end` HTML comments, or move dated Ward Flow records to `docs/ward-flow/archive/` as documented in [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md). Run `npm run docs:check-links` and `npm run docs:check-scripts` to verify inbound links and script references.

## Historical collections

| Collection                                        | How to use it                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [Plan navigation](ward-flow/plans/README.md)      | Dated plans and checkpoints from both existing plan roots; the task record establishes commissioned work  |
| [Archive and restoration record](ARCHIVE.md)      | Archived handovers, reports and other dated material, with the retained Git revision                      |
| [Earlier archive note](ward-flow/ARCHIVE-NOTE.md) | Earlier trims and their source revisions                                                                  |
| [Lessons](ward-flow/lessons/README.md)            | Historical repository copy; its index does not turn a lesson into a current rule                          |
| [Code map](ward-flow/code-map/README.md)          | Maintained navigation to scoped updates and the historical subsystem census                               |
| [Legacy decision register](ward-flow-ledger.md)   | Historical decision/identity evidence; new decisions belong in the [decision log](ward-flow/decisions.md) |

The retained `handover/` rubric has a drawing consumer; `handovers/` was archived on 18 October.
Folder names and old unchecked boxes do not establish active work. Keep consumer references and
restoration provenance intact; this navigation change moves no files.

## Historical discovery catalogue

<details>
<summary>Open the inherited discovery catalogue — historical, not current task instructions</summary>

Entries below include inherited PsychSift and dated material. Open a document's boundary and current
consumers before applying its advice; keep original incident commands/results as evidence.

<!-- docs-script-refs:historical-start -->

### Historical architecture & design catalogue

- [wiring-conventions.md](wiring-conventions.md) — page/button wiring conventions and the dead-button / orphan-route gates
- [search-chrome-behaviour.md](search-chrome-behaviour.md) — shared search-chrome contract: composer ownership, phone edge-to-edge dock, hide/reveal reserves
- [mockup-retirement-policy.md](mockup-retirement-policy.md) — when a mockup may be deleted, who decides, what evidence is required, and the three tiers that keep developer-gated prototypes out of cleanup scope
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

- [decisions/ccz4hb-review-coverage.md](decisions/ccz4hb-review-coverage.md) — Decision: restoring automated review coverage (#CCZ4HB) — the row closed — but see the 2026-09-02 correction below, which removes the premise that decision rested on.

### Historical process & review catalogue

- [testing.md](testing.md) — test execution, focused/live commands, Playwright ownership, flake policy
- [development-speed-playbook.md](development-speed-playbook.md) — going faster without weakening any gate: arbiter, receipts, narrow selection, worktree reuse
- [ward-flow-phase-6-7-decisions.md](ward-flow-phase-6-7-decisions.md) — owner decisions settled before Phases 6 and 7 are designed

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (process, plus the `agents/` rule files `AGENTS.md` delegates to), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [agents/codex-dependency-shortcut.md](agents/codex-dependency-shortcut.md) — Codex Dependency Shortcut — When the user types exactly dependency as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for safe de…
- [agents/codex-desktop-worktree-setup.md](agents/codex-desktop-worktree-setup.md) — Codex Desktop Worktree Setup — It must work before node_modules exists, validate Node 24/npm 11, reuse only a complete byte-identical local installation, and otherwise run…
- [agents/dead-code-deletion.md](agents/dead-code-deletion.md) — Deleting Code You Believe Is Dead — "Nothing imports it" is necessary and nowhere near sufficient.
- [agents/test-deletion-guard.md](agents/test-deletion-guard.md) — Deleting tests, or letting a tool delete them for you — On 2026-08-31 a commit on PR #2481 titled "test(ui):
- [agents/wiring-and-bundle-budget.md](agents/wiring-and-bundle-budget.md) — Page Wiring and Bundle Budget — Interactive controls and routes follow conventions the codebase already holds to.

## Plans and workstreams (living)

- [superpowers/](superpowers/) — agent-authored plans and specs

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (the Ward Flow developer-gated prototype's context, decisions, roadmap, ledgers and dated handovers), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [ward-flow-context.md](ward-flow-context.md) — Ward Flow — complete context — Everything a session needs to work on Ward Flow, in one file.
- [ward-flow-phase-3-rulings.md](ward-flow/archive/dated-notes/ward-flow-phase-3-rulings.md) — Ward Flow Phase 3 — every decision made on the product owner's behalf — 73 rulings, made across three sessions while executing the 12-task plan.
- [ward-flow-phase-5-handover.md](ward-flow-phase-5-handover.md) — Ward Flow Phase 5 — session handover — Written 2026-08-26, before the merge;
- [ward-management-decisions.md](ward-flow/archive/dated-notes/ward-management-decisions.md) — Ward Flow — architecture decisions — Decisions for the ward-management context that are hard to reverse, surprising without context, and the result of a real trade-off.

## Subdirectory map

| Directory                    | What lives there                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [ward-flow/](ward-flow/)     | Dedicated Ward Flow product, design, governance, reference-data, code-map, and archive documentation                       |
| [agents/](agents/)           | Agent-rule reference files `AGENTS.md` delegates to by name — the full text of rules its always-loaded core only points at |
| [superpowers/](superpowers/) | October 2026 agent-authored plans, plus the older plans and specs that code or tests still cite                            |

## Point-in-time records (historical — do not update)

Dated status reports, reviews, and operator decisions. They describe the repo
as it was on that date; supersede with a new dated document rather than editing.
The dated audits, reports and handovers left the live tree on 18 October 2026; see [`ARCHIVE.md`](ARCHIVE.md).

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (dated records and the `superpowers/` folder — historical; do not update; the `ward-flow-phase-3-workspace/` folder and most of `archive/` were removed in the 15 Oct 2026 docs trim, see [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md)), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md](superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md) — Ward Flow — metro psychiatry patient flow, design — Status: Approved design, awaiting implementation plan.
- [superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md](superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md) — Ward Flow Phase 4 — specialist boards, design — Date: 2026-08-25. Product owner:

<!-- docs-script-refs:historical-end -->

</details>
