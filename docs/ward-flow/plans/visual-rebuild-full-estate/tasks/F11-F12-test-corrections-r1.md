# F11/F12 focused DOM test corrections — 2026-09-13

Scope: only `tests/ward-screen-overview-and-entry.dom.test.tsx` and `tests/ward-statistics.dom.test.tsx`.

The actual pre-edit copies were saved before editing at `C:\Users\joshs\AppData\Local\Temp\ward-f14-tests-before-r1`:

- `ward-screen-overview-and-entry.dom.test.tsx`: SHA-256 `87472AC7162D9030E1FE51BC7B7783D65F7BC5FCDAA930C798AC0C1120A46AE1`
- `ward-statistics.dom.test.tsx`: SHA-256 `0F585D67969036FFC20EFE73B72B798AD4E1CCE8CEC2537AE91FE0EE45C0AD79`

Input evidence: `C:\Users\joshs\AppData\Local\Temp\ward-tests-7SBrEp\report-0.json` (SHA-256 `FD915F9535A04C241E10AFE7372B5055E4D844BF98FB327C39C3D4749F0E59B4`). The run was 14/14 files, 166 collected, 161 passed, 5 failed, with the fifth failure owned by Alerts and untouched. The four relevant failures were one obsolete Wards digit-ban assertion and three obsolete Statistics layout/placement assertions.

Changes:

- Wards now asserts the provider-derived `${allUnits().length} wards` directory count and retains the provenance guard that the index has no bed numbers or availability; the no-ranking guard remains.
- Statistics now asserts the six commissioned drawing panel test IDs/headings: Across all services, Flow over time, Where the pressure is, Emergency departments, Community teams, and Referrals for a bed.
- Statistics figure placement now follows the current panel ownership: bed-readiness/not-offered under system, refusal/declines/blocked-discharge figures under pressure, pull-to-arrival under Flow, and referral-to-bed under Referrals for a bed. The system measurement disclosure is opened before placement assertions so closed disclosure state does not hide retained figures from the DOM check.
- The withheld-declines assertion now checks the pressure panel while retaining its caption/provenance assertions.

Post-edit SHA-256:

- `tests/ward-screen-overview-and-entry.dom.test.tsx`: `DE793FFD67F0D6E30419BCEB912E987447C4E304093E048AD1137647D48BF0B1`
- `tests/ward-statistics.dom.test.tsx`: `AFEA06F35597F46F1F96F28503E2DDB87859B009CC8FFB4AF5D4F2C8C4837009`

`git diff --check` passed for the worktree inspection. No test runner was executed for this correction task; parent must rerun the two files and Alerts. No visual or hosted proof is claimed.
