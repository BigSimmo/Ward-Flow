# Runtime audit repairs

This local repair branch starts at `559f225892b27b6c42bd7e9a6fa81f3ef81e62ec`, newer than the supplied audit baseline `2f71bc9b6b9aa80e6b1fec04f8df43f830e5c180`. It addresses the seven unresolved mechanisms without changing the deliberate exclusion of original typed values from device storage.

- **WF-RUN-06:** device saving tracks the successfully written revision separately from saving capability. Pending copies invalidate the prior current-save marker, show pending status and retain unload protection. Pending registration keeps its existing leave guard, including an unchanged submitted form. The persistence hook owns cancellation of obsolete loader effects.
- **WF-RUN-01:** both shell Alerts callbacks and the PWA page receiver compose the existing leave approval before actual route departure. Same-route focus and desktop drawer opening retain their behaviour.
- **WF-RUN-04:** import ownership begins before file reading and covers validation and every adoption/cleanup side effect. New imports, reset/scenario commands and provider retirement invalidate older work. Stale panel completions cannot overwrite current status.
- **WF-RUN-03:** phone previews resolve stable record keys against current permitted results within their world/access lifetime. Unrelated refreshes preserve selection; removal, access loss and replacement retire it.
- **WF-RUN-05:** reload intent belongs to one worker and is consumed before a reload attempt. An already-activated update can reload from its older notice; cancelled unload cannot arm later updates.
- **WF-RUN-08:** mounted lazy-panel fallbacks subscribe to shared pending/result state. A panel reopened during retry observes completion with its current props.
- **WF-RUN-09:** phone search exposes accessible loading/failure status and an explicit retry, preserving its query and focus hand-off.
- **WF-RUN-02:** recent screens use the permitted view catalogue directly, avoiding full searches. This is a computation improvement, not a measured phone-speed claim.

The retired WF-RUN-07 registration repair is preserved. Wider performance observations remain measurement opportunities; this patch supplies no physical-phone responsiveness, sleep, durable offline-editing or deployment evidence.

Focused regression tests exercise controlled source/React/worker sequences, including real Next dynamic loading for the retry/remount regression. Browser evidence uses the installed Chromium and local development app; it is separate from the pinned production browser lane and a physical device. Final check outcomes and any limits are recorded in the task handover.

## Local verification

The selected `verify:pr-local` plan passed runtime, formatting, diff integrity, documentation checks, locked-install parity, backend typecheck, lint, frontend typecheck and the affected unit selection: **35 files / 329 tests**. An additional six-file regression lane passed **44 tests**, covering the retired registration guard, guarded transport closing, command completion, import generation bounds, pending local saving and shared resend. These lanes overlap; their counts are not a unique-test total.

The new mocked shared resend cases cover a successful server commit with a lost response, byte-identical retry, and desk/workspace changes both after acceptance and during retry. They found no additional client defect. A mocked idempotent server does not prove hosted-server behaviour or durable offline editing.

The local production build passed. The script-budget check measured initial route scripts at 548.7 KiB (Home), 553.9 KiB (Referrals), 502.9 KiB (ED), 580.1 KiB (Ward) and 609.7 KiB (Movement), all within the existing ceilings. No budget was changed. These compressed dependency measurements do not establish phone responsiveness. The build reported an existing `select optgroup::label` CSS optimisation warning outside the changed styles.

Installed Chromium 151, emulated at 390 × 844, exercised the actual Add patient → empty search → See all alerts journey on the production build: declining preserved route and draft; approving navigated. Local development browser checks also forced a search chunk failure, exposed and corrected a header-layout collision, then verified readable feedback, retry, focus hand-off and no horizontal page overflow.

A second production-browser check held and rejected the actual search chunk: failure and retry were visible; retry retained the typed synthetic query and transferred focus, without horizontal overflow. This used mobile browser emulation, not a physical phone.

No hosted CI, live provider, deployment or physical-device execution was performed. The complete unit population, PostgreSQL integration tests and full production browser-journey lane were not run; the selected local plan explicitly leaves those wider gates to hosted CI.
