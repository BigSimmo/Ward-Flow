# 14 Nov 2026, design lane C (PR #1679, D-234)

Measured by a local production build of the PR head (`scripts/check-script-budget.mjs`, Node 24.22.1).
Each new limit is the measurement plus 0.3. Every raise is inside the 5 KB allowance.

Raised:

- Coordinator `/ward-flow` 603.9 to 605.5 (measured 605.2), Referrals 602.8 to 604.0 (603.7), ED 556.1 to
  556.8 (556.5), Ward 640.4 to 644.7 (644.4), Movement 634.3 to 635.8 (635.5), ED board 694.9 to 697.0
  (696.7), Bed meeting 605.2 to 606.0 (605.7), Statistics 652.1 to 652.8 (652.5).

Why: main alone was already over on five of these (CI measured main at 603.5, 603.4, 556.3, 640.5, 634.9,
695.2, 605.1 and 652.3). Lane C adds the ward home's diversion release dialog, the in-place arrival
check, the one save-status line, the one-line refusal words and the held-declined referral queue.

What was tried first: CI's first build of this PR measured the ward page at 658.5 KB (+18 KB). The ward
home was statically importing the lazily loaded arrivals corridor for one label, the whole transport
checks module for one arrival check, and the arrival identity dialog. The label moved to
`ward-movement-origin.ts`, the arrival check to the small `ward-arrival-gaps.ts`, and the dialog now
loads on first use. That brought the ward page back to 644.4 KB.

After merging main with PR #1678 (its own 0.7 KB demo Pause raise, D-229), each limit above takes that
0.7 KB on top: Coordinator 606.2, Referrals 604.7, ED 557.5, Ward 645.4, Movement 636.5, ED board 697.7,
Bed meeting 606.7, Statistics 653.5. CI measured the merged tree at 605.8, 604.4, 557.3, 645.1, 636.1,
697.3, 606.4 and 653.2.

After merging main with Lane A (#1672), figures (#1673) and Lane B (#1682), main alone measured the ward
page at 642.2 KB and the merged tree at 646.5 KB. Lane C's share is still the ward home work above plus
the rail's Ready scope word and its ⓘ (R-BEDS-5, D-224). The ward limit moves to 647.0 KB, 4.8 KB over
main's own figure, inside the 5 KB a PR may raise one screen without asking. The other limits keep the
values already set here; each sits at or under 5 KB above main's own measurement.
