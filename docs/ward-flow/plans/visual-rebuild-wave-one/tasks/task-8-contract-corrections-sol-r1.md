# Task 8 contract corrections — Sol r1

Date: 2026-09-13  
Scope: three test files only  
Execution model: `gpt-5.6-sol / medium`

## Reason

The integrated Batch 1 run collected 5,121 tests and completed with 5,031 passing, 15 failing and 75 pending. Three failures in this scope were stale presentation assertions after intentional third-edition changes; none identified a product or derivation regression.

- `ward-bar-zero-is-reachable.test.ts` still required Delays to be one of three `WardBar` callers. Delays now follows the drawing with a four-fact definition list. The test retains the real all-zero `waitingSplit` assertion and now pins the exact remaining WardBar callers, Capacity and Movements, before checking every discovered caller for empty-state handling.
- `ward-delays-nobody-waiting.dom.test.tsx` still searched for WardBar implementation classes. Its empty-state, measured-none and real seeded derivation guards remain. The non-empty case now checks the labelled definition list's exact four facts: the waiting total and all three derived duration bands. The empty case requires that fact band to be absent.
- `ward-board-people-panel.dom.test.tsx` appended a second day unit to tile text after the tiles began rendering the unit visibly. It now compares the normalized, unit-bearing tile and people-panel strings directly as the same sorted multiset.

Product interfaces, handlers and derivations are unchanged. No assertions were removed for the zero state, real seeded input, exact fact values or exact Board multiset.

## Output hashes

- `tests/ward-bar-zero-is-reachable.test.ts` — `F1483DD8AA40DCA850F3F3F110356820F58DFB1B1C2DAB405B494CDC85FD6432`
- `tests/ward-delays-nobody-waiting.dom.test.tsx` — `0B45DC47C4644D29DB8BD52D9F8356DDA1041FEEDA612994342FB7C1C9BB45B1`
- `tests/ward-board-people-panel.dom.test.tsx` — `1A62687779B5900201414DA17FD52DBF8CCA8E93294F59E121BD5B76A70E2947`

## Verification boundary

- `git diff --check -- tests/ward-bar-zero-is-reachable.test.ts tests/ward-delays-nobody-waiting.dom.test.tsx tests/ward-board-people-panel.dom.test.tsx` — passed with no output.
- Tests and browser checks were not run under the controller-owned verification boundary.
