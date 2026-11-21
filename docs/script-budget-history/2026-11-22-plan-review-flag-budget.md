22 Nov 2026, the plan review flag (D-275, PR #1729), measured on main. Main's own production build after #1729 merged measured three screens 0.0 to 0.1 KB over their limits, and after #1732 (D-276) merged the same three were 0.2 to 0.4 KB over, so the 6 am Perth release on 22 Nov kept the live site at #1728. Each limit is now main's measured size plus 0.3 KB, since sizes move about 0.2 KB between builds:

- `/bedchart/movements/WF-001`: 659.7 → 660.2 KB (measured 659.9 KB).
- `/bedchart/ed/arm-ed`: 715.5 → 716.2 KB (measured 715.9 KB).
- `/bedchart/bed-meeting`: 623.4 → 623.9 KB (measured 623.6 KB).

Every raise is under the 5 KB a PR may add (D-82).

**Why it grew.** The plan review flag's shared check and tag (`ward-expect-review.ts`), shown in the movement workflow actions, the ED row facts and the Flow list row these screens load, then a further 0.1 to 0.3 KB from #1732's review fixes in code the same screens share.

**Trim tried.** None is safe: the helper is two small functions on screens that already load the movement model, and loading the flag lazily would show it a moment after the row, which is worse for the person reading the board.
