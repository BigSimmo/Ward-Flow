# Task 8 guard corrections — Luna r1

Date: 2026-09-13. Model label: Luna, medium reasoning.

Two narrowly scoped guard corrections were applied under Task 8:

- `tests/ward-css-token-references-resolve.test.ts`: removed `--text-3xl` and `--text-4xl` from the fallback-bearing defect register. Current Ward CSS declares both names, so retaining them made the register stale. The canonical-duplicate detector and all other names remain unchanged.
- `tests/ward-chrome-owner.test.ts`: `splitMediaBlocks` now parses `min-width` and `max-width` in `px` or `rem` (1rem = 16px) and admits a block only when its range intersects the actual phone interval `0–40rem` (640px). This excludes the non-phone `min-width: 62.5625rem` / `max-width: 87.4375rem` range while retaining unbounded-min phone media such as `max-width: 48rem` and bounded ranges with `min-width <= 40rem`.

SHA-256 after edit:

| File                                              | SHA-256                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `tests/ward-chrome-owner.test.ts`                 | `799D7436B7B02353C0CE4C731027217EC15E3B1D6CB2AF639D227E17BCC2F845` |
| `tests/ward-css-token-references-resolve.test.ts` | `6556CA728072DBF45FB6982458AA04CE218D50382367F835AC399C72F48C7850` |

No tests, browser checks, server, provider, or hosted operations were run. The integrated full suite was already in progress; these corrections await its current/follow-up result.
