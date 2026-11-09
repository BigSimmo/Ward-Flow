# Ward Flow backlog

<!-- last-checked: 2026-11-09 -->

_Updated 2026-11-09 - first version: one list of work, gathered from the scattered lists (Josh, 9 November 2026); Documentation owns._

**The one list of work.** Audience: Josh and every builder. Questions for Josh live in
[STATUS "Waiting on Josh"](STATUS.md#waiting-on-josh); decisions live in [decisions.md](decisions.md); the plan
is the [roadmap](roadmap.md). Built status was checked against `main` at `bd16e4adb` (9 November 2026)
by source search and merge titles. Open pull requests were not read from GitHub for this page.

One line per item, with its source. Move an item down the list as it progresses; drop an item from
**Done recently** after two weeks. Synthetic data only.

## Ideas

Not agreed. Each needs Josh's yes before anyone builds it.

- Run the pilot beside the whiteboard first, or switch straight away. ([product brief](product-brief.md#questions-only-josh-can-answer), question 3)
- Whether wards and the ED use Ward Flow on day one of a pilot, or the coordinator alone. ([product brief](product-brief.md#questions-only-josh-can-answer), question 2)
- Move hosting to Sydney (Q370). D-84 says revisit with the health service's IT before real data. ([roadmap](roadmap.md#2-pilot-readiness))
- Tier 4 items 19–23 and 25: no descriptions yet; on hold until Josh names them (D-97 item 7). ([tier plan](plans/2026-11-04-tier-improvements.md#explicit-exclusions-and-missing-information))
- Tier plan holds: I1 handover notes, item 91 monthly exports, item 97 integrations. ([tier plan](plans/2026-11-04-tier-improvements.md#explicit-exclusions-and-missing-information))
- Tools in two panes on wide desktops (Q311, "not yet"). ([Tools review](../design/reviews/2026-11-02/tools-2-nov/SUGGESTIONS.md))
- External domain review: deferred until a real need; needs spending authority (D-97 item 4). ([decisions.md](decisions.md#d-97-owner-answers-on-seven-open-items-n21-n25-n26-n29-n40-n41-and-wf-b008-8-november-2026))
- Regional multi-leg transport (D-35, deferred). ([decisions.md](decisions.md))
- September "unowned work" and "deferred" leads: unverified since 12 September; check each against source before acting. ([OPEN-QUESTIONS](OPEN-QUESTIONS.md), sections ③ and ④)
- Late-August remaining-work list: superseded by later decisions; leads only. ([history](../history/ward-flow-remaining-work.md))

## Agreed (not started)

Agreed by Josh or required by a decision, with no build or check yet.

- Legal times decision card: keep D-93 (typed times only, no countdowns) and D-72 (scrubbed offline copy) unless Josh changes them on the pending card. ([D-93](decisions.md#d-93-legal-form-times-show-only-as-typed-never-as-a-countdown-31-october-2026))
- ED next-step wording: Josh to sign off the 3, 8, 24 and 48 hour defaults before the wording is final. (owner thread, 9 November 2026)
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

## Building (with PR)

- Documentation and working-rules audit: archive moves, this backlog, stale pages (D-107). Branch `claude/project-thread-ituetd`.
- Clinical values audit (D-106). Branch `claude/project-thread-ituetd-clinical`.

## Done recently

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
