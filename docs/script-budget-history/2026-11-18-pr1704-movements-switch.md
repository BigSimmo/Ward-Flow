18 Nov 2026, PR #1704 (D-265: Movements Graph or Table switch, compact stage cards, Statistics phone tools menu). The phone script budget measured eight screens up to 0.9 KB over on run 44315021480. Each limit is now the measured size plus 0.2 KB:

- `/bedchart`: 620.8 → 621.4 KB (measured 621.2 KB).
- `/bedchart/referrals`: 618.2 → 618.6 KB (measured 618.4 KB).
- `/bedchart/ed`: 571.8 → 572.2 KB (measured 572.0 KB).
- `/bedchart/ward/rph-adult-secure`: 660.9 → 661.3 KB (measured 661.1 KB).
- `/bedchart/movements/WF-001`: 658.6 → 659.7 KB (measured 659.5 KB).
- `/bedchart/ed/arm-ed`: 712.1 → 713.2 KB (measured 713.0 KB).
- `/bedchart/bed-meeting`: 621.1 → 621.3 KB (measured 621.1 KB).
- `/bedchart/statistics`: 670.2 → 670.8 KB (measured 670.6 KB).

Every raise is under the 5 KB a PR may add (D-82).

**Why it grew.** The growth of 0.2 to 1.0 KB is in code every screen loads. The Movements help and tour text changed for the Graph or Table switch, the "All" tab and the Stages heading, and that text is inlined into the shared help bundle. The Graph or Table switch and the Statistics "…" menu use kit parts (Segmented, Menu) that were already shared.

**Trim.** None found under 1 KB without cutting help text that D-265 asks for. Issue #1684 keeps the wider trim open.
