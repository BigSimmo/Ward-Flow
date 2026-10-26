# Ward Flow wiring conventions

_Updated 2026-10-24 - historical catalogue moved to the Ward archive; route checks name the tests that exist; pre-commit drift is blocking only for Ward indexes; Documentation owns._

For current routes, navigation, unavailable controls and browser evidence, follow the
[maintained Ward wiring guide](agents/wiring-and-bundle-budget.md) and [AGENTS.md](../AGENTS.md).
Current source and the accepted Ward app govern behaviour and appearance.

### Current Ward Flow wiring & pre-commit summary

- **Buttons:** Every non-submit `<button>` must specify `type="button"` and wire an `onClick` handler (enforced by the local `require-button-wiring` ESLint rule). Controls that are unavailable for a stated reason use `aria-disabled="true"` + `ignoreUnavailableActivation` (`src/components/ui-primitives.tsx`) + an accessible explanation (`title` / `aria-describedby`), or the prototype-wide D4 notice (`"Not wired in this prototype."`). Never combine native `disabled` with `aria-disabled="true"`.
- **Routes & navigation:** Ward Flow routes live under `src/app/ward-flow/` and must be reachable from real navigation. `tests/ward-no-dead-ends.dom.test.tsx` renders every route and fails on controls that go nowhere; `tests/ward-component-reachability.test.ts` fails on screens no route can reach. `npm run sitemap:check` only checks that the generated route map is current. Regenerate route and script maps with `npm run docs:update` when routes or scripts change.
- **Pre-commit hook (`.githooks/pre-commit`):** Runs `node scripts/pre-commit-checks.mjs` and `node scripts/check-staged-docs.mjs` against a disposable staged index snapshot. It **never** auto-runs `npm run docs:update` or rewrites working-tree files. Drift in the Ward generated indexes (screen map, rules, owner rulings, drawing manifest, screen verification) blocks the commit; drift in the site map, script inventory or codebase index only warns unless `PRECOMMIT_DOCS_SYNC_STRICT=1` is set. Run the named generator and stage its output.

The earlier historical wiring catalogue (preserved on 8 October 2026) moved on 24 October 2026 to [wiring conventions: historical catalogue](ward-flow/archive/wiring-conventions-historical.md).
