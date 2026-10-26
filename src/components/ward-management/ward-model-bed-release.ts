/**
 * The bed release model: a ward's expected or confirmed discharge, what it waits on, and the
 * discharge support services and arrival checks recorded around it. Moved unchanged out of
 * `ward-model.ts` (F-17 file split, 26 Oct 2026), which re-exports it so importers are unchanged.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { DischargeLogisticsFields } from "@/components/ward-management/discharges/discharge-dependencies";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  DischargeDelayClearReason,
} from "@/components/ward-management/ward-change-reasons";

/** #398: the services a discharge support notice goes to (`SEND_RELEASE_SUPPORT_NOTICE`). */
export const SUPPORT_SERVICE_TYPES = ["pharmacy", "transport", "cleaning"] as const;
export type SupportServiceType = (typeof SUPPORT_SERVICE_TYPES)[number];

/**
 * D-72 (21 Oct 2026): the arrival checklist items the emergency department records with
 * `RECORD_ARRIVAL_CHECK`, onto `Movement.contrabandSearchDone` and `Movement.medicationChartDone`.
 */
export const ARRIVAL_CHECKS = ["contraband_search", "medication_chart"] as const;
export type ArrivalCheck = (typeof ARRIVAL_CHECKS)[number];

/**
 * A bed release's lifecycle, in order. Hand-listed (never derived), like `DECLINE_REASONS`, since a
 * UI picker needs a runtime list. **Three stages since 2026-08-28** (owner decision,
 * `docs/ward-flow-phase-6-7-decisions.md`): each says how CERTAIN the discharge is, nothing else.
 * `"blocked"` became a flag (`BedRelease.blocker`/`blockedBy`) on an expected or confirmed release,
 * because a release in state `"blocked"` matched neither branch of `capacityBreakdown` and silently
 * dropped the ward's confirmed count; `CapacityBreakdown.blockedToday` now counts stuck beds beside it.
 * Transitions go BOTH ways (`REVERT_BED_RELEASE`): a one-way model made wards record reversals
 * dishonestly.
 */
export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;
export type BedReleaseState = (typeof BED_RELEASE_STATES)[number];

/**
 * **The Q1 axis change, landed 2026-08-28** ("The three lists", List 2). This replaces
 * `BED_RELEASE_CONFIDENCE_LEVELS` — the `likely` / `possible` pair Phase 5 shipped — outright.
 *
 * A expected discharge no longer carries HOW CONFIDENT the ward is; it carries WHAT IT IS
 * WAITING ON. The owner's reasoning: confidence asks a ward to estimate a probability, people are
 * poor at that, and worse, two wards' "likely" do not mean the same thing — so a coordinator can
 * neither compare them nor add them up. What a discharge is waiting on is a **fact, not a
 * judgement**: comparable across wards, and actionable. A bed waiting on a ward round is a
 * different prospect from one waiting on a family meeting.
 *
 * **`"Nothing outstanding"` carries more weight than it looks.** It is a expected discharge with
 * no obstacle at all — the closest thing to the old "likely", and the one a coordinator can most
 * safely plan against. Without it the list would force a ward to name an obstacle that does not
 * exist, which is how a fixed list starts producing false records.
 *
 * Provenance, stated because it matters: these words were proposed by an agent session and
 * APPROVED by the product owner. No charge nurse has seen them, and this is the list of the three
 * most in need of a clinician's own words — the owner is not the one held up waiting on a ward
 * round. They ship verbatim; a clinician's wording replaces them verbatim in turn.
 */
export const BED_RELEASE_WAITING_ON = [
  "Awaiting ward round",
  "Awaiting family or carer agreement",
  "Awaiting accommodation",
  "Awaiting community team acceptance",
  /*
   * ═══ TWO ADDED 2026-09-06 — OWNER RULING, CLINICIAN CHECK R6: *"Add those two."* ═══
   * (`docs/ward-flow/clinician-check-rulings-2026-09-06.md`, read at source before this edit.)
   *
   * ⚠️ **A FIXED CLINICAL LIST, EXTENDED BY THE OWNER — NO AGENT MAY ALTER IT FURTHER.** These
   * values ARE the rendered text; there is no label map between them and a coordinator's screen.
   *
   * ⚠️ **ONE DECISION WAS MINE AND IT IS THE INITIAL CAPITAL, NOTHING ELSE.** He wrote the two
   * mid-sentence as *"awaiting legal or Mental Health Act process"* and *"awaiting transport"*. The
   * other five entries begin with a capital and render directly, so a lowercase pair would read as
   * a defect on the screen. **The WORDS are his, unchanged; only the first letter is conformed to
   * the list's existing convention.** If that is wrong it is a one-character revert — flagged to
   * Ward Lead rather than left to be noticed.
   *
   * "Mental Health Act" keeps its capitals because it is the Act's name.
   *
   * ⚠️ **"Awaiting transport" WAS PREDICTED BY THE 24-HOUR PULL RULING AND ARRIVED SEPARATELY.**
   * The owner said a transport can take four hours; a ward waiting on one had no way to say so,
   * because this list offered ward round, family, accommodation, community team, or nothing.
   */
  "Awaiting legal or Mental Health Act process",
  "Awaiting transport",
  /* Stays last: it is the null case, not another thing to wait for. */
  "Nothing outstanding",
] as const;
export type BedReleaseWaitingOn = (typeof BED_RELEASE_WAITING_ON)[number];

/**
 * A bed release names the stay it belongs to (`admissionId`, owner decision 2026-09-25) and nothing
 * else about the departing patient: no timing that could identify them, no reason relating to them,
 * and (spec D11) not even sex, the one otherwise-permitted patient attribute. Every other field
 * below is about the BED or the confirming WARD. `tests/ward-flow-reducer.test.ts` and
 * `tests/ward-bed-availability-model.test.ts` both assert this structurally against the type's own
 * field set, not against fixture content.
 */
export type BedRelease = {
  id: string;
  unitId: string;
  /**
   * THE STAY THIS RELEASE BELONGS TO — owner decision, Josh, 25 September 2026: *a bed release is a
   * named patient's discharge.* Required, never null, and always an `Admission.id` on this same
   * `unitId`. `FLAG_BED_RELEASE` refuses to create a release without one.
   *
   * It is what makes the free-bed count move exactly once. When this admission leaves
   * (`RECORD_LEAVING` / `RECORD_PATIENT_DISCHARGE`, both through `departAdmission`), this release
   * completes to `"discharged"` in the same write that raises the ward's figures. Before this field
   * existed, the reducer guessed which departure matched which release by comparing ward-wide counts,
   * with two seeded ids hard-coded as exceptions.
   *
   * A JOIN KEY, NOT A DISPLAY FIELD. No screen renders it, and no audit record copies it. A bed that
   * comes free for any other reason (cleaning, repairs) is not a `BedRelease` at all. It belongs to
   * the blocked and closed-bed records.
   */
  admissionId: string;
  state: BedReleaseState;
  expectedAt: Instant;
  /**
   * What this discharge is still waiting on, chosen from `BED_RELEASE_WAITING_ON`. Non-null only
   * while `state` is `"expected"` — a confirmed discharge is a decision, not something still
   * being waited on, and a released one has already happened.
   *
   * Renamed from `confidence` by the Q1 axis change of 2026-08-28. Keeping the old name over the
   * new values would have put "Awaiting ward round" in a field called `confidence` on a screen a
   * coordinator reads as fact, which is the kind of quiet mismatch this project treats as a
   * defect rather than a cosmetic point.
   *
   * `"Nothing outstanding"` is a legitimate value, not an absence: it means a expected discharge
   * with no obstacle. `null` means the release is not expected at all. The two are different and
   * must not be collapsed.
   */
  waitingOn: BedReleaseWaitingOn | null;
  /**
   * **The blocked FLAG's reason** (bed-model rework, 2026-08-28). Non-null means this discharge
   * is decided-or-expected AND currently stuck; it may sit on a `"expected"` release or on a
   * `"confirmed"` one, and a blocked-but-confirmed release still counts as confirmed. Always
   * `null` on a `"discharged"` release — once the bed is free there is nothing left being held up.
   *
   * Before this rework `blocked` was a fourth STATE and this field was legal only in it, which
   * is what made a stuck confirmed discharge fall out of the ward's confirmed count entirely.
   * Always a `BedReleaseBlocker` — enforced by the type here, and by a membership check against
   * `BED_RELEASE_BLOCKERS` in the reducer.
   */
  blocker: BedReleaseBlocker | null;
  /**
   * The role that recorded the block, non-null exactly when `blocker` is. A role — a unit or
   * service label — never a personal name, the same discipline `confirmedBy` holds to. Kept
   * separate from `confirmedBy` because the two answer different questions once a block can
   * outlive a state change: `confirmedBy` is who last reported this release's stage, this is who
   * said it was stuck (Q3: provenance stays a role and a timestamp, never a person).
   */
  blockedBy: string | null;
  /**
   * Q4 of the 2026-08-28 decisions: this bed is being MADE READY (cleaning and the like).
   * **Informational only — it must NEVER gate allocation.** A bed being prepared is still
   * offered, still counts in `availableNow`, and still appears in every figure, because the pull
   * of the next patient takes hours anyway. See `BED_PREPARATION_NOTES` for the full reasoning.
   */
  preparing: boolean;
  /**
   * What the bed is waiting on to be ready, chosen from `BED_PREPARATION_NOTES` — the owner
   * supplied that list on 2026-08-28, so the field is now expressible where it could previously
   * only be `null`. `null` alongside `preparing: true` remains legal and means "being made ready,
   * reason not stated"; `preparing: false` forces it null, because "not being made ready, waiting
   * on a clean" is a contradiction.
   *
   * **A note here still gates NOTHING.** See `preparing` above and `BED_PREPARATION_NOTES`.
   */
  preparationNote: BedPreparationNote | null;
  confirmedAt: Instant;
  /** A role — a unit or service label. Never a personal name. */
  confirmedBy: string;
  /** Reason the most recent discharge blocker was cleared, chosen from `DISCHARGE_DELAY_CLEAR_REASONS`. */
  lastClearedBlockReason?: DischargeDelayClearReason;
  /** Append-only history of cleared discharge blockers on this bed release. */
  clearedBlockHistory?: ReadonlyArray<{
    readonly at: Instant;
    readonly by: WardFlowRole;
    /** Absent when the clearing event named no reason; never defaulted. */
    readonly reason?: DischargeDelayClearReason;
    readonly blocker?: BedReleaseBlocker | null;
  }>;
  /**
   * #398 (D-72): the support notices the ward sent for this confirmed release, one per service,
   * oldest first (`SEND_RELEASE_SUPPORT_NOTICE`). About the bed only. Absent until the first.
   */
  supportNoticesSent?: ReadonlyArray<{
    readonly service: SupportServiceType;
    readonly at: Instant;
    readonly by: WardFlowRole;
  }>;
} & DischargeLogisticsFields;
