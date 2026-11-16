16 Nov 2026, PR #1700 (Customise the phone + sheet and bottom bar, D-250). CI run 43819020149 on bad74e21 measured eight phone screens over their limits by 0.3 to 1.1 KB. Each new limit is the measured size plus 0.2 KB:

- `/ward-flow`: 619.6 → 620.8 KB (measured 620.6 KB; main alone 619.5 KB).
- `/ward-flow/referrals`: 617.3 → 618.2 KB (measured 618.0 KB; main alone 616.9 KB).
- `/ward-flow/ed`: 570.7 → 571.8 KB (measured 571.6 KB; main alone 570.5 KB).
- `/ward-flow/ward/rph-adult-secure`: 659.4 → 660.6 KB (measured 660.4 KB; main alone 659.4 KB).
- `/ward-flow/movements/WF-001`: 658.1 → 658.6 KB (measured 658.4 KB; main alone 657.3 KB).
- `/ward-flow/ed/arm-ed`: 710.9 → 712.1 KB (measured 711.9 KB; main alone 710.8 KB).
- `/ward-flow/bed-meeting`: 619.2 → 620.5 KB (measured 620.3 KB; main alone already 619.3 KB, over before this PR).
- `/ward-flow/statistics`: 668.6 → 669.9 KB (measured 669.7 KB; main alone already 668.7 KB, over before this PR).

Every raise is under the 5 KB a PR may add (D-82). `/ward-flow/capacity` is under its limit and unchanged.

**Why it grew.** About 1.1 KB on the shared shell. Each desk's chosen bottom bar has to be read and resolved on first load so the bar is drawn right: the new `ward-dock-store.ts` (read, check and save the stored choice) and the slot resolution in `next-phone-menu.tsx`. The Customise and Edit bottom bar sheets themselves load with the phone menu sheets, on first open, not on first load.

**Trim.** Looked at moving the option list builder out of the shell (not built), but the shell still has to check each stored key against what the desk may open, which is most of the same code, so it would save only a few hundred bytes. Issue #1684 keeps the wider trim open.
