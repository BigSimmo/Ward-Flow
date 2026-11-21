22 Nov 2026, the 21 Nov review fixes and the two approved mock-ups (D-276). CI's production build measured four screens 0.1 to 0.2 KB over their limit. Each limit is now the measured size plus about 0.3 KB:

- `/bedchart`: 624.3 → 624.8 KB (measured 624.5 KB).
- `/bedchart/referrals`: 621.4 → 621.8 KB (measured 621.5 KB).
- `/bedchart/ed`: 573.6 → 573.9 KB (measured 573.6 KB).
- `/bedchart/statistics`: 672.3 → 672.6 KB (measured 672.3 KB).

Every raise is under the 5 KB a PR may add (D-82).

**Why it grew.** About 0.2 KB in code every screen loads: the installed app now checks for a new version when it comes back to the screen (at most every 30 minutes), and the browser status bar takes the header navy (`APP_CHROME_COLORS`). The ED board adds the tier key's Escape and press-outside close.

**Trim.** None found worth the risk the night before the demo: the new code is a few short listeners, and the removed hero inputs and CSS were already dead in the bundle. Issue #1684 keeps the wider trim open.
