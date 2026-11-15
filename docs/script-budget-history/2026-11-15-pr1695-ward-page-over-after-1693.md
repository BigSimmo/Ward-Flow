15 Nov 2026, PR #1695 (follow-up to PRs #1692 and #1693, Help). Main's CI went red on the phone script budget after #1692 merged: `/ward-flow/ward/rph-adult-secure` measured 659.2 KB against its 659.1 KB limit (runs 43754767217 on 0ff1d112d and 43761243380 on a60aeb2a7). A red main blocks the hand release Josh asked for. Each new limit is the measured size on a60aeb2a7 plus about 0.2 KB:

- `/ward-flow/ward/rph-adult-secure`: 659.1 → 659.4 KB (measured 659.2 KB).
- `/ward-flow`: 619.4 → 619.6 KB (measured 619.4 KB, exactly at its limit, so the next shell change would turn main red again).

Both raises are under the 5 KB a PR may add (D-82). The other seven screens are under their limits (0.1 to 23 KB headroom) and are unchanged.

**Why it grew.** About 0.1 KB on the shared shell (516.2 KB, against 516.1 KB measured for #1690). #1692 added the 40px phone search rule and moved Help left of search in the header, both in the shell. #1693's Help walkthrough data loads with the Help sheet, not on first load.

**Trim.** None found for 0.1 KB. Issue #1684 keeps the wider trim open.
