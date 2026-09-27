# F14 disclosure/time corrections r1

Scope: `capacity-screen.tsx` and `on-call-screen.tsx` only. Actual-before snapshots were copied to `C:\Users\joshs\AppData\Local\Temp\f14-disclosure-before` before editing: capacity SHA-256 `AA7A24724D36BD9B666B971E75C657DD02AB11CC88C37FCB12FE86AD9E6713B2`; on-call `9085FB369B288FF9203A1B16ED010F6903AB593EB532179EADB80191E614648D`.

- Capacity synthetic footer now explicitly says there is no real hospital represented, while retaining the existing invented-figures and non-clinical-record sentences. This addresses the JSON failure where the banner text began `Where the mismatch is...` and lacked `no real hospital`/`real hospital`.
- On-call keeps a visible top disclosure with the exact screen-level wording `Every role and shift on this screen is invented`, plus no-contact/no-ringing language. The detailed print disclosure remains a closed `<details>` and its paragraphs now bind the invention marker to each relevant sentence; no disclosure was force-opened solely for the old test.
- `ward-instant-display.test.ts` identifies the remaining bare call as `movement.referredAt` in `src/components/ward-management/ward/ward-screen.tsx:1866`. This task explicitly excluded WardScreen, so it remains pending for that owner; no `MAY_ASSERT_TODAY` weakening was made.
- `ward-settings-screen.dom.test.tsx` is a stale cross-screen wording assertion: Settings renders `What prints on the handover sheet`, while the test expects concatenated Handover headings. Settings source was not changed.
- Provenance failures span additional owned-by-other screens (including ED/statistics/alerts); only on-call disclosure prose was changed here. No claim is made that the full provenance sweep passes.

Static checks: TypeScript `transpileModule` syntax diagnostics reported zero errors for both edited files. `npx prettier --check` reported both files not formatted; no formatter write was run because both files contain concurrent pre-existing work outside this correction scope. No tests, browser, server, provider, or hosted checks were run.
