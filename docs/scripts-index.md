# Ward Flow scripts inventory

_Updated 2026-10-21 - exact generated counts and executable documentation boundary; Documentation owns._

Curated map of `scripts/` (118 files) and the `package.json` script surface (82 entries),
grouped by what each part protects. `package.json` is the command surface; this page says why
each group exists. `npm run docs:check-inventory` compares the two counts above exactly,
and `npm run docs:check-scripts` checks that every `npm run` named in maintained docs
still exists. Neither check proves the descriptions are current, so read the script before
relying on it.

The journey build and serve commands execute tools under `docs/ward-flow/journey/`. They are
maintained executable documentation, rather than ordinary Markdown or runtime modules. The
generic lint command and executable coverage inventory target the source/scripts roots; they
do not by themselves certify these documentation tools. Keep their explicit build/proof checks
and relative inputs/outputs with them, following [organisation changes](DOCS-SYSTEM.md#organisation-changes-and-executable-inputs).

On 18 October 2026 the tooling layer was cut from 163 files and 99 commands to the set below.
One-off audits, PsychSift and Database leftovers, and multi-agent coordination helpers that no
gate used were retired: worktree reports, merge-loss and final-merge audits, gate receipts and
the gate arbiter, PR branch sync, the flake ledger, mutation runs, fold-gate selectors, run slots
and the review server. Their history is in Git.

## Build, run and test

| Command                                                        | Script                                                                                  | Purpose                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`, `npm run start`                                 | `dev-free-port.mjs`, `local-server-startup.mjs`                                         | Start Next.js on a free port.                                                                                                 |
| `npm run ensure`                                               | `ensure-local-server.mjs`                                                               | Start or reuse the local server and print its verified URL.                                                                   |
| `npm run build`                                                | `run-heavy.mjs`, `guard-next-build.mjs`                                                 | Production build behind the heavy-run lock and the build guard.                                                               |
| `npm run lint`, `npm run typecheck`                            | `run-heavy.mjs`                                                                         | ESLint and TypeScript behind the heavy-run lock.                                                                              |
| `npm run test`, `npm run test:focused`, `npm run test:related` | `run-vitest.mjs`, `test-focused.mjs`, `ward-flow/related-tests.mjs`                     | Unit and DOM tests: the whole suite, a focused set, or the tests related to changed files.                                    |
| `npm run test:coverage`, `npm run check:coverage-inventory`    | `check-coverage-inventory.mjs`, `coverage-contract.mjs`                                 | Coverage run, and the check that every executable file is in the coverage inventory.                                          |
| `npm run check:ward-expected-reds`                             | `check-ward-expected-reds.mjs`, `run-ward-tests.mjs`, `ward-flow/full-gate-recheck.mjs` | The CI unit shards: run the suite and compare reds with `tests/ward-expected-reds.json`.                                      |
| `npm run test:e2e` and the `test:e2e:*` lanes                  | `run-playwright.mjs`, `playwright-base-url.ts`, `playwright-browser-preflight.mjs`      | Playwright journeys, including the CI journey and release-gate lanes.                                                         |
| `npm run test:backend`                                         | the `backend/ward-flow` package                                                         | Backend build and tests.                                                                                                      |
| `npm run verify:pr-local`                                      | `verify-pr-local.mjs`                                                                   | Local pre-push readiness selected from CI scope rules; inspect the dry run for the actual local stages.                       |
| `npm run verify:cheap`                                         | the `package.json` command chain                                                        | Unconditional broad offline documentation, static, lint, typecheck and unit checks.                                           |
| `npm run test:live`                                            | `run-live-tests.mjs`                                                                    | Provider-backed live tests; refuses unless `ALLOW_PROVIDER_TESTS=true` is set for an approved run. No live tests exist today. |
| `npm run bench`                                                | none                                                                                    | Vitest benchmarks.                                                                                                            |

Shared helpers for these runners: `owned-child.mjs` (and its Windows companion), `test-run-lock.mjs`,
`test-environment.mjs` (offline, provider-free test environment), `test-run-selection.mjs`,
`unit-test-population.mjs`, `test-evidence-identity.mjs`, `test-cache-path.mjs`, `retryable-fs.mjs`,
`child-process-result.mjs`, `npm-script-invocation.mjs`, `sensitive-text.mjs`, `run-tsx.mjs`,
`resolve-tsx-cli.mjs`, `register-server-only.mjs` and `enable-server-only-stub.mjs`. The journey
lane also uses `ward-flow/journey-run-verdict.mjs`, `ward-flow/known-journey-failures.mjs`,
`ward-flow/keep-journey-failures.mjs`, `ward-flow/journey-durations.json` and the screenshot tool
`ward-flow/shots.mjs` (with `ward-flow/shot-routes.txt` and `ward-flow/local-audit-target.mjs`).
The unit shards use `ward-flow/unit-durations.mjs`, `ward-flow/test-module-dependencies.mjs` and
`ward-flow/gate-build-flag.mjs`.

## CI

`scripts/ward-ci-public/` holds what `.github/workflows/ward-flow.yml` runs: `plan.mjs` and
`verify-plan.mjs` (which jobs a change needs), `main-reuse.mjs` (reuse a pull request's proven
result on main), `changed-checks.mjs` (format, lint and the test-deletion guard on changed files),
`check-contracts.mjs` and `check-policy-contracts.mjs` (the workflow's own contracts),
`install-chromium.mjs`, and `bot-author-policy.mjs` for the bot author workflow. CI also runs
`check-script-budget.mjs` (phone first-load script budgets in `script-budget.json`),
`check-knip-baseline.mjs` (`npm run check:knip`), `ward-flow/related-tests.mjs`,
`ward-flow/gate-tsc.mjs` and `ward-flow/selected-baseline-verdict.mjs`.

## Safety and data safeguards

| Command or hook                                    | Script                                                                                 | Protects                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| pre-commit hook                                    | `pre-commit-checks.mjs`, `staged-source-tree.mjs`, `check-staged-docs.mjs`             | Staged secret and patient-identifier admission, sign-out ownership, changed-line checks.  |
| pre-push hook, `npm run guard:push`                | `guard-push.mjs`                                                                       | Push destination identity and auto-merge ownership (no override), then format and static. |
| `npm run check:client-bundle-secrets`              | `check-client-bundle-secrets.mjs`                                                      | No API key, token or credentialed database URL in tracked client source.                  |
| `npm run ward:governance:check`                    | `ward-flow/check-clinical-governance-gate.mjs`                                         | Synthetic fixture identifiers and the disclaimer source (runs in CI).                     |
| `npm run check:ward-reference`                     | `ward-flow/check-ward-reference.mjs`, `ward-flow/build-reference-*.mjs`                | The generated ward reference registry still matches its source pack (runs in CI).         |
| `npm run check:ward-legal-language`                | `ward-flow/check-ward-legal-language.mjs`                                              | No screen wording claims legal authority the app does not have (runs in CI).              |
| `npm run check:ward-source-control-chars`          | `ward-flow/check-source-control-chars.mjs`                                             | Hidden or bidirectional control characters in source.                                     |
| `npm run check:installed-lock-parity`              | `check-installed-lock-parity.mjs`, `check-node-engine.cjs`                             | Installed packages and Node match the lockfile and engine range.                          |
| `npm run check:diff-integrity`                     | `check-diff-integrity.mjs`, `diff-integrity.json`                                      | A change cannot silently delete test cases or write a truncation banner.                  |
| `npm run check:dead-code-candidate`                | `check-dead-code-candidate.mjs`                                                        | Refuses an unsafe dead-code removal unless the owner approves that run.                   |
| `node scripts/ward-flow/sign-out-check.mjs <file>` | `ward-flow/sign-out-check.mjs`, `ward-flow/claim-files.mjs`, `ward-flow/logs-root.mjs` | Sign-out log clashes before editing.                                                      |

The dependency audit is the `npm audit` step in `.github/workflows/dependency-audit.yml`, and the
secret history scan is the gitleaks job in `.github/workflows/ward-flow.yml`. Neither needs a
script here.

## Documents and generated indexes

`npm run docs:check-links` (`check-maintained-doc-links.mjs`, `ward-flow/check-doc-links.mjs`),
`npm run docs:check-scripts` (`check-docs-script-refs.mjs`), `npm run docs:facts` and
`npm run docs:facts:write` (`doc-facts.mjs`), `npm run docs:check-index`
(`check-codebase-index-coverage.mjs`), `npm run docs:check-inventory` and `npm run docs:update`
(`update-docs-inventory.mjs`), `npm run sitemap:check` (`generate-site-map.ts`),
`npm run docs:maintain` and `npm run docs:maintain:check`
(`ward-flow/maintain-docs-and-organisation.mjs`, which also runs `check-stale-docs.mjs`), and
`npm run ward:organise:check` (`ward-flow/organisation.mjs`, `ward-flow/organisation-core.mjs`).
The pre-commit hook selects generated-document checks from staged paths and checks the index
snapshot: Ward indexes block on failure; general index checks are advisory unless strict mode is
set. CI directly checks reference-pack integrity and scope-selected owner-rulings, rules and
organisation outputs. The full `docs:maintain:check` aggregate additionally runs
`ward-flow/screen-map.mjs`, `ward-flow/mockup-manifest.mjs` and
`ward-flow/screen-verification.mjs` (using `ward-flow/screen-pairs.mjs` and the verification library).
`check-stale-docs.mjs` is a separate advisory age-and-reference report, not a generator drift check.
`ward-flow/sync-lessons.mjs` is a retired stub that only refuses; a documentation test still
checks that refusal.

## Design and product checks

`npm run check:ward-text-size` (`ward-flow/check-text-size-floor.mjs` with its baselines and
`ward-flow/font-size-inventory.mjs`), `npm run check:type-scale`, `npm run check:icon-scale`,
`npm run check:explanatory-buttons`, `npm run check:design-system-contract`
(`token-layer-divergences.mjs`), `npm run check:mockups` (`check-mockup-retirement.mjs`),
`npm run ward:test:sync:check` (`ward-flow/design-test-sync.mjs`) and
`npm run check:ward-errata-freshness`. Most are also asserted by unit tests, so the CI shards run
them. `figma-tokens.mjs` syncs design tokens with Figma (see `docs/agents/figma-sync.md`).
`check-ward-data.mjs` explains problems in the editable ward data in plain words. It has no npm
command yet because it currently reports open data problems.

## Setup and maintenance

`npm run hooks:install` (`install-git-hooks.mjs`, also run on install), `npm run setup:codex-worktree`
(`setup-codex-worktree.mjs`, Windows Codex Desktop), `npm run check:runtime` (`check-runtime.ts`),
`npm run check:playwright-browser-revision`, `npm run ward:reference:build`, `npm run ward:dev`
(`ward-flow/dev-with-organisation.mjs`), `npm run format` and `npm run format:changed`
(`check-format-changed.mjs`), and `export-task-receipt.py` for optional task receipts
(`docs/task-receipts.md`).
