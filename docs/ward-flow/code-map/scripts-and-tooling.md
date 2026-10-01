# Scripts, generators, hooks and tooling

> Updated tooling contracts, 2 October 2026: both selectors default to the local `origin/main`
> ref, retain explicit `--base`, never fetch and fail when refs cannot be compared. Owner-rulings
> indexing includes `decisions.md` with source-qualified IDs and distinguishes decisions from
> questions/proposals. The rules index reads only the versioned historical lessons copy; foreign
> branch/provider/model instructions remain historical. Screen verification records optional full
> checked revisions and bounded folder/page hashes, excluding shared shell, globals and transitive
> imports. Neither drawing freshness nor structural checks prove current app appearance.
> The detailed line counts below are the original 25 September snapshot, not fresh measurements.

Covers every tracked file under `scripts/ward-flow/` (including `scripts/ward-flow/audit/`), every
other `scripts/` file whose name or content genuinely mentions Ward Flow (found via
`grep -il ward scripts/`, excluding `scripts/ward-flow/`, then checked line by line — most raw hits
were false positives, listed at the end), the Ward-related `npm run` scripts in `package.json`,
`.githooks/pre-commit` and the Ward Flow parts of `scripts/guard-push.mjs`, the
`docs/ward-flow/journey/*.mjs` build tooling, the scripts under
`docs/ward-flow/mockups/third-edition-kit/`, and `docs/ward-flow/organisation/registry.json`. Tip
`ace8e9ee8d` (branch `codex/task-ward-flow-live-state-20260831`; `git log -1` on this worktree
currently shows one docs commit past that — `d9016539bd`, the code-map split itself — which does
not touch any file below). Written 25 September 2026. Line counts are `wc -l` on the tracked file,
run individually per file; nothing here was executed. Back to [the code map index](README.md).

## `scripts/ward-flow/` — generators (write a committed file from a source of truth)

- **`scripts/ward-flow/build-reference-registry.mjs`** (182 lines) — Generates
  `src/components/ward-management/reference/ward-reference-registry.ts` from
  `docs/ward-flow/reference-data/entities.json`: real, sourced NAMES for facilities, EDs, wards and
  community services. By construction `ReferenceEntity` carries no numeric field at all, so no bed
  count can leak through this path. Run: `npm run ward:reference:build`. Checked by
  `check-ward-reference.mjs`.
- **`scripts/ward-flow/build-reference-distances.mjs`** (135 lines) — Generates
  `src/components/ward-management/reference/ward-reference-distances.ts` from the same pack's
  `distances.json`: real OSM/OSRM road distances between 26 metropolitan sites. Explicitly does
  **not** replace `TRAVEL_BANDS` (regional, invented) — the two populations do not overlap. A
  missing pair renders nothing, never a dash or a zero.
- **`scripts/ward-flow/build-reference-teams.mjs`** (155 lines) — Generates
  `src/components/ward-management/reference/ward-reference-teams.ts`: published contact details
  (phone, hours, referral email) for real community mental-health services. Matches pack rows to
  Ward Flow teams by exact name only — never suburb/postcode/LGA proximity. No numeric capacity
  field, same structural reasoning as the registry generator.
- **`scripts/ward-flow/mockup-manifest.mjs`** (113 lines) — Writes
  `docs/ward-flow/mockups/MANIFEST.json`, a content hash of every file in `docs/ward-flow/mockups/`
  (CRLF normalised to LF first, so a checkout line-ending difference cannot fire `--check`).
  `--check` exits 1 if the committed manifest disagrees with disk. This is what makes a drawing
  edit as visible as a code change.
- **`scripts/ward-flow/owner-rulings-index.mjs`** (375 lines) — Scans `docs/ward-flow/owner-*.md`
  and generates `docs/ward-flow/OWNER-RULINGS.md`, an index of every ID-coded ruling, bare numbered
  heading, and ID-coded table row across roughly 30 files. `--check` fails if the committed index
  is stale. Deliberately excludes `how-to-write-to-the-owner.md` (instructions _to_ the owner, not
  a record of what he ruled).
- **`scripts/ward-flow/rules-index.mjs`** (130 lines) — Reads every lesson's frontmatter from the
  versioned historical copy (`docs/ward-flow/lessons/`) and generates
  `docs/ward-flow/RULES.md`, grouped by keyword-matched theme; anything unmatched is listed under
  "Unfiled" rather than silently dropped. `--check` is the gate mode.
- **`scripts/ward-flow/screen-map.mjs`** (176 lines) — Generates `docs/ward-flow/SCREEN-MAP.md`
  from the hand-authored `PAIRS`/`SUPERSEDED` roster in `screen-pairs.mjs`, cross-checked against
  every mockup, route source and screen folder actually on disk. `--check` fails on a stale map
  **or** on anything unmapped/unreachable it discovers that `PAIRS` does not cover — the
  UNREACHABLE check is what would have caught `ed-home.tsx` (imported by nothing, no route).
- **`scripts/ward-flow/screen-pairs.mjs`** (99 lines) — Not a script (no CLI, no shebang): the
  single hand-authored `PAIRS`/`SUPERSEDED` roster (mockup file ↔ route ↔ screen folder ↔
  in-build-plan flag), imported by `screen-map.mjs` and `screen-verification.mjs` so the list
  cannot have two copies that drift.
- **`scripts/ward-flow/screen-verification.mjs`** (266 lines) — Generates
  `docs/ward-flow/SCREEN-VERIFICATION.md` from the hand-edited
  `docs/ward-flow/screen-verification.json` (the record of a human actually looking at a screen
  beside its drawing, at three widths, both themes). `--check` fails only on STRUCTURAL problems
  (missing roster row, malformed entry, stale generated page) — deliberately **never** on a screen
  being unverified or stale, because every screen starts unverified and a gate that is red from
  birth gets switched off. `--report` prints the live comparison; `--hash <mockup>` prints one
  implementation hash on demand (never written into a generated file, so editing a component can't
  make the doc go stale).
- **`scripts/ward-flow/screen-verification-lib.mjs`** (137 lines) — The pure functions behind
  `screen-verification.mjs`: `drawingStatus` (has the DRAWING moved since the last look) and
  `implementationFiles`/`implementationSha256`/`implementationStatus` (has the BUILT screen moved).
  Written after WF-35, where a drawing-hash match was printed as "CURRENT" and read as a claim
  about the built screen, which nothing had actually compared.
- **`scripts/ward-flow/contact-sheet.mjs`** (102 lines) — Writes
  `docs/ward-flow/mockups/CONTACT-SHEET.html`: one page of every current drawing as a live
  `<iframe>` (never a screenshot — these drawings build their own navigation with JavaScript, so a
  static capture renders a different, wrong design). Excludes the two superseded
  patient-search drawings by name.
- **`scripts/ward-flow/sync-lessons.mjs`** (152 lines) — Copies the lesson store (working source)
  into `docs/ward-flow/lessons/` (versioned backup), byte-for-byte, comparing content not mtime.
  Never deletes from the repo copy — a file present in the repo but gone from the store is reported
  under "only in repo" and left alone, because that is exactly the moment the backup exists for.
  Exits 0 and does nothing if the store does not exist on this machine. `--check` mode for gates.

## `scripts/ward-flow/` — checks, ratchets and gates

- **`scripts/ward-flow/check-clinical-governance-gate.mjs`** (136 lines) — npm: `ward:governance:check`.
  Proves patient cohorts are synthetic (scans `ward-patients-seed.ts`), proves no outbound EHR/PAS
  endpoints exist, proves the prototype disclaimer is mounted, and hard-blocks live deployment
  without governance sign-off records in `docs/ward-flow/governance/approvals/`. Exit 1 on any
  breach.
- **`scripts/ward-flow/check-doc-links.mjs`** (100 lines) — npm: `check:ward-doc-links` /
  `ward:check-docs`. Fails if a relative markdown link under `docs/ward-flow/**` points at a file
  that is not there. Does not check absolute URLs, in-file anchors, or links inside fenced code
  blocks. ⚠️ Similarly named to, and a **different file from**, the repo-wide
  `scripts/check-docs-links.mjs` (`npm run docs:check-links`) — see Pitfalls.
- **`scripts/ward-flow/check-drawing-rules.mjs`** (223 lines) — Usage:
  `node scripts/ward-flow/check-drawing-rules.mjs <drawing.html> [...]`. Static, read-only check of
  a drawing's rendered copy (text, title/aria-label/placeholder/alt/value attributes, and string
  literals inside its own `<script>`) against the owner's written rules (legal-form codes, banned
  phrases, edge-bar allowlist). Import-free by design — a `.mjs` script must not depend on the
  TypeScript source tree, so `SELECTABLE_LEGAL_FORMS` is a hand-copied constant kept in step with
  `ward-legal-forms.ts` by comment, not by import. Not npm-wired; run directly.
- **`scripts/ward-flow/check-errata-freshness.mjs`** (263 lines) — npm: `check:ward-errata-freshness`.
  Re-measures every factual claim in `docs/ward-flow/plans/2026-09-10-master-plan-errata.md`
  against the current tree and reports STILL TRUE / EXPIRED per claim, using the command each claim
  names. Written after that errata sheet itself went stale within an hour and would have damaged a
  working guard if followed blindly.
- **`scripts/ward-flow/check-live-state.mjs`** (223 lines) — Report-only: reads
  `docs/ward-flow/live-state.json` and compares its recorded git assertions against the current
  machine. Refuses any arguments (`process.argv.length !== 2`, exit 2). Never fetches, writes,
  stages, commits or contacts a provider. Not npm-wired.
- **`scripts/ward-flow/check-source-control-chars.mjs`** (341 lines) — npm:
  `check:ward-source-control-chars`. Fails if any file under `src/`, `tests/` or `docs/ward-flow/`
  contains a C0 control character other than tab/newline/CR. Written after two literal NUL bytes
  were committed inside a template literal on 2026-09-10 and passed every other gate (tests, `tsc`,
  Prettier, `git diff --numstat`) because a NUL separates a string exactly as well as a space.
- **`scripts/ward-flow/check-text-size-floor.mjs`** (495 lines) — npm: `check:ward-text-size`.
  Ratchet (owner ruling D-3): counts `--text-3xs`/`--text-2xs` occurrences in
  `src/components/ward-management/**/*.module.css` and compares against
  `text-size-floor-baseline.json` — the count may only fall, never rise. `--update-baseline`
  rewrites the baseline (only after a screen is legitimately rebuilt below the floor).
- **`scripts/ward-flow/check-ward-legal-language.mjs`** (237 lines) — npm:
  `check:ward-legal-language`. Fails if a screen renders wording that asserts legal authority the
  app does not have ("Statutory Breaches", "Legal deadline passed", computed MHA deadlines) while
  explicitly permitting the real, owner-approved form names and the `authorisation` eligibility
  gate. A ban on the app ASSERTING legal consequence, not a ban on legal vocabulary.
- **`scripts/ward-flow/check-ward-reference.mjs`** (79 lines) — npm: `check:ward-reference`.
  Regenerates `ward-reference-registry.ts` and `ward-reference-distances.ts` into memory (importing
  `build-reference-registry.mjs`/`build-reference-distances.mjs`'s `generate` exports) and compares
  against the committed files. Never writes; reports the regenerate command instead.
- **`scripts/ward-flow/audit-lessons.mjs`** (425 lines) — Usage:
  `node scripts/ward-flow/audit-lessons.mjs [--check|--json]`. Mechanical audit of the lesson store
  across four failure modes — decay (broken paths/retired scripts cited as active), duplicates,
  contradictions, and frontmatter/encoding integrity. Writes
  `docs/ward-flow/LESSON-AUDIT-REPORT.md` in default mode; `--check` exits 1 on unclassified decay
  or unannotated contradictions; `--json` for machine-readable output.
- **`scripts/ward-flow/design-test-sync.mjs`** (238 lines) — npm: `ward:test:sync` /
  `ward:test:sync:check`. Tracks alignment between `docs/ward-flow/design-test-registry.json` and
  the 34 operational screens' tests. Flags: `--check` (coverage/alignment), `--detect` (screens
  whose design/code changed), `--audit` (brittle test queries), `--sync <id>` (re-align DOM/copy
  assertions for one screen). Hard-refuses to touch clinical calculations, legal thresholds or
  patient-safety assertions — presentational assertions only.

## `scripts/ward-flow/` — coordination and dev tooling

- **`scripts/ward-flow/chat-control.mjs`** (3,404 lines — the largest file in this area) — Local-only
  multi-session coordination: validates the role contract (lead/builder/verifier), creates
  content-addressed assignments, handovers and reset certificates in
  `docs/ward-flow/control/` (`handoverDirectory`, `promptDirectory`), manages atomic local role
  leases, and renders a recreation prompt. Subcommands: `validate`, `status`, `export-chat-log`,
  `capture-checkout-artifacts`, `create-assignment`, `create-handover`, `publish-handover`,
  `certify-reset`, `recreate --role lead|builder|verifier`. Imports `receiptKey` from
  `../gate-receipts.mjs`. Never commits, merges, fetches, pushes or contacts a provider. Not
  npm-wired; invoked directly by whichever chat-control workflow doc names it.
- **`scripts/ward-flow/whois.mjs`** (239 lines) — Usage: `node scripts/ward-flow/whois.mjs [name]
[--role <query>] [--all]`. Resolves "what is checked out in folder X" from git state, because a
  session's self-reported name or branch label cannot be trusted (documented incident: one session
  claimed two contradictory identities from the same transport address in one day). Explicitly a
  folder audit, not an identity system — it answers a different question from "who sent this
  message". Full protocol: `docs/ward-flow/who-is-who.md`. Tested by
  `tests/ward-whois-register.test.ts` (its own doc comment warns that `process.exit` inside the
  `--role` path would end a whole Vitest run, not just a test, if imported carelessly).
- **`scripts/ward-flow/folded.sh`** (110 lines, bash) — Usage: `folded.sh <worktree> <line-ref>
<known-folded-control> <sha>...`. Answers "has this commit actually landed on the ward line", as
  opposed to `git log --all -S '<text>'` which answers "which commit introduced this text" — a
  substitution that produced two same-day false "unfolded" reports. Refuses to report at all until
  a commit named as KNOWN-FOLDED resolves as folded (proves the checker CAN say yes before trusting
  a no). Three exit codes: 0 all folded, 1 at least one not folded, 2 CANNOT TELL (control or ref
  failed to resolve) — code 2 is deliberately not collapsed into "not folded".
- **`scripts/ward-flow/role-map.py`** (103 lines, Python) — Prints the second-edition →
  ward-tokens colour-role mapping with WCAG contrast ratios, authored by ROLE rather than by VALUE
  (six of seven neutral roles differ by only a hex digit, so value-matching cannot discover the
  pairing). Reads `docs/ward-flow/design/prototypes/design-language.html`, `ckb-v2-tokens.css` and
  `ward-tokens.module.css`. Read-only reference tool; not npm-wired.
- **`scripts/ward-flow/mutate.mjs`** (116 lines) — Exports `withMutation({file, find, replace},
body)` and `blobHash` (git's own blob-hash algorithm). A single mutation with two guarantees: the
  file is always restored in a `finally`, and the restore is verified by hash rather than assumed.
  Deliberately does not use `git checkout --` (blocked by this machine's protection hook on some
  paths, and silently a no-op for an untracked file). Written after a hand-typed `node -e` mutation
  probe silently did nothing three times and reported the unmutated code as a pass.
- **`scripts/ward-flow/mutation-run.mjs`** (1,279 lines) — npm: `mutate` /
  `mutate:self-test`. The CLI mutation-testing harness: refuses an untracked target, refuses a
  find-string that does not match exactly once, proves the mutant applied by content, restores from
  bytes captured before the edit (not from `HEAD`) in a `finally`, verifies the restore by content,
  and reports which assertions went red. Usage: `--file <path> --find <str> --replace <str>
--command <test command>`, or `--self-test`. Exit codes: 0 mutant caught, 1 mutant survived, 2
  refused before mutating, 3 restore failed (act now), 4 indeterminate (mutant never ran).
- **`scripts/ward-flow/organisation-core.mjs`** (403 lines) — Pure logic behind
  `organisation.mjs`: `buildReport`, `classifyEntry`, `validateRegistry`, `digest` (SHA-256),
  `matches`, `safePath`, `contentDenied`, `TOOL_VERSION`. No filesystem or git access of its own —
  imported by `organisation.mjs` for testability.
- **`scripts/ward-flow/organisation.mjs`** (512 lines) — npm: `ward:organise` (writes a report) /
  `ward:organise:check`. Walks the repository against `docs/ward-flow/organisation/registry.json`,
  classifying every file into one of six systems (or excluded/restricted/unavailable), and writes
  its report into the git directory (`<gitdir>/ward-organisation`, **not** a tracked path — see
  `reportDirectory`). CLI: `--check|--write-report|--show-report --source working-tree|index
[--root <repo>]`. Refuses symlinks, junctions and hardlinks (conservatively "unavailable") and
  caps file/total bytes read (8 MiB / 96 MiB).
- **`scripts/ward-flow/dev-with-organisation.mjs`** (27 lines) — npm: `ward:dev`. Runs
  `organisation.mjs --write-report --source working-tree`, then (only if that exits 0)
  `scripts/ensure-local-server.mjs`, propagating whichever exit code is non-zero.
- **`scripts/ward-flow/serve-mockups.mjs`** (68 lines) — Usage: `node
scripts/ward-flow/serve-mockups.mjs [port]` (env `PORT`, default 60178). A minimal static HTTP
  server for `docs/ward-flow/mockups/`, root path defaulting to
  `settings-third-edition.html`. This is how a drawing must be viewed — opening the HTML file
  directly renders a different, wrong design because the drawings build their navigation with
  JavaScript.

## `scripts/ward-flow/` — manual visual audits (Playwright; not fold gates)

None of the files in this group are npm-wired or referenced by the pre-commit/pre-push guards; all
are run directly with `node` by whoever is doing a one-off visual pass, and none of them are part
of "Fold gates in order" below.

- **`scripts/ward-flow/adversarial-visual-audit.mjs`** (482 lines) — Hardcoded to
  `http://localhost:3605`. Screenshots a fixed screen list at 3 viewports × 2 themes and writes
  `.audit-reports/adversarial-audit-report.json` plus `.audit-reports/screenshots/`.
- **`scripts/ward-flow/audit-all-screens-visual.mjs`** (231 lines) — The one visual auditor that
  uses `stableProjectPort`/`WARD_FLOW_URL` instead of a hardcoded port. Checks FF4 (zero horizontal
  overflow), FF6 (zero console errors), FF8 (disclaimer present) across all 34 screens, 3
  viewports, 2 themes; writes a JSON report under `.audit-reports/`. Optional `process.argv[2]`
  filters to one screen.
- **`scripts/ward-flow/audit-on-call-elevation.mjs`** (269 lines) and
  **`scripts/ward-flow/audit-out-of-area-elevation.mjs`** (310 lines) — One-off Playwright audits
  hardcoded (or `BASE_URL` env-overridable, for the out-of-area one) to `localhost:3605`, each
  writing screenshots under its own `.audit-reports/<name>/` subfolder for a specific elevated-flag
  screen.
- **`scripts/ward-flow/audit-statistics-screens.mjs`** (193 lines) — Hardcoded to
  `localhost:3605`; walks a fixed list of 7 statistics-screen URLs plus 3 "known-good" comparison
  URLs. No file output found (console only).
- **`scripts/ward-flow/inspect-targets.mjs`** (49 lines) and **`scripts/ward-flow/test-drawer.mjs`**
  (52 lines) — Small, hardcoded-URL (`localhost:3605`) Playwright probes: the first checks
  interactive-element tap-target sizes on the statistics screens; the second clicks the Tools
  drawer trigger and Escape-key close on the statistics hub. Console output only.
- **`scripts/ward-flow/verify-movement-horizon.mjs`** (128 lines) — Checks the 48-hour movement
  Gantt chart: design-token discipline, WCAG contrast on 6 event-swatch colours in dark mode,
  scrubber zoom-math invariants, label-clipping, and lane structure across the four WA health
  services.
- **`scripts/ward-flow/table-sweep.mjs`** (125 lines) — Walks the import graph transitively (not
  just one level — an earlier, shallower version missed two table-rendering files reached only
  through `ward-management-modes` → `ward-management-network`) from each screen's `page.tsx` to
  report which screens render a table and which implementation. Uses `<th[ >]`, not `<th[^>]*>`,
  because the latter also matches `<thead>` and once produced a false accessibility finding across
  ten files.
- **`scripts/ward-flow/token-collision-scan.mjs`** (228 lines) — Finds two different design-token
  names resolving to the identical colour on a fill property, in **both** light and dark palettes
  (light-only reports 30 groups, 21 of them false). `--self-test` runs three planted cases (real
  collision, clean pair, dark-only collision) before trusting its own report; `--light-only` skips
  the dark check. Writes nothing unless `--self-test`/normal run finds a collision file to report
  against (`fs.writeFileSync` appears once, for its own report).
- **`scripts/ward-flow/text-size-floor-baseline.json`** (45 lines) — Not a script: the ratchet
  baseline `check-text-size-floor.mjs` reads and (`--update-baseline`) writes. Current recorded
  count: 379 occurrences across 37 files, measured 2026-09-12, tied to owner ruling D-3.

## `scripts/ward-flow/audit/` — restored measurement aside (explicitly not fold gates)

Per its own `README.md`: "Restored from the 2026-09-22 Temp aside
(`ward-lead-aside-20260922-wave4/.audit-reports/`). These are local measurement and
browser-stabilisation helpers from the adversarial audit — not part of the fold gates."

- **`scripts/ward-flow/audit/README.md`** (14 lines) — The table above, plus the note that the
  large suite JSON lives at `docs/ward-flow/audit-artefacts/stabilisation-suite-report.json`.
- **`scripts/ward-flow/audit/count-ward-population.mjs`** (28 lines) — Walks `tests/` and prints
  `population_files=<N>`: the same "which test files count as the ward suite" logic duplicated in
  `measure-ward-suite.mjs` and (independently again) in `scripts/check-ward-expected-reds.mjs`.
- **`scripts/ward-flow/audit/measure-ward-suite.mjs`** (114 lines) — Imports
  `compareFailingSet` from `../../check-ward-expected-reds.mjs`. Runs the same ward-suite
  comparison but always prints file/test/failing counts even when the manifest comparison itself
  fails, and writes the kept report to
  `docs/ward-flow/audit-artefacts/stabilisation-suite-report.json`.
- **`scripts/ward-flow/audit/stabilisation-browser-check.mjs`** (210 lines) and
  **`scripts/ward-flow/audit/stabilisation-browser-check-2.mjs`** (186 lines) — One-shot Playwright
  smoke checks against `WARD_URL` (default `localhost:3605`): live clock, handover countdown, bed
  alerts panel totals, community transport, task filters, ED waits. Console output only; the
  second file is explicitly a follow-up pass, not a rerun of the first.

## Ward-related npm scripts (`package.json`)

| Script                            | Command                                                                        | What it does                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:ward-expected-reds`        | `node scripts/check-ward-expected-reds.mjs`                                    | Full offline ward suite; failing set must equal `tests/ward-expected-reds.json` in both directions, with floors on files-walked and tests-run so a broken run can't report success vacuously. |
| `check:ward-text-size`            | `node scripts/ward-flow/check-text-size-floor.mjs`                             | Sub-12px CSS-use ratchet (owner ruling D-3).                                                                                                                                                  |
| `check:ward-source-control-chars` | `node scripts/ward-flow/check-source-control-chars.mjs`                        | No stray C0 control bytes in `src/`, `tests/`, `docs/ward-flow/`.                                                                                                                             |
| `check:ward-errata-freshness`     | `node scripts/ward-flow/check-errata-freshness.mjs`                            | Re-measures every claim in the 2026-09-10 errata sheet.                                                                                                                                       |
| `check:ward-citations`            | `node scripts/check-ward-citations.mjs`                                        | Every git-object SHA and path cited in Ward Flow docs resolves.                                                                                                                               |
| `mutate`                          | `node scripts/ward-flow/mutation-run.mjs`                                      | CLI mutation-testing harness.                                                                                                                                                                 |
| `mutate:self-test`                | `node scripts/ward-flow/mutation-run.mjs --self-test`                          | Proves the harness itself can detect a mutant.                                                                                                                                                |
| `test:e2e:ward-journeys`          | `node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-`          | The 13 `tests/ui-ward-*.spec.ts` browser journeys, advisory `chromium-mockups` project only — never the production browser lane.                                                              |
| `check:ward-legal-language`       | `node scripts/ward-flow/check-ward-legal-language.mjs`                         | No wording asserting legal authority the app lacks.                                                                                                                                           |
| `ward:reference:build`            | runs `build-reference-registry.mjs` then `-distances.mjs` then `-teams.mjs`    | Regenerates the three reference-pack-derived TypeScript files.                                                                                                                                |
| `check:ward-reference`            | `node scripts/ward-flow/check-ward-reference.mjs`                              | The three generated reference files match their source pack.                                                                                                                                  |
| `check:ward-doc-links`            | `node scripts/ward-flow/check-doc-links.mjs`                                   | Relative links under `docs/ward-flow/**` resolve.                                                                                                                                             |
| `ward:journey`                    | `node docs/ward-flow/journey/build.mjs`                                        | Runs the 7-step journey-explorer build chain.                                                                                                                                                 |
| `ward:journey:prove`              | `node docs/ward-flow/journey/build.mjs --prove`                                | Runs the 7 `prove-*.mjs` probes instead (each deliberately breaks an input and checks the build refuses).                                                                                     |
| `ward:docs`                       | inline `node -e`                                                               | Prints where the Ward Flow docs and boot instructions live.                                                                                                                                   |
| `ward:check-docs`                 | `npm run check:ward-doc-links`                                                 | Alias.                                                                                                                                                                                        |
| `ward:organise`                   | `node scripts/ward-flow/organisation.mjs --write-report --source working-tree` | Writes an organisation report to the git-dir side location.                                                                                                                                   |
| `ward:organise:check`             | `node scripts/ward-flow/organisation.mjs --check`                              | Gate mode of the same.                                                                                                                                                                        |
| `ward:dev`                        | `node scripts/ward-flow/dev-with-organisation.mjs`                             | Organisation check, then starts/ensures the local dev server.                                                                                                                                 |
| `ward:first-run`                  | inline `node -e`                                                               | Prints the three-step local first-run instructions.                                                                                                                                           |
| `ward:test:sync`                  | `node scripts/ward-flow/design-test-sync.mjs`                                  | Regenerate design↔test alignment.                                                                                                                                                             |
| `ward:test:sync:check`            | `node scripts/ward-flow/design-test-sync.mjs --check`                          | Gate mode.                                                                                                                                                                                    |
| `ward:governance:check`           | `node scripts/ward-flow/check-clinical-governance-gate.mjs`                    | Synthetic-only / no-live-endpoint / disclaimer / sign-off gate.                                                                                                                               |

⚠️ **Not npm-wired at all**, despite being real gates run by hand or by `folded.sh`/pre-commit-style
workflows: `scripts/check-ward-data.mjs`, `scripts/run-ward-tests.mjs`,
`scripts/ward-flow/check-drawing-rules.mjs`, `scripts/ward-flow/check-live-state.mjs`,
`scripts/ward-flow/chat-control.mjs`, `scripts/ward-flow/whois.mjs`, `scripts/ward-flow/folded.sh`,
`scripts/ward-flow/role-map.py`, and every file in the "manual visual audits" and `audit/` groups
above. Each is invoked directly with `node`/`python`/`bash`, per its own header comment's usage
line.

## Other `scripts/` files that mention Ward Flow (outside `scripts/ward-flow/`)

- **`scripts/check-ward-expected-reds.mjs`** (427 lines) — The full offline ward suite comparison
  described in the npm table above. Two floors (files walked, tests run) are the load-bearing half;
  the manifest-equality comparison is the easy half. Exit-code / direct-invocation detection
  (`isDirectInvocation`) is deliberately careful about Windows path comparison after a prior
  silent-pass bug on raw string comparison.
- **`scripts/check-ward-citations.mjs`** (274 lines) — `--selftest` injects one impossible short
  SHA, one impossible full-length SHA and one absent path and must exit 1 naming all three; a
  healthy tree exits 0; run from outside a git repo exits 2 (REFUSED). Resolves a cited SHA as
  commit, then blob, then tree — checking only `^{commit}` once reported 24 false "unresolved SHA"
  findings against 0 real defects. Copyable into any worktree with zero dependencies.
- **`scripts/check-ward-data.mjs`** (976 lines) — Read-only, offline. Imports real values from the
  TypeScript modules themselves (re-running under `tsx`) rather than duplicating their arithmetic,
  except one module-local React constant it must text-parse (`columnServices` in
  `ward-management-network.tsx`) — that parse fails loudly rather than silently reporting nothing
  to check. Every failure message names the file to edit and the values as written, because its
  audience is a psychiatrist editing bed numbers, not a developer reading a stack trace. Not
  npm-wired; documented usage is `node scripts/check-ward-data.mjs`.
- **`scripts/run-ward-tests.mjs`** (537 lines) — Usage: `node scripts/run-ward-tests.mjs [files...]`
  (no args discovers every `tests/ward-*.test.ts(x)`). Refuses to report success unless every
  handed-in file actually produced a result, batching Vitest invocations to stay under Windows'
  command-line length cap while always reconciling against the one original handed-in list, never
  per batch. Written after a worker crash produced `83 passed (83)` — a pass line that agreed with
  itself and not with its 84-file input, and exited 0. Exit codes: 0 all ran and passed, 1 a real
  failure, 2 a coverage discrepancy (deliberately distinct from 1).
- **`scripts/guard-push.mjs`** (1,785 lines total) — Ward Flow is Guard 0 of six pre-push guards
  (the schema drift guard was retired on 26 September 2026).
  Header doc comment: lines 11–20. Guard 0 implementation — `isMainBranch`, `isWardFlowBranch`,
  `isWardFlowFile`, `wardFlowPushVerdict`, `wardFlowPushGuard`: lines 268–478. Call site inside
  `main()`'s guard chain: line 1532. Self-test assertions for the ward guard: lines 1705–~1769.
  Blocks pushing anything `isWardFlowFile` recognises (or any push from a branch matching
  `/ward[-_]?flow|ward[-_]?lead|\bward\b/i`) to `origin/main` (override
  `CONFIRM_WARD_FLOW_PUSH_TO_MAIN=I_CONFIRM_FOLD_TO_ORIGIN_MAIN`) or to any other remote branch
  (override `CONFIRM_WARD_FLOW_REMOTE=I_CONFIRM_WARD_FLOW_REMOTE`) — because Ward Flow branches
  exist on this disk only, with no remote copy, and "fold into main" in this context always means
  the local ward line.
- **`scripts/ci-change-scope.mjs`** (1,543 lines total) — Repo-wide CI scope classifier
  (`check:ci-scope`), not Ward-owned, but its advisory-mockup arm has a dedicated, commented Ward
  section: `wardAdvisorySpecs` (~lines 111–156) derives the `ui-ward-*.spec.ts` alternation from
  `mockupSpecPattern` in `playwright.config.ts` rather than restating it — restating it drifted
  three separate times (`morning`, `forced-colors`, then three specs at once in a merge that
  silently unioned instead of conflicting). The `mockupPatterns` array separately notes (~line 180)
  that Ward Flow's implementation tree and its journeys carry no literal "mockup" in their paths,
  so every name-based rule needs this explicit ward arm to see them at all.
- **`scripts/production-readiness.ts`** (538 lines) — One-line mention (~line 277): the
  `DeveloperAreaGate` production-gating comment lists `/mockups/ward-flow/**` alongside the other
  three gated mockup surfaces, and states the exact double-flag pairing that is allowed to bypass
  it for the isolated Playwright production build.
- **`scripts/generate-site-map.ts`** (786 lines) — Generates `docs/site-map.md`. Two Ward Flow
  entries: a redirect-map row for `/mockups/ward-flow/constellation` → `/network`, and a
  known-caveats line documenting that `/mockups/ward-flow` is one of four developer-gated mockup
  subtrees that survive in production (404 elsewhere) behind `DeveloperAreaGate`.
- **`scripts/issues-report.mjs`** (403 lines) — `/issues` ledger reporting tool. `--ward` filters
  the outstanding-issues report to rows `isWardFlowRow` recognises (matching `/^ward flow\b/i` in
  the summary, or explicit flags); `--core` is the complement. The two flags are mutually exclusive
  (throws if both given).
- **`scripts/playwright-pr-shards.mjs`** (350 lines) — PR-required Playwright shard assignment.
  One-line comment (~line 132) records that `ui-ward-{management,coordinator,roles}.spec.ts` moved
  OUT of the required PR shards once Ward Flow moved behind the `/mockups/ward-flow` developer
  gate; it now runs only under the advisory `chromium-mockups` project.
- **`scripts/list-database-skills.mjs`** (507 lines) — One-line reference to
  `docs/ward-management-mode-map.md` in a list of catalogued skill docs; not Ward-Flow-specific
  tooling itself.
- **`scripts/check-codebase-index-coverage.mjs`** (173 lines) and
  **`scripts/check-docs-script-refs.mjs`** (126 lines) — Both are general repo-hygiene gates
  (codebase-index coverage; stale script references in docs) that each carry exactly one incidental
  Ward Flow comment: the former excludes `.audit-reports` as "Local ward-flow audit scratch...not a
  product module"; the latter explains why "lessons" was added to a dated-doc allowlist after
  `docs/ward-flow/lessons/` was versioned in.
- **`scripts/check-mockup-retirement.mjs`** (995 lines), **`scripts/check-type-scale.mjs`** (72
  lines) and **`scripts/check-dead-code-candidate.mjs`** (633 lines) — General repo gates
  (mockup-route retirement safety, off-scale Tailwind text utilities, dead-code candidate
  detection) that each use Ward Flow as a worked example or an explicit exclusion inside otherwise
  repo-wide logic — e.g. `/mockups/ward-flow` is cited as one of the live-in-production gated
  mockup surfaces a naive retirement policy would wrongly delete, and `check-type-scale.mjs`'s own
  comment names the Ward Flow 12px floor as the reason its off-scale findings on ward CSS are
  grandfathered rather than enforced there.
- **`scripts/check-docs-links.mjs`** (626 lines) — npm: `docs:check-links`. The **repository-wide**
  doc-link checker (all of `docs/`, not just `docs/ward-flow/`). Genuinely different tooling from
  `scripts/ward-flow/check-doc-links.mjs`; see the naming-collision pitfall below.
- **`scripts/design-system-contract-baseline.json`** (225 lines) — A whole-repo design-token
  contract-violation baseline; several `src/components/ward-management/**` files appear in it
  alongside every other component directory. Not Ward-owned tooling — a data file for
  `design-system-contract-utils.mjs`'s repo-wide ratchet.

### False-positive matches (matched the grep, are not about Ward Flow)

`grep -il ward scripts/` (excluding `scripts/ward-flow/`) matches substrings, so most hits were
`forward`, `toward`, `backward`, `outward`, `award`, `afterward(s)` or `awareness` inside an
unrelated word. Checked individually and confirmed to have **zero** genuine Ward Flow content:
`scripts/audit-merge-loss.mjs`, `scripts/build-medication-lexicon-report.ts`,
`scripts/check-bundle-budget.mjs`, `scripts/check-dependency-drift.mjs`,
`scripts/check-design-drift-ratchet.mjs`, `scripts/check-diff-integrity.mjs`,
`scripts/check-drift.ts`, `scripts/check-repo-awareness-snapshot.ts`,
`scripts/design-system-contract-utils.mjs`, `scripts/dev-free-port.mjs`,
`scripts/eval-answer-quality.ts`, `scripts/gate-arbiter.mjs`, `scripts/gate-receipts.mjs`,
`scripts/generate-outstanding-issues-snapshot.mjs`, `scripts/generate-repo-awareness-snapshot.ts`,
`scripts/lib/tenancy-scan.mjs`, `scripts/pr-policy.mjs`, `scripts/recover-ingestion-queue.ts`,
`scripts/run-eval-safe.mjs`, `scripts/run-heavy.mjs`, `scripts/setup-claude-cloud.sh`,
`scripts/snapshot-repo-awareness.mjs`, `scripts/sql/capture-live-retrieval-rpcs.sql`,
`scripts/sql/drift-replay-scaffold.sql`, `scripts/test-focused.mjs`.

Three further files use "ward" only as the ordinary clinical noun ("hospital ward", "ward round"),
for the unrelated PsychSift RAG product, never the Ward Flow product: `scripts/soak-test.ts`
("ward-round soak test" for the PsychSift app tier), `scripts/sql/lexical-rpc-parity-check.sql`
("routine ward round documentation" as synthetic RAG test copy), and
`scripts/fixtures/rag-adversarial-cases.v1.json` ("SYNTHETIC Ward Handover Extract" as an
adversarial RAG fixture title). None of the three are Ward Flow tooling.

Also outside scope by name but not by content: **`scripts/audit-officer-200.mjs`** (154 lines) and
**`scripts/audit-third-edition-200.mjs`** (240 lines) _are_ genuine, undocumented Ward Flow
Playwright audits (200-point checklists against `/mockups/ward-flow/transport/officer` and the 16
third-edition screens respectively, using `stableProjectPort`/`WARD_FLOW_URL`) — they did not
surface from the `ward` grep because their filenames and most of their content name screens and
test IDs rather than the word "ward" itself. ⚠️ Both hardcode `ARTIFACT_DIR` to a path outside this
repository, on another AI tool's local data folder on this specific machine
(`C:\Users\joshs\.gemini\antigravity\brain\<uuid>`) — see Pitfalls.

## `.githooks/pre-commit` — Ward Flow parts

236 lines total. Fails open by design (missing script/node/older branch skips silently rather than
blocking a commit it cannot judge), and each check fires only when its own declared source pattern
is staged.

- **Lines 19–59: generated-index re-check.** `ward_flow_index_check(script, pattern)` runs
  `node <script> --check` and blocks the commit if it disagrees, only when a staged file matches
  that script's pattern:
  - `screen-map.mjs` ← `docs/ward-flow/mockups/**`, `src/app/mockups/ward-flow/**`,
    `docs/ward-flow/SCREEN-MAP.md`, `scripts/ward-flow/screen-pairs.mjs`
  - `rules-index.mjs` ← `docs/ward-flow/RULES.md`
  - `owner-rulings-index.mjs` ← `docs/ward-flow/(archive/dated-notes/)?owner-*.md`,
    `docs/ward-flow/OWNER-RULINGS.md`
  - `mockup-manifest.mjs` ← `docs/ward-flow/mockups/**`
  - `screen-verification.mjs` ← `docs/ward-flow/screen-verification.json`,
    `docs/ward-flow/SCREEN-VERIFICATION.md`, `scripts/ward-flow/screen-pairs.mjs`,
    `docs/ward-flow/mockups/MANIFEST.json`
- **Lines 61–85: local-`main` fold guard.** If the current branch is `main`/`master` and any staged
  file matches the Ward Flow path set (`src/components/ward-management/`,
  `src/app/mockups/ward-flow/`, `docs/ward-flow/`, `scripts/ward-flow/`,
  `scripts/run-ward-tests.mjs`, `tests/(helpers/|ui-)?ward-*`), the commit is blocked unless
  `CONFIRM_WARD_FLOW_FOLD_TO_MAIN=I_CONFIRM_FOLD_TO_MAIN` is set. This is the commit-time twin of
  `guard-push.mjs`'s Guard 0 at push time.
- **`SKIP_DOCS_SYNC_HOOK=1`** (line 6) skips the entire hook, generated-index checks included.

## `docs/ward-flow/journey/*.mjs` — the journey-explorer build chain

19 tracked `.mjs` files, one HTML output (`ward-journey-explorer.html`) plus a BPMN file and two
generated markdown reports. `npm run ward:journey` runs the 7-step chain below in order via
`build.mjs`, stopping at the first refusal; `npm run ward:journey:prove` runs the 7 `prove-*.mjs`
probes instead, each of which deliberately breaks an input, asserts the real build refuses and
names the offender, then restores the input. `docs/ward-flow/journey/probe-io.mjs` (84 lines) is
the shared, hardened restore helper every probe uses (`guardClean`/`restore`/`writeStubbornly`),
written after a transient Windows file-lock (`errno -4094`) intermittently made a probe's own
`finally`-block restore fail silently, letting one probe's deliberately-broken file become the next
probe's adopted baseline — which once silently reverted a day of real edits to `rebuild-map.mjs`.

**The 7-step chain (`build.mjs`, 82 lines):**

1. **`extract-vocab.mjs`** (68 lines) — Reads every event/action name straight out of
   `src/components/ward-management/{ward-model,ward-change-reasons,ward-admissions,
ward-bed-availability,ward-patients,ward-eligibility}.ts` and writes `vocabularies.json`.
2. **`rebuild-map.mjs`** (1,320 lines — the largest file in this group) — Lays out the route map
   from a declarative node/edge spec (paths are computed, not hand-drawn, so anchoring holds by
   construction) and writes `stages.json`.
3. **`build-explorer.mjs`** (491 lines) — Builds `ward-journey-explorer.html`. Refuses to produce a
   page unless every engine action is accounted for as either a drawn transition or an explicit
   "changes no state" entry — an unmapped action is a build failure, not a silent gap. Stamps its
   own provenance (commit + clean/dirty tree state) into the page.
4. **`build-bpmn.mjs`** (230 lines) — Emits the same pathway as a BPMN 2.0 XML file (opens in
   Camunda Modeler or bpmn.io), at PATHWAY level (sequence, decisions, interruptions) rather than
   all 71 individual actions.
5. **`make-inventory.mjs`** (46 lines) — Writes `MAP-INVENTORY.md`: a flat-text listing of every
   box, action and state machine the map currently claims, for a reviewer to diff against source
   without parsing three JSON files.
6. **`refusal-coverage.mjs`** (308 lines) — Reads a Vitest `lcov.info` coverage report (not
   `coverage-final.json`, which this repo's config never emits) and reports which of the reducer's
   313 refusal lines no test ever executed. Writes nothing and says so if no coverage report
   exists — never falls back to a guess, because a wrong "nothing tests this" on a clinical map
   sends someone to fix a safeguard that is fine.
7. **`what-changed.mjs`** (187 lines) — Compares the current map against a committed
   `map-snapshot.json` and writes `WHAT-CHANGED.md` plus the refreshed snapshot, so a box
   appearing/disappearing shows up as prose, not just as an unread diff of a thousand-line JSON
   file.

**Other tooling in this folder (not in the 7-step chain):**

- **`audit-crossings.mjs`** (39 lines) and **`audit-map.mjs`** (96 lines) — Standalone diagnostics,
  not called by `build.mjs`, any `prove-*` probe, or any npm script. The first finds map lines that
  visually cross behind a box (reading corner data from `stages.json`, never parsing the drawn SVG
  path); the second reads the explorer template's own `LANE_COLOUR`/filter definitions straight out
  of its HTML — never a second copy kept in the checker — so it cannot drift from the page it is
  checking.
- **`serve.mjs`** (34 lines) — Static HTTP server for this folder (default port 60413, overridable
  via `PORT` — a fixed port would silently serve a stale copy from a different worktree on the same
  port).
- **`probe-io.mjs`** (84 lines) — Shared safe-restore helper for the probes (see above).
- **`prove-overlap.mjs`** (31), **`prove-check.mjs`** (67), **`prove-legend.mjs`** (98),
  **`prove-data.mjs`** (41), **`prove-inventory.mjs`** (46), **`prove-coverage.mjs`** (130),
  **`prove-screen.mjs`** (59) — The 7 probes run by `--prove`, one per generator-side invariant
  (no overlapping boxes, coverage check can fail, every colour/lane is named in the legend, a
  missing data marker is caught rather than shipping a blank page, a misread field is caught rather
  than printing "[object Object]", the coverage measure refuses bad inputs from three different
  failure shapes, an action nothing can trigger is caught by name).

## `docs/ward-flow/mockups/third-edition-kit/` scripts

Manual/dev harness for checking the 16 third-edition drawings against the design standard; none of
these are npm-wired or part of the automated fold gates.

- **`check.mjs`** (248 lines) — `node check.mjs <file.html> <fontcss:platinum|premium>`: the base
  Playwright harness (fonts, weights, page errors, overflow at four viewports/two themes).
- **`check-standard.mjs`** (285 lines) — Adapted from `check.mjs` for the full design standard:
  adds the type floor, a full-page contrast sweep, reconciliation-line checks, masthead figures,
  rail tap targets, demo-height/containment checks, and the appearance control's first-click
  behaviour from a dark machine.
- **`check-shell.mjs`** (250 lines) — Drives shell _behaviours_ a screenshot cannot show: Escape
  clearing the service filter, a search pick widening scope with a way back, a drawer being an
  inert-surroundings dialog with wrapping Tab focus, an unbuilt-screen press opening the live tally,
  the prototype mark's visibility at every width, and the Activity line reading "snapshot".
- **`recompute-contrast.mjs`** (143 lines) — `node recompute-contrast.mjs [file] [--write]`. Reads a
  page's own light/dark `<style>` token values, recomputes every `#contrastTable` row via WCAG
  relative luminance, and compares against `contrast-pairs.json`. Read-only unless `--write`.
- **`shell-sweep.mjs`** (793 lines) — Checks that all 16 `*-third-edition.html` pages share one
  identical shell (stylesheet, skip link, rail, header bar and related chrome).
- **`shots.mjs`** (63 lines) — `node merged/shots.mjs <file.html> <outprefix> <fontcss>`: takes
  reference screenshots.
- **`run-all-checks.sh`** (26 lines) — Serial harness: `bash <scratchpad>/run-all-checks.sh
<output file>` runs `check.mjs` (or equivalent) over all 16 pages one after another, in the same
  output shape as `check-output.txt`.
- **`shell/build-preview.mjs`** (72 lines) — Builds `shell/preview.html` by splicing a mockup's own
  `<style>` block with `shell.css`, `shell-markup.html` (a Command-body stub), the preview engine
  stub and `shell-script.js`.
- **`shell/check-preview.mjs`** (314 lines) — `check.mjs`'s gate set adapted for `preview.html`
  specifically (5 widths, the appearance probe opening from the Tools drawer instead).
- **`shell/shots-preview.mjs`** (118 lines) — Screenshots `shell/preview.html` across both themes,
  four sizes, and every shell state.
- **`shell/preview-stub.js`** (385 lines) — Not a script: the preview's stand-in for the real
  Command engine, exposing `window.WardFlow` with a small invented dataset in the engine's own
  shapes, so `shell-script.js` can run against it unmodified.
- **`shell/shell-script.js`** (2,373 lines — the largest single file anywhere in this area) — Not a
  check: the actual shell script (helpers, service scope, tasks, figures/reconcile, per-page
  tallies, sort/filter, universal search, activity, tools, service switch) lifted from the owner's
  rail artifact. This is production-shape UI logic living inside a docs/mockups folder, not
  `src/` — see Pitfalls.

## `docs/ward-flow/organisation/registry.json`

924 lines. The registry `scripts/ward-flow/organisation.mjs`/`organisation-core.mjs` classify every
file in the repository against (`schemaVersion: 1`, `product: "ward-flow"`). Top-level shape:

- **`roots`** — ~50 glob roots that are IN scope for classification at all (every Ward Flow source
  tree, plus the shared build/test/lint config files and a short list of shared UI/theme files
  Ward Flow depends on but does not own, e.g. `src/app/layout.tsx`, `src/components/ui/sheet.tsx`).
- **`sourceClasses`** — three classes by extension: `code` (`.ts .tsx .js .mjs .mts .css .py .sh
.html`), `documentation` (`.md .txt`), `structured-reference` (`.json .yaml .yml`).
- **`denials`** — globs excluded outright regardless of root match, including
  `docs/ward-flow/lessons/**` (the working lesson store, deliberately not organisation-tracked)
  and `**/*.tsv`/`**/*.jsonl`.
- **`rules`** — 88 `id`-keyed entries (each with `pattern`, `priority`, `owner`, `system`, `module`,
  `reference`, `reviewedBy`), the bulk of the file. Names the **six systems** the top of this doc's
  scope note repeats — `behaviour`, `data-content`, `documentation-knowledge`, `issue-health`,
  `safety-governance`, `change-recovery` — plus a handful of cross-cutting `owner` values seen
  across the rules: `ward-flow`, `Ward Lead`, `design-reference`, `shared`, `mixed`, `excluded`. A
  representative slice of `module` values: `ward-flow`, `engine`, `model`, `access`, `reference`,
  `design`, `documentation`, `handover`, `host-boundary`, `planning`, `privacy`, `tooling`,
  `verification`. The tail of the file carries explicit `existing-metadata-*` entries for
  historical/rescued artefacts (e.g. `docs/ward-flow/sdd-rescued/**`) with their own
  not-current-implementation reasoning, rather than leaving them to fall through to a default.

## Generated files and their generators

| Generated doc                                                          | Generator                                        | Check command                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/reference/ward-reference-registry.ts`  | `build-reference-registry.mjs`                   | `npm run check:ward-reference`                                                                                                  |
| `src/components/ward-management/reference/ward-reference-distances.ts` | `build-reference-distances.mjs`                  | `npm run check:ward-reference`                                                                                                  |
| `src/components/ward-management/reference/ward-reference-teams.ts`     | `build-reference-teams.mjs`                      | (no dedicated `--check`; regenerate and diff by hand — `check-ward-reference.mjs` checks only the registry and distances files) |
| `docs/ward-flow/mockups/MANIFEST.json`                                 | `mockup-manifest.mjs`                            | `node scripts/ward-flow/mockup-manifest.mjs --check`                                                                            |
| `docs/ward-flow/OWNER-RULINGS.md`                                      | `owner-rulings-index.mjs`                        | `node scripts/ward-flow/owner-rulings-index.mjs --check`                                                                        |
| `docs/ward-flow/RULES.md`                                              | `rules-index.mjs`                                | `node scripts/ward-flow/rules-index.mjs --check`                                                                                |
| `docs/ward-flow/SCREEN-MAP.md`                                         | `screen-map.mjs`                                 | `node scripts/ward-flow/screen-map.mjs --check`                                                                                 |
| `docs/ward-flow/SCREEN-VERIFICATION.md`                                | `screen-verification.mjs`                        | `node scripts/ward-flow/screen-verification.mjs --check`                                                                        |
| `docs/ward-flow/mockups/CONTACT-SHEET.html`                            | `contact-sheet.mjs`                              | none (visual reference page, not a gate)                                                                                        |
| `docs/ward-flow/lessons/*.md` (repo mirror of the lesson store)        | `sync-lessons.mjs`                               | `node scripts/ward-flow/sync-lessons.mjs --check`                                                                               |
| `docs/ward-flow/LESSON-AUDIT-REPORT.md`                                | `audit-lessons.mjs`                              | `node scripts/ward-flow/audit-lessons.mjs --check`                                                                              |
| `docs/ward-flow/journey/ward-journey-explorer.html`                    | `build-explorer.mjs` (via `ward:journey`)        | `npm run ward:journey` (build refuses rather than emitting a wrong page)                                                        |
| `docs/ward-flow/journey/ward-journey.bpmn`                             | `build-bpmn.mjs` (via `ward:journey`)            | part of `npm run ward:journey`                                                                                                  |
| `docs/ward-flow/journey/MAP-INVENTORY.md`                              | `make-inventory.mjs` (via `ward:journey`)        | part of `npm run ward:journey`                                                                                                  |
| `docs/ward-flow/journey/WHAT-CHANGED.md` + `map-snapshot.json`         | `what-changed.mjs` (via `ward:journey`)          | part of `npm run ward:journey`                                                                                                  |
| `docs/ward-flow/journey/refusal-coverage.json`                         | `refusal-coverage.mjs` (via `ward:journey`)      | part of `npm run ward:journey`; silently writes nothing if no lcov report exists                                                |
| `docs/ward-flow/audit-artefacts/stabilisation-suite-report.json`       | `scripts/ward-flow/audit/measure-ward-suite.mjs` | none — explicitly not a fold gate, a restored aside                                                                             |
| `text-size-floor-baseline.json` count                                  | `check-text-size-floor.mjs --update-baseline`    | `npm run check:ward-text-size` (ratchet, not regenerate-and-diff)                                                               |

## Fold gates in order

Compiled from `docs/ward-flow/code-map/README.md` and `.githooks/pre-commit`; run the narrower
generator `--check`s only when their own source changed.

1. **Every commit** (automatic, `.githooks/pre-commit`): the five generated-index `--check`s
   (`screen-map`, `rules-index`, `owner-rulings-index`, `mockup-manifest`, `screen-verification`),
   each fired only if its declared source is staged; and the local-`main` Ward Flow fold guard.
2. **Every push** (automatic, `scripts/guard-push.mjs` Guard 0): blocks any push of Ward Flow
   files or from a Ward Flow branch to `origin/main` or any other remote branch, without an
   explicit `CONFIRM_WARD_FLOW_*` override.
3. **Before declaring a task done** (manual, run yourself):
   - `node scripts/check-ward-expected-reds.mjs` — full offline ward suite; required for any
     engine change.
   - `npm run test:e2e:ward-journeys` — the 13 browser journeys, `chromium-mockups` project.
   - `npm run check:ward-doc-links` — Ward doc links resolve.
   - `npm run ward:organise:check -- --source working-tree`.
   - Each generator's own `--check` when its sources changed: `screen-map`, `mockup-manifest`,
     `owner-rulings-index`, `screen-verification`, `rules-index` (pre-commit already runs these
     narrowly; re-running by hand after a batch of edits catches anything staged in a way the
     pattern match missed).
   - Any of the other targeted gates whose surface you touched:
     `npm run check:ward-reference`, `npm run check:ward-legal-language`,
     `npm run check:ward-text-size`, `npm run check:ward-source-control-chars`,
     `npm run check:ward-errata-freshness`, `npm run check:ward-citations`,
     `npm run ward:governance:check`, `node scripts/check-ward-data.mjs` (data-file edits),
     `node scripts/ward-flow/check-drawing-rules.mjs <drawing.html>` (drawing edits),
     `npm run ward:test:sync:check` (design/test alignment).
4. **Integrate**, following repository [`AGENTS.md`](../../../AGENTS.md) and [`HOW-WE-WORK.md`](../HOW-WE-WORK.md):
   verify the remote is `BigSimmo/Ward-Flow`, run the selected checks for the candidate tree, and
   integrate via reviewed task branch. (The former local-only ward line and `ward-lead` fold procedure
   belonged to the pre-separation arrangement and are historical.)

## Pitfalls in this area

1. **Two different, similarly-named doc-link checkers.** `scripts/check-docs-links.mjs`
   (`npm run docs:check-links`, repo-wide) and `scripts/ward-flow/check-doc-links.mjs`
   (`npm run check:ward-doc-links`, Ward-only) are separate files with separate scope. Running the
   wrong one gives a false sense that Ward Flow's links were checked, or floods you with unrelated
   repo-wide link findings.
2. **Most `scripts/ward-flow/` files are not npm-wired.** `chat-control.mjs`, `whois.mjs`,
   `folded.sh`, `role-map.py`, `check-drawing-rules.mjs`, `check-live-state.mjs`, every "manual
   visual audit" script, and everything in `audit/` are run directly with `node`/`python`/`bash`.
   Grepping `package.json` for a script name before assuming it is wired will save a wasted search.
3. **The generated indexes are self-checking but their `--check` only fires when their OWN source
   is staged** (`.githooks/pre-commit`). A commit that edits `screen-pairs.mjs` in a way that
   changes `SCREEN-MAP.md`'s content but is caught by the `screen-map.mjs` pattern is fine; an edit
   to a file the pattern does not list will not trigger a re-check even if it should have.
4. **Several visual-audit scripts hardcode `http://localhost:3605`** instead of using
   `stableProjectPort`/`WARD_FLOW_URL` (only `audit-all-screens-visual.mjs`,
   `audit-out-of-area-elevation.mjs` via `BASE_URL`, and the `scripts/audit-*-200.mjs` pair via
   `WARD_FLOW_URL` do). Running one of the hardcoded scripts against a dev server on a different
   port will silently connect to nothing or to a different project.
5. **`scripts/audit-officer-200.mjs` and `scripts/audit-third-edition-200.mjs` write their
   artefacts outside this repository**, to `C:\Users\joshs\.gemini\antigravity\brain\<uuid>` — a
   different AI tool's local data directory on this specific machine. They will not work, and
   should not be trusted to work, on any other machine or worktree.
6. **`scripts/ward-flow/organisation.mjs`'s report is not a tracked file.** `ward:organise` writes
   into `<gitdir>/ward-organisation`, not anywhere under `docs/`. Looking for its output under
   `docs/ward-flow/` will not find it; use `--show-report`.
7. **The `screen-verification.mjs` `--check` gate cannot tell you a screen is wrong or stale on
   purpose.** It only fails on structural JSON problems. Reading a clean `--check` as "every screen
   matches its drawing" is exactly the WF-35 misreading `screen-verification-lib.mjs` was written
   to stop; read the generated `SCREEN-VERIFICATION.md` itself for per-screen status.
8. **The journey-explorer probes (`prove-*.mjs`) mutate real source files in this folder and
   restore them.** They are hardened against a known Windows transient-lock failure
   (`probe-io.mjs`), but running two of them concurrently, or interrupting one mid-run, is exactly
   the scenario that already once silently reverted a day of edits to `rebuild-map.mjs`. Never run
   `npm run ward:journey:prove` alongside another edit to this folder.
9. **`docs/ward-flow/mockups/third-edition-kit/shell/shell-script.js` (2,373 lines) is real,
   load-bearing UI logic, not a check** — it is the actual third-edition shell script, lifted into
   a docs/mockups folder for preview purposes. A future editor scanning "scripts under docs/" for
   throwaway tooling could easily skip past the one file in this whole area that is production-shape
   application code.
10. **`count-ward-population.mjs` duplicates the same "which files count as the ward suite" walk
    three times** (itself, `measure-ward-suite.mjs`, and independently again inside
    `scripts/check-ward-expected-reds.mjs`). If the population definition ever needs to change, all
    three copies must move together or the audit-folder count and the real gate's count will
    silently diverge.

## Not checked

No script listed above was executed, and no npm script was run. Every file/write/flag claim comes
from reading the file's own source (header comments, `process.argv`/flag parsing, and
`writeFileSync`/`fs.write*` call sites) or from `grep`/`wc -l`/`git ls-files` output captured in
this session — not from running the tooling. The exact end line of the ward self-test block in
`scripts/guard-push.mjs` (given as "~1780") was not pinned to the single closing line; the block
runs from line 1726 to somewhere before the next unrelated assertion group, confirmed only to
roughly that point. Whether every `check:ward-*` npm script currently passes on this tree was not
verified — this document describes what each script does and reads/writes, not its current exit
code. The `docs/ward-flow/journey/refusal-coverage.mjs` output path was confirmed as
`docs/ward-flow/journey/refusal-coverage.json` by reading its `OUT` constant directly (line 46) and
is quoted correctly in the table above, not inferred.
