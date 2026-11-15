15 Nov 2026, PR #1683 (permit(), History, the one late rule, am/pm). Josh approved going above the 5 KB rule (D-242). Each limit is the size CI measured at 8029df345 (merged with main 6d09158ef) plus 0.2 KB. Main alone measured the size in brackets on the same run:

- `/ward-flow`: 608.4 → 617.8 KB (measured 617.6 KB; main 607.9 KB).
- `/ward-flow/referrals`: 605.9 → 615.2 KB (measured 615.0 KB; main 606.2 KB).
- `/ward-flow/ed`: 559.5 → 568.8 KB (measured 568.6 KB; main 559.6 KB).
- `/ward-flow/ward/rph-adult-secure`: 648.1 → 657.4 KB (measured 657.2 KB; main 648.0 KB).
- `/ward-flow/movements/WF-001`: 640.0 → 655.3 KB (measured 655.1 KB; main 640.6 KB).
- `/ward-flow/ed/arm-ed`: 699.9 → 709.1 KB (measured 708.9 KB; main 699.7 KB).
- `/ward-flow/bed-meeting`: 608.2 → 617.5 KB (measured 617.3 KB; main 608.0 KB).
- `/ward-flow/statistics`: 655.7 → 666.9 KB (measured 666.7 KB).

`/ward-flow/capacity` needed no raise (measured 638.4 KB against 663.2 KB).

**Why it grew.** The one permission source (`ward-permit.ts` and `ward-permit-place-rules.ts`, D-222 and D-223) and the History category table (`ward-audit-categories.ts`) now run in the browser on every screen. Before, only the server ran them. Together they add about 9 KB to the shared shell. The person page also gained the History tab wording, the late rule and times that say their day. Statistics gained the figure splits.

**Trim.** No small, safe trim was found, because the growth is the rule tables themselves. A later trim could keep the place rules on the server only.

**After #1675 merged (15 Nov, 08:35Z).** CI measured this PR at ea12c8000, merged with main 06b1fb2c0. The person page went over its limit by 0.1 KB from #1675's own code. Four limits moved to the new measured size plus 0.2 KB, on the same D-242 approval:

- `/ward-flow/movements/WF-001`: 655.3 → 655.6 KB (measured 655.4 KB; main 640.6 KB).
- `/ward-flow/ed`: 568.8 → 568.9 KB (measured 568.7 KB).
- `/ward-flow/bed-meeting`: 617.5 → 617.6 KB (measured 617.4 KB).
- `/ward-flow/statistics`: 666.9 → 667.0 KB (measured 666.8 KB).
