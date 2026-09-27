# Focused batch r2 evidence

Source: `C:\Users\joshs\AppData\Local\Temp\ward-tests-cIapbv\report-0.json`  
JSON SHA-256: `EC7AD45FB85C6D3FFAD997E89004CBE3AEEBE0C7D780F7264AD30B46FFE0E63D`  
Evidence author: gpt-5.6-luna, medium reasoning. Test execution owner: controller Astra. This is local test evidence only; it is not physical-device, hosted, provider, or visual proof.

Command:

```text
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-board-page.dom.test.tsx tests/ward-board-third-edition-headings.dom.test.tsx tests/ward-community-hub.dom.test.tsx tests/ward-facade-agrees-with-screens.test.ts tests/ward-delays-screen.dom.test.tsx tests/ward-shell-third-edition.dom.test.tsx
```

The runner summary reports 6 files handed in / 6 run; its JSON records 146 tests collected, 143 passed, 3 failed, 0 pending; 45 suites total (40 passed, 5 failed). Per file:

| File                                             | Passed | Failed |
| ------------------------------------------------ | -----: | -----: |
| `ward-board-page.dom.test.tsx`                   |      4 |      2 |
| `ward-board-third-edition-headings.dom.test.tsx` |      7 |      1 |
| `ward-community-hub.dom.test.tsx`                |     37 |      0 |
| `ward-delays-screen.dom.test.tsx`                |     22 |      0 |
| `ward-facade-agrees-with-screens.test.ts`        |     40 |      0 |
| `ward-shell-third-edition.dom.test.tsx`          |     33 |      0 |

Failed test names:

- `ward board page states the day count as text on every occupied tile` — expected numeric day strings, received values with ` days`.
- `ward board page — out-of-service beds draws a unit's blocked beds as out-of-service tiles, not as fillable empty ones` — expected one matching element, found two.
- `the bed board's third-edition headings gives the bed grid the heading it did not have` — could not find heading `Every bed, and who is in it`.

The controller has since corrected the number/unit exact multiset, scoped out-of-service matching to the actual bed list, and added a separate bed-grid H2/count. Those corrections were not rerun in this batch. They remain pending confirmation in the current integrated full run (451 files across 3 admitted batches). The focused command’s file order differs from the JSON result order; it is the same six-file set.
