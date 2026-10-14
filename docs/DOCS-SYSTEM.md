# Documentation system

How Documentation keeps Ward Flow docs accurate on this tip. **Process doc - no product DDL.**

_Updated 2026-10-14 - generated-files inventory, 7-gate documentation verification pipeline, and archival standard; Documentation owns._

## Principles

1. **One live source per topic** - archive or stub duplicates.
2. **Stamp what you touch** - `_Updated YYYY-MM-DD - <why>; Documentation owns._`
3. **Names only for secrets** - never paste values, JWTs, or dashboard passwords.
4. **One task identity** - follow `docs/task-receipts.md` and reuse existing ledger/checkpoint IDs. `docs/ward-flow/STATUS.md` preserves dated history; current task state needs current source and acceptance evidence. Do not create another status store.
5. **One map improvement per pass** when cheap.
6. **Ward Flow repository lock** - confirm `git remote get-url origin` is `https://github.com/BigSimmo/Ward-Flow.git` before editing. Use a separate worktree based on this repository's `main`; confirm the branch and tip before acting. `D:\Worktrees\Database\ward-lead` and `BigSimmo/Database` are legacy sources, not Ward Flow destinations.
7. **Recheck triggers** - relevant source, boot command or entry path changes refresh affected maintained guidance; operator changes restamp runbooks. Update the existing task receipt at meaningful lifecycle events; preserve dated status evidence.

## Pipeline

Scope -> Verify repository and branch -> Read tip -> Edit (class-aware) -> Stamp + commit (docs only) -> One map improvement

Stage **docs paths only** - never mix unrelated product WIP. A push or pull request requires the user's authorisation and a verified `BigSimmo/Ward-Flow` destination.

## Ward Flow live set

| Doc                                                            | Role                                |
| -------------------------------------------------------------- | ----------------------------------- |
| [`ward-flow/README.md`](ward-flow/README.md)                   | Product and design entry point      |
| [`ward-flow/LOCAL-FIRST-RUN.md`](ward-flow/LOCAL-FIRST-RUN.md) | UI boot                             |
| [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md)       | Live vs archive map                 |
| [`task-receipts.md`](task-receipts.md)                         | Current task/evidence handoff       |
| [`ward-flow/STATUS.md`](ward-flow/STATUS.md)                   | Historical status and owner context |
| [`ward-flow/HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md)         | Builder workflow handbook           |
| [`ward-flow-task-ledger.md`](ward-flow-task-ledger.md)         | Task ledger                         |

## Generated documentation & manifests

Never hand-edit generated files. Run `npm run docs:maintain` (`node scripts/ward-flow/maintain-docs-and-organisation.mjs --write`) to regenerate all derived Ward Flow and repository indexes, recompute `pack_manifest.json` digests, and run every documentation and organisation gate in one pass (`npm run docs:maintain:check` runs the read-only verification pass, and `npm run ward:classify -- <path>` classifies any existing or proposed file path against `docs/ward-flow/organisation/registry.json`):

| Generated file                                                                        | Write / refresh command                                  | Check command                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| [`site-map.md`](site-map.md)                                                          | `npx tsx scripts/generate-site-map.ts --write`           | `npm run sitemap:check`                                  |
| [`scripts-index.md`](scripts-index.md)                                                | `node scripts/generate-scripts-index.mjs --write`        | `npm run docs:check-inventory`                           |
| [`ward-flow/SCREEN-MAP.md`](ward-flow/SCREEN-MAP.md)                                  | `node scripts/ward-flow/screen-map.mjs --write`          | `node scripts/ward-flow/screen-map.mjs --check`          |
| [`ward-flow/SCREEN-VERIFICATION.md`](ward-flow/SCREEN-VERIFICATION.md)                | `node scripts/ward-flow/screen-verification.mjs --write` | `node scripts/ward-flow/screen-verification.mjs --check` |
| [`ward-flow/mockups/MANIFEST.json`](ward-flow/mockups/MANIFEST.json)                  | `node scripts/ward-flow/mockup-manifest.mjs --write`     | `node scripts/ward-flow/mockup-manifest.mjs --check`     |
| [`ward-flow/OWNER-RULINGS.md`](ward-flow/OWNER-RULINGS.md)                            | `node scripts/ward-flow/owner-rulings-index.mjs --write` | `node scripts/ward-flow/owner-rulings-index.mjs --check` |
| [`ward-flow/RULES.md`](ward-flow/RULES.md)                                            | `node scripts/ward-flow/rules-index.mjs --write`         | `node scripts/ward-flow/rules-index.mjs --check`         |
| `ward-flow/ORGANISATION.md` ([`registry.json`](ward-flow/organisation/registry.json)) | `node scripts/ward-flow/organisation.mjs --write`        | `npm run ward:organise:check`                            |

## 7-Gate documentation verification pipeline

1. **Maintained script references (`npm run docs:check-scripts`):** executes `node scripts/check-docs-script-refs.mjs` across `MAINTAINED_ROOT_DOCS`, `docs/`, and `.github/` outside paired historical markers to verify every `npm run <script>` exists in `package.json`.
2. **Maintained local links & anchors (`npm run docs:check-links`):** executes `node scripts/check-maintained-doc-links.mjs` across all Git-tracked Markdown files (and `MAINTAINED_ROOT_DOCS`) outside historical markers.
3. **Architecture & codebase index (`npm run docs:check-index`):** executes `node scripts/check-codebase-index.mjs` to verify `docs/codebase-index.md` matches current `src/` directories.
4. **Scripts & command inventory (`npm run docs:check-inventory`):** executes `node scripts/generate-scripts-index.mjs --check` to verify `docs/scripts-index.md` matches `scripts/` and `package.json`.
5. **Ward Flow relative doc links (`npm run check:ward-doc-links`):** executes `node scripts/ward-flow/check-doc-links.mjs` across `docs/ward-flow/` (including archived files).
6. **Staged / stale generator drift (`node scripts/check-stale-docs.mjs` & `node scripts/check-staged-docs.mjs`):** verifies in `.githooks/pre-commit` and CI that generated Ward Flow indexes and manifests match their inputs without mutating the working tree.
7. **Ward organisation registry (`npm run ward:organise:check`):** executes `node scripts/ward-flow/organisation.mjs --check` against [`ward-flow/organisation/registry.json`](ward-flow/organisation/registry.json) to validate canonical source paths, hashes, and ownership classifications.

## Archival & historical fencing standard

When retiring or superseding a document (or preserving inherited PsychSift material):

1. Place a top-of-file `> **SUPERSEDED ...**` or `> **Historical ...**` callout banner naming the current live replacement.
2. Wrap historical body sections that reference retired `npm run` scripts or removed PsychSift paths in paired HTML comments (`docs-script-refs:historical-start` and `docs-script-refs:historical-end`, each on its own comment line).
   Paired markers exclude historical command and path references from `docs:check-scripts` and `docs:check-links`; a prose banner alone does not exclude text.
3. Move dated Ward Flow records under [`ward-flow/archive/`](ward-flow/archive/) (indexed in [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md)).

Use the existing [`ward-flow/organisation/registry.json`](ward-flow/organisation/registry.json)
`canonicalSources` for reviewed canonical references and this index for navigation. Add metadata
only through a reviewed, tested schema change; do not create another manifest or task ledger.

**Boot:** `npm run ensure` - trust the printed URL; never hardcode ports.

## Repository boundary

Ward Flow is in `BigSimmo/Ward-Flow`. `BigSimmo/Database` is the separate PsychSift repository. Historical documents may mention the former shared checkout; treat those paths as history and use the verified Ward Flow checkout for current work.

## Related

- Agent skills: **Documentation Operating System**, **Docs Freshness Audit**.
- Weekday freshness sweep routine (Documentation bot).
