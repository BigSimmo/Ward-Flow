/*
 * The community team screen's pure helpers, shared types and constants. No hooks and no markup.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import type { SinceItem } from "@/components/wf";
import {
  isAwaitingTeamAnswer,
  leavingDestinationLabel,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { elapsedDaysPhrase } from "@/components/ward-management/community/community-elapsed";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { daysBetween, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type {
  CommunityScopedAddressing,
  CommunityScopedReferral,
} from "@/components/ward-management/ward-referral-visibility";
import type { LegalForm, Movement, Unit } from "@/components/ward-management/ward-model";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import { siteByCode } from "@/components/ward-management/ward-sites";
import type { Patient, PatientId } from "@/components/ward-management/ward-patients";

/** Said wherever this screen has a heading for a fact that no Ward Flow record holds. */
export const NOT_RECORDED_IN_WARD_FLOW = "Not recorded in Ward Flow";

export type TransportDraftState = TransportBookingAnswers;

export const BLANK_TRANSPORT_DRAFT: TransportDraftState = {
  provider: undefined,
  escortRequired: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  estimatedDay: "today",
};

export type ActiveTabType =
  "tab-sent" | "tab-triage" | "tab-inpatients" | "tab-expected" | "tab-egress" | "tab-caseload";

export type DrawerType =
  | "px"
  | "pxDrawer"
  | "referral"
  | "referralDrawer"
  | "activity"
  | "activityDrawer"
  | "tasks"
  | "tasksDrawer"
  | "tools"
  | "toolsDrawer"
  | null;
export type ModalType = "contact" | "handover" | "crisis" | null;

/**
 * Clinical contact is the contact itself, not a sent message — team, time, and role only. Wired only
 * when the engine declares `RECORD_CLINICAL_CONTACT`.
 */
export function clinicalContactCanSave(): boolean {
  return true;
}

export type CaseloadFilter = "all" | "5A" | "5B" | "cto" | "high" | "depot";

export type CaseloadRow = {
  key: string;
  referralId: string;
  patientId: PatientId | undefined;
  umrn: string | undefined;
  ageBand: string;
  legalForm: LegalForm | undefined;
  addressingState: CommunityScopedAddressing["state"] | undefined;
};

/** The four filter states the desktop lists hold. Named once so the screen and its hooks agree. */
export type TriageFilter = "all" | "p1" | "p2" | "p3" | "ed";
export type InpatientFilter = "all" | "secure" | "open" | "older";
export type EgressFilter = "all" | "overdue" | "today" | "upcoming";

/**
 * Since you looked (v10, team page): what changed for this team since the current shift began, read
 * from the record. The prototype keeps no per-person "last looked" time, so the shift start stands
 * in for it, as Handover does. Referrals in counts referrals naming this team raised in the window;
 * accepted and declined count this team's answers decided in the window.
 */
export function teamSinceItems(
  referrals: readonly CommunityScopedReferral[],
  names: readonly string[],
  since: Instant,
  now: Instant,
  waiting: number,
): SinceItem[] {
  const within = (at: Instant | undefined) => at !== undefined && at >= since && at <= now;
  const addressed = referrals.filter((referral) => names.includes(referral.addressing.destination.teamName));
  const decided = (state: string) =>
    addressed.filter((referral) => referral.addressing.state === state && within(referral.addressing.decidedAt)).length;
  return [
    {
      id: "in",
      value: addressed.filter((referral) => within(referral.raisedAt)).length,
      word: "referrals in",
    },
    { id: "accepted", value: decided("accepted"), word: "accepted" },
    { id: "declined", value: decided("declined"), word: "declined" },
    { id: "waiting", value: waiting, word: "still waiting an answer" },
  ];
}

/**
 * The ward's own name, from the units the provider holds. Never a literal: a hospital name typed
 * into a screen is a second home for a fact the data layer owns, which
 * `tests/ward-flow-data-boundary.test.ts` exists to refuse.
 *
 * An id the unit list does not carry renders as the id rather than as a blank or a guess.
 */
export function unitName(unitId: string, units: readonly Unit[]): string {
  return units.find((unit) => unit.id === unitId)?.name ?? unitId;
}

/**
 * Which of the two bed states this is, said out loud on every row — and, for an occupied bed, a
 * third fact this function used to miss entirely.
 *
 * `bedIsOccupied` is true for `"pulled"` as well as `"occupied"` — correctly, because the ward has
 * given the bed away — but a person whose bed is pulled may still be in an emergency department. A
 * row that read the same for both would tell a community team somebody is on a ward when they are
 * not.
 *
 * ⚠️ **THAT PARAGRAPH USED TO STOP THERE AND CLAIM A COMPLETENESS IT DID NOT HAVE.** It named only
 * the pulled-but-not-arrived case as the one this function exists to distinguish, and missed the
 * mirror case the model actually records for an OCCUPIED bed: `Admission.awayAtEmergencyDepartmentSince`
 * is a real, non-null-able field, and `ward-admissions.ts` (around `:408`) is explicit that the bed
 * STAYS occupied while it is set — "It is a fact about the PERSON, which is why it is a field and
 * not a state." The seed creates admissions with it set (`ward-admissions-seed.ts`, around `:426`)
 * and the reducer writes it at runtime, but until now this function never read it, so "In the bed"
 * rendered identically for somebody on the ward and somebody who has been sent to an emergency
 * department — the exact confusion the doc comment above claimed to have already prevented.
 */
export function bedStateLabel(admission: Admission): string {
  if (admission.state !== "occupied") return "A bed is pulled — not yet arrived";
  if (admission.awayAtEmergencyDepartmentSince !== null) return "In the bed — currently at an emergency department";
  return "In the bed";
}

/**
 * How long this person has been in this bed, in whole days, via `daysInBed` — the one place this
 * project computes a stay, counted from `arrivedAt` and never from `pulledAt`. `null` is stated
 * rather than substituted: somebody whose bed is pulled has not arrived, and "0 days" would read as
 * "arrived this morning".
 */
export function stayLabel(admission: Admission, now: Instant): string {
  const days = daysInBed(admission, now);
  if (days === null) return "Not yet arrived, so no length of stay";
  if (days === 0) return "In this bed under a day";
  return `In this bed ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * ⚠️ **BOTH FUNCTIONS BELOW NOW RENDER A DURATION, NOT AN INSTANT — A NEW OWNER RULING, NOT A
 * REVERSAL OF THE FINDING BELOW.** The demonstration-clock defect this block used to describe is
 * still closed exactly as stated: `WardFlowProvider` re-anchors the seeded state onto the hour the
 * demonstration opens by walking `INSTANT_FIELDS` (`ward-reanchor.ts`) and shifting every field it
 * names, and `INSTANT_FIELDS` names `pulledAt`, `awayAtEmergencyDepartmentSince`,
 * `expectedDischargeAt`, `dischargeDateSetAt`, `dischargeConfirmedAt`, `leftAt` and the nested
 * `recordedAt` — landed by `44ca08839` ("the demo clock was leaving six admission timestamps
 * behind"), reaching this branch through the merge `aeff0635b`. `tests/ward-reanchor.test.ts`
 * derives its expectation from BOTH `ward-model.ts` and `ward-admissions.ts` — see its `MODEL_FILES`
 * — so `now` and these dates are on ONE clock and `now - field` is sound.
 *
 * **What changed on 2026-09-01 is the question that clock defect used to gate.** Once a duration can
 * be computed soundly, the owner ruled it should be SHOWN — as elapsed time, never a calendar date.
 * A printed expected-discharge day or departure time would still be a synthetic figure rendered to a
 * community team as though it were a plan, because every date in this fixture is invented; "left 5
 * weeks ago" carries no such claim, cannot be mistaken for a real record of a real person, and stays
 * correct as the demonstration clock moves with nobody maintaining it. See this file's header block
 * for the full ruling and `community-elapsed.ts` for the one rounding rule both fields use.
 *
 * ⚠️ **THE TWO FIELDS ARE NOT THE SAME SHAPE, AND THAT IS THE TRAP HERE.** `leftAt` is set only once
 * a departure has actually happened, so `departureLabel` has exactly one direction to say. But
 * `expectedDischargeAt` is "a ward's own plan, revisable at will" (see the field's own comment in
 * `ward-admissions.ts`) and can be past OR future — `isPastExpectedDischarge` exists precisely
 * because a person can be overdue. A single past-tense renderer applied to both would print "left −3
 * days ago" for someone not yet due, which is nonsense, and would silently hide the one direction on
 * this screen that is clinically interesting: a plan that has already passed. `expectedBackLabel`
 * therefore branches on the sign of `now - expectedDischargeAt` and says "in N days/weeks" for a plan
 * still ahead, "N days/weeks ago" for one that has passed, and never spends the word "overdue" doing
 * it — that word names a followed-up-contact threshold this screen still does not have (see the "NO
 * THRESHOLD" paragraph in the file header, which this change does not touch).
 */
export function expectedBackLabel(admission: Admission, now: Instant): string {
  // `null` cannot reach here — `expectedBack` filters it out — and is still stated rather than
  // substituted, because a fallback string is the one shape that could put an unrecorded plan on
  // this screen if that ever changed. Non-finite is degraded the same conservative way
  // `isPastExpectedDischarge` treats it — as no sound answer, never a guessed one.
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected) || !Number.isFinite(now)) {
    // D-47: one wording for one fact — `ward-board.tsx` and the printed daily sheet say the
    // same thing about the same field, and three variants read as three different facts.
    // 🔴 AND THE NULL ARM OF THIS BRANCH IS UNREACHABLE TODAY: the only caller maps
    // `lists.expectedBack`, built as `currentlyAdmitted.filter((a) => a.expectedDischargeAt
    // !== null)`, so a null cannot arrive. The LIVE path is non-finite-but-non-null — a stored
    // value that is not a date, which is a DATA DEFECT and not an absence. ⚠️ Two different
    // facts share this branch; separate them when you next touch this function. Not split
    // here because that is a behaviour change and D-47 is a wording ruling.
    return "No expected date set";
  }
  if (now > expected) {
    const days = daysBetween(expected, now);
    return days === 0
      ? "Expected discharge was earlier today"
      : `Expected discharge was ${elapsedDaysPhrase(days)} ago`;
  }
  if (now < expected) {
    const days = daysBetween(now, expected);
    return days === 0 ? "Expected discharge is later today" : `Expected discharge in ${elapsedDaysPhrase(days)}`;
  }
  return "Expected discharge is today";
}

/**
 * How long ago this admission ended, never the date it ended on. See the block above for why a
 * duration and not a date. `leftAt` is always in the past in practice (set only once a departure has
 * actually happened), so unlike `expectedBackLabel` there is exactly one direction to say — but a
 * negative or non-finite instant is still degraded to the absence wording rather than trusted, the
 * same conservative floor `daysInBed` holds for an incoherent arrival. `null` — nobody recorded a
 * departure instant — is still a distinct thing to say, and this exact wording is unchanged: an
 * absence is not a duration of zero.
 */
export function departureLabel(admission: Admission, now: Instant): string {
  const leftAt = admission.leftAt;
  if (leftAt === null || !Number.isFinite(leftAt) || !Number.isFinite(now)) {
    return "Left this ward; the departure time was not recorded";
  }
  const days = Math.max(daysBetween(leftAt, now), 0);
  return days === 0 ? "Left this ward earlier today" : `Left this ward ${elapsedDaysPhrase(days)} ago`;
}

/**
 * The recorded destinations of the departures that are NOT on list 1, as a de-duplicated sentence
 * fragment in the vocabulary's own words. Derived from the same array whose length is printed
 * beside it, so the number and the words cannot describe different sets.
 */
export function otherDepartureDestinations(departures: readonly Admission[]): string {
  const labels = [
    ...new Set(
      departures.map((admission) => leavingDestinationLabel(admission.leavingDestination) ?? "no destination recorded"),
    ),
  ];
  return labels.join("; ");
}

/**
 * Display labels only — never the picker's own option set. Duplicated from
 * the retired intake form's own (unexported) `SOURCE_LABELS`, the third time this repository has
 * made that trade rather than export a form-picker's private map for a read-only screen to import;
 * `community-vocabulary.ts`'s own near-identical duplication note records the same reasoning. A
 * source missing from this map still renders, as its own raw value, via the `??` fallback below.
 */
const REFERRAL_SOURCE_LABELS: Record<CommunityScopedReferral["source"], string> = {
  community: "Community",
  crisis_service: "Crisis service",
  ambulance: "Ambulance",
  inter_hospital: "Inter-hospital",
  // The owner's own words, 2026-09-06, quoted rather than paraphrased: "ED medical staff will
  // refer a patient". Names the referrer, not the department — see `REFERRAL_SOURCES`.
  ed_medical: "ED medical staff",
  // Owner answer 25, 2026-09-17: "GP referrals: the GP is told by phone or letter for now; add
  // 'GP' as a referral source." See `REFERRAL_SOURCES`' own doc comment in `ward-model.ts` for
  // why this app never contacts the GP itself.
  gp: "General practitioner (GP)",
  psychiatric_ward: "Inpatient psychiatric ward",
};

/**
 * Where a referral says it came from, in words a coordinator reading this queue can act on: the
 * channel (`REFERRAL_SOURCE_LABELS`) and, where the record names one, the originating site
 * (`siteByCode`) — never a literal hospital name, which would be a second home for a fact
 * `siteDirectory` already owns. An unresolvable site code renders as the code itself rather than a
 * blank or a guess, the same discipline `unitName` holds a few functions above.
 */
export function referralOriginLabel(referral: CommunityScopedReferral): string {
  const channel = REFERRAL_SOURCE_LABELS[referral.source] ?? referral.source;
  const site = siteByCode(referral.originSiteCode);
  const origin = site ? `${channel} · ${site.name}` : `${channel} · site ${referral.originSiteCode}`;
  // The sending team, where the record names one. Appended through the shared helper rather than
  // formatted here: this is one of three places origin is rendered, and a wording decision made
  // three times becomes three claims about one fact the day somebody sharpens one of them.
  return withSendingTeam(origin, referral);
}

/**
 * The one addressing on `referral` that names `team` — the same match `admissionBelongsToTeam`
 * makes for an admission, read here for the referral itself rather than for who it eventually
 * admitted. `undefined` when this referral never named this team at all.
 */
function communityAddressingFor(
  referral: CommunityScopedReferral,
  team: CommunityTeam,
): CommunityScopedAddressing | undefined {
  return referral.addressing.destination.teamName === team.name ? referral.addressing : undefined;
}

export function caseloadStatutoryFormCode(row: CaseloadRow): string | undefined {
  return row.legalForm?.code;
}
/** Only a person-recorded expiry belongs in the current record. */
function caseloadRecordedExpiryAt(row: CaseloadRow): Instant | undefined {
  return row.legalForm?.dueAt;
}
export function caseloadRecordedExpiryLabel(row: CaseloadRow, now: Instant): string {
  const expiresAt = caseloadRecordedExpiryAt(row);
  return expiresAt !== undefined ? formatInstantWithDay(expiresAt, now) : "No expiry recorded";
}
export function caseloadRowsForTeam(
  referrals: readonly CommunityScopedReferral[],
  movements: readonly Movement[],
  patients: readonly Patient[],
  team: CommunityTeam,
  matchedAdmissions: readonly Admission[],
): CaseloadRow[] {
  const patientById = new Map(patients.map((patient) => [patient.id, patient] as const));
  const movementById = new Map(movements.map((movement) => [movement.id, movement] as const));
  const movementByReferralId = new Map<string, Movement>();
  for (const movement of movements) {
    if (movement.referralId === undefined) continue;
    if (!movementByReferralId.has(movement.referralId)) {
      movementByReferralId.set(movement.referralId, movement);
    }
  }

  const rows: CaseloadRow[] = [];
  const seenReferralIds = new Set<string>();

  for (const referral of referrals) {
    const addressing = communityAddressingFor(referral, team);
    if (addressing === undefined || addressing.state !== "accepted") continue;
    seenReferralIds.add(referral.id);
    const movement = movementByReferralId.get(referral.id);
    const patient = referral.patientId === undefined ? undefined : patientById.get(referral.patientId);
    rows.push({
      key: referral.id,
      referralId: referral.id,
      patientId: referral.patientId,
      umrn: patient?.umrn,
      ageBand: referral.ageBand,
      legalForm: movement?.legalForm,
      addressingState: addressing.state,
    });
  }

  for (const admission of matchedAdmissions) {
    if (admission.referralId === null || seenReferralIds.has(admission.referralId)) continue;
    const referral = referrals.find((candidate) => candidate.id === admission.referralId);
    if (referral === undefined) continue;
    seenReferralIds.add(referral.id);
    const addressing = communityAddressingFor(referral, team);
    const movement =
      admission.movementId === null ? movementByReferralId.get(referral.id) : movementById.get(admission.movementId);
    const patient =
      admission.patientId !== null
        ? patientById.get(admission.patientId)
        : referral.patientId === undefined
          ? undefined
          : patientById.get(referral.patientId);
    rows.push({
      key: referral.id,
      referralId: referral.id,
      patientId: admission.patientId ?? referral.patientId,
      umrn: patient?.umrn,
      ageBand: referral.ageBand,
      legalForm: movement?.legalForm,
      addressingState: addressing?.state,
    });
  }

  return rows;
}

/**
 * Referrals naming `team` whose addressing to it is still `"queued"` — the team's own unanswered
 * queue. `FD-24` means a referral can be queued here while another destination has already decided
 * something else entirely; that is exactly why this reads the ADDRESSING's own state, never
 * `referralState(referral)`, which would read the referral's overall (and irrelevant) outcome.
 */
export function referralsWaitingOnTeam(
  referrals: readonly CommunityScopedReferral[],
  team: CommunityTeam,
): CommunityScopedReferral[] {
  /*
   * 🔴 **FD-5 OPT-IN — EXCLUDED. This is a WORKLIST, and that is the whole of the answer.**
   * Every row here is something a person must accept or decline. A referral the referrer has taken
   * back needs neither: **a decline is a recorded clinical decision, and recording one against a
   * referral nobody is pressing would put a refusal on a person's record that no clinician meant.**
   *
   * ⚠️ **AND THE COST OF THIS EXCLUSION IS REAL, SO IT IS WRITTEN DOWN RATHER THAN LEFT TO BE
   * DISCOVERED:** a team that had been working on somebody now sees that row simply disappear from
   * this screen. **The team hub's list is where it stays visible and says it was withdrawn** — that
   * pairing is deliberate, and neither half is correct alone. ✅ **Ruled and built 2026-09-12.**
   *
   * ⚠️ **INERT TODAY, AND SAYING SO IS THE POINT.** No referral in the seed carries `withdrawnAt`,
   * so this exclusion changes nothing yet and a "simplification" back to a bare `state === "queued"`
   * would be GREEN. **An uncaught claim that knows it is uncaught is survivable; one that does not is
   * how the next author deletes it in good faith.** The catcher arrives with the seed specimen, which
   * is parked because nothing can yet CREATE a withdrawal — `RECORD_REFERRER_WITHDRAWAL` has no
   * dispatcher, and hand-authoring a state the reducer cannot reach would make all four of these look
   * tested while testing nothing.
   */
  return referrals.filter((referral) => isAwaitingTeamAnswer(communityAddressingFor(referral, team)));
}

/**
 * ⚠️ **THE MOST DELICATE DERIVATION ON THIS SCREEN, AND WHY EACH BRANCH IS WORDED AS IT IS.**
 *
 * `CommunityScopedAddressing` carries `state: "accepted"` and `decidedAt` — WHEN this team said yes.
 * `Admission` carries `arrivedAt` — when the bed began. Comparing the two is real and derivable;
 * nothing else about "is this person still with the team" is. `ward-model.ts` holds no team
 * discharge, no episode end and no closing date for a community addressing — checked, not assumed
 * — so this function can only ever say what this team ACCEPTED and WHEN, never who is currently
 * under its care.
 *
 * Three outcomes, and they are the only three `lists.currentlyAdmitted` can produce:
 *
 *   - `"bed-pulled-not-arrived"` — `arrivedAt` is `null`. There is no admission START to compare an
 *     acceptance against, so this admission can be neither of the other two. A person here may
 *     still be in an emergency department; the bed has simply been given away.
 *   - `"accepted-before-admission"` — this team accepted, with a recorded `decidedAt`, strictly
 *     before `arrivedAt`. This is the group the owner asked for: admitted while ALREADY accepted.
 *   - `"referred-during-admission"` — everything else: no accepted addressing to this team at all,
 *     or one accepted at or after `arrivedAt`. A referral raised during the bed necessarily decides
 *     no earlier than it was raised, so it can never land in the branch above by construction —
 *     this is the ward reaching out, not a relapse under this team's care, and the two must never
 *     be merged.
 */
export type AcceptedBeforeAdmission = {
  readonly kind: "accepted-before-admission";
  readonly admission: Admission;
  readonly acceptedAt: Instant;
  /** Never null here — narrowed once, at the point this variant is built, so every reader of this
   *  type gets the real instant rather than re-deriving "this branch means arrivedAt exists". */
  readonly arrivedAt: Instant;
  /** Minutes from acceptance to the bed beginning — always positive by construction. Kept as raw
   *  minutes (not a day count) so sorting and "shortest gap" comparisons stay exact; every rendered
   *  duration is still derived from `acceptedAt`/`arrivedAt` through `daysBetween`, never from this
   *  field directly. */
  readonly gapMinutes: number;
};
export type TeamAdmissionCategory =
  | AcceptedBeforeAdmission
  | { readonly kind: "referred-during-admission"; readonly admission: Admission }
  | { readonly kind: "bed-pulled-not-arrived"; readonly admission: Admission };

export function categoriseTeamAdmission(
  admission: Admission,
  team: CommunityTeam,
  referrals: readonly CommunityScopedReferral[],
  now: Instant,
): TeamAdmissionCategory {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) {
    return { kind: "bed-pulled-not-arrived", admission };
  }
  const referral =
    admission.referralId === null ? undefined : referrals.find((candidate) => candidate.id === admission.referralId);
  const addressing = referral ? communityAddressingFor(referral, team) : undefined;
  if (addressing && addressing.state === "accepted" && addressing.decidedAt !== undefined) {
    const decidedAt = addressing.decidedAt;
    if (Number.isFinite(decidedAt) && decidedAt < arrivedAt) {
      return {
        kind: "accepted-before-admission",
        admission,
        acceptedAt: decidedAt,
        arrivedAt,
        gapMinutes: arrivedAt - decidedAt,
      };
    }
  }
  return { kind: "referred-during-admission", admission };
}

/** A whole-day elapsed phrase, except that zero (or negative, or non-finite) whole days reads as
 *  "under a day" rather than "0 days" — `elapsedDaysPhrase` itself refuses a count below 1, so this
 *  is the one place on this screen that decides the same-day case its caller must decide. */
export function elapsedSinceOrUnderADay(days: number): string {
  return Number.isFinite(days) && days > 0 ? elapsedDaysPhrase(days) : "under a day";
}

/**
 * USC-03 (production audit, 25 Oct 2026): a community decline goes only to the referral whose
 * decline control is open — the waiting row's (`declineOpenFor`) or the phone sheet's. Any other
 * id is refused, so a drafted reason can never be applied to a referral nobody opened.
 */
export function declineTargetIsOpen(
  referralId: string,
  declineOpenFor: string | undefined,
  phone: { declining: boolean; referralId: string | null },
): boolean {
  return referralId === declineOpenFor || (phone.declining && referralId === phone.referralId);
}
