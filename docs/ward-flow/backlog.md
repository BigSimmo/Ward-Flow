# Ward Flow backlog

<!-- last-checked: 2026-11-10 -->

_Updated 2026-11-10 - D-108 items moved to Done, Q344, Q383 and Q384 given a home (D-121); first version 9 November 2026 (Josh); Documentation owns._

**The one list of work.** Audience: Josh and every builder. Questions for Josh live in
[STATUS "Waiting on Josh"](STATUS.md#waiting-on-josh); decisions live in [decisions.md](decisions.md); the plan
is the [roadmap](roadmap.md). Built status was checked against `main` at `bd16e4adb` (9 November 2026)
by source search and merge titles. Open pull requests were not read from GitHub for this page.

One line per item, with its source. Move an item down the list as it progresses; drop an item from
**Done recently** after two weeks. Synthetic data only.

## Ideas

Not agreed. Each needs Josh's yes before anyone builds it.

- Whether wards and the ED use Ward Flow on day one of a pilot, or the coordinator alone. ([product brief](product-brief.md#questions-only-josh-can-answer), question 2)
- Move hosting to Sydney (Q370). D-84 says revisit with the health service's IT before real data. ([roadmap](roadmap.md#2-pilot-readiness))
- Tier 4 items 19–23 and 25: no descriptions yet; on hold until Josh names them (D-97 item 7). ([tier plan](plans/2026-11-04-tier-improvements.md#explicit-exclusions-and-missing-information))
- Tier plan holds: I1 handover notes, item 91 monthly exports, item 97 integrations. ([tier plan](plans/2026-11-04-tier-improvements.md#explicit-exclusions-and-missing-information))
- Tools in two panes on wide desktops (Q311, "not yet"). ([Tools review](../design/reviews/2026-11-02/tools-2-nov/SUGGESTIONS.md))
- External domain review: deferred until a real need; needs spending authority (D-97 item 4). ([decisions.md](decisions.md#d-97-owner-answers-on-seven-open-items-n21-n25-n26-n29-n40-n41-and-wf-b008-8-november-2026))
- Regional multi-leg transport (D-35, deferred). ([decisions.md](decisions.md))
- Silent data loss gaps A and C: say how many waiting saves the session limit dropped, and a frozen hidden tab (audit M8). Gap B, sign-out inside an Undo window, is fixed by D-125. ([evidence](evidence/2026-11-10-silent-data-loss-paths.md#gaps-left-for-josh))
- Merge the ED strip into the Home stage card as one chip row, option A (Q344, asked 3 November, not answered). ([design handover](../design/handover/README.md#q327-to-q349-design-system-and-home-flow-2-to-3-november-2026))

## Leads to verify

Old lists that may still hold open work. Check each item against source before acting on it.

- September "unowned work" and "deferred" leads: unverified since 12 September. ([OPEN-QUESTIONS](OPEN-QUESTIONS.md), sections ③ and ④)
- Late-August remaining-work list: superseded by later decisions. ([history](../history/ward-flow-remaining-work.md))

## Agreed (not started)

Agreed by Josh or required by a decision, with no build or check yet.

- Clinical values still synthetic (six added since D-63, four more under D-106) need a sourced value and Josh's signature. ([clinical-values.md](clinical-values.md))
- Review the per-client sign-in limits before any real user signs in (D-97 item 6, WF-B008). ([decisions.md](decisions.md#d-97-owner-answers-on-seven-open-items-n21-n25-n26-n29-n40-n41-and-wf-b008-8-november-2026))
- Desk walk, part 2: Patient, movement and referral detail pages, break glass, cover, the phone layout and the shared signed-in server. ([desk walk](evidence/desk-walk-2026-11-08.md))
- First load in a new tab still holds the coordinator's figures in the server HTML until the desk cookie is set. ([desk walk](evidence/desk-walk-2026-11-08.md#follow-up-fixes-9-november-2026))
- Infrastructure: isolated staging, monitoring and alerts, backup and restore, app-plus-data rollback, rate limits and account revocation, each with Ward-only acceptance evidence. ([production readiness](governance/PRODUCTION-READINESS.md))
- Real-data gate: every item in the go/no-go checklist, signed by people outside this repository (D-87). ([REAL-DATA-GO-NO-GO](governance/REAL-DATA-GO-NO-GO.md))
- Outside reviews before a pilot: TGA, clinical safety officer, privacy, WA legal advice on forms, approved reference data, post-incident review. ([roadmap](roadmap.md#2-pilot-readiness))
- Live acceptance of shared save, reload, conflict and recovery with real test accounts, under a bounded spend. ([live audit handoff](../history/ward-flow/live-audit-handoff-2026-11-06.md#remaining-acceptance-work))
- Tier operations acceptance: downtime wording, licence exceptions, alert contacts, NVDA, VoiceOver and physical devices. ([tier operations](plans/2026-11-04-tier-operations.md#owner-acceptance-checklist))
- iPhone and iPad Safari on a real device. ([known issues](pilot/known-issues.md))
- Unknown counts after a partial load (audit M6): when partial data loads can really happen, show "unknown" instead of "0 beds ready" for the missing wards. Not built now (D-125 item 4). ([decisions.md](decisions.md#d-125-top-10-audit-follow-ups-approved-10-november-2026))
- **Master stress test, after the demo (D-215, D-216, 14 November 2026).** Full list: `master-stress-test/run/not-fixed-tonight.md` in the project files; the 133 no-sign-off recommendations are in `master-stress-test/pack/recs/`. Built after the demo:
  - One figure dictionary as the only source of each figure (R-FIGS-9), including the three "needing a bed" figures (REG2-5); split average stay into completed stays and stay so far (R-FIGS-16, RV2-15); "Left today" and "Expected to leave today" labels everywhere (rest of R-FIGS-12). ([decisions.md](decisions.md#d-216-the-36-sign-off-recommendations-from-the-stress-test-pack-14-november-2026))
  - One permission source for screen and server (R-STRUCT-1).
  - Every save writes one History line naming the desk that acted (R-STRUCT-5; rest of LG-6, A2-4, R5-3). ([decisions.md](decisions.md#d-215-stress-test-answers-for-after-the-demo-14-november-2026))
  - One definition of a late arrival, on every desk, with the bell and Act now (R-HOME-9, R-MOVE-6, R-MOVE-7).
  - Statistics windows and their starts in Perth time, in the definitions; am/pm on screen with the 24-hour clock in printed legal times.
  - Form 3E: decide whether it ends the order; until then warn only.
  - Patient pages' other `clock()` lines that can show a time without its day; the Board time label in letters and prints (`ClockZoneLabel`); the remaining "Synthetic prototype" badge and markers (R-STYLE-20).
  - The 7-day discharge-plan prompt in the shared inbox (bell, Act now, Alerts), not only ward Home.
  - Planned-admission arrival with an old bed count: an override reason (third refusal of R-STRUCT-4). The Midland sample page's Decline and its 5-minute Undo.
  - Undo after the community "Ask more wards" card (a new undo event), and on the override and gender-reason refer routes.
  - Site bed manager and nurse in charge rails: a network bed line (RV2-16; reconcile D-197 item 10 with the 30 October rail rule).
  - Short-lived glitches: the start-of-day flash after a reload (A2-1), the header after Mark handover ready (REG2-6), Add a reason when closing a bed (AC1-4), an overfull demo day dropped with no reason (RV2-18).
  - One bed count marker ("Checked 10:22 · 1h 15m old", `ward-bed-count-marker.ts`) placed on the ward card, hero pill, Count old chip, Find a ward and the planned-admission drawer, with an Ask control (R-BEDS-1, R-BEDS-3); a seclusion room "Check" tag after a signed time (R-STRUCT-37); the "Discharges today" naming split (R-FIGS-12); remaining "past 24 hours" sentences to "over 24 hours".
  - Wording rulings (D-218, Josh 14 Nov 2026), to follow when each item is built. Remove, do not build: R-BEDS-11, R-LEGAL-9, R-LEGAL-14, R-FIGS-2 (count line), R-FIGS-10, R-FIGS-14, R-MOVE-9, R-STRUCT-41, R-STRUCT-50, R-STRUCT-14. No who-does-it line (D-192 hides the button): R-BEDS-2, R-LEGAL-15, R-STRUCT-2. A one-word label or tooltip only: R-BEDS-5, R-FIGS-3, R-FIGS-11, R-FIGS-15, R-FIGS-18, R-HOME-15, R-HOME-23, R-STRUCT-30 (short empty states, such as "No patients waiting"), R-STRUCT-48 (show once, then dismiss). Keep one short line: R-BEDS-14, R-MOVE-4, R-MOVE-14, R-STYLE-17 (a refusal says why and what to do next), R-HOME-8 (a brief confirmation after Acknowledge or Snooze), R-STRUCT-46 and R-STRUCT-47 (a plain warning before Pause or Reset). Reasons: `master-stress-test/pack/design-backlog.md` and `pack/recs/` in the project files.
  - Clinical sitting: gender recording on the ED board (RV2-19), "Involuntary bed requested" before status is set (LG-9), single-sex "Review" marks (RV2-10).
  - Worked-example seed data (RD-05 waitlist, D1a-E-1, Lead-VM-1); size, type and icon polish (FIT-2, V1-2, V1-3); test gaps DP5-1, DP5-2, DP5-6; nightly browser checks and the screenshot baseline (Lead-P1-1).

## Building (with PR)

- Second rules and docs audit: documentation fixes, guards and history moves (D-121). Branch `claude/ituetd-audit2`.
- Clinical and privacy answers (D-122): one held clinical PR, merged only after Josh checks it.

## Done recently

- Documentation and working-rules audit (D-107, #1555) and clinical values audit (D-106, #1556).
- Legal times kept as typed with no countdowns (D-93), and the outage copy stays print or saved file only (D-72); ED long-wait next steps worded (D-108, #1560).
- Q383 (check the Railway front-door settings before #1345 merged): not kept as open work; #1345 merged.
- Ward risk flags on bed requests (D-117 item 3): the ward's request card now reads the referrals sent to that ward (its inbox, FD-23), and shows "Plan staffing for this arrival" when the referral records aggression or absconding. Movement and referral only, never the patient record (R-2026-09-04-A). ([decisions.md](decisions.md#d-117-care-plans-follow-up-frequent-presenter-count-tribunal-date-and-ward-flags-10-november-2026))
- Q384 done: `Ward Flow hold` has been a required check in the "Protections" ruleset since 3 November, so the `hold` label blocks merges (audit A8-08). ([design handover](../design/handover/README.md#q382-to-q389-threads-started-3-november-2026))

Merged into `main` in the last two weeks (26 October to 9 November 2026).

- D-80 item 17: a coordinator gives an "on behalf of the ward" reason before opening a ward's clinical record (`24e75284`).
- D-80 item 14: Governance record-view review and the Access log in Settings (approved 31 October).
- Triage and risk form, with webPSOLIS pick-lists (#1500, #1502, #1504, #1542).
- Named bed counts as pulled, never also waiting (D-96, #1506).
- Friction pass: Quick bar, Patient peek and Ward peek (D-98, #1549).
- Desk walk fixes: community Waiting closed by address; server page held until the desk is known (`a7e35bf19`).
- Tools overhaul for every desk, including Remind me, Messages and Due back from leave (Q308–Q326, #1316, #1323, #1488).
- Bed meeting agenda, actions and TV boards (#1348, #1389).
- One page scroll, and a click outside closes a drawer (D-95, #1322).
- One right-hand drawer across the main screens (#1495, #1497).
- Site lock fails closed with a 12-character demo code (#1345).
- Home's Today's review replaces Registers (#1551); Home redesign (#1546, #1552).
- Help: 52 how-to guides and 15 screen questions (#1525).
