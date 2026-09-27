# Ward Flow — every decision waiting on the owner (16 September 2026)

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

Produced by a read-only Opus planner at `65aa7c54a6`; nothing run. **CONFLICT** = two recorded owner
answers disagree. **CONSULT** = check with someone outside the team. Recommendations are the planner's,
not rulings. Supersedes the quick list in `WARD-FLOW-PROGRESS-2026-09-16-NIGHT.md` §3 where they differ.

## Tier 1 — clashes and legal clocks (code already built on one side)

1. **Legal form time limits** — CONFLICT (16 Sept Ruling 1: 1A 72h from written, 24h from received,
   3D 72h; vs 23–24 Aug "just start a clock on arrival / avoid hard rules"; vs D5 no time limits).
   CONSULT. Options: (a) Ruling 1 limits as warnings that never block; (b) simple count-up from ED
   arrival; (c) Ruling 1 limits shown only after legal confirmation. **Rec (a), no section numbers,
   figures confirmed before anyone outside sees them.** Blocks WF-31, ED clocks, legal-forms drawing,
   Settings Form 1A row. Sources: owner-decisions-2026-09-16-rulings.md:14,35-49;
   owner-decisions-2026-09-15.md:55-59; plans/2026-09-16-drawings-new-look-with-rules.md:49,59;
   ward-model.ts:257-262; PROJECT-ISSUES.md:207-218 (wrongly filed as answered).
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 1.** Close to Rec (a): the app works out no
   limits itself; the clinician types the expiry written on the form; it shows as a warning that
   never blocks; WA legal advice before anyone relies on it. The ED arrival clock and the form clocks
   are separate and must never be merged.
2. **Act section numbers beside the limits** — CONSULT. Stored Act: s34 ward-ordered assessment of a
   voluntary inpatient; s36 voluntary inpatients; s56 effect of continued detention; 72h referral period
   referenced in s45(4), 24h examination in s59(1)(b) (s44, s58 not in stored copy); detention up to 72h
   metro / 144h outside (s28(3)); regional extensions s45(4) +72h, s59(2) +48h. **Rec: show none.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 3, "No Mental Health Act section numbers
   anywhere."** Matches Rec exactly.
3. **Clock start when time written is unknown** (counts from ED record opening — unsafe direction).
   **Rec: ask for time written; no countdown until entered.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 1** (his general "yes to all recommendations"
   covers this sub-detail of the legal-forms question; not separately called out).
4. **Undo "Form 1A received"** — **Rec: correction with recorded reason, original kept in history.**
   (Stopping the 72h row after receipt is a build fix.)
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 4.** Matches Rec exactly.
5. **Regional extensions** — CONSULT. **Rec: clinician records extension and new expiry; app never
   computes one.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 5.** Matches Rec exactly.
6. **Revoked exam after transport booked** — CONFLICT (WLQ-4 keep vs Ruling 9 release; both "yes to an
   AI recommendation"). **Rec: keep bed flagged; a person releases.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 6.** Matches Rec exactly; WLQ-4 wins over Ruling 9.
7. **Gender and beds** — CONFLICT (WLQ-6 later vs Ruling 5 now; 1 of 259 beds linked to a person).
   **Rec: record gender at referral and use it for the incoming patient's own check now; unknown
   refused only on single-gender wards; bay-mix waits.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 8.** Matches Rec exactly; Ruling 5 wins, narrowed
   as recommended.
8. **Non-binary patient placement (PT-007, asked 10 Sept)** — CONFLICT, CONSULT (hospital policy).
   **Rec: coordinator override with recorded reason after confirming with ward; prefer single room.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 9.** Matches Rec exactly.
9. **ED → community team referral** — CONFLICT (WLQ-19 later vs Ruling 16 now). **Rec: real referral
   reaches the team; all teams offered, patient's area team first and marked; not offered while on a
   form until examination outcome recorded.**
   ✅ **ANSWERED — owner-answers-2026-09-17.md item 14, "build now."** Matches Rec; Ruling 16 wins.
10. **Community teams cancelling transport** — **Rec: stays with coordinator and ED until teams are
    identifiable.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 24, "Yes they can" (owner's words). This
    REVERSES the Rec above** — community teams may now cancel transport they booked.

## Tier 2 — product and privacy

11. **Accepting a referral starts no journey** — **Rec: keep separate; add "start the bed journey"
    carrying legal status; approve sentence "Accepting records which unit has agreed to take this
    referral, and nothing else. No bed is pulled, no patient is moved, and no transport is arranged —
    each is a separate step."**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 15.** Matches Rec.
12. **"Change view" shows referred-ward count/names** — CONFLICT (3 Sept vs FD-23 / Ruling 10).
    **Rec: coordinators only.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 38.** Matches Rec exactly.
13. **Demo survives reload** — CONFLICT (2 Sept "reload wipes, this phase"). **Rec: keep, never save
    typed text** (implemented on the fix line — confirm).
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 36.** Matches Rec: keep, stop saving once anyone
    types free text.
14. **Diagnosis on bed board** — CONFLICT (29 Aug tentative diagnosis vs later no-diagnosis rule; no
    referral field). **Rec: fixed-list broad category, shown as "tentative".**
    ✅ **ANSWERED — owner-answers-2026-09-17.md items 12 and 13.** Matches Rec exactly.
15. **Referral history free text vs "holds no free text"** — **Rec: keep box; make every sentence
    honest.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 56** (write more realistic example referral
    histories, without faking links) plus his general "yes to all recommendations".
16. **Journey with no booked transport (DECISION-02, never asked)** — **Rec: allow with "no transport
    needed" recorded.**
    ⏳ **STILL OPEN — clarification asked 17 Sept.** This is owner-answers-2026-09-17.md item 28,
    marked **CLARIFY**: "a journey with no transport." He asked a question back; nothing is built
    until he answers.
17. **Diversion in transit (DECISION-01, never asked)** — **Rec: person records diversion; ward told;
    coordinator prompted to release or keep.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 29.** A person records the new destination and
    reason; the ward is told; the bed stays held until released by the coordinator, the ward, or the
    original referrer (owner's addition, widening the Rec).
18. **Pulled-bed reservation length / auto-release (DECISION-08, never asked)** — engine 60 min,
    Settings says 120, AI recommended 120 + auto-release, no source for "24h". **Rec: prompt at 60 min,
    never auto-release.** Note "hold" means something else in the 1 Sept ruling.
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 35, "Default to 4 hours" (owner's words).** This
    changes the Rec's 60-minute prompt to a 4-hour default; nothing is released automatically.
19. **ED 24h figure and 3-ward limit adjustable on Settings?** — **Rec: show as fixed figures with who
    set them and when.** ⚠️ The owner chose on 16 Sept to wire some Settings controls for real; this
    recommendation conflicts with that choice — ask again.
    ✅ **ANSWERED — owner-answers-2026-09-17.md items 33 and 34.** The 16 Sept choice wins over this
    Rec: ED waiting target adjustable 12–36 hours (default 24); wards referred at once adjustable 1–3
    (default 3).
20. **Queue ranking and urgent reasons** (you asked for ten reasons; six placeholders exist) — **Rec:
    review the six, add up to four; legal status does not rank by itself.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 37.** Matches Rec; Ward Lead chooses the four
    further urgent reasons ("you decide", owner's words).
21. **Admissions not starting in ED (DECISION-03)** — **Rec: community-direct next, transfers later.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 59.** Matches Rec; multi-leg regional transport
    stays out of scope.
22. **Rolling 24h vs calendar days** — **Rec: rolling 24h on live screens, calendar days in reports.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 32.** Matches Rec; release times also get a
    Today/Tomorrow chooser.
23. **High-acuity override** — minor CONFLICT (WLQ-32 reason vs Ruling 3 "with NUM consulted").
    **Rec: require a "NUM consulted" confirmation alongside the reason.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 10.** Matches Rec exactly.

## Tier 3 — housekeeping and protected actions (each needs an explicit yes; back up first)

24. **28 request slips moved to the main inbox's applied/** — **Rec: move to a Ward Flow folder, keep
    every file.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 61.** Matches Rec exactly.
25. **Protected deletions:** tests/zz-clock-probe.test.ts (delete); tests/scratch_debug_elig.test.ts
    (delete); two expect(true) cases in tests/ward-screen-overview-and-entry.dom.test.tsx:111,170 (move
    comments to a doc, replace or remove — test-deletion gate); orphaned worktree registration
    C:/Users/joshs/.codex/worktrees/39cd/ward-lead (remove, no files); D7 duplicate
    patient-search-perfected-third-edition.html (delete; keep Claude add-a-patient draft). WLQ-33 chat
    control folder already approved after fold.
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 60.** "Delete the two old scratch test files, the
    orphaned Codex worktree registration, and the duplicate Patient search drawing (back up first)."
    The owner's yes is now given; the deletions themselves are a separate, protected-deletion piece of
    work (routes to whoever owns that — this pass is records only, no src/test edits).
26. **Retire Morning screen** — the parked test's "D9" is Spec D9, not ruling D-9. **Rec: retire.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 41.** Matches Rec; its tests move to Capacity.
27. **ED hub drawing** — only emergency-department-third-edition.html exists. **Rec: confirm it.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 42.** Confirmed: the ED "third edition" is the ED
    drawing; the five extra drawings are reference only.
28. **Ruling 7 explained:** "Cancelling transport never books another vehicle or marks the patient
    ready by itself; a person does each." **Rec: agree and close.** (Code still auto-creates a replacement
    job — see engine/journey plans Q7/Q2; confirm.)
    ✅ **CLOSED — owner-answers-2026-09-17.md item 30.** "Cancelling transport while a bed is held: no
    automatic rebooking; a person books again." Closed in `owner-decisions-2026-09-16-rulings.md`
    directly. The auto-created replacement job is a separate build defect, not part of this ruling.
29. **Ruling 12** — the unmapped events and file it names don't exist. **Rec: close.**
    ✅ **CLOSED — owner-answers-2026-09-17.md item 62.** "Close the already-answered records and the
    two rulings about things that no longer exist." Closed in `owner-decisions-2026-09-16-rulings.md`
    directly.
30. **Capacity figures coordinators don't use** — **Rec: ask cold at next Capacity review.**
    ⏳ **Not among the 17 Sept answers; still open.** No owner-answers-2026-09-17.md item addresses
    this; the Rec stands unactioned.
31. **Internal patient codes in URLs** — **Rec: fine for synthetic data; re-decide before real data.**
    ✅ **ANSWERED — owner-answers-2026-09-17.md item 58.** Matches Rec exactly.

## Tier 4 — parked; one trigger: before any real patient data or real coordinator

32. Aboriginal cultural safety review; medical device / TGA status; clinical safety officer and hazard
    log (the AI cited NHS DCB0129/0160 — use Australian advice); statutory authority on legal-status
    changes (WLQ-28); real catchment data (WLQ-29, CM-4); post-incident review scope (R-B-17); regional
    multi-leg transport (WF-45). All CONSULT.
    ✅ **MOSTLY ANSWERED — owner-answers-2026-09-17.md item 63** parks the outside reviews (cultural
    safety, TGA, clinical safety officer, privacy, WA legal advice, real catchment data, post-incident
    review scope) and logs them as high priority, each due before real patient data or a real
    coordinator — see the new rows added to `docs/ward-flow-task-ledger.md` under this pass. Regional
    multi-leg transport is separately answered by **item 59**: "out of scope." ⏳ **Statutory authority
    on legal-status changes (WLQ-28) is not addressed by the 17 Sept answers and stays open.**

## Tier 5 — older small questions, one yes/no sitting

33. 10 Sept B-1, B-3, B-5, B-6, B-7, B-8, B-9, B-10, B-12; 2 Sept wording rows 3, 9, 10, 11 and the ED
    "another reason" rider; the ED-discharge check; the GP referral option.
    ⚠️ **Not individually confirmed by owner-answers-2026-09-17.md.** His general "yes to every
    recommendation, except the items he answered separately" may cover some of these, and the GP
    referral option is answered directly by **item 25** ("GP referrals: the GP is told by phone or
    letter for now; add 'GP' as a referral source"). The rest are not matched item-by-item here and
    should be verified against their original recommendation before being marked closed.

## Already answered — close these records

O-17.1 type scales (OPEN-QUESTIONS.md:56-60, PROJECT-ISSUES.md:189-190) · ED-to-community reopening
trigger (WLQ-19, now Ruling 16) · PROJECT-ISSUES "genuinely open" locked-bed override (WLQ-3), Form 4A
(WLQ-5), queued requests (WLQ-18, Ruling 14) · device copy "never ranks wards" / "no bed numbers" (R-B-04,
R-B-11) · 2 Sept LIVE rows 1, 2, 4, 5, 6, 12 · 10 Sept A-7 (WLQ-21), A-8 (D-17, WLQ-7), A-1 (D-11, Ward
Lead's delegated ruling) · R-B-16 (WLQ-14) · community O-3/O-12.3 (WLQ-20, WLQ-34..37) · ledger §3
DECISION-04 (WLQ-30), DECISION-11 (WLQ-29 / Q-2), DECISION-12 (WLQ-8), DECISION-10 (Q-8) · WLQ-38 ·
WLQ-1 vs restyle (D1–D7) · WLQ-23 (WLQ-37) · 6 Sept Q2 (WLQ-16), Q1 shape (WLQ-36).

✅ **All of the above marked closed in place, 2026-09-17**, records housekeeping per
`docs/ward-flow/owner-answers-2026-09-17.md` item 62 — each record above now carries its own closing
note, in the file it lives in, citing the ruling or WLQ that answered it. See that file's own entry
for the exact wording; nothing was deleted, only marked.

## Not covered by the planner

Owner records beyond index headings for 1, 3, 5, 8, 9, 12 Sept; B-series item-by-item; source of the
24h hold figure; git history of a rival ED drawing; Act s44/s52/s58 and Form 3D's section (not stored);
commits after `65aa7c54a6`.
