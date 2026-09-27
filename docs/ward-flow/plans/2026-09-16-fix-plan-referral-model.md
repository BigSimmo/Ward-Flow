# Fix plan — referral model (WF-09/11/12/14/15/23, STILL-04, intake role) — read-only Opus planner, 16 Sept 2026, base 65aa7c54a6

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md`.** Kept for history; do not follow. It was the source for that plan; its R-numbers are still cited.

## Key findings (verified unless marked)

- WF-09: the ED raise form never sends a referralId; no uniqueness guard (a second open movement, or a
  withdrawn/declined ED addressing, is not refused). PULL_PATIENT writes `referralId: null` and
  `homeRegion: null` on the admission, so `admissionBelongsToTeam` is false for every runtime admission —
  a community team never sees its referred patient admitted. Tripwire: statistics-claims-register.ts
  :1211-1260 pins that null. **Intake referrals to an ED carry `purpose: "bed"` and appear on no ED list.**
- WF-11: REFER_TO_UNITS replaces the live list (dropped wards get no withdrawal entry), resets referredAt
  (rewrites ED "since referral" and ward "At …"), cap checked on the event list only; shortlist selection
  starts empty so any re-refer drops live wards.
- WF-12: community can decline but not accept; after any ward/ED acceptance the community arm can never
  answer (guards :3995, :4303) and referrer withdrawal is refused (:4394); referral-match shows nothing for
  the community arm of a mixed referral.
- WF-14: all exits close as did_not_proceed + free reason; no "admission not required" or "left before
  review" event; ED "For discharge" chip always reads none; REFER_TO_COMMUNITY_TEAM has free-text `reason`.
- WF-23: handover "declined by all" ignores acceptance (ward-derivations.ts:1232-1235), feeding handover
  and statistics; inbox "destinations declined" (:1057) same; test oracle re-implements the defect.
- WF-15: WLQ-19 later vs Ruling 16 now (Ruling 16 recorded by another tool; owner words verbatim).
  RECEIVE_REFERRAL with source ed_medical + community arm already creates a referral the team sees.
  **Do not filter teams by catchment** (Ruling Q-2 "catchment is information, never a filter").
- STILL-04: ACCEPT_REFERRAL creates no movement but tells the ward it "is now expected to receive the
  patient"; referral-board says "records the unit only" (false for ED/community).
- Intake always dispatches role "community", even for ED medical referrals.

## Tasks

Wave 1 now (separate worktrees): **R1** handover declined-by-all respects acceptance (+oracle, claims
test) S · **R3** replace "expected to receive" with "`{unit}` accepted referral `{id}`. No bed is pulled and
no movement is created." and board note "Acceptance records the decision only…" S · **R4** PULL_PATIENT
keeps referralId/patientId/homeRegion from the resolved referral; re-evidence the claims-register entry;
test through admissionBelongsToTeam M · **R5** RAISE_REFERRAL refuses a second open movement, a withdrawn or
declined ED addressing; allows re-raise after a closed journey (pins Q11) S.
Wave 2 after gemfix engine change: **R7** community arm stays answerable after ward/ED acceptance S → **R8**
referral-match community decline control (community reasons, aria-disabled until chosen, both branches) M;
**R9** intake records role "ed" for source ed_medical (EVENT_ROLE RECEIVE_REFERRAL ["community","ed"];
reducer refuses ed with other sources) S–M.
Wave 3 after wiring fold: **R2** inbox "destinations declined" respects acceptance S · **R13a**
REFER_TO_UNITS adds, never silently drops, keeps referredAt, cap on live+new; shortlist pre-selects and
locks live wards (read comment :1980-1990 first) M.
Wave 4 after Q1=Ruling 16 and R9: **R10** RECEIVE_REFERRAL `closesMovementId` creates the referral and
closes the ED journey atomically (release bed once, cancel uncollected transport, `onwardReferralId`,
remove free-text reason); test via the hub's own waiting list L → **R11** intake prefill from the ED journey
(`fromMovementId`, `teamName`) M → **R12** ED button links to intake; REFER_TO_COMMUNITY_TEAM unmounted,
not deleted S. **R12-alt** if WLQ-19: button aria-disabled "Not wired in this prototype.", panel removed.
Blocked: R6 ED inbox "request a bed from this referral" (Q10, Q12, drawing first) · R13b withdraw one
ward's request (Q6) · R14+R15 closure kind + ED dispositions (Q7) · R16 bed-purpose ED referrals on ED lists
(Q10) · R17 community accept (Q3) · R18 withdrawn acceptance classification (Q8).

## Owner questions

Q1 WF-15 Ruling 16 now, routed through the intake form [rec] · Q2 involuntary patient referred to a
community team: show legal status, no block [rec] · Q3 community team may accept (follow-up only) [yes] ·
Q4 referrer may withdraw only the community arm after a ward accepts [yes] · Q5 accepting a front-door
referral creates no movement; ship R3 wording [yes] · Q6 re-referring adds; replacing is an explicit
withdraw with a fixed reason (owner's wording) [add] · Q7 ED "For discharge" / "For community follow up" as
recorded dispositions that keep the patient on the board until they leave [yes] · Q8 withdrawn-only
acceptance is not "declined by all" [no] · Q9 intake role for police/ambulance/crisis/inter-hospital: keep
"community" for now · Q10 bed-purpose intake referrals to an ED show on its lists [yes] · Q11 new journey
allowed after an earlier one closed [yes] · Q12 ED drawing adds "Request a bed from this referral" [yes,
drawing first].

## Risks

R4 reddens the claims-register check by design and changes community-hub/statistics figures · team-name
spellings from `communityTeamOptions()` may not match hub page names (suspected) — test R10 through the hub
list · gemfix tip lacks the engine change; check before R7–R9 · existing tests encode community-role ED
referrals · Ruling 16 file carries wrong section numbers elsewhere — confirm Q1 before the L build · do not
build a catchment filter · R13a changes shortlist behaviour.
