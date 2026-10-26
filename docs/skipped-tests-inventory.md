# Skipped / todo / fixme test inventory

Generated 2026-10-26 by a read-only scan (audit item 7). No tests were changed. "Reason" is heuristic: the comment directly above or on the line, or the skip condition message; **NO REASON** marks entries without one. Conditional skips (`skipIf`, env-gated `describe.skip`) are included.

Total: 6 (no reason: 4)

| Location                                         | Kind | Line                                                                                       | Reason                                                                        |
| ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `tests/owned-formatting.test.ts:66`              | skip | it.skipIf(process.platform === "win32")(                                                   | **NO REASON**                                                                 |
| `tests/pre-commit-checks.test.ts:513`            | skip | it.skipIf(process.platform === "win32")("blocks when the default log is absent off Windows | **NO REASON**                                                                 |
| `tests/release-gate-axe-sweep.spec.ts:153`       | skip | test.skip(isPhoneLayout(page), "The actions menu is the desktop ED board's");              | The phone ED board opens each row's actions in a sheet rather than this menu. |
| `tests/ward-public-ci-setup.test.ts:93`          | skip | it.skipIf(process.platform === "win32")("terminates a deliberately stalled local command w | **NO REASON**                                                                 |
| `tests/ward-screen-verification-lib.test.ts:340` | skip | it.skipIf(process.platform === "win32")(                                                   | **NO REASON**                                                                 |
| `tests/ward-travel-bands.test.ts:243`            | skip | it.skipIf(!TRAVEL_BANDS_ARE_INVENTED)(COMPLETENESS_GUARD_TITLE, () => {                    | the table is deliberately incomplete                                          |
