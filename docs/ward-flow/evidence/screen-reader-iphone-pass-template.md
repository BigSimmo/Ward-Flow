# Screen reader and iPhone pass (manual script)

**Audience:** whoever runs the pass, Josh and builders. **Status:** draft script, not yet run. **Owner:** Documentation. **Written:** 10 November 2026 for M97 of the master audit list.

The [8 November accessibility check](accessibility-check-2026-11-08.md) covered automated scans, the keyboard, dialogs and both themes in Chrome. This pass adds what only a person can do: **VoiceOver on a real iPhone**, **NVDA on Windows**, and **200% text**, through four journeys while updates arrive. Run it before each client demonstration. Copy this file to `screen-reader-iphone-pass-YYYY-MM-DD.md` and fill it in.

**Still to do (a person):** everything below. No part of it has been run. Emulation, a desktop browser's device mode or an automated scan does not count as this pass.

## Set-up

- Synthetic data only, **Winter surge** day. A second browser tab or device on the bed coordinator's desk makes the changes that arrive while you work (a new referral, a bed confirmed, a toast).
- iPhone: Safari, latest iOS the pilot site uses, VoiceOver on (triple-click the side button if set). Note the iOS version.
- Windows: NVDA (note the version) with Chrome, then Edge. Note the versions.
- 200% text: on the iPhone, Settings > Accessibility > Display and Text Size > Larger Text, two steps up from default; on Windows, Chrome zoom 200%. Note any text cut off, overlapping the floating bar, or needing sideways scrolling.

## Journeys

For each journey and each set-up, record **Heard** (was each control and state announced with its words?), **Order** (did focus move in a sensible order and land somewhere useful after each step?), **Updates** (was an arriving change announced once, politely, without moving focus?) and **Blocked** (could you finish?).

| Journey                                                     | VoiceOver iPhone | NVDA Chrome | NVDA Edge | 200% iPhone | 200% Chrome | Notes |
| ----------------------------------------------------------- | ---------------- | ----------- | --------- | ----------- | ----------- | ----- |
| Accept a referral on the nurse in charge's desk             |                  |             |           |             |             |       |
| Move a patient to another bed on the ward                   |                  |             |           |             |             |       |
| Record a discharge and hear the bed come free               |                  |             |           |             |             |       |
| Open Handover and read the shift summary                    |                  |             |           |             |             |       |
| While on any of the above, a toast with Undo arrives        |                  |             |           |             |             |       |
| While on any of the above, the board updates from elsewhere |                  |             |           |             |             |       |

## Record

Date, commit, devices and versions, who ran it, and each finding with where it happened. Findings become issues (filing them uses GitHub, so it needs Josh's yes).
