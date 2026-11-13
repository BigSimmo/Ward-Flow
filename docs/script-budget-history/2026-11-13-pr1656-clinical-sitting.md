# 13 November 2026, PR #1656 (held clinical PR, D-186 and D-187)

All nine phone limits raised by 0.3 KB: `/ward-flow` 582.3 to 582.6, `/ward-flow/referrals` 586.8 to 587.1,
`/ward-flow/ed` 536.4 to 536.7, `/ward-flow/ward/rph-adult-secure` 615.8 to 616.1, `/ward-flow/movements/WF-001`
613.5 to 613.8, `/ward-flow/capacity` 660.0 to 660.3, `/ward-flow/ed/arm-ed` 674.7 to 675.0, `/ward-flow/bed-meeting`
593.8 to 594.1 and `/ward-flow/statistics` 633.9 to 634.2. Measured with two local production builds at the same
checkout path (main `92630b1e` against the PR at `d61696f5`), every route grew by the same 0.2 KB, so the growth is in
the shared shell: the seven triage timings Josh had listed in the values register (D-186 item 16), the one legal
reading for the patient page (D-186 item 7) and the two named legal rules (D-187 item 3). They are approved content,
so no trim was taken; CI found Movements 0.1 KB over its limit (613.5 KB against main's 613.4 KB) before the raise.

After PR B (#1657) merged, its own raises replaced these in the merge, so this PR's 0.3 KB was added again on top
of main `ea4cd8b5`: `/ward-flow` 585.2 to 585.5, `/ward-flow/referrals` 589.9 to 590.2, `/ward-flow/ed` 538.5 to 538.8, `/ward-flow/ward/rph-adult-secure` 618.2 to 618.5, `/ward-flow/movements/WF-001` 616.9 to 617.2, `/ward-flow/capacity` 662.4 to 662.7, `/ward-flow/ed/arm-ed` 677.9 to 678.2, `/ward-flow/bed-meeting` 596.3 to 596.6, `/ward-flow/statistics` 636.4 to 636.7. CI's production build on `2f68cc3f` found Capacity
over its limit (662.4 KB) with B's limits alone; the growth is the same shared-shell 0.2 KB measured above.

After PR C (#1660) merged, main `00849b0a` was merged in and this PR's 0.3 KB was added on top of C's limits again. The
rest of the clinical build (D-186 to D-189: the transport paperwork rule, the legal order warnings, the fit to travel
reason dialogs, the To check group, the two statuses and the sample labels) then went on top. A local production build
of `e43c4fde` (before the knip clean-up, which only drops unused exports) measured four routes over: `/ward-flow` 589.4 KB, `/ward-flow/movements/WF-001`
622.4 KB, `/ward-flow/ed/arm-ed` 682.6 KB and `/ward-flow/statistics` 643.2 KB. Their limits rise to 589.7, 622.7, 682.9
and 643.5 KB, each within 5 KB of main's (589.1, 621.5, 680.6 and 640.6 KB). The growth is approved clinical content and
was not traced module by module; no trim was taken. Capacity, the Ward page and the bed meeting sheet shrank, and their
limits are left as they were.

After PR E (#1658) merged, main `a1c90573` was merged in. A local production build of the merged tree then measured every
budgeted route over main's new limits by 0.5 to 2.8 KB, because both PRs' additions now load together. Each limit is set to
the measured size plus 0.3 KB, within 5 KB of main's: `/ward-flow` 592.3 (+0.8), Referrals 599.3 (+3.1), ED 549.4
(+0.8), the Ward page 628.2 (+1.1), Movement 627.0 (+1.8), Capacity 663.2 (+1.3), ED arm 688.7 (+2.4), the bed meeting
sheet 599.7 (+1.4) and Statistics 645.0 (+0.8). No trim was taken: the growth is the combined approved content of the two
pull requests, and Josh asked on 14 November to avoid slow, low-yield work before the demo.
