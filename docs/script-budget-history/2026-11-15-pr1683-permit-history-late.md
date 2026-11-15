15 Nov 2026, PR #1683 (permit(), History, the one late rule, am/pm). Josh approved going above the 5 KB rule (D-238). Each new limit is main's limit on 15 Nov plus this PR's growth, measured on CI at 6c68dd5a0 against the limits then, plus 0.3 KB room:

- `/ward-flow`: 608.4 → 617.0 KB (grew 8.3 KB).
- `/ward-flow/referrals`: 605.9 → 614.5 KB (grew 8.3 KB).
- `/ward-flow/ed`: 559.5 → 568.3 KB (grew 8.5 KB).
- `/ward-flow/ward/rph-adult-secure`: 648.1 → 657.0 KB (grew 8.6 KB).
- `/ward-flow/movements/WF-001`: 640.0 → 654.9 KB (grew 14.6 KB).
- `/ward-flow/ed/arm-ed`: 699.9 → 709.0 KB (grew 8.8 KB).
- `/ward-flow/bed-meeting`: 608.2 → 617.0 KB (grew 8.5 KB).
- `/ward-flow/statistics`: 655.7 → 666.6 KB (grew 10.6 KB).

`/ward-flow/capacity` needed no raise.

**Why it grew.** The one permission source (`ward-permit.ts` and `ward-permit-place-rules.ts`, D-222 and D-223) and the History category table (`ward-audit-categories.ts`) now run in the browser on every screen. Before, only the server ran them. Together they add about 8.5 KB to the shared shell. The person page also gained the History tab wording, the late rule and times that say their day. Statistics gained the figure splits.

**Trim.** No small, safe trim was found, because the growth is the rule tables themselves. A later trim could keep the place rules on the server only.
