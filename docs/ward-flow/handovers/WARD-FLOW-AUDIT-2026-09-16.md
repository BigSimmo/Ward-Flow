# Ward Flow audit, 16 September 2026

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Read this before `WARD-FLOW-HANDOVER-2026-09-16-CONSOLIDATED.md`.** That handover is superseded:
its factual claims were checked against the code and many are wrong (below).

**How this was produced.** Nine read-only reviewers audited the ward line at `f44ae7369d` (engine,
screens, clinical/legal/privacy, open questions, contradictions, tests and git state, PsychSift,
tooling, and an adversarial review of the "done" claims). Two further reviewers tried to refute the
serious findings; none was refuted, six were narrowed. Every surviving finding was then re-checked at
`4f2803f49a` (20:11) and was still present. Nothing was run; every finding is from reading code.

**Fixes for the engine, the ED styles, the Settings controls and the Movements chart are being made on
`ward/audit-fixes-20260916`.** Items that depend on an owner answer are not being changed.

## 1. Waiting on the owner — nothing below is built or changed until answered

1. **Examination revoked after transport is booked.** WLQ-4 (15 Sept): do not release the bed.
   Ruling 9 (16 Sept): release it and refund capacity. The code follows WLQ-4.
2. **Legal form time limits.** Ruling 1: Form 1A 72 hours from when written, 24 hours from receipt,
   Form 3D 72 hours. WLQ-5 and restyle answer D5: no durations, no section numbers. The code now
   shows the Ruling 1 clocks.
3. **Gender and bed matching.** WLQ-6: not wired until beds link to people. Ruling 5: gender decides
   the bed now. The gender check still has no caller.
4. **Community teams cancelling transport.** Ruling 11 says yes; no event can say which community
   team is acting, so it is not built.
5. **ED referral straight to a community team.** WLQ-19: revisit later. Ruling 16: build now. A
   button was built, but it reaches no community team (section 2, item 3).
6. **The Mental Health Act section numbers** cited beside the Ruling 1 figures (s34, s36, s56) do not
   match the section titles in the stored copy of the Act, `data/mha-2014-sections.source.json`
   (s34 "Person in charge of ward may order assessment"; s36 a voluntary-inpatient referral; s56
   "Effect of order for continuation of detention"). They were written by a tool, not the owner.
7. **Rulings 7 and 12** await the explanation the owner asked for; **Ruling 13** (which ED drawing)
   and **Ruling 15** are deferred.

## 2. Confirmed defects that depend on section 1 — reported, not fixed

1. **Form 1A and 3D clocks start from the wrong moment.** The screen counts from
   `formedAt ?? openedAt`, and the reducer never writes `formedAt`, so for every referral raised in
   the app the 72-hour clock starts at ED record opening. A 1A written 30 hours earlier shows 72 hours
   left. The 3D clock uses the same base, not when the 3D was placed.
2. **The Act's regional extensions** (s45(4) and (6), s59(2) in the stored text) are not modelled, so
   a lawfully extended regional referral would show as a breach.
3. **The community-team referral creates no referral** the community team can see; the chosen team is
   written only into the closure sentence, the dropdown is not filtered by catchment, and the patient's
   legal status is not considered.
4. **"Mark Form 1A received" is one click with no undo**, and the 72-hour validity row keeps counting to
   "Expired" after receipt.
5. **Ruling 1's recorded clinical justification is not built**; the screen shows labels only.

## 3. Confirmed defects being fixed on `ward/audit-fixes-20260916`

- Duplicate, dead `case` blocks for `RECORD_LEGAL_FORM_RECEIVED` and `REFER_TO_COMMUNITY_TEAM`.
- Bed leak after a step-back, through `WITHDRAW_REFERRAL` or the community-team referral.
- The community-team referral releasing the bed of a patient already collected.
- The referrer-withdrawal cascade closing a movement without releasing its bed, admission or transport.
- Cancelling transport at `pulled` jumping the stage to `handover_ready`; the replacement job losing
  `bookedBy`.
- A ward arrival with no acting unit skipping the ward scope check.
- Form 1A receipt accepted for a movement that is not on a Form 1A.
- Seven ED style classes deleted in `8035fdfa9f` but still used; ED buttons below the 48px tap target.
- Settings controls that claim to dispatch alerts but are read by nothing.
- The Movements 48-hour chart built from hand-typed data under real seed IDs, naming Form 4B.

## 4. Records that were wrong

- `WARD-FLOW-HANDOVER-2026-09-16-CONSOLIDATED.md` names the wrong HEAD, claims a clean tree, numbers
  the rulings differently from `owner-decisions-2026-09-16-rulings.md`, marks deferred rulings (12, 13, 15) and an exploring ruling (7) as merged or done, says community teams can cancel transport (they
  cannot), gives a non-existent button id, and marks Ruling 1's override and Ruling 9's stop-transport
  UI as done (neither exists).
- The legal clocks and community referral were committed within minutes of
  `WARD-LEAD-START-HERE-2026-09-16.md` saying not to build them until the owner chose.
- 28 inbox files were moved to `docs/outstanding-issues-inbox/applied/` (`883ecfdfb4`) while
  `docs/outstanding-issues.md` is unchanged since 7 September; `check:ledger-write-discipline` is
  expected to reject that shape (read, not run).
- "Ward Flow is never pushed" is true of this line but not of all Ward Flow work: `origin/main` carries
  ward-management files from PRs #2140, #2289, #2597 and #2654.

## 5. Branch-level facts

- The ward line lacks **eleven** migrations `origin/main` has, and adds none. Anything that touches
  `origin/main` must not be a replacement.
- `ward/restyle-drawings-20260916` and `ward/lead-fixes-20260914` are folded into
  `ward/audit-fixes-20260916` (`2a63854057`, `49aba2926b`).
