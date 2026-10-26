# Skipped / todo / fixme test inventory

Generated 2026-10-26 by a read-only scan (audit item 7). That scan changed no tests. Updated 2026-10-26 by hand after the four Windows skips gained written reasons (there is no generator script). "Reason" is heuristic: the comment directly above or on the line, or the skip condition message; **NO REASON** marks entries without one. Conditional skips (`skipIf`, env-gated `describe.skip`) are included.

Total: 6 (no reason: 0)

| Location                                         | Kind | Line                                                                                       | Reason                                                                                                        |
| ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `tests/owned-formatting.test.ts:67`              | skip | it.skipIf(process.platform === "win32")(                                                   | Skipped on Windows: the default sign-out log is fixed at D:/Repos/ward-flow-logs, so HOME cannot redirect it. |
| `tests/pre-commit-checks.test.ts:514`            | skip | it.skipIf(process.platform === "win32")("blocks when the default log is absent off Windows | Skipped on Windows: the default sign-out log is fixed at D:/Repos/ward-flow-logs, so HOME cannot redirect it. |
| `tests/release-gate-axe-sweep.spec.ts:153`       | skip | test.skip(isPhoneLayout(page), "The actions menu is the desktop ED board's");              | The phone ED board opens each row's actions in a sheet rather than this menu.                                 |
| `tests/ward-public-ci-setup.test.ts:94`          | skip | it.skipIf(process.platform === "win32")("terminates a deliberately stalled local command w | Skipped on Windows: runBounded wraps the command in GNU coreutils `timeout`, which Windows does not provide.  |
| `tests/ward-screen-verification-lib.test.ts:341` | skip | it.skipIf(process.platform === "win32")(                                                   | Skipped on Windows: creating a directory symlink needs administrator rights or Developer Mode there.          |
| `tests/ward-travel-bands.test.ts:243`            | skip | it.skipIf(!TRAVEL_BANDS_ARE_INVENTED)(COMPLETENESS_GUARD_TITLE, () => {                    | the table is deliberately incomplete                                                                          |
