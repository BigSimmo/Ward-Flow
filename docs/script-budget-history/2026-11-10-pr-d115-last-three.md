# 10 Nov 2026, D-115 items 3, 4 and 6 (one count everywhere, missing patient shown)

Raised ED 524.4 to 524.6 and statistics 616.7 to 619.0 (the measured size plus the usual 0.2 KB
margin, HOW-WE-WORK section 6).

| Route      | Measured | Old limit | New limit |
| ---------- | -------- | --------- | --------- |
| ED         | 524.4    | 524.4     | 524.6     |
| statistics | 618.8    | 616.7     | 619.0     |

Why: D-115 item 3 makes every "beds ready now" figure leave out a bed named for an accepted
referral, so the shared rail count, Statistics hero, map, compare and journey views now select
referrals and pass the named holds. Item 6 adds the "Absent without leave" line to the Statistics
journey and the executive split with its small-number protection. ED moved only by rounding from
the shared rail count.

Trim tried: the new code is the hold and leave logic itself, in modules the screens already load.
Moving it behind an on-demand chunk would add about 0.4 KB to every route and split one figure
across two loads, so no safe trim was found. Both raises are well inside the 5 KB per screen a PR
may take without asking.
