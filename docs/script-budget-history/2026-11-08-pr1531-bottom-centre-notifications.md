# PR #1531: bottom-centre notifications (Note 14)

8 November 2026. `/ward-flow/referrals` raised from 560.0 KB to 563.0 KB. Hosted CI measured 562.4 KB
merged with main and 559.5 KB for main alone, so this PR adds about 2.9 KB gzipped to the route.
The new code sits in the shared layout chunk that every ward route loads: the shift change downtime
pack drawn as a toast (glyph, title, Open pack), the floating notes holder and the notes height check
in `wf/band.ts`. Referrals had only about 0.5 KB of headroom, so it is the one route pushed over; the
other measured routes stay within their limits. A local build placed none of the Settings changes in
the Referrals load, and the only trim available (dropping the toast's glyph) saves well under 1 KB,
so the limit is raised by 3 KB, within the 5 KB a PR may raise without asking.

9 November 2026. `/ward-flow/ward/rph-adult-secure` raised from 593.8 KB to 594.5 KB. Hosted CI
measured 593.8 KB merged with main (just over the limit) and 593.4 KB for main alone, so this PR adds
about 0.4 KB gzipped to the ward route: the same shared notes code plus the stable `data-wf-*` hooks
on the shared Hero and card heading. The route had no headroom left on main, so the limit is raised by
0.7 KB, within the 5 KB a PR may raise without asking.

9 November 2026, merge with main. Main had since raised its own limits (Referrals 565.0 KB, ward route
598.3 KB) for its own growth. This PR's two raises are carried on top of main's values unchanged in
size: Referrals 565.0 → 568.0 KB (+3.0) and the ward route 598.3 → 599.0 KB (+0.7).
