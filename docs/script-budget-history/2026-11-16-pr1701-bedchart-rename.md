16 Nov 2026, PR #1701 (rename to BedChart, D-250). The phone script budget measured two screens 0.1 KB over on run 43820310193:

- `/bedchart/bed-meeting`: 619.2 → 619.5 KB (measured 619.3 KB).
- `/bedchart/statistics`: 668.6 → 668.9 KB (measured 668.7 KB).

Both raises are under the 5 KB a PR may add (D-82). The other screens are under their limits and are unchanged.

**Why it grew.** The new What's new line ("Ward Flow is now called BedChart ...") is inlined into the shared client bundle with the rest of the What's new list. These two screens were already within 0.1 KB of their limits.

**Trim.** None found for 0.1 KB: the rename itself makes most strings shorter. Issue #1684 keeps the wider trim open.
