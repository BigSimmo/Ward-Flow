---
name: focused-runs-cannot-select-readfilesync-tests
description: "test:focused selects by import graph, so a test that reads source as text can never be selected — two gates sat red for days"
metadata:
  node_type: memory
  type: project
  originSessionId: 2b6afefc-3c5d-42e8-9a09-d310ecde7e2f
  modified: 2026-09-03T20:27:07.845Z
---

`npm run test:focused` is `vitest related --run <changed files>` (`scripts/test-focused.mjs:69`).
`vitest related` selects by the **module import graph**. So a test that inspects source with
`readFileSync` imports nothing from `src/` and **can never be selected by a focused run, whatever
you change**. It executes only under `npm run test`, `verify:cheap`, or CI heavy scope.

**Why:** on 2026-09-04 two Ward Flow contract gates were both red on the integration line and
nobody knew. `tests/ward-design-language-contract.test.ts` had four stale rows in
`COVERING_THE_GROUND`; `tests/ward-primitives-shared.test.ts` was missing two ED breakpoints. Both
are readFileSync tests. My first diagnosis was "nobody happened to run it" — the real cause is that
no focused run _could_ have. That is one property with two instances, and it predicts more: every
check in this repo that reads source as text rather than importing it has the same exposure.

⚠️ **The fix is usually not a better habit — it is an import.** Deriving a list from a runtime
`export const … as const` array instead of a TypeScript type both makes the derivation _possible_
(types are erased; a runtime test cannot enumerate one) and puts the test in the import graph, so
it attends automatically. Two derivations in a plan were specified over TS types and would have
silently become hand-lists with a floor under the hand-list.

**How to apply:** when writing a source-text guard, either import a runtime array from the module
it polices, or state in the test that it is attendance-dependent and name what makes it run. Before
trusting a green focused run, ask whether the guard you care about is even in the graph. See
[[the-suite-never-tests-the-absence]], [[a-bypass-that-runs-a-narrower-check]],
[[checks-that-cannot-fail]].
