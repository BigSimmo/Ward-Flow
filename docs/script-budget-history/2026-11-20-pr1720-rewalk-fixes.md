20 Nov 2026, PR #1720 (D-271: demo re-walk fixes). The CI production build measured four screens at or just over their limits, each 0.3 KB more than main alone. Each limit is now the measured size plus 0.3 KB:

- `/bedchart`: 623.3 → 623.7 KB (measured 623.4 KB).
- `/bedchart/referrals`: 620.5 → 620.8 KB (measured 620.5 KB).
- `/bedchart/ward/rph-adult-secure`: 663.2 → 663.5 KB (measured 663.2 KB).
- `/bedchart/ed/arm-ed`: 715.2 → 715.5 KB (measured 715.2 KB).

Every raise is under the 5 KB a PR may add (D-82).

**Why it grew.** The growth is in code every screen loads. The shared layout now closes an Undo message once the board clock passes its Undo window, and Reset also closes Undo refusal messages (D-271 fault 1).

**Trim.** None found: the 0.3 KB is the fix itself. Issue #1684 keeps the wider trim open.
