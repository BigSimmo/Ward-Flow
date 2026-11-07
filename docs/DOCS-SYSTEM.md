# Documentation system

How Documentation keeps Ward Flow docs accurate on this tip. **Process doc - no product DDL.**

_Updated 2026-11-08 - documentation audit fixes: one home per kind of truth, history folder, status page limit, one date line per page; Documentation owns._

## Principles

1. **One live source per topic** - archive or stub duplicates. Facts that change with the code live only in [`FACTS.md`](FACTS.md); see [Facts and retired terms](#facts-and-retired-terms).
2. **One date line per page** - keep a single `_Updated YYYY-MM-DD - <why>; Documentation owns._` line near the top and replace it when you edit; do not stack a new line per edit, because Git already records each change. Living pages also carry the `last-checked` marker (pipeline step 7).
3. **Names only for secrets** - never paste values, JWTs, or dashboard passwords.
4. **One home per kind of truth** (Josh, 7 November 2026). Do not create another status store.

   | Question              | The one home                                                                  |
   | --------------------- | ----------------------------------------------------------------------------- |
   | Where are we now?     | The **Now** section of [`ward-flow/STATUS.md`](ward-flow/STATUS.md)           |
   | What is the plan?     | [`ward-flow/roadmap.md`](ward-flow/roadmap.md)                                |
   | What is in flight?    | Open pull requests, summarised in the Now section                             |
   | What did Josh decide? | [`ward-flow/decisions.md`](ward-flow/decisions.md); no new `owner-*.md` files |
   | How do we work?       | [`AGENTS.md`](../AGENTS.md) and the topic files it links                      |
   | What happened before? | [`history/`](history/README.md) and [`ARCHIVE.md`](ARCHIVE.md)                |

   Notion is optional ([task receipts](task-receipts.md)).

5. **One map improvement per pass** when cheap.
6. **Ward Flow repository lock** - confirm `git remote get-url origin` is `https://github.com/BigSimmo/Ward-Flow.git` before editing. Use a separate worktree based on this repository's `main`; confirm the branch and tip before acting. `D:\Worktrees\Database\ward-lead` and `BigSimmo/Database` are legacy sources, not Ward Flow destinations.
7. **Recheck triggers** - relevant source, boot command or entry path changes refresh affected maintained guidance; operator changes restamp runbooks. Update the existing task receipt at meaningful lifecycle events; preserve dated status evidence.
8. **Say the evidence limit once.** A document records what was checked; only source, tests and observed runs prove behaviour. State a page's evidence boundary once, near the top, rather than repeating "does not establish" or "is not proof" in every paragraph.

## Pipeline

Scope -> Verify repository and branch -> Read tip -> Edit (class-aware) -> Stamp + commit (docs only) -> One map improvement

Stage **docs paths only** - never mix unrelated product WIP. A push or pull request requires the user's authorisation and a verified `BigSimmo/Ward-Flow` destination.

## Ward Flow live set

| Doc                                                            | Role                                       |
| -------------------------------------------------------------- | ------------------------------------------ |
| [`ward-flow/STATUS.md`](ward-flow/STATUS.md)                   | Where things stand now (re-checked weekly) |
| [`ward-flow/roadmap.md`](ward-flow/roadmap.md)                 | The plan                                   |
| [`ward-flow/decisions.md`](ward-flow/decisions.md)             | Every decision                             |
| [`ward-flow/README.md`](ward-flow/README.md)                   | Product and design entry point             |
| [`ward-flow/LOCAL-FIRST-RUN.md`](ward-flow/LOCAL-FIRST-RUN.md) | UI boot                                    |
| [`ward-flow/HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md)         | Builder workflow handbook                  |
| [`task-receipts.md`](task-receipts.md)                         | Task and evidence handoff                  |
| [`ARCHIVE.md`](ARCHIVE.md)                                     | The one archive index, and how to restore  |

[`ward-flow-task-ledger.md`](ward-flow-task-ledger.md) keeps dated task detail and evidence; it is not the list of current work.

## Generated documentation & manifests

Never hand-edit generated files. In `scripts-index.md`, only the headline counts are generated;
the descriptions and command map are curated and editable. Run `npm run docs:maintain` (`node scripts/ward-flow/maintain-docs-and-organisation.mjs --write`) to regenerate the derived outputs listed below, recompute `pack_manifest.json` digests, and run the declared documentation and organisation checks in one pass (`npm run docs:maintain:check` runs the read-only verification pass, and `node scripts/ward-flow/maintain-docs-and-organisation.mjs --classify <path>` classifies any existing or proposed file path against `docs/ward-flow/organisation/registry.json`):

| Generated file                                                                                          | Write / refresh command                                                                                  | Check command                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Journey reader outputs](ward-flow/journey/README.md)                                                   | `node docs/ward-flow/journey/verify.mjs --write`                                                         | `node docs/ward-flow/journey/verify.mjs --check`                        |
| [Printable Help guides](../public/help/coordinator.md)                                                  | `node scripts/build-help-cheat-sheets.mjs --output public/help`                                          | `node scripts/build-help-cheat-sheets.mjs --output public/help --check` |
| [`site-map.md`](site-map.md)                                                                            | `npm run sitemap:update` (or `npm run docs:update`, which also refreshes the script counts)              | `npm run sitemap:check`                                                 |
| [`scripts-index.md`](scripts-index.md)                                                                  | `node scripts/update-docs-inventory.mjs`                                                                 | `npm run docs:check-inventory`                                          |
| [`ward-flow/SCREEN-MAP.md`](ward-flow/SCREEN-MAP.md)                                                    | `node scripts/ward-flow/screen-map.mjs --write`                                                          | `node scripts/ward-flow/screen-map.mjs --check`                         |
| [`ward-flow/SCREEN-VERIFICATION.md`](ward-flow/SCREEN-VERIFICATION.md)                                  | `node scripts/ward-flow/screen-verification.mjs --write`                                                 | `node scripts/ward-flow/screen-verification.mjs --check`                |
| [`design/third-edition-mockups/MANIFEST.json`](../design/third-edition-mockups/MANIFEST.json)           | `node scripts/ward-flow/mockup-manifest.mjs --write`                                                     | `node scripts/ward-flow/mockup-manifest.mjs --check`                    |
| [`ward-flow/OWNER-RULINGS.md`](ward-flow/OWNER-RULINGS.md)                                              | `node scripts/ward-flow/owner-rulings-index.mjs --write`                                                 | `node scripts/ward-flow/owner-rulings-index.mjs --check`                |
| [`ward-flow/RULES.md`](ward-flow/RULES.md)                                                              | `node scripts/ward-flow/rules-index.mjs --write`                                                         | `node scripts/ward-flow/rules-index.mjs --check`                        |
| `<git-dir>/ward-organisation/ORGANISATION.md` ([`registry.json`](ward-flow/organisation/registry.json)) | `npm run ward:organise` (`node scripts/ward-flow/organisation.mjs --write-report --source working-tree`) | `npm run ward:organise:check`                                           |

## Documentation verification pipeline

1. **Maintained script references (`npm run docs:check-scripts`):** executes `node scripts/check-docs-script-refs.mjs` across `MAINTAINED_ROOT_DOCS`, `docs/`, and `.github/` outside paired historical markers to verify every `npm run <script>` exists in `package.json`.
2. **Maintained local links & anchors (`npm run docs:check-links`):** executes `node scripts/check-maintained-doc-links.mjs` across all Git-tracked Markdown files (and `MAINTAINED_ROOT_DOCS`) outside historical markers.
3. **Architecture & codebase index (`npm run docs:check-index`):** executes `node scripts/check-codebase-index-coverage.mjs` to verify maintained index sections mention the required current source roots. This is directory coverage, not proof that architectural prose is true.
4. **Scripts & command inventory (`npm run docs:check-inventory`):** executes `node scripts/update-docs-inventory.mjs --check` to compare the exact tracked-script and package-command counts in `docs/scripts-index.md`. The rest of that catalogue is curated; count equality does not establish catalogue completeness or semantic freshness.
5. **Ward Flow relative doc links, including history:** run `node scripts/ward-flow/check-doc-links.mjs` directly (no `--file`) to check `docs/ward-flow/` with archived sections. `npm run docs:check-links` excludes marked history sections.
6. **Staged checks, committed-tree checks and advisory freshness:** `.githooks/pre-commit` runs `node scripts/check-staged-docs.mjs` against an index snapshot without mutating working files. Selected Ward indexes (`--ward-indexes`) block on failure; general site-map, inventory and codebase-index checks remain advisory unless `PRECOMMIT_DOCS_SYNC_STRICT=1`. The local CI definition also checks the committed screen map, drawing manifest, screen-verification index, exact script counts and architecture directory coverage directly, including documentation-only scope. The site-map check runs after dependencies install; changes to its route, generator and root output inputs select that installation. Owner-rulings, rules and organisation retain their independent scope selection. This describes workflow wiring, not an observed hosted result. Separately, `node scripts/check-stale-docs.mjs` reports old, unreferenced documents; it is advisory, needs full Git history (it refuses on a shallow clone rather than report a false picture) and does not detect generated-file drift. Run it by hand for a periodic clean-up; the living-page reminder in step 7 is what runs automatically.
7. **Living-docs freshness (`npm run docs:freshness`):** pages that describe the app as it is now (entry READMEs, STATUS, demo script, operations runbook, staff release notes, DATABASE, local first run and every desk guide; the list is in `scripts/check-living-docs-freshness.mjs`) carry an invisible `<!-- last-checked: YYYY-MM-DD -->` marker near the top. The check warns when a marker is missing or older than the page's limit: 7 days for `STATUS.md`, 14 days for the rest (`PAGE_DAYS` in the script). It works on shallow clones. It runs inside `docs:maintain:check`, as a GitHub warning on every pull request (`--annotate`), and weekly in `.github/workflows/docs-freshness.yml`, which opens or updates one `docs-stale` issue that emails Josh and closes it when every page is fresh. It is advisory; `--strict` makes it fail. Update the date only after checking the page against the current app.
8. **Ward organisation registry (`npm run ward:organise:check`):** executes `node scripts/ward-flow/organisation.mjs --check` against [`ward-flow/organisation/registry.json`](ward-flow/organisation/registry.json) to validate canonical source paths, hashes, and ownership classifications.
9. **Facts and retired terms (`npm run docs:facts`):** executes `node scripts/doc-facts.mjs` to verify [`FACTS.md`](FACTS.md) and every fact marker match the source, and to warn on retired terms (failing only on lines a pull request adds). See [Facts and retired terms](#facts-and-retired-terms).

## Facts and retired terms

Docs go stale when they restate something the code decides. Two mechanisms stop that without
anyone remembering to update docs:

- **Generated facts.** `scripts/doc-facts.mjs` reads a few changeable facts from source (database
  and sign-in provider, latest migration, route counts, latest and next decision number, Node range,
  backend environment variables) and writes them to [`FACTS.md`](FACTS.md). Quote a fact in any
  Markdown file as `<!-- fact:database-provider -->Supabase<!-- /fact -->`. `npm run docs:facts:write`
  (also part of `npm run docs:maintain`) rewrites live markers; CI fails while a marker or
  `FACTS.md` disagrees with the source, so a code change that moves a fact cannot merge with old
  docs. To add a fact, add an extractor to `collectFacts` in `scripts/doc-facts.mjs` and a test.
- **Retired terms.** [`retired-terms.json`](retired-terms.json) lists words for things Ward Flow no
  longer uses, with why and what to say instead. Existing mentions in maintained docs show as CI
  warnings (a to-do list, never a block). A pull request that adds a new mention fails, so the
  backlog only shrinks. A line that itself says the thing is retired, removed or replaced passes.
  Archives, dated records and append-only logs are never scanned; fence a
  deliberate historical mention elsewhere with the paired markers below.

When a decision retires something, add its term to `retired-terms.json` in the same pull request.

## Evidence and semantic maintenance

Live fact markers do not belong in historical evidence. Fixed-revision verification lines and paired
`docs-script-refs:historical-start/end` or `docs-facts:frozen-start/end` sections reject live markers;
write mode leaves the entire offending file byte-identical and reports the error. Nested fences
are tracked independently; unmatched or crossed fences refuse updates. Remove
the marker and retain the value established at that revision. Use frozen fences for multi-line evidence paragraphs. Put current generated facts in separate
prose. A new check gets a new dated note with its actual revision and scope.

The CI documentation lane checks the journey reader in an isolated temporary tree before dependency
installation, and checks generated Help after the locked install. Changes to `public/help/` select
these contracts too. `verify.mjs --prove` runs journey mutation proofs locally in a disposable tree;
it is separate from routine output parity. Neither structural parity nor a date stamp verifies the
truth of handwritten architectural, staff or operational instructions.

When behaviour changes, identify the affected handwritten sources in the existing task/PR record:
roles and scope, Help and walkthroughs, staff history and desk steps, API/operator/recovery contracts.
Update affected instructions and test important capability boundaries against source. Keep historical
observations separate; record live publication only after observing the target revision and content.
No automatic prose updater, publication smoke test or external documentation-bot delivery is proven
by this repository's checks.

## Maintained page conventions

For a new or substantially revised maintained page, make its audience, lifecycle status and owning role clear near the top. Identify the source revision or inputs supporting current claims, and distinguish an edit date from verified evidence. Name a replacement when the page is superseded. A compact prose header is sufficient; no new metadata registry is required.

Use lower-kebab-case for new prose filenames and ISO dates for point-in-time records. Retain recognised filenames such as `README.md`, `AGENTS.md` and `SECURITY.md`. Do not rename legacy files or retrofit frozen evidence merely for consistency. Label current guidance, generated reference, proposals and historical records explicitly, and link each topic to its existing authoritative home.

## Organisation changes and executable inputs

Improve navigation before moving files. A domain extraction, test regrouping or stylesheet split needs a concrete consumer or ownership benefit, an exact owned scope and focused acceptance evidence. It is not required merely to match a preferred folder tree. Preserve current URLs, engine behaviour, accepted appearance and protected history.

Before a source or test move, map imports, generator paths, test discovery/sharding, coverage and path-scoped guards. Account for the before/after file populations of offline, data, style and text safeguards, including intentional exceptions. During the authorised implementation, prove a synthetic forbidden specimen is still rejected at the new location; do not infer this from a passing build.

Directory labels do not establish runtime inactivity. The digest route reads an HTML reference from `design/third-edition-mockups/`; the PWA connects worker registration, an offline page, manifest, icons, screenshots and cache headers. Keep those literal file/URL contracts intact or update their consumers and focused tests together. The organisation registry validates only its declared roots; an excluded file is not automatically misplaced or unneeded.

Executable documentation under `ward-flow/journey/` has build/serve consumers even though it is outside the ordinary `src/` and `scripts/` coverage roots. Keep that distinction visible in the command map. Physical relocation requires its input/output paths and check boundary to be updated together.

Backend engine changes also affect build inputs and the reviewed watch-path contract. Use the backend's existing watch-input checker; a local pass does not establish deployed settings. Actual provider configuration, deployment and target-specific recovery rehearsals retain their separate authority and evidence requirements.

## Agent rule files and references

- A rule has one home. [`AGENTS.md`](../AGENTS.md) keeps the hard safeguards; topic rules live in [`agents/`](agents/) and the files it links. `CLAUDE.md`, `GEMINI.md` and nested adapters defer to it (`@AGENTS.md`) and never copy process rules.
- Update owned docs when evidence shows drift, and route other owners' files to them. A changed file does not prove an agent loaded it, so verify loaded instructions in a fresh session.
- For Next.js, read the installed docs that `AGENTS.md` names. For other libraries, use [Context7](agents/context7.md). Keep source code, credentials and patient details out of queries.
- Apply a skill only when it is installed and relevant, and read it first. A historical skill name grants nothing. Ward tasks live in the [task ledger](ward-flow-task-ledger.md).
- For a codebase appraisal export, stage it outside the repository, include `EXPORT_MANIFEST.md`, exclude secrets, dependencies, build output and local state, and check the archive opens.

## Archival & historical fencing standard

When retiring or superseding a document (or preserving inherited PsychSift material):

1. Place a top-of-file `> **SUPERSEDED ...**` or `> **Historical ...**` callout banner naming the current live replacement.
2. Wrap historical body sections that reference retired `npm run` scripts or removed PsychSift paths in paired HTML comments (`docs-script-refs:historical-start` and `docs-script-refs:historical-end`, each on its own comment line).
   Paired markers exclude historical command and path references from `docs:check-scripts` and `docs:check-links`; a prose banner alone does not exclude text.
3. Move dated Ward Flow records that something still reads into [`history/`](history/README.md), and remove ones nothing cites, each with the owner's approval. List every move or removal in [`ARCHIVE.md`](ARCHIVE.md), the one archive index, with the Git tag or commit that keeps the earlier state. Search tools skip `docs/history/` through the root `.ignore` file; the checks still cover it.

Use the existing [`ward-flow/organisation/registry.json`](ward-flow/organisation/registry.json)
`canonicalSources` for reviewed canonical references and this index for navigation. Add metadata
only through a reviewed, tested schema change; do not create another manifest or task ledger.

**Boot:** `npm run ensure` - trust the printed URL; never hardcode ports.

## Repository boundary

Ward Flow is in `BigSimmo/Ward-Flow`. `BigSimmo/Database` is the separate PsychSift repository. Historical documents may mention the former shared checkout; treat those paths as history and use the verified Ward Flow checkout for current work.

## Related

The tracked `.claude/` folder holds client hook configuration only. No external documentation bot or
scheduled documentation audit runs for this repository; the automatic upkeep is the CI checks above
and the weekly living-page reminder.
