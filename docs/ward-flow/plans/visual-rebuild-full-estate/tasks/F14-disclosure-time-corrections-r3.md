# F14 disclosure/time corrections r3

Focused evidence: `C:\Users\joshs\AppData\Local\Temp\ward-tests-wBtTxn\report-0.json` reported 15 files / 277 tests / 272 passed / 5 failed. Actual-before hashes for this round are recorded under `C:\Users\joshs\AppData\Local\Temp\f14-disclosure-r3-before`: Capacity `3DE0F8EDABAB1AE3CE8BCCE789E3E89C9D148FC5B3D086C604BBAB9B5E4BC896`, On-call `06182BFF2BCC30D0DA615F0072D1C1960E47CE46AF2EEC9711907F2F637F02EA`, Settings `9F618FACF63E173486C40D3197895B9E7CAD76B859BF03A6B791592295FF1268`, Settings test `BCDCE9144097BFF9016C9EE73246B11D4C96268345D65E83E306C685F30D2643`.

- Capacity now preserves all required concepts in the visible sentence: synthetic figures, no real hospital, not a real medical device, and not a clinical record.
- On-call keeps one visible top sentence matching the screen-level disclosure query. The detailed print paragraph was changed to “Every role and shift listed in this disclosure is invented”, preventing a hidden duplicate from being selected while keeping its self-contained provenance marker and no-contact/no-ringing facts.
- Settings now names the actual rendered Handover section `Shift and sign off` rather than stale `Sign off`. The test’s composite `Handover sheet` exclusion remains narrow and the six content-section checks remain intact.

Static checks: Prettier completed for Capacity, On-call, Settings, and the Settings test; `git diff --check` reported no diagnostics for those paths. No tests, browser, server, provider, or hosted checks were run. The broader provenance guard was not rerun, so this report makes no green claim for other pages.
