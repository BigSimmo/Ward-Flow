# TV readable across a room (10-minute check)

**Audience:** whoever runs the check, Josh and builders. **Status:** draft template, not yet run. **Owner:** Documentation. **Written:** 10 November 2026 for M104 of the master audit list.

`tests/ward-audit-m104-tv-readable.test.ts` checks the type sizes of the three TV views at 1920 by 1080 from the stylesheet: lists and names at least 24px, the smallest words at least 20px and the tile figures at the 28px display step or more. Sizes on paper are not the same as reading a real screen in a real room, so this check is done once by a person. Copy this file to `tv-room-check-YYYY-MM-DD.md`.

**Still to do (a person):** the whole check. It has not been run.

## Set-up

- A meeting-room screen (note its make, size and resolution) driven at 1920 by 1080, browser full screen.
- Synthetic data only, **Winter surge** day. Full names stay on screen (D-83).
- Stand 3 metres away, in the room's normal light. Ten minutes in all.

## Record

| View                      | Can you read every name? | Every figure? | The smallest words (status, footer)? | Anything cut off or overlapping? | Notes |
| ------------------------- | ------------------------ | ------------- | ------------------------------------ | -------------------------------- | ----- |
| Bed meeting TV            |                          |               |                                      |                                  |       |
| Ward TV                   |                          |               |                                      |                                  |       |
| ED TV (tea room)          |                          |               |                                      |                                  |       |
| A change arriving (watch) |                          |               |                                      |                                  |       |

Date, screen, distance, light, who checked. Findings become issues (filing them uses GitHub, so it needs Josh's yes).
