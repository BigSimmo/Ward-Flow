20 Nov 2026, the pre-freeze UX review fixes (D-270). A local production build measured three screens at their limit (0.0 to 0.1 KB over) and three more within 0.1 KB of it. Each limit is now the measured size plus 0.3 KB:

- `/bedchart`: 623.3 → 623.6 KB (measured 623.3 KB).
- `/bedchart/referrals`: 620.5 → 620.8 KB (measured 620.5 KB).
- `/bedchart/ward/rph-adult-secure`: 663.2 → 663.5 KB (measured 663.2 KB).
- `/bedchart/ed/arm-ed`: 715.2 → 715.5 KB (measured 715.2 KB).
- `/bedchart/bed-meeting`: 622.4 → 622.7 KB (measured 622.4 KB).
- `/bedchart/statistics`: 672.0 → 672.3 KB (measured 672.0 KB).

Every raise is under the 5 KB a PR may add (D-82).

**Why it grew.** About 0.2 KB in code every screen loads: the demo seed's stage changes for journeys already collected or arrived (so Weekly's "Where the time goes" shows finished steps), the two new top bar names, and the hero's word face for a next step.

**Trim.** The new "ago" formatter was moved out of the shared kit into `ward-ago-text.ts`, which saved 0.1 KB. Issue #1684 keeps the wider trim open.

**After merging #1720 (D-271).** #1720 raised `/bedchart`, referrals, rph-adult-secure and arm-ed by 0.3 KB on its own. A fresh local build of both PRs together measured `/bedchart` 623.6, `/bedchart/ed` 573.4 and rph-adult-secure 663.5 KB. So `/bedchart` keeps main's 623.7 plus this PR's 0.2 (623.9), `/bedchart/ed` goes 573.3 → 573.6 KB and rph-adult-secure 663.5 → 663.8 KB. The others stand as above.
