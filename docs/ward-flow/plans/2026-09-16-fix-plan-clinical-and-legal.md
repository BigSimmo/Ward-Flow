# Fix plan — clinical and legal (WF-01/03/17/30/31/36, bed-board diagnosis) — read-only Opus planner, 16 Sept 2026, base 65aa7c54a6

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`.** Kept for history; do not follow. It was the source for that plan.

Not verified against current primary law or by a WA legal adviser. Stored Act: `data/mha-2014-sections.source.json`
(79 sections, as at 2025-09-25). **Missing from the stored copy:** s27, s30, s32–33, s38–40, s43–44, s47–54,
s57–58, s60 — so the 72h referral period (s44) and any 24h examination period after reception (s52) cannot be
confirmed from their own text.

## Key findings (verified unless marked)

- Cited sections are wrong: s34 = ward order to assess a voluntary inpatient (≤6h, s34(3)); s35 revokes it;
  s36 = referral of a voluntary inpatient; s56 = effect of a continuation order. Citations sit in
  `ward-model.ts:361-370`, `tests/ward-legal-figure-guard.test.ts:241-253`, the rulings record's recorder
  text (`owner-decisions-2026-09-16-rulings.md:41,43`, not the owner's quote at :37), and drawings
  `legal-forms-third-edition.html:646,698`, `alerts-third-edition.html:749`.
- Stored text: s41(a)(ii) referral states its own expiry; s45(4) 72h period extendable once by 72h outside
  metro (s45(6) once only); s55(1)(c)/(3) further-examination order ≤72h **from reception/detention**, not
  extendable (s55(4)); s59(1)(b) 24h period at a non-authorised place, +48h outside metro (s59(2)); s28(3)
  transport detention ≤72h metro / 144h outside.
- **Suspected:** Form 3D ("…Detention In An Authorised Hospital For Further Examination",
  data/forms-catalog.json:452-455) is the s55(1)(c) order → a clock "from when placed" starts from the
  wrong event and shows more time than remains (unsafe).
- Clocks count from `formedAt ?? openedAt` (ed-screen.tsx:2494-2585); reducer never writes `formedAt`;
  no event produces a 3D start. Receipt is single-click, stores `now`, no correction; 72h row keeps
  counting after receipt; 3D alert not suppressed after examination.
- **Suspected defect:** 4A/4C due time parsed as minute-of-day (ed-screen.tsx:431-441, dispatched :1126)
  lands on day 0 after day rollover.
- Task ledger DECISION-05/06 contain unverified legal/policy claims ("Form 4A expires in 7 days",
  "unlawful detention", "WA Health diversity guidelines").
- WF-17: single examination only; "revoked" is not a psychiatrist's order (s31 revocation is a
  practitioner's act; s55(1)(a)–(d) four orders incl. further examination).
- WF-01: WLQ-4 branch at handover_ready/moving keeps bed; Ruling 9 at `moving` would cancel a collected
  job (the defect just fixed in REFER_TO_COMMUNITY_TEAM).
- WF-30: `genderEligibility` has no caller and refuses unrecorded gender everywhere (contradicts WLQ-35);
  placement reads `movement.sex` (against §8/§9). PT-007 sex "Non-binary", no gender.
- WF-36: movement-path security gate checks only that locked beds exist (ward-eligibility.ts:160);
  referral path uses `lockedBedsFree` but `allocatableLocked` is never written — both overstate.
- WF-03: acuity tests cover capacity 1 only; **staffing overrides on pulls are not recorded**; none of
  the five OVERRIDE_REASONS mentions staffing.
- Bed board: caption `ward-board.tsx:1882-1883` falsely says the diagnosis came from a referral (a
  Referral cannot carry one; pulls write null); pinned by tests/ward-board-people-panel.dom.test.tsx:58.

## Tasks

**A. Independent of owner answers**

- T1 Remove Act section citations (model comment, guard provenance strings, two drawings; add a
  correction paragraph under Ruling 1 without editing the owner quote) + new
  `tests/ward-act-section-citation-guard.test.ts` (positive/negative controls, anti-vacuity >50 files).
  Opus reviews the guard. S.
- T2 Correct the bed-board diagnosis caption ("Any diagnosis shown is tentative: a broad category, not a
  diagnosis this ward has confirmed."). S.
- T3 `genderEligibility` follows WLQ-35 (unrecorded passes on Undesignated wards). S.
- T4 Capture when the Form 1A was written at intake (day select + HH:MM; refuse future). M.
- T5 Stop counting from ED record opening: no `formedAt` → "time written not recorded", no countdown;
  3D → "start time not recorded", no alert; mutation control. S.
- T6 Receipt needs a confirm step and a chosen receipt time (`receivedAt`, refuse future / before
  formedAt; store `legalFormReceiptRecordedAt`). M.
- T7 WF-03 multi-place and returned-place tests; record staffing overrides on pulls
  (`Override.gate`). M. Stop if ward-facing override readers would render false words.
- T8 Check the 4A/4C due-time day rollover; if reproduced reuse T4's day select. S.
- Lanes: T1, T2, T3 parallel now · Lane E: T4 → T5 → T6 → T8 → (T9|T10|T11) → T16 · Lane P: T7 → T17 ·
  Lane X: T12 → T15.

**B. WF-31 branch (owner Q1)**

- T9 (A: Ruling 1 computed clocks) — 9a stop 1A row after receipt, stop 3D alert after examination,
  "Not wired" for extensions; 9b recorded clinical justification from a list on PULL/BOOK (needs Q10;
  engine computing legal conclusions — risk); 9c 3D start instant (hand back).
- T10 (B: D5 wins) — delete FORM_* constants, rows, alerts, allowlist entries; keep receipt + count-up.
- T11 (C, recommended) — record the expiry written on the form (widen captured dueAt to 1A and 3D),
  count down to it; remove computed constants; optional single extension event (refuse a second).

**C. Other owner-dependent**

- T12 WF-01 split: Ruling 9 up to collection (cancel job, release bed/admission, close, notify ward),
  WLQ-4 after collection. Q2.
- T13 WF-30 now: capture gender at intake, carry to admission (13a), gates per the gender plan (13b),
  screens (13c). Q3.
- T14 DECISION-05 option (b) labels. Q4.
- T15 WF-17 `RECORD_REEXAMINATION` appended records + `currentExaminationDecision()`. Q5.
- T16 Receipt correction as an appended record. Q6.
- T17 WF-36 `Admission.bedKind`; secure pulls consume locked beds; refunds restore; override uses open bed.
  Q7.

## Owner questions (cost-ordered)

Q1 clocks: A computed / B none / **C record the expiry written on the form (rec)**; sub-Qs: which order is
Form 3D; keep the 24h-after-receipt figure labelled as the owner's. **Get WA legal advice before anyone
relies on it.** · Q2 WF-01: **Ruling 9 before collection, WLQ-4 after (rec)**; Q2b if WLQ-4 everywhere,
refuse collection while flagged [yes] · Q3 gender now by recording at intake (rec) — expect many
refusals/overrides because 258/259 occupants lack gender; Q3b undesignated ward + unrecorded incoming =
WLQ-36 treatment · Q4 non-binary: **(b) clinician records bed type the person chooses, (a) meanwhile**;
fix PT-007 fixture ("Non-binary" in sex, "Her") · Q5 re-examination = new record; add "further
examination ordered" outcome? · Q6 receipt correction [yes] · Q7 voluntary patients take open beds first
[yes; may be Ward Lead's call] · Q8 keep the five override reasons (WLQ-32) vs NUM consultation · Q9 FD-12
admission inherits referral's diagnosis block? · Q10 justification reasons and which acts.

## Risks

Engine computing legal conclusions (T9b; C avoids) · wrong citations re-copied from the rulings record
unless T1's correction lands · invented legal claims in ledger DECISION-05/06 · 3D/1A section mapping
suspected (key sections missing) · long-running clocks are the unsafe direction · reducer merge conflicts
(run lanes in order) · staffing overrides appearing on ward screens · routine WLQ-36 overrides if gender
is "now" · ward browser journeys not in verify:ui — record looking in SCREEN-VERIFICATION.md.
