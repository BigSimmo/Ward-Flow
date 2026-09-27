# F14 disclosure/time corrections r2

Actual-before copies were taken before this round in `C:\Users\joshs\AppData\Local\Temp\f14-small-before`: `ward-screen.tsx` `D33A0BC4E45623E50149C04F4425244C1CBAD9450D954A36E92FD63BE060A2C0`; Settings test `916F9F66BCF54396270BBF5606A39AC76454B1251B20E19AB895B1C6D62741E1`; claims register `BFE2811C062F2FA11055AAC510C79D73BBE12AACD8BD980C9667B47DAF3508D`; prior owned Capacity/on-call snapshots are recorded in r1.

Changes:

- `ward/ward-screen.tsx`: the `movement.referredAt` display now uses existing `formatInstantWithDay(movement.referredAt, now)`, resolving the exact static failure `unapproved: movement.referredAt` without changing movement state or wording.
- `tests/ward-settings-screen.dom.test.tsx`: excludes the composite `Handover sheet` title/intro/count heading from the cross-screen section list, while retaining the six actual content-section names and the non-vacuous check. This follows current Handover markup; Settings already presents the intended disclosure list.
- `statistics-claims-register.ts`: lengthened the rendered locator from duplicated `href={STATISTICS_HOME_HREF}` to the unique `className={thirdEditionStyles.backLink}`. The source claim still records the shared route constant as evidence.

Static verification: TypeScript `transpileModule` reported syntax-ok for all five TSX/test files and the claims register. Prettier completed on all owned files (Settings was corrected after an intermediate literal-newline typo). `git diff --check` produced no diagnostics for the owned paths. No tests, browser, server, provider, or hosted checks were run.

The full provenance sweep was not rerun; additional failures may remain outside the owned files.
