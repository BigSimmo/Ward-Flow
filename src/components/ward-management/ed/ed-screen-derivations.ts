// What the ED screen derives from the records on every render: who is on the board, the lists,
// the counts, the Needs you items and the hero chips. Split out of `ed-screen.tsx` unchanged (fix
// list 2.5 and 9.6, 15 Oct 2026). A plain function, not a hook: `EdScreen` calls it after its early
// return, exactly where this code used to run.
import { edHasNoBedYet } from "@/components/ward-management/ed/ed-no-bed";
import { isEdOriginJourney, isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { stageCopy, deriveNextWardsAfterRefusal } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { Movement } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edAnsweredReferralsFor, edArrivedFor, edExpectsFor } from "@/components/ward-management/ward-referrals";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LATE_ARRIVAL_GRACE_MINUTES,
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import type { EdNeedsItem } from "./ed-needs-you";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { activeTaskItems, inboxItemsForRole } from "@/components/ward-management/ward-act-now-items";
import {
  ANSWERED_VISIBLE_CAP,
  bayText,
  edBayAssignments,
  type EdStepEvent,
  isEdInitiatedWithdrawal,
  movementMedicalClearance,
  seedBayNumber,
  waitLine,
} from "./ed-screen-model";
import { edDepartmentTimelineEvents, formatTimelineExamOutcome, type TimelineEvent } from "./ed-screen-timeline";

type PriorityFlag = {
  tone: "danger" | "warn" | "good" | "quiet";
  kind: string;
  recordId: string;
  // Owner, 26 Sept 2026: set only for a movement-sourced flag, so the row can name the patient
  // instead of the WF journey number. Left undefined for a referral-sourced flag below, whose
  // `recordId` is a referral id, not a movement id, and out of this change's scope.
  personName?: string;
  meta: string;
  why: string;
  when: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function deriveEdScreen({
  movements,
  units,
  referrals,
  registryPatients,
  configuration,
  inboxSnoozes,
  admissions,
  now,
  accessTarget,
  thisEdId,
  boardFilter,
  patientQuery,
  patientSort,
  heroHighlight,
  selectedPatientId,
  arrivalPlanOpenFor,
  setSelectedPatientId,
  setPhoneSheetFor,
  setArrivalPlanOpenFor,
  toggleBookTransport,
  recordEdStep,
}: {
  movements: WardFlowContextValue["movements"];
  units: WardFlowContextValue["units"];
  referrals: WardFlowContextValue["referrals"];
  registryPatients: WardFlowContextValue["patients"];
  configuration: WardFlowContextValue["configuration"];
  inboxSnoozes: WardFlowContextValue["inboxSnoozes"];
  admissions: WardFlowContextValue["admissions"];
  now: Instant;
  accessTarget: number;
  thisEdId: string;
  boardFilter: "all" | "not_reviewed" | "under_form" | "no_destination" | "discharge" | "withdrawn";
  patientQuery: string;
  patientSort: string;
  heroHighlight: string | null;
  selectedPatientId: string | null;
  arrivalPlanOpenFor: string | undefined;
  setSelectedPatientId: (value: string | null) => void;
  setPhoneSheetFor: (value: string | undefined) => void;
  setArrivalPlanOpenFor: (value: string | undefined) => void;
  toggleBookTransport: (movementId: string) => void;
  recordEdStep: (event: EdStepEvent) => void;
}) {
  // Ward-origin transfers are excluded even if routing retains an ED id. Transit rows remain
  // accountable to this board; physical ED wait figures use isWaitingInEd separately.
  // Its own patients only, and only while still open — an arrived or otherwise closed movement
  // has left the department (see `isOpen`'s own doc comment). This is THIS DEPARTMENT'S OPEN
  // MOVEMENTS: everyone it is still accountable for until they reach a ward, INCLUDING patients
  // already collected by transport and in transit. It is not a historical log.
  //
  // 🔴 THIS READ "who is here now" UNTIL 2026-09-07 AND THE PREDICATE NEVER MATCHED IT. `moving`
  // is admitted, and two seeded movements sit at that stage — so the comment claimed physical
  // presence for patients already in an ambulance. Both this chat and another stopped rather than
  // guess, because making the comment match the code legitimises a possibly-wrong count while
  // making the code match the comment changes a clinical population without authority.
  //
  // ✅ THE OWNER RESOLVED IT BY REJECTING THE QUESTION: the count is a real operational population
  // and only the WORDS were wrong. So the comment moved and THE PREDICATE IS UNTOUCHED.
  //
  // 🔴 DO NOT NARROW THIS FILTER. Dropping `moving` to make the screen literally "who is standing
  // here" would take a patient off the board of the department still accountable for them during
  // transit — the most fragile part of the journey, and the one where a failed transfer comes
  // straight back to this department. **An inflated count is a number that is wrong; a vanished
  // patient is a person nobody is watching.**
  //
  // ⚠️ THAT WARNING CAME FROM THE OTHER CHAT AND THIS ONE DID NOT HAVE IT. Both of us wrote a
  // correct fix for the same false sentence, in the same file, within hours; git raised a conflict
  // and the conflict is why the warning survived. Had either version merged cleanly over the
  // other, one of two true things would have been lost silently — and the half that would have
  // gone is the half that tells the next person what not to do. **Two correct fixes for one defect
  // are not interchangeable; the union of them is what either author actually wanted.**
  //
  // ⚠️ Worth keeping as a shape: "the code or the comment?" is a false pair when one of them is a
  // clinical population somebody relies on. The comment is cheap and the population is not, so the
  // burden of proof sits on changing the predicate — and neither chat could discharge it. Stopping
  // was right; the escalation was avoidable only because a third reading existed that neither of us
  // had, which is exactly what an owner is for.
  //
  // ⚠️ And the reusable half, named by the other chat: **a defect that touches a model field is not
  // thereby a model decision.** The field did not have to move for the sentence to become true.
  // Owner answer 19 (2026-09-17) / RB3: ED "For discharge" and "For community follow-up" are recorded
  // outcomes that keep the patient on the board until they physically leave the department.
  // Ward Lead audit (2026-09-17): `isEdInitiatedWithdrawal` widens this from "an ED outcome keeps
  // a closed movement here" to also keep an ED-initiated `WITHDRAW_REFERRAL` — this department's
  // own decision, so it stays accountable for it — while a coordinator-driven revocation or any
  // other closure stays off the board exactly as before.
  const patients = movements.filter(
    (movement) =>
      isEdOriginJourney(movement) &&
      movement.originEdId === thisEdId &&
      movement.stage !== "arrived" &&
      (!movement.closure ||
        (movement.edOutcome !== undefined && !movement.leftDepartmentAt) ||
        isEdInitiatedWithdrawal(movement)),
  );
  const bayById = edBayAssignments(patients);
  const patientBay = (id: string) => bayById.get(id) ?? bayText(seedBayNumber(id));

  /**
   * THE INBOX. Two fields, never one — `edId` AND `purpose`.
   *
   * ⚠️ A ward→ED medical notification carries the SAME `edId` as psychiatry's own review request:
   * both are about a patient in this department, raised by parties at this hospital. `purpose` is
   * the only thing keeping them apart, and `originSiteCode` — the inference that looks right and is
   * wrong on exactly this case — is not read here or in `edReferralsFor`.
   */
  /**
   * 🔴 THE INBOX IS NOW THE PEOPLE WHO ARE HERE, AND THE EXPECTS ARE THE PEOPLE ON THE WAY.
   *
   * Product owner, 2026-09-07: *"When a patient is referred to the ED and not in the ED then they
   * are an expect. If they are referred within the ED, they are put on the Referrals."* and *"When
   * expects arrive and are marked as arrived, they become referrals."*
   *
   * ⚠️ **THE FILTER ON `inbox` IS A BEHAVIOUR CHANGE, NOT A TIDY-UP.** Before today this list held
   * every queued referral addressed to this team, whether or not the patient was in the building —
   * and the paragraph under its own heading already said *"a person who is not in the department yet
   * has no department clock at all"*. **The concept was in the prose and absent from the structure.**
   *
   * The two lists read the SAME predicate from opposite sides — `hasArrivedInDepartment` — rather
   * than each spelling out its own rule. Two filters spelling one rule is how two lists come to
   * disagree about who is in the building, and `tests/ward-ed-expects-derivation.test.ts` pins the
   * partition: nobody in both, nobody in neither.
   */
  /*
   * 🔴 `edArrivedFor`, NOT `edReferralsFor(...).filter(...)` — AND THE DIFFERENCE WAS A PATIENT ON
   * NEITHER LIST. `edReferralsFor` is a worklist admitting `queued` only, while `edExpectsFor`
   * admits `queued` AND `accepted`. So an ACCEPTED referral whose patient had arrived left Expects
   * (they are here) without entering Referrals (not queued) — invisible to the department treating
   * them, one click after "Mark arrived". The two lists now take ONE population and one predicate
   * from opposite sides, so the partition holds by construction rather than by two filters somebody
   * has to keep in step.
   */
  const inbox = edArrivedFor(referrals, thisEdId, "psychiatric_review");
  const rawExpects = edExpectsFor(referrals, thisEdId, "psychiatric_review");
  const expects = [...rawExpects].sort((a, b) => {
    const etaA = movements.find((m) => m.referralId === a.referral.id)?.transport?.estimatedAt;
    const etaB = movements.find((m) => m.referralId === b.referral.id)?.transport?.estimatedAt;
    if (etaA !== undefined && etaB !== undefined) {
      return etaA - etaB;
    }
    if (etaA !== undefined) return -1;
    if (etaB !== undefined) return 1;
    return a.referral.raisedAt - b.referral.raisedAt;
  });

  /**
   * RECENTLY ANSWERED — owner ruling 7, 2026-09-01. A clinician who declines a referral watches the
   * row vanish from the inbox above the moment they answer it, because that list is a worklist
   * (`edReferralsFor`'s own `queued` scoping). Without this, there is no undo, no record on this
   * screen, and nothing to check a mistake against. `edAnsweredReferralsFor` is the second selector
   * that scoping requires — see its own doc comment for why it cannot be a parameter on
   * `edReferralsFor` instead.
   */
  const answeredAll = edAnsweredReferralsFor(referrals, thisEdId, "psychiatric_review");
  /**
   * `edAnsweredReferralsFor` returns them sorted by `decidedAt` DESCENDING, so slicing from the
   * front takes the ten most RECENT rather than an arbitrary ten. That ordering is load-bearing for
   * this cap, and `tests/ward-ed-answered-cap.dom.test.tsx` names the three oldest rows and asserts
   * their absence — so a selector that stopped sorting would fail there rather than quietly
   * showing ten of the wrong rows, which renders identically to ten of the right ones.
   *
   * ⚠️ AN UNDATED DECISION IS DROPPED FIRST, AND THAT IS THE INTENDED ORDER. The selector
   * sorts a missing `decidedAt` to `-Infinity`, so a row with no decision time sinks below every
   * dated one. Right, because nothing can be claimed as recent without a time — but it does mean
   * such a row leaves this list once ten dated decisions exist. The referral is untouched; only
   * this view of it is limited.
   */
  const answered = answeredAll.slice(0, ANSWERED_VISIBLE_CAP);

  /**
   * THE OUTBOX: patients this team referred onward who are STILL HERE.
   *
   * Filtered from `patients` above rather than from `movements` again, so it inherits that array's
   * own definition of who is present (this department's, still open, not yet arrived) instead of
   * restating it — two filters spelling one rule is how two lists come to disagree about who is in
   * the building.
   *
   * `acceptedUnitId` is the marker for "referred on and taken", and it is set from
   * `accepted_awaiting_bed` onward. A patient whose placement is still being requested or reviewed
   * has not been referred onward yet, and one who has `arrived` has left — `patients` already
   * excludes them. **No stage is treated as finished with**: a pulled bed and a booked handover are
   * both still jobs this team owes.
   */
  // P3-3 (Ward Lead audit, 2026-09-17): `!movement.closure` alongside the existing
  // `acceptedUnitId !== undefined` check — defence in depth for `RECORD_ED_OUTCOME`'s P1-4 fix
  // (`ward-flow-reducer.ts`), which now clears `acceptedUnitId` on outcome. A closed movement
  // belongs on the board (RB3's own reasoning at `patients` above) but never in "still to be
  // moved" — nothing is still moving it anywhere.
  const outbox = patients.filter((movement) => movement.acceptedUnitId !== undefined && !movement.closure);

  // P3-1 (Ward Lead audit, 2026-09-17): `&& !m.edOutcome` on both chips below. A patient whose ED
  // outcome is already recorded has a settled answer — "for discharge" or "for community
  // follow-up" — not an unreviewed or destination-less one; before this fix a discharged patient
  // still on the board (RB3's own reasoning above) kept inflating both counts.
  // Withdrawn (see `isEdInitiatedWithdrawal` above) also excluded from every chip below: it is
  // closed, so "reviewed", "under a form" and "has a destination" are questions about a bed search
  // that no longer exists. It gets its own chip instead.
  const notReviewedCount = patients.filter((m) => !m.examination && !m.edOutcome && !isEdInitiatedWithdrawal(m)).length;
  // P3-2 (Ward Lead audit, 2026-09-17): `!!m.legalForm` only. `legalStatus` is a clinical
  // classification (e.g. "Voluntary"), not a form under section — `!!m.legalStatus` counted every
  // voluntary patient as "under a form", which none of them are.
  const underFormCount = patients.filter((m) => !!m.legalForm && !isEdInitiatedWithdrawal(m)).length;
  // S-19 (audit 13 Oct 2026): one rule with the hero's "No bed yet" (`edHasNoBedYet`).
  const noDestCount = patients.filter(edHasNoBedYet).length;
  // F7 (Opus adversarial review, 2026-09-17): this used to count `closure?.outcome ===
  // "did_not_proceed"`, which matches EVERY reason a journey closed without an admission —
  // including a community referral (`edOutcome: "for_community_follow_up"`) — not specifically a
  // discharge. "For discharge" now means exactly what its own label says: `edOutcome ===
  // "for_discharge"`, the outcome only `RECORD_ED_OUTCOME` writes.
  const dischargeCount = patients.filter((m) => m.edOutcome === "for_discharge").length;
  // Ward Lead audit (2026-09-17): the "Withdrawn" chip's own count.
  const withdrawnCount = patients.filter(isEdInitiatedWithdrawal).length;

  // v10 rule 5: the board filters and the search highlight and dim. Every person stays on the board.
  const matchesBoardFilter = (m: Movement) => {
    if (boardFilter === "not_reviewed") return !m.examination && !m.edOutcome && !isEdInitiatedWithdrawal(m);
    if (boardFilter === "under_form") return !!m.legalForm && !isEdInitiatedWithdrawal(m);
    if (boardFilter === "no_destination") return edHasNoBedYet(m);
    if (boardFilter === "discharge") return m.edOutcome === "for_discharge";
    if (boardFilter === "withdrawn") return isEdInitiatedWithdrawal(m);
    return true;
  };
  const matchesPatientQuery = (movement: Movement) => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return true;
    const person = resolveSubjectPatient(movement, { patients: registryPatients, referrals, movements });
    return `${person.displayName} ${person.umrn}`.toLowerCase().includes(q);
  };
  const heroHighlightMatch: Record<string, (m: Movement) => boolean> = {
    past: (m) => isWaitingInEd(m) && now - m.openedAt >= accessTarget,
    severe: (m) => isWaitingInEd(m) && now - m.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES,
    no_bed: edHasNoBedYet,
    under_form: (m) => !!m.legalForm && !isEdInitiatedWithdrawal(m),
  };
  const boardMatchCount = patients.filter((m) => matchesBoardFilter(m) && matchesPatientQuery(m)).length;
  const isBoardRowDim = (m: Movement) =>
    !matchesBoardFilter(m) ||
    !matchesPatientQuery(m) ||
    (heroHighlight !== null && !(heroHighlightMatch[heroHighlight]?.(m) ?? true));

  const visiblePatients = [...patients].sort((a, b) => {
    if (patientSort === "longest") return a.openedAt - b.openedAt;
    if (patientSort === "name")
      return resolveSubjectPatient(a, { patients: registryPatients, referrals, movements }).displayName.localeCompare(
        resolveSubjectPatient(b, { patients: registryPatients, referrals, movements }).displayName,
      );
    return 0;
  });

  const selectedPatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null;
  const selectedPatientInfo = selectedPatient
    ? resolveSubjectPatient(selectedPatient, {
        patients: registryPatients,
        referrals,
        movements,
      })
    : null;

  const awaitingReviewPatients = patients.filter((m) => !m.examination && !m.edOutcome && !isEdInitiatedWithdrawal(m));
  const clearedPatients = patients.filter((m) => movementMedicalClearance(m, referrals)?.cleared === true);
  const underFormPatients = patients.filter((m) => !!m.legalForm && !isEdInitiatedWithdrawal(m));

  const priorityFlags: PriorityFlag[] = [];
  // Top 25 item 3: names the eligible wards nobody has asked yet. The
  // coordinator refers from the shortlist, so this only tells the department who is next.
  const nextWardsSentence = (m: Movement) => {
    const names = deriveNextWardsAfterRefusal(m, units, now)?.candidates.map((c) => c.unit.name) ?? [];
    return names.length === 0 ? " No other eligible ward is left to ask." : ` Next eligible: ${names.join(", ")}.`;
  };
  for (const m of patients) {
    const flagPatientInfo = resolveSubjectPatient(m, {
      patients: registryPatients,
      referrals,
      movements,
    });
    if (m.legalForm?.dueAt !== undefined && m.legalForm.dueAt < now) {
      priorityFlags.push({
        tone: "danger",
        kind: "Form expiry passed",
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `Form ${m.legalForm.code} passed its deadline at ${formatInstantWithDay(m.legalForm.dueAt, now)}. The movement stands at ${stageCopy[m.stage].label.toLowerCase()}.`,
        when: `passed ${splitDuration(Math.max(now - m.legalForm.dueAt, 0))} ago`,
        actionLabel: "Renew or discharge the form",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    // Walkthrough code-read, 25 Sept 2026: only once the bed is pulled (before that no bed is held and
    // the booking panel stays shut), and never when "no transport needed" is recorded.
    if (m.stage === "pulled" && !m.transport && (m.transportNeed?.needed ?? true) !== false) {
      priorityFlags.push({
        tone: "warn",
        kind: "Transport not booked",
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.acceptedUnitId ? (units.find((u) => u.id === m.acceptedUnitId)?.name ?? m.acceptedUnitId) + " holds the bed" : "A bed is held"} and no transport is booked. The handover cannot be marked ready until it is.`,
        when: `waiting ${splitDuration(Math.max(now - m.openedAt, 0))}`,
        actionLabel: "Book transport",
        onAction: () => toggleBookTransport(m.id),
      });
    }
    if (
      m.declines &&
      m.declines.length > 0 &&
      !m.acceptedUnitId &&
      (!m.referredUnitIds || m.referredUnitIds.length === 0)
    ) {
      priorityFlags.push({
        tone: "warn",
        kind: "Every ward asked has declined",
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.declines.length} ${m.declines.length === 1 ? "ward has" : "wards have"} declined and no ward has been asked since.${nextWardsSentence(m)}`,
        when: "declined",
        actionLabel: "Ask another ward",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    if (m.stage === "accepted_awaiting_bed") {
      priorityFlags.push({
        tone: "good",
        kind: "Acceptance received",
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.acceptedUnitId ? (units.find((u) => u.id === m.acceptedUnitId)?.name ?? m.acceptedUnitId) : "Unit"} has accepted this person. The bed has not been pulled, so they are still in the department.`,
        when: `waiting ${splitDuration(Math.max(now - m.openedAt, 0))}`,
        actionLabel: "Open patient",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    if (m.stage === "moving") {
      priorityFlags.push({
        tone: "quiet",
        kind: "Left the department",
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.acceptedUnitId ? (units.find((u) => u.id === m.acceptedUnitId)?.name ?? m.acceptedUnitId) : "Unit"} is expecting this person. The department's part is done.`,
        when: "in transit",
        actionLabel: "Open patient",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    if (isArrivalLate(m, now) && m.arrivalDetails?.estimatedArrivalAt !== undefined) {
      const estimatedArrivalAt = m.arrivalDetails.estimatedArrivalAt;
      priorityFlags.push({
        tone: "danger",
        kind: "Arrival late",
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `Estimated ward time was ${arrivalEtaLabel(estimatedArrivalAt, now)}. More than ${LATE_ARRIVAL_GRACE_MINUTES} minutes have passed (${OPERATIONAL_DEFAULT_LABEL}) and they have not been marked arrived.`,
        when: `late ${splitDuration(Math.max(now - (estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES), 0))}`,
        actionLabel: "Update arrival plan",
        onAction: () => setArrivalPlanOpenFor(m.id),
      });
    }
    if (m.originEdId === thisEdId && isWaitingInEd(m) && now - m.openedAt > LONG_WAIT_MINUTES) {
      priorityFlags.push({
        tone: "quiet",
        kind: `Waiting ${LONG_WAIT_TEXT}`,
        recordId: m.id,
        personName: flagPatientInfo.formalName,
        meta: `${m.cohort} · ${urgencyTierLabel(m.urgency)}`,
        why: `Waiting in the emergency department for ${splitDuration(now - m.openedAt)}, over ${LONG_WAIT_MINUTES / 60} hours (${OPERATIONAL_DEFAULT_LABEL}).`,
        when: `waiting ${splitDuration(now - m.openedAt)}`,
      });
    }
  }

  for (const { referral } of inbox) {
    const waited = Math.max(0, now - referral.raisedAt);
    if (waited > 60) {
      priorityFlags.push({
        tone: "warn",
        kind: "Referred and not yet seen",
        recordId: referral.id,
        meta: `${referral.ageBand} · ${urgencyTierLabel(referral.urgency)}`,
        why: "This department referred this person to psychiatry and no review has been recorded.",
        when: `waiting ${splitDuration(waited)}`,
      });
    }
  }

  for (const { referral } of expects) {
    const waiting = Math.max(0, now - referral.raisedAt);
    if (waiting <= 60) {
      priorityFlags.push({
        tone: "quiet",
        kind: "Expected within the hour",
        recordId: referral.id,
        meta: `${referral.ageBand} · ${urgencyTierLabel(referral.urgency)}`,
        why: `Referred ${splitDuration(waiting)} ago. Waiting for arrival in department.`,
        when: `waiting ${splitDuration(waiting)}`,
        actionLabel: "Mark arrived in department",
        onAction: () => {
          recordEdStep({
            type: "RECORD_ARRIVED_IN_DEPARTMENT",
            role: "ed",
            now,
            referralId: referral.id,
          });
        },
      });
    }
  }

  const PRIORITY_TONE_RANK: Record<string, number> = { danger: 0, warn: 1, good: 2, quiet: 3 };
  priorityFlags.sort((a, b) => PRIORITY_TONE_RANK[a.tone] - PRIORITY_TONE_RANK[b.tone]);

  const timelineEvents = edDepartmentTimelineEvents({ movements, units, referrals, registryPatients, thisEdId, now });

  // One movement's recorded journey, newest first. The record dialog and the board's
  // expanded row both read this, so the two never disagree.
  function journeyEventsFor(subject: Movement): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    events.push({
      min: subject.openedAt,
      tone: "quiet",
      what: "Arrived at the department",
      by: null,
    });
    const selMc = movementMedicalClearance(subject, referrals);
    if (selMc?.cleared) {
      events.push({
        min: selMc.at,
        tone: "quiet",
        what: "Medically cleared",
        by: null,
      });
    }
    if (subject.examination) {
      events.push({
        min: subject.examination.at,
        tone: "quiet",
        what: `Reviewed by psychiatry (${formatTimelineExamOutcome(subject.examination.outcome)})`,
        by: null,
      });
    }
    if (subject.legalForm?.dueAt !== undefined) {
      events.push({
        min: subject.legalForm.dueAt,
        tone: subject.legalForm.dueAt < now ? "danger" : "warn",
        what:
          (subject.legalForm.dueAt < now ? "Deadline passed on " : "Deadline falls due on ") +
          `Form ${subject.legalForm.code}`,
        by: null,
      });
    }
    if (subject.declines) {
      for (const d of subject.declines) {
        if (d.at !== undefined) {
          events.push({
            min: d.at,
            tone: "warn",
            what: `${units.find((u) => u.id === d.unitId)?.name ?? d.unitId} declined`,
            by: null,
          });
        }
      }
    }
    if (subject.acceptedAt && subject.acceptedUnitId) {
      events.push({
        min: subject.acceptedAt,
        tone: "good",
        what: `${units.find((u) => u.id === subject.acceptedUnitId)?.name ?? subject.acceptedUnitId} accepted`,
        by: null,
      });
    }
    if (subject.transport) {
      events.push({
        min: subject.transport.acceptedAt ?? subject.openedAt,
        tone: "good",
        what: "Transport booked",
        by: subject.transport.bookedBy?.role ? WARD_FLOW_ROLE_LABELS[subject.transport.bookedBy.role] : null,
      });
    }
    if (subject.arrivalDetails?.recordedAt !== undefined) {
      const details = subject.arrivalDetails;
      events.push({
        min: details.recordedAt,
        tone: isArrivalLate(subject, now) ? "danger" : "good",
        what: `Arrival plan recorded · ${arrivalModeLabel(details.mode)} · ward ${arrivalEtaLabel(details.estimatedArrivalAt, now)}`,
        by: details.recordedBy ? WARD_FLOW_ROLE_LABELS[details.recordedBy] : null,
      });
    }
    events.sort((a, b) => b.min - a.min);
    return events;
  }
  const selectedPatientJourneyEvents: TimelineEvent[] = selectedPatient ? journeyEventsFor(selectedPatient) : [];

  const waitingForBed = patients.filter(
    (movement) => movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled",
  ).length;
  const waitingHere = patients.filter(isWaitingInEd);
  const longestHere = waitingHere.length
    ? Math.max(...waitingHere.map((movement) => Math.max(now - movement.openedAt, 0)))
    : undefined;

  const leavingForWard = patients.filter(
    (movement) => movement.stage === "handover_ready" || movement.stage === "moving",
  ).length;
  const heroChips = [
    {
      id: "past",
      label: `Past ${waitLine(accessTarget)}`,
      word: `past ${waitLine(accessTarget)}`,
      value: patients.filter(heroHighlightMatch.past).length,
      tone: "danger" as const,
    },
    {
      id: "severe",
      label: `Over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`,
      word: `over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`,
      value: patients.filter(heroHighlightMatch.severe).length,
      tone: "warning" as const,
    },
    {
      id: "no_bed",
      label: "No bed yet",
      word: "with no bed yet",
      value: patients.filter(heroHighlightMatch.no_bed).length,
    },
    {
      id: "under_form",
      label: "Under a form",
      word: "under a form",
      value: patients.filter(heroHighlightMatch.under_form).length,
    },
  ];
  /* Needs you holds only items needing action (good news stays on the row). A wait past the long-wait
     default is listed too, neutrally, never as a breach (owner ruling D-24, 26 Sept 2026). */
  const needsYouFlags = priorityFlags.filter(
    (flag) => flag.tone === "danger" || flag.tone === "warn" || flag.kind === `Waiting ${LONG_WAIT_TEXT}`,
  );
  const needsYouItems: EdNeedsItem[] = needsYouFlags.map((flag, index) => ({
    key: `${flag.recordId}-${index}`,
    actNow: flag.tone === "danger",
    kind: flag.kind,
    person: flag.personName ?? flag.recordId,
    when: flag.when,
    actionLabel: flag.actionLabel,
    onAction: flag.onAction,
    onOpen: patients.some((patient) => patient.id === flag.recordId)
      ? () => setPhoneSheetFor(flag.recordId)
      : undefined,
  }));
  // Top 25 item 6: one Needs you for the signed in role. The shared
  // task rows owned by the ED (`inboxItemsForRole`) for this department's people join the list,
  // once per person not already listed above.
  const listed = new Set(needsYouFlags.map((flag) => flag.recordId));
  const owned = inboxItemsForRole(
    activeTaskItems(
      {
        movements,
        units,
        configuration,
        inboxSnoozes,
        admissions,
        patients: registryPatients,
        referrals,
        // Top 25 item 12: the sending team sees its own stuck handover here too.
        stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
      },
      now,
    ),
    "ed",
  );
  for (const item of owned) {
    const movement = movements.find((m) => m.id === item.movementId);
    if (!movement || movement.originEdId !== thisEdId || listed.has(movement.id)) continue;
    listed.add(movement.id);
    needsYouItems.push({
      key: `task-${item.id}`,
      actNow: item.tone === "danger",
      kind: item.title,
      person: resolveSubjectPatient(movement, { patients: registryPatients, referrals, movements }).formalName,
      when: item.owner,
      onOpen: patients.some((patient) => patient.id === movement.id) ? () => setPhoneSheetFor(movement.id) : undefined,
    });
  }
  const activeHeroChip = heroChips.find((chip) => chip.id === heroHighlight);

  const arrivalPlanMovement = arrivalPlanOpenFor ? movements.find((m) => m.id === arrivalPlanOpenFor) : undefined;

  return {
    patients,
    patientBay,
    inbox,
    expects,
    answeredAll,
    answered,
    outbox,
    notReviewedCount,
    underFormCount,
    noDestCount,
    dischargeCount,
    withdrawnCount,
    heroHighlightMatch,
    boardMatchCount,
    isBoardRowDim,
    visiblePatients,
    selectedPatient,
    selectedPatientInfo,
    awaitingReviewPatients,
    clearedPatients,
    underFormPatients,
    timelineEvents,
    journeyEventsFor,
    selectedPatientJourneyEvents,
    waitingForBed,
    longestHere,
    leavingForWard,
    heroChips,
    needsYouItems,
    activeHeroChip,
    arrivalPlanMovement,
  };
}
