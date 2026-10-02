# Documents and design drawings

This part covers `docs/ward-flow/` (measured at 1,284 files: 65 top-level files, 27 history/tooling
subfolders, and `mockups/` at 135 files) and `docs/ward-flow-task-ledger.md` (7,867 lines). Tip
`ace8e9ee8d` (this part's own commits sit on top, on `ward/extend-ward-flow-code-map`), date
25 September 2026. File counts are `find <dir> -type f | wc -l`; line counts are `wc -l`; every
"first written" date is `git log --follow --diff-filter=A --format=%ad --date=short -- <path>`
(oldest add, so a moved file keeps its original date). Status calls (CURRENT / GENERATED /
SUPERSEDED / DATED NOTE) are read from each file's own banner or opening lines, not guessed, except
where marked "(inferred)". Back to [the code map index](README.md).

## Top-level files in `docs/ward-flow/` (65)

### CURRENT — read these

- **`README.md`** (151 lines) — the only entry point (says so explicitly: "any other file that says
  'start here' is historical"). What Ward Flow is, where the current build lives, sources of truth,
  how to run it, "the four documents", traps. Updated 21 September 2026; some detail (the
  organisation checkpoint table) is newer than the rest.
- **`STATUS.md`** (277 lines) — where things stand: what is built, what is deferred, what needs the
  owner. Last written 25 September 2026, keeps the 17–21 September text below where still true. File
  has a mojibake artefact (`â€”` for em dash) from an encoding mismatch — readable but ugly; a
  future editor should not "fix" it into new prose without checking the whole file's encoding.
- **`HOW-WE-WORK.md`** (152 lines) — how any AI builder picks up, builds, tests, commits and hands
  back work. Written 17 September 2026; "where an older process document disagrees, this file
  wins." Sections: picking up work, branches/worktrees, commits, folding, testing (incl. the 17 and
  21 September speed rules), owner rules that fail builds, model tiers, asking/recording owner
  questions, superseding a document, protected work, "brief doesn't cover it, stop."
- **`LOCAL-FIRST-RUN.md`** (75 lines) — how to boot the UI only; product/process entry stays
  `README.md`. Has a leading UTF-8 BOM character before its `#` heading (harmless, but `grep -c`
  patterns anchored to line start can miss line 1).
- **`OPEN-QUESTIONS.md`** (185 lines) — top part (rewritten 17 September, round 2) is current open
  questions; everything below its own `## Superseded sections below this line` marker (line 47) is
  the 12 September list, explicitly kept only for history. Read the top only.
- **`OWNER-RULINGS.md`** (1,107 lines) — see GENERATED below.
- **`RULES.md`** (249 lines) — see GENERATED below.
- **`SCREEN-MAP.md`** (116 lines) — see GENERATED below.
- **`SCREEN-VERIFICATION.md`** (82 lines) — see GENERATED below.
- **`SCREEN-DEFINITION-OF-DONE.md`** (120 lines) — the extra checklist a screen needs on top of
  `definition-of-done.md`. Carries two active amendment banners (13 and 21 September) narrowing
  numerical scoring and six-view coverage to lean/focused checks; the base checklist below them is
  otherwise unchanged.
- **`definition-of-done.md`** (30 lines) — the task-level checklist: build passes, tests for the
  touched area pass, committed locally, `STATUS.md` updated, decision log updated if a choice was
  made. Directly cross-referenced by `HOW-WE-WORK.md`.
- **`decisions.md`** (65 lines) — the project-level decision log, newest at the bottom, still being
  appended to (latest entry: D-6, restated 25 September 2026). Detailed clinical/product rulings
  point to `OWNER-RULINGS.md` instead of duplicating them.
- **`how-to-write-to-the-owner.md`** (59 lines) — the DID/ISSUE/... reply format. Written
  2026-09-01 but directly cross-referenced as current by `HOW-WE-WORK.md` §8 ("Ward Lead asks ...
  See `how-to-write-to-the-owner.md`").
- **`UNIVERSAL-MOCKUP-SPECIFICATION.md`** (277 lines) — a QA-protocol reference for building and
  verifying mockups. Its own top banner defers token/palette/colour authority to
  `mockups/WARD-FLOW-DESIGN-SYSTEM.md` where the two disagree — read that file for tokens, this one
  for the wider QA protocol.
- **`product-brief.md`** (148 lines) — the product brief: written 25 September 2026 from the code,
  docs and drawings, marked inline wherever a line is "(Guess — Josh to confirm)" rather than a
  recorded decision. Actively being extended — the tip commit on this branch is
  "record Josh's product brief answers and flesh out success measures" — but `README.md`'s "four
  documents" list (last touched 21 September) does not yet name it; treat it as current and check
  `git log -1 -- docs/ward-flow/product-brief.md` before relying on a specific claim in it.
- **`ARCHIVE-NOTE.md`** (24 lines) — a short pointer: dated handovers and one-off notes are
  historical, live guidance is `LOCAL-FIRST-RUN.md` and `README.md`.
- **`code-map.md`** (5 lines) — redirect stub to [`code-map/README.md`](README.md) (this map's own
  index), kept so old links into "the code map" still land somewhere live.
- **`design-test-registry.json`** (452 lines) — registry connecting mockups and React components to
  their automated test suites and clinical invariants. Actively read by
  `scripts/ward-flow/design-test-sync.mjs`; not itself marked generated.
- **`live-state.json`** (228 lines) — chat-control/reconciliation state file, read by
  `scripts/ward-flow/chat-control.mjs`, `scripts/ward-flow/check-live-state.mjs` and
  `tests/ward-flow-chat-control.test.ts`. Its own `capturedAt` field says 2026-08-31 and its
  `chatControlSystem.contract` field points at `docs/ward-flow/control/roles.json`, a path that no
  longer exists (`HOW-WE-WORK.md` §7: "`control/README.md` (gone — deleted with WLQ-33)"). The file
  is still functionally live (code reads it), but do not trust its embedded pointers or timestamp.
- **`screen-verification.json`** (703 lines) — the data `SCREEN-VERIFICATION.md` is generated from;
  see GENERATED below for the generator. Its own `_howToUse` field is the fullest explanation of how
  to record a screen check (mockup hash vs. implementation hash, two separately aging facts).

### GENERATED — do not hand-edit

- **`OWNER-RULINGS.md`** (1,107 lines) — `node scripts/ward-flow/owner-rulings-index.mjs` (`--check`
  fails if stale). Scans `docs/ward-flow/owner-*.md` and
  `docs/ward-flow/archive/dated-notes/owner-*.md` (34 files). Edit a ruling in its own source file,
  never here.
- **`RULES.md`** (249 lines) — `node scripts/ward-flow/rules-index.mjs`. Generated from the 207-lesson
  store copied into `lessons/` (see that folder below); edit a lesson there.
- **`SCREEN-MAP.md`** (116 lines) — `node scripts/ward-flow/screen-map.mjs`. "68 mockups · 44 routes ·
  29 screen folders." The mockup-to-route pairing is hand-authored (no rule derives it); completeness
  (which files exist) is discovered from disk. This is the file the mockups section below is built
  from.
- **`SCREEN-VERIFICATION.md`** (82 lines) — `node scripts/ward-flow/screen-verification.mjs`, edited
  via `screen-verification.json`, not directly. "34 of 34 screens have been looked at" — but per its
  own banner, a hash match only proves the drawing has not moved since the look, never that the
  screen is correct.

### SUPERSEDED — carry an explicit banner

- **`HIGH-FIDELITY-DESIGN-TO-PRODUCTION-PLAYBOOK.md`** (555 lines) — "SUPERSEDED on 17–21 Sept 2026
  by `HOW-WE-WORK.md` and `mockups/WARD-FLOW-DESIGN-SYSTEM.md`."
- **`PARALLEL-MULTI-AGENT-BUILD-PLAYBOOK.md`** (241 lines) — "SUPERSEDED on 17–21 Sept 2026 by
  `HOW-WE-WORK.md`."
- **`NEW-CHAT-PROMPT.md`** (223 lines) — "SUPERSEDED on 17 Sept 2026 by `README.md`."
- **`how-chats-talk-to-each-other.md`** (171 lines) — "SUPERSEDED on 17 Sept 2026 by
  `HOW-WE-WORK.md`."
- **`START-HERE-ward-builder-four.md`** (35 lines) — "SUPERSEDED on 17 Sept 2026 by `README.md`."
- **`START-LOCAL-CHAT.md`** (7 lines) — "Moved to archive. Chat-control procedure is superseded."
  Redirects to `LOCAL-FIRST-RUN.md` and `HOW-WE-WORK.md`.
- **`PROJECT-ISSUES.md`** (7 lines) — "NOT CANONICAL. Historical review worksheet." Redirects to
  `STATUS.md` and the task ledger.

### DATED NOTE — point-in-time investigation, evidence, proposal or handover

All of these were written for a specific moment and are not maintained afterwards; treat any figure
in them as belonging to the tree named, never as current.

- **`JOURNEY-AUDIT-REPORT.md`** (86 lines, 16 Sept 2026) — Antigravity's end-to-end clinical-journey
  QA audit of the 18 third-edition mockups (local static prototype, before the journey-explorer tool
  existed).
- **`LESSON-AUDIT-REPORT.md`** (54 lines, 13 Sept 2026) — an automated integrity audit of 160 lessons
  in the machine-local memory store (predates today's 209-lesson `lessons/` copy).
- **`REACT-SYNCHRONIZATION-ANALYSIS.md`** (110 lines, 16 Sept 2026) — an architecture analysis of
  keeping `src/components/ward-management/` synchronised with the third-edition HTML mockups.
- **`a-residual-shared-by-two-implementations-2026-09-10.md`** (56 lines, 10 Sept 2026) — Ward Lead
  re-verifying a claimed repair by re-running a corpus, at the moment least likely to be checked.
- **`accept-referral-reason-path-evidence.md`** (77 lines, 2 Sept 2026) — evidence for a specific
  fixed defect (the front door could not say yes), pinned to two commits.
- **`assignment-register.md`** (195 lines, last touched 10 Sept 2026) — one line per task, one owner,
  created after the same section was dispatched to two chats at once. Superseded in practice by the
  ledger and `HOW-WE-WORK.md`'s worktree-ownership registration, though it carries no banner saying
  so (inferred from later process docs not mentioning it).
- **`audit-2026-09-25-full-review.md`** (313 lines, 25 Sept 2026) — a full review of the Ward Lead
  folder (type check, full offline suite, lint, organisation checkpoint), pinned to tip `3e38413195`.
- **`audit-and-repair-report.md`** (778 lines, 22 Sept 2026) — an adversarial audit finding an
  unlinked referral that acquired another synthetic patient's identity, plus engine-probe findings on
  stage corrections and locked-bed discharge. Audit-only: "no application repairs were made."
- **`bed-states-options.md`** (341 lines, 1 Sept 2026) — three options for a six-bed-state model,
  laid out without a recommendation, measured at a pinned commit because three files were being
  edited by another session at the time.
- **`cleanup-awaiting-approval.md`** (35 lines, 2 Sept 2026) — four items the protect-ward-flow hook
  refuses to delete, listed rather than force-removed.
- **`clinician-check-questions.md`** (90 lines, 6 Sept 2026) — questions to put to a real ward
  clinician, written because the bed model had been revised twice and never shown to one.
- **`community-origin-scope.md`** (124 lines, 1 Sept 2026) — scopes (does not build) letting a
  journey start at a community team rather than only ED, per an owner correction.
- **`coordinator-referral-surfaces.md`** (432 lines, 1 Sept 2026) — every surface where a referral
  reaches the coordinator, measured, revised six times since its first pass.
- **`dev-server-failure-causes.md`** (108 lines, 8 Sept 2026) — four distinct causes of "dev server
  won't serve a ward page," organised around the discriminating observation for each.
- **`engine-gate-implementation-brief.md`** (233 lines, 2 Sept 2026) — implementation brief for the
  owner's ruling "the engine should refuse, screen checks are not enough," written while another
  session was actively editing the reducer/events files it describes.
- **`finding-register-ward-verifier.md`** (73 lines, 2 Sept 2026) — Ward Verifier's contribution to a
  combined finding register; corrects its own count mid-document (13, not 9).
- **`finding-register-wf-build3.md`** (474 lines, 2 Sept 2026) — findings from the WF-BUILD3 `.ts` and
  DOM test sweeps (see below).
- **`probes-that-answer-a-neighbouring-question.md`** (298 lines, 9 Sept 2026) — nine reproducible
  probes that returned a confident wrong answer by checking something adjacent to the real question.
- **`publication-runbook.md`** (392 lines, 6 Sept 2026) — written after eight pushes and nine
  bookkeeping-only check failures to land one PR; a runbook for Ward Flow's separate publication
  process (not this branch, which is never pushed — this concerns PsychSift-side PRs).
- **`roadmap.md`** (110 lines, 25 Sept 2026) — a proposed milestone order drawn from the product
  brief and the day's audits. Explicitly unreviewed: "Josh has not yet reviewed it."
- **`skipped-test-reconciliation.md`** (149 lines, 7 Sept 2026) — separates two previously conflated
  populations of "skipped" ward tests (environment-gated vs. `.skip`ped); read-and-report only.
- **`stale-claims.md`** (79 lines, 1 Sept 2026) — the mechanism by which an accurate report is already
  out of date by the time it is read, illustrated by two same-day mutual corrections.
- **`statistics-primitive-reconciliation.md`** (173 lines, 5 Sept 2026) — a recommendation (not a
  change) for which of two duplicate sets of statistics primitives should survive.
- **`the-engine-enforces-nothing.md`** (343 lines, 2 Sept 2026) — establishes that bed rules lived on
  screens rather than in the reducer, correcting an earlier reassurance to the owner.
- **`three-chat-working-agreement.md`** (505 lines, 1 Sept 2026) — how the three-chat model (Ward
  Lead/Builder/Verifier) was meant to divide work. No banner, but describes a role scheme
  `HOW-WE-WORK.md` (17 Sept) replaced with "any AI builder"; treat as historical (inferred).
- **`tr-d4-readiness-signal-proposal.md`** (159 lines, 6 Sept 2026) — a proposal only; explicitly
  "nothing is built, no reducer event has been written."
- **`two-verdicts-one-question.md`** (155 lines, 1 Sept 2026) — two live clinical defects traced to
  one structural cause: `ward-eligibility.ts` holding two separate, uncompared verdict functions.
- **`vocabulary.md`** (121 lines, 1 Sept 2026) — every fixed list in the model, each marked
  behavioural (⚙️) or a replaceable label (🏷️), measured at a pinned commit before the bed-readiness
  rule changed. Still a useful map of vocabulary, but re-derive before quoting a specific list as
  current.
- **`ward-answers-chat-prompt.md`** (67 lines) — the prompt for a since-retired fourth "Ward Answers"
  read-only chat role (inferred retired, no banner — role model superseded by `HOW-WE-WORK.md`).
  Cites `docs/ward-flow/where-things-stand-2026-09-01.md`, a file that no longer exists at that path.
- **`ward-builder-three-chat-prompt.md`** (92 lines) and **`ward-builder-two-chat-prompt.md`**
  (73 lines) — startup prompts for the retired "Ward Builder Two/Three" worker-chat roles (inferred
  retired, same reasoning as above).
- **`wf-build3-004-dom-test-sweep.md`** (271 lines, 1 Sept 2026) — a "checks that cannot fail" sweep
  across every ward DOM test; report only, nothing changed.
- **`wf-build3-005-ts-test-sweep.md`** (2,054 lines, 1 Sept 2026) — the same method applied to all 89
  `tests/ward-*.test.ts` files then existing; committed three times while incomplete on purpose, so
  the sweep would survive even if the session did not.
- **`who-is-who.md`** (156 lines, 1 Sept 2026) — "a role is a folder, not a name": identity is bound
  to worktree + `.ward-session.json`, checked against `git worktree list`. The role scheme is
  historical, but the tool it documents, `scripts/ward-flow/whois.mjs`, still exists on disk and
  still works as a plain worktree/branch identifier regardless of which role naming is current.
- **`action-reachable-absence-prereg-2026-09-12.txt`** (78 lines, 12 Sept 2026) — a pre-registration
  (predictions written before measuring) for a sweep of action-reachable UI states.
- **`none-census-prereg-2026-09-11.txt`** (33 lines, 11 Sept 2026) — pre-registration for a census of
  every "none" in the UI.
- **`u-sweep-prereg-2026-09-11.txt`** (24 lines, 11 Sept 2026) — pre-registration for a three-control
  sweep.
- **`commit-attribution-2026-09-06.tsv`** (2,208 lines, 6 Sept 2026) — a per-commit table of branch,
  attribution, author time and subject, covering the project's early history.

## Big history folders and small tooling folders

- **`archive/dated-notes/`** — 178 files (177 dated notes + its own `README.md`), spanning roughly
  1–19 September 2026 by filename date. Every owner-answer dump, handover and one-off measurement
  note moved out of the top level during "docs hardening." Its `README.md` states plainly: "Not live
  guidance," and points back to `README.md`, `LOCAL-FIRST-RUN.md`, `STATUS.md`. Nothing outside this
  folder reads it as data, but `OWNER-RULINGS.md`'s generator scans `archive/dated-notes/owner-*.md`
  by pattern, and several current docs cite specific files here by path (e.g. `README.md` cites
  `archive/dated-notes/owner-answers-2026-09-17.md`). Worth knowing: `HOW-TO-FOLD-2026-09-10.md`
  (fold procedure detail `HOW-WE-WORK.md` points to), `owner-answers-2026-09-17.md` and
  `owner-answers-2026-09-18.md` (round-2 owner rulings, still cited), `PROJECT-ISSUES.md` (archived
  copy of the top-level redirect), `START-LOCAL-CHAT.md` (archived copy).
- **`lessons/`** — 209 files (207 lessons + `README.md` + `MEMORY.md`), all named for their topic, no
  dates in filenames. This is a **versioned, committed copy** of the live lesson store at
  `~/.claude/projects/D--Repos-Database/memory/` (outside git, machine-local). The store is the
  working source; this copy exists purely so 160+ (now 207) lessons are not the one thing in the
  project with nothing behind it. Kept in step by `node scripts/ward-flow/sync-lessons.mjs` /
  `--check` (content-compared, never auto-deletes a lesson that vanished from the store). This is the
  direct source `RULES.md` is generated from. Worth knowing: `README.md` (the sync contract, read
  first), and lessons that are themselves about this project's traps rather than general ones, e.g.
  `ward-flow-tests-share-one-instant.md`, `ward-flow-coordinator-overrides-everything.md`,
  `a-clinical-word-that-means-two-things.md`.
- **`plans/`** — 374 files across nine dated/named subfolders (`2026-09-16-fix-plan-inputs`,
  `command-shell-refinement`, `dashboard-layouts`, `movements-refinement`, `product-refinement`,
  `research-2026-09-10`, `type-floor-record-2026-09-11-528bb60708`, `visual-rebuild-full-estate`,
  `visual-rebuild-wave-one`) plus loose dated files from roughly 10–17 September. `plans/README.md`
  is itself the index and is current: it states "current open work is recorded in `STATUS.md` and the
  task ledger, not in standalone plan documents here," lists what folded into the ward line at which
  commit ("Round 2," commits `a7c7288668` and `6c33169b03`), and tables which older plans are
  superseded and by what. `SCREEN-DEFINITION-OF-DONE.md` still points into
  `plans/product-refinement/VISUAL-REVIEW.md` as the live lean-review procedure. Worth knowing:
  `plans/README.md` (read first), `2026-09-17-build-plan-legal-clinical.md`,
  `2026-09-17-build-plan-referrals-transport.md`, `2026-09-17-build-plan-screens.md` (the three
  folded Round 2 plans), `product-refinement/VISUAL-REVIEW.md` (live procedure), `research-2026-09-10/README.md`.
- **`sdd-rescued/`** — 81 files in three dated subfolders (`builder-plan-2026-09-01/`,
  `ward-community-index/`, `ward-statistics-skeleton/`), all from the 1 September build. "Rescued"
  means pulled out of a session-specific location before it could be lost; holds task briefs, task
  reports, progress notes and raw `.diff` review files between named commits. No README. Nothing
  reads these programmatically; they are read-only history for whoever needs to see exactly what an
  early build session was told and what it reported back. Worth knowing:
  `builder-plan-2026-09-01/progress.md`, `builder-plan-2026-09-01/final-fix-report.md`.
- **`design/`** — 68 files: 13 top-level design briefs/decisions (e.g.
  `FRONT-DOOR-BOARDS-DECISION.md`, `screen-adoption-playbook.md`, `statistics-v2/v3/v4-brief.md`),
  `design/evidence/` and `design/prototypes/` (the ten-plus-four "Board" HTML prototypes the owner
  approved 2026-09-04/05, with their own detailed `README.md`). `design/prototypes/` is deliberately
  in `.prettierignore` — a whole-tree format pass once broke ten byte-identity guards by touching
  these files. Explicitly "reference, not routes": nothing imports them, they hold no dedicated
  mockup index entry, and the seven-task foundation plan superseded them as an editing target. Worth
  knowing: `design/prototypes/README.md` (the fullest account of a shared-CSS-block reconciliation
  mistake in the project, and why `mockup-ward-home-v4.html` is the spec, not `v3`),
  `screen-adoption-playbook.md`.
- **`reference-data/`** — 17 files: the WA catchment/capacity/distance data pack (`entities.json`,
  `distances.json`, `catchment_assertions.json`, `capacity_assertions.json`, `geocode_cache.json`,
  `sources.json`, `decisions.json`, `open_questions.json`, `pack_manifest.json`) plus its own
  `PACK_README.md`, `INGEST_MAP.md`, `DISTANCES-README.md`, `CHANGELOG.md`,
  `PROVENANCE-AUDIT-2026-09-18.md`, `PHASE_STATUS.md`, `DECISIONS-APPLIED-2026-09-17.md` and
  `WARD-FLOW-MASTER-COMPLETE-2026-09-17.md`. Built 2026-09-17 (Phases 1–5), current status
  `operational_use_approved=false`. **Actively read**, unlike most history folders here:
  `scripts/ward-flow/build-reference-distances.mjs`, `build-reference-registry.mjs` and
  `build-reference-teams.mjs` consume it to generate the real
  `src/components/ward-management/reference/ward-reference-*.ts` files the app imports, and
  `check-ward-reference.mjs` plus two test files check it. Worth knowing: `PACK_README.md` (the
  standing rules, e.g. "Null ≠ zero; chairs ≠ beds; aggregates ≠ wards"), `INGEST_MAP.md`.
- **`journey/`** — 33 files: the Journey Explorer, "the master tool for mapping Ward Flow's flow and
  behaviour" per an 18 September owner instruction. `ward-journey-explorer.html` is the drawing
  (served, never opened bare, via `node docs/ward-flow/journey/serve.mjs`); everything on it is
  generated at build time from `src/components/ward-management/` by `npm run ward:journey`
  (`build.mjs`, `build-explorer.mjs`, `build-bpmn.mjs`, `extract-vocab.mjs`, plus several
  `prove-*.mjs` checkers and a `.bpmn` export). This is CURRENT and actively maintained — the newest
  of the "master tool" designations in the project. Worth knowing: `README.md` (read first, explains
  the six tabs), `ward-journey-explorer.html` (the artefact), `HANDOVER.md`.
- **`handover/`** — 16 files: a single large "Sovereign Screen Design & Production Engineering
  Handover" package with `templates/` and `transcripts/` subfolders. Its own `README.md` carries an
  explicit banner: "SUPERSEDED on 17 Sept 2026 by `README.md`. Kept for history; do not follow. This
  package is not the Ward Flow entry point." Whole folder is historical.
- **`handovers/`** (plural, no README) — 18 files, all dated 2026-09-02 or 12–17 September, one
  session handover per file (`WARD-FLOW-HANDOVER-2026-09-16*.md` has five variants alone: base,
  consolidated, resumption, review-findings, plus a same-day progress/checkpoint/still-missing set).
  `README.md` itself cites one of these as "the newest audit":
  `handovers/WARD-FLOW-AUDIT-2026-09-16.md` (also cited from the task ledger's own banner). Worth
  knowing: `WARD-FLOW-AUDIT-2026-09-16.md`, `WARD-LEAD-START-HERE-2026-09-16.md`,
  `WARD-FLOW-OWNER-DECISIONS-OPEN-2026-09-16.md`.
- **`build-contracts-2026-09-12/`** — 25 files (18 per-screen build contracts + `README.md` + others),
  all 12 September 2026. Each contract answers six fixed questions about one screen (does it exist,
  what are its sections, what data does each need, cited `file:line` for every claim) and was
  committed specifically because keeping it in a chat's scratchpad had already cost the project five
  separately-rediscovered diagnoses. Read-only history now that the screens it covers are built.
- **`governance/`** — 3 files: `ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`, `CLINICAL-SAFETY-CASE.md`
  (DCB0129-style hazard log), `WA-MENTAL-HEALTH-ACT-COMPLIANCE.md`. Each self-labelled
  "DRAFT / PROTOTYPE GOVERNANCE BASELINE" — not wired into any gate or test, not a substitute for the
  outside reviews `README.md` and `decisions.md` D-6 say are still parked (Aboriginal cultural safety
  review explicitly deferred by the owner, 17 and 25 September). Worth reading before assuming any
  compliance claim in the app is backed by a real review.
- **`register/`** — 4 files, all 2 September 2026: a combined finding register
  (`REGISTER-2026-09-02.md`) plus three per-builder finding lists. Distinct from
  `finding-register-ward-verifier.md` and `finding-register-wf-build3.md` at the top level, which
  cover different sweeps the same week.
- **`reports/`** — 14 files, all 2 September 2026: per-builder session logs, closing reports and two
  domain audit reports (`audit-domain-2-bed-engine-census-capacity-acuity-gender.md`,
  `audit-domain-3-referrals-intake-triage.md`).
- **`reviews/2026-09-13-local-audit-1734/`** — 7 files (one dated review batch): a local audit with
  its own `WardFlow_Local_Final_Audit.md`, a CSV+JSON issue register, and three supporting JSON
  artefacts (`publication-verification.json`, `report-manifest.json`, `review-evidence.json`,
  `test-failure-comparison.json`). Self-contained, nothing outside this folder reads it.
- **`triage/`** — 6 files, all 2 September 2026: `wf-build2-006-batch-a/b/c.md` (a triage sweep split
  into three batches) plus `d15-live-check.md`, `falsifier-visibility.md`,
  `reexport-blindness-sweep.md`.
- **`traps/`** — 6 files, 1–2 September 2026: short named-pattern write-ups (e.g.
  `silent-transforms.md`, `fixture-contingent-branches.md`, `comments-that-reverse-a-ruling.md`) —
  the same genre as the `lessons/` store but not folded into it; likely predates that store's
  creation.
- **`outstanding/`** — 6 files, 2 and 4 September 2026: per-role outstanding-work handback notes
  (`ward-lead-2026-09-02.md`, `ward-lead-2026-09-04.md`, `ward-builder-two-2026-09-02.md`, etc.).
  **Not the same thing as the repository's `docs/outstanding-issues.md`** — the task ledger's own
  warning table is explicit that Ward Flow work must never touch that file.
- **`evidence/`** — 3 files, 31 August – 7 September 2026: two dated defect-evidence notes
  (`rendered-undeclared-token-defect-2026-09-02.md`, `token-alias-bypass-2026-09-06.md`) and one
  process-audit handover transcript (`.txt`, 31 August).
- **`merge/`** — 2 files: `playwright-config-resolution.md`, `post-fold-verification-plan.md` — notes
  from a specific merge/fold event, not a general merge-conflict guide.
- **`rescued/ward-builder-three/`** — 2 files: `mutate.mjs` (a standalone mutation-testing script) and
  a triage-progress note. Same "pulled from a temp location before it was lost" pattern as
  `sdd-rescued/`.
- **`organisation/`** — 1 file, `registry.json`: the reviewed source-ownership registry `README.md`
  describes under "Organisation checkpoint (six non-Design systems)." **Live and actively checked** —
  `npm run ward:organise` / `ward:organise:check` read it, and `tests/ward-organisation-core.test.ts`
  covers its behaviour. Not history despite sitting among these folders.
- **`audit-artefacts/`** — 1 file, `stabilisation-suite-report.json`: a raw Vitest summary JSON
  (`numTotalTestSuites: 2151`, etc.) captured from one run. A number, not a claim — check the date it
  was captured before quoting it.
- **`harness/`** — 1 file, `engine-gate-harness.test.ts.txt`: a before/after probe for the "engine
  refuses unless a reason is recorded" ruling (2 September 2026). Named `.txt`, not `.ts`, on
  purpose — its own comment says "THIS IS A TRANSIENT PROBE, NOT A PERMANENT TEST"; `tests/` belongs
  to Ward Lead. Vitest will never pick this file up.
- **`scripts/`** (singular, inside `docs/ward-flow/`, distinct from the repo's `scripts/ward-flow/`)
  — 1 file, `scan-dead-order.py`. Referenced only from an archived dated note
  (`archive/dated-notes/dead-order-scan-2026-09-03.md`); not wired into any npm script or gate.
- **`tools/`** — 1 file, `check-forward-composes.mjs`. Same situation: mentioned from
  `dev-server-failure-causes.md` and one archived note, not registered as an npm script.

## `docs/ward-flow/mockups/` (135 files)

### The folder's own documents

- **`README.md`** (CURRENT) — start-here for the drawings: the three-mirror standard, the sixteen
  third-edition pages with their publish-artifact URLs, the eleven added 11 September, the seven
  added 11 September with no artifact yet, the reference-only list, how to prove a page, how to build
  a new page, the rules every drawing must follow. This is the single most load-bearing file in the
  folder — read it before touching any drawing.
- **`WARD-FLOW-DESIGN-SYSTEM.md`** (2,680 lines, CURRENT — the design authority) — the one standard
  every mockup is built to: rules, tokens, components, shell states, wording/honesty rules,
  accessibility floor, definition of done, the recipe and Never list, decisions taken, screens index.
  Frozen 8 September 2026, version 3.0 (third edition). Mirrored (not superseded) by
  `design-system-third-edition.html` (live component page) and `ward-flow-digest.html` (condensed
  reader's brief).
- **`MANIFEST.json`** (CURRENT, GENERATED-style data) — `sha256-lf` hash per mockup file, keyed by
  filename. This is what `SCREEN-VERIFICATION.md`'s `mockupSha256` column is checked against, and
  what a future re-hash (`node scripts/ward-flow/screen-verification.mjs --hash <mockup>`) compares
  to when recording a new verification.
- **`CONTACT-SHEET.html`** (DATED NOTE-style artefact) — a static contact sheet of the drawings, not
  itself a screen or a route.
- **`FOLD-READY-2026-09-10.md`**, **`HANDOVER-2026-09-12-close-out.md`**,
  **`PHASE0-RESOLUTION-2026-09-10.md`**, **`WARD-MOCKUPS-HANDOVER-2026-09-11.md`**,
  **`WARD-MOCKUPS-STATUS-2026-09-10.md`** — five DATED NOTE handover/status snapshots from the
  10–12 September third-edition build push. Historical; current status is `STATUS.md` and this
  folder's own `README.md`.

### Design authority — the 34 screens with a build contract (per `SCREEN-MAP.md`)

Each is the design source for exactly the route shown; `SCREEN-MAP.md` is the generator-checked
source of this table and is more current than this bullet list if the two ever disagree.

- **`command-third-edition.html`** — `/` — **the reference build every other page copies from.**
- **`delays-third-edition.html`** — `/delays`
- **`movement-third-edition.html`** — `/movements`
- **`capacity-third-edition.html`** — `/capacity`
- **`ward-third-edition.html`** — `/ward/[unitId]`
- **`wards-third-edition.html`** — `/wards` — one of the seven added 11 Sept with no artifact URL yet.
- **`bed-board-third-edition.html`** — `/board/[unitId]`
- **`emergency-department-third-edition.html`** — `/ed/[edId]` — confirmed 17 Sept as the ED drawing
  (not one of the five reference-only files).
- **`community-team-third-edition.html`** — `/community/[teamId]`
- **`patient-search-third-edition.html`** — `/search`
- **`patient-now-third-edition.html`** — `/people/[patientId]` — gained a Legal panel 11 Sept; its
  published artifact predates that change.
- **`search-hub-third-edition.html`** — `/hub`
- **`raise-a-referral-third-edition.html`** — `/referrals/new`
- **`statistics-third-edition.html`** — `/statistics`
- **`statistics-overview-third-edition.html`** — `/statistics/overview` — added 11 Sept, no artifact
  URL yet.
- **`statistics-ward-third-edition.html`** — `/statistics/ward/[unitId]`
- **`statistics-community-third-edition.html`** — `/statistics/community/[teamId]`
- **`statistics-emergency-department-third-edition.html`** — `/statistics/ed/[edId]`
- **`statistics-compare-third-edition.html`** — `/statistics/compare` — added 11 Sept, no artifact
  URL yet.
- **`statistics-service-third-edition.html`** — `/statistics/service/[serviceId]` — one of the eleven
  added 11 Sept.
- **`network-third-edition.html`** — `/network` — added 11 Sept, no artifact URL yet.
- **`governance-third-edition.html`** — `/governance` — one of the eleven added 11 Sept; gained an
  access-record second tab that day, published artifact predates it.
- **`handover-third-edition.html`** — `/handover` — one of the eleven added 11 Sept.
- **`discharges-third-edition.html`** — `/discharges` — added 11 Sept, no artifact URL yet.
- **`out-of-area-third-edition.html`** — `/out-of-area` — one of the eleven added 11 Sept.
- **`on-call-third-edition.html`** — `/on-call` — one of the eleven added 11 Sept (labelled "On-call
  and contacts").
- **`alerts-third-edition.html`** — `/alerts` — one of the eleven added 11 Sept; had a one-handed
  phone pass that day, published artifact predates it.
- **`transport-officer-third-edition.html`** — `/transport/officer` — one of the eleven added
  11 Sept; deliberately phone-first, also holds up at desk width.
- **`legal-forms-third-edition.html`** — `/legal-forms` — added 11 Sept, no artifact URL yet.
- **`add-a-patient-third-edition.html`** — `/people/new` — one of the eleven added 11 Sept.
- **`referrals-third-edition.html`** — `/referrals` — one of the eleven added 11 Sept.
- **`settings-third-edition.html`** — `/settings` — one of the eleven added 11 Sept; this file (not
  `settings-perfected-third-edition.html`) is Gemini's rebuild, confirmed by commit date
  (`f0e5ea88f9`, 16 Sept, newer than the 12 Sept approved version).
- **`sign-in-third-edition.html`** — `/mockups/ward-flow-sign-in` — one of the eleven added 11 Sept;
  deliberately carries no rail, no bar and no input element (nobody is signed in yet).
- **`ward-answer-third-edition.html`** — `/ward/[unitId]/answer` — added 11 Sept, no artifact URL yet.

### Reference only / variant / backup — drawn, but not a design source (32 files, per `SCREEN-MAP.md` "drawn, no build contract" plus its "superseded" list)

- **`design-system-third-edition.html`** — the design system as a live-component page (a mirror of
  `WARD-FLOW-DESIGN-SYSTEM.md`, not itself a screen source).
- **`ward-flow-digest.html`** — the condensed reader's brief mirror of the same standard.
- **`movement-gantt-third-edition.html`**, **`network-horizon-third-edition.html`** — alternate
  visualisations of Movement and Network, not routed.
- **`sovereign-chrome-and-drawers-perfected.html`** — reference only (routed at `/sovereign`, a
  scratch route, per `SCREEN-MAP.md`; not a design source for any real screen per `README.md`).
- **`sovereign-sidebar-ultimate.html`** — reference only, confirmed by `README.md`.
- **`perfected-activity-drawer.html`**, **`perfected-drawers-showcase.html`**,
  **`perfected-service-popover.html`**, **`perfected-tasks-drawer.html`**,
  **`perfected-tools-drawer.html`** — component-level drawer/popover explorations, not full screens.
- **`settings-perfected-third-edition.html`** — reference only, confirmed 17 Sept 2026: this is the
  file that stayed reference when `settings-third-edition.html` became the routed Gemini rebuild.
- **`add-a-patient-third-edition-claude-draft.html`** — an earlier draft superseded by
  `add-a-patient-third-edition.html`.
- **`patient-now-original-third-edition.html`**, **`patient-now-perfected.html`** — earlier/variant
  takes on Patient Now; the routed source is `patient-now-third-edition.html`.
- **`patient-search-perfected-third-edition.html`** — variant of the routed patient-search drawing.
- **`movement-service-filter-experiment.html`** — a named experiment, not a candidate design.
- **`raise-a-referral-perfected-third-edition.html`** — variant of the routed referral drawing.
- **`header-text-5-variations.html`**, **`header-text-inside-capsule-variations.html`**,
  **`header-text-perfected-variations.html`**, **`header-text-redesign-mockups.html`**,
  **`header-text-clean-perfected.html`**, **`header-text-perfected-specification.html`**,
  **`header-badge-size-variations.html`** — seven files from one header-wording exploration; none
  routed.
- **`ward-decisions-perfected-third-edition.html`** — variant panel exploration, not routed.
- **`delays-perfected-third-edition.html`** — variant of the routed Delays drawing.
- **`notification-popup-third-edition.html`** — a component exploration, not a screen.
- **`ward-before-after-redesign.html`** — a before/after comparison artefact, not a build source.
- **`handover-perfected-third-edition.html`**, **`ward-perfected-third-edition.html`**,
  **`wards-cards-third-edition.html`** — variant takes on Handover/Ward/Wards; the routed sources are
  the plain `*-third-edition.html` files above.

### Superseded — explicitly "never build from these" (`SCREEN-MAP.md`)

- **`patient-search-console.html`** — pre-third-edition patient search; superseded.
- **`patient-search-working.html`** — pre-third-edition patient search; superseded.

Note: the code map's overview page mentions "five `.bak` files" among the variation/experiment set;
a full recursive search of `docs/ward-flow/` found **zero** files matching `*.bak` today — either
cleaned up since the overview was written or the overview's count was off. Flagging rather than
silently correcting it.

### `mockups/reference/gemini-2026-09-15/` (21 files) — reference only, all one batch

Its own `README.md` states the whole folder's status: these are the drawings as they stood in
`ward-lead` at 00:15 on 16 September 2026 (uncommitted at the time), mostly rewritten by a Gemini
Antigravity session the evening before. The owner liked their visual look, but "they break several
owner rulings and removed most of the committed drawings' behaviour, so nothing is built from them" —
kept only so a restyle can copy their CSS. See `plans/2026-09-16-drawings-new-look-with-rules.md`.

- **`README.md`** — the batch's own status note (above).
- **`add-a-patient-third-edition-claude-draft.html`**, **`add-a-patient-third-edition.html`**,
  **`alerts-third-edition.html`**, **`CONTACT-SHEET.html`**, **`discharges-third-edition.html`**,
  **`governance-third-edition.html`**, **`legal-forms-third-edition.html`**,
  **`movement-gantt-third-edition.html`**, **`movement-third-edition.html`**,
  **`network-horizon-third-edition.html`**, **`on-call-third-edition.html`**,
  **`out-of-area-third-edition.html`**, **`patient-now-third-edition.html`**,
  **`patient-search-perfected-third-edition.html`**, **`patient-search-third-edition.html`**,
  **`settings-third-edition.html`**, **`sign-in-third-edition.html`**,
  **`transport-officer-third-edition.html`**, **`ward-answer-third-edition.html`**,
  **`wards-third-edition.html`** — twenty visual restyles, one per named screen above, each
  reference-only per the folder's own README. Same filenames as the real mockups one level up; do
  not confuse the two paths.

### `mockups/third-edition-kit/` (37 files across the folder and its `fonts/`, `inputs/` and `shell/` subfolders) — the drawing-checker toolchain

Summarised rather than itemised (the [Scripts and tooling](scripts-and-tooling.md) part covers the
`.mjs` checkers in file-by-file detail). At the top level: `check.mjs` (sweeps eight widths × two
themes: fonts loaded, no sideways overflow, the 12px/10.5px type floor, 4.5:1 contrast, focus ring,
prints `ALL GREEN` or red lines), `check-shell.mjs` (asserts shell wording, e.g. the Activity line
must start "Invented figures..." never "Live"), `check-standard.mjs`, `shell-sweep.mjs` (drift of any
page's shell from Command's — every page must read `SAME SHELL`), `recompute-contrast.mjs`,
`shots.mjs`, plus `contrast-pairs.json`, `REVIEW-FINDINGS.json`, `check-output.txt` (a captured run),
and dated docs `AGENT-BRIEF.md` (the brief given to one agent building one page),
`HANDOVER.md`/`HANDOVER-MOCKUPS-CHAT-2026-09-10.md`/`MERGE-BRIEF.md`/`RESUME-2026-09-09.md`.
`run-all-checks.sh` has a hard-coded `cd` to a worktree that no longer exists
(`.claude/worktrees/ward-flow-phase-5-resume-166ecb`) and will fail here — run the individual `node`
commands from `README.md` instead. `fonts/` (7 files) self-hosts the Geist/Geist Mono `.woff2` faces
plus `platinum.css` so the checker never makes a third-party font request. `inputs/` (5 files) holds
the shell specification and review notes the shared shell was built from
(`SHELL-SPEC.md`, `SHELL-REVIEW.md`, `RAIL-MAP.md`, `rail.html`, `buildsheet.html`). `shell/`
(10 files) holds the shared shell markup, CSS and script as their own standalone preview
(`shell-markup.html`, `shell.css`, `shell-script.js`, `shell-docs.css`, `preview.html`,
`preview-stub.js`, plus build/check/screenshot scripts for that preview and `SHELL-NOTES.md`).

## `docs/ward-flow-task-ledger.md` (7,867 lines)

CURRENT and actively appended — the single ledger for every outstanding Ward Flow task, merged
2026-08-30 from four earlier documents. Structure: a top banner naming the newest live sections
first (as of this writing: §7.21 and §7.54 through §7.68, the estate-wide visual/structural
elevation and remediation work), then a large "⚠️ WHAT THIS IS NOT" table drawing the boundary
against `docs/outstanding-issues.md` (the whole repository's separate ledger — never touched from
Ward Flow work) and `docs/ward-flow-ledger.md` (the decisions register — cited, never restated here).
Below the banner the file is chronological: the original 30 August record (kept for its reasoning,
its "building now" / "with the owner" lists are explicitly not current), then a
"👑 AUTHORITATIVE WARD FLOW MASTER LEDGER — RECONCILED 2026-09-13" section, then numbered `§7.x`
entries running from mid-September to 25 September, each one a dated session closeout or status
refresh. To find a task's current state: jump to the highest-numbered `§7.x` section that mentions
it, not the earliest. `design-test-registry.json` and `audit-2026-09-25-full-review.md` both cite
this file directly.

## Which document answers which question

| Question                                                                    | Answer                                                                                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is Ward Flow, in one paragraph?                                        | `README.md` ("What Ward Flow is"); fuller version `product-brief.md`.                                                                              |
| What did the owner rule, on any topic?                                      | `OWNER-RULINGS.md` (generated index) — but open the cited source file, it may carry a later correction/withdrawal.                                 |
| What does "done" mean for a task?                                           | `definition-of-done.md`.                                                                                                                           |
| What does "done" mean for a screen?                                         | `SCREEN-DEFINITION-OF-DONE.md`, read together with its 13 and 21 September amendment banners.                                                      |
| Has a screen actually been looked at against its drawing?                   | `SCREEN-VERIFICATION.md` (generated from `screen-verification.json`) — a hash match, not a correctness claim.                                      |
| Which mockup is the design source for a route?                              | [Screen map](../SCREEN-MAP.md) for route/drawing associations; the accepted app remains appearance authority.                                      |
| What is the current status — what's built, deferred, needs the owner?       | [Task ledger](../../ward-flow-task-ledger.md) and the owning current checkpoint/receipt; STATUS is historical.                                     |
| What is still genuinely open / needs an owner answer?                       | `OPEN-QUESTIONS.md` (top part only, above its own "Superseded" marker) and the current task checkpoint and receipt.                                |
| What is the state of a specific task?                                       | `docs/ward-flow-task-ledger.md`, newest-numbered `§7.x` section that mentions it.                                                                  |
| How does an AI builder pick up and hand back work?                          | `HOW-WE-WORK.md`.                                                                                                                                  |
| How should a reply to the owner be formatted?                               | `how-to-write-to-the-owner.md`.                                                                                                                    |
| What are the fixed vocabulary lists, and which matter behaviourally?        | `vocabulary.md` — dated (1 Sept), re-derive before quoting a specific list.                                                                        |
| What is the design system / token standard?                                 | [Accepted-app baseline](../README.md); the mockup design-system document records historical drawing rules.                                         |
| Is a document's date or SHA still trustworthy?                              | Never assume so — every current doc says to re-check `git log -1`; see the "Trusting a document's number" pitfall in the [Overview](overview.md).  |
| Are Aboriginal cultural safety / clinical safety / MHA compliance reviewed? | `governance/*.md` — each self-labelled DRAFT baseline, not a completed review; `decisions.md` D-6 records the Aboriginal review as owner-deferred. |

## Pitfalls in this area

1. **A file with no banner is not automatically current.** Several top-level files (the chat-role
   prompts, `three-chat-working-agreement.md`, `who-is-who.md`, `assignment-register.md`) describe a
   process `HOW-WE-WORK.md` has since replaced, but carry no "SUPERSEDED" banner because
   `HOW-WE-WORK.md` §9's convention only started 17 September. Cross-check against `HOW-WE-WORK.md`
   before following one of these, not just the file's own banner.
2. **`live-state.json`'s embedded pointer is dead.** It names `docs/ward-flow/control/roles.json` as
   its contract; that `control/` folder was deleted with WLQ-33 (`HOW-WE-WORK.md` §7). The file is
   still read by code (`scripts/ward-flow/chat-control.mjs`), but do not follow its internal path
   fields.
3. **The mockups' `reference/gemini-2026-09-15/` folder shares filenames with the real mockups one
   level up** (`patient-now-third-edition.html` exists at both paths, with different content). A
   path-blind grep or diff across the whole `mockups/` tree will silently compare or conflate the
   wrong file. Always match on the full relative path.
4. **`mockups/README.md`'s own text warns that no gate reads a drawing.** A defect fixed in the built
   screen can be redrawn back into its mockup and nothing anywhere turns red — `SCREEN-VERIFICATION.md`
   only proves a human looked once, at a specific hash.
5. **`harness/engine-gate-harness.test.ts.txt` will never run.** It is named `.txt` specifically so
   Vitest skips it; treat anything in it as a historical probe result, not a live regression guard.
6. **`docs/ward-flow/outstanding/` is not `docs/outstanding-issues.md`.** The task ledger's own
   banner table exists because this distinction has been crossed before; the two are unrelated ledger
   systems for unrelated scopes.
7. **`STATUS.md` and `LOCAL-FIRST-RUN.md` both carry encoding artefacts** (a mojibake em dash and a
   leading BOM character respectively) from a past save in the wrong encoding. They read fine in a
   browser/editor but can break a naive byte-exact diff or a `grep -c '^#'` style anchor on line 1.
8. **Two "sixteen"/"eighteen" screen counts in the same folder do not describe the same set.**
   `mockups/README.md`'s "sixteen pages" table is the original third-edition set;
   `WARD-FLOW-DESIGN-SYSTEM.md`'s "eighteen mockups" plan and `SCREEN-MAP.md`'s "68 mockups" are
   different countings at different times (pre-11-September additions vs. everything on disk now).
   Quote the file the count came from, not just the number.
9. **`design/prototypes/` is `.prettierignore`d on purpose** — its files are compared byte-for-byte
   against a shared CSS block, and a whole-tree Prettier run once broke ten guards by touching them.
   Do not "clean up" that ignore entry.
10. **`product-brief.md` and `roadmap.md` are dated 25 September (today) but are not yet named in
    `README.md`'s "four documents" list** (last touched 21 September). They are current in the sense
    of being the newest writing, but the entry-point document has not caught up to them yet — do not
    assume `README.md`'s document list is exhaustive.

## Not checked

I did not open every file inside `archive/dated-notes/` (177 files), `lessons/` (207 lesson files),
`plans/` (374 files) or `sdd-rescued/` (81 files) individually — for these I read each folder's own
README/index where one exists, sampled representative files, and relied on filename dates plus
cross-references from current documents. I did not verify that every `[artifact]` URL in
`mockups/README.md` still resolves (that would touch an external provider). I did not open every one
of the 20 duplicate-named files inside `mockups/reference/gemini-2026-09-15/` individually to confirm
each really is a visual variant of its same-named counterpart one level up — I took the folder's own
`README.md` at its word for the batch as a whole. I did not run `node scripts/ward-flow/screen-map.mjs
--check` or the other generator `--check` commands myself (running scripts is out of scope for this
part); status calls for generated files rest on each file's own "GENERATED, DO NOT EDIT" banner
matching what `HOW-WE-WORK.md` and `README.md` describe. I did not read `docs/ward-flow-ledger.md`
(the separate decisions register the task ledger's banner mentions) — it is out of this part's named
scope.
