import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import type { Unit } from "./ward-model";
import { referralIntakeError } from "./referrals/referral-submission";
import { referralSuburbIsAnswered } from "@/components/ward-management/ward-referrals";
import { isTentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_HISTORY_LIMITS,
  SENDING_TEAM_NAME_LIMIT,
  type ReferralHistoryField,
  REFERRAL_SOURCES,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_PURPOSES,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
type ReferralIntakeEvent = Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }>;
type FindUnit = (state: WardFlowState, id: string) => Unit | undefined;
type ReferralIntakeContext = { state: WardFlowState; event: ReferralIntakeEvent; findUnit: FindUnit };
/** The first refusal wins, in the original order. Checks preserve exact messages and
 * malformed-input behaviour; successful construction and history copying stay in the facade. */
export function referralIntakeRefusal(
  state: WardFlowState,
  event: ReferralIntakeEvent,
  findUnit: FindUnit,
): string | null {
  const context = { state, event, findUnit };
  for (const validate of [
    ageRefusal,
    destinationCountRefusal,
    destinationIdentityRefusal,
    emergencyDestinationRefusal,
    wardDestinationsRefusal,
    structuredIntakeRefusal,
    senderRefusal,
    catchmentRefusal,
    originSiteRefusal,
    timingAndPatientRefusal,
    historyShapeRefusal,
    historyLengthRefusal,
    sendingTeamRefusal,
    diagnosisRefusal,
  ]) {
    const refusal = validate(context);
    if (refusal !== null) return refusal;
  }
  return null;
}
function ageRefusal({ event }: ReferralIntakeContext): string | null {
  // Fix round B (review finding I2): the role check above used to be the ONLY guard, and
  // this reducer's own comment said so — `source`, `homeRegion`, `ageBand`, `urgency` and
  // `originSiteCode` all passed through unvalidated. That contradicts the spec's Failure
  // behaviour directly: "a referral missing a required field, or carrying an unknown source
  // … → refused with a visible `Rejection`. Never silently queued, never defaulted." Every
  // check below is a membership check (or, for `originSiteCode`, a resolution against the
  // real site list), not a truthiness test — same discipline as `DECLINE_REFERRAL`'s own
  // `reason` guard below, added in the same commit as the gap this closes. Each failure names
  // what was wrong so a rejected intake is never mistaken for a silent success.
  if (!COHORTS.includes(event.ageBand)) {
    return `RECEIVE_REFERRAL ageBand must be chosen from COHORTS`;
  }
  return null;
}

function destinationCountRefusal({ state, event }: ReferralIntakeContext): string | null {
  // Review finding M1: `sex` was the ONE enum-shaped field on this event with no membership
  // check, though `SEXES` exists for exactly this. It is not a theoretical gap — a non-form
  // caller (a demo control, a Playwright fixture, the guided tour) sending `sex: "F"` used to
  // queue silently, after which `unit.sexMix["F"] ?? 0` is 0 everywhere and
  // `sexDesignationAccepts("Female only", "F")` is false, so the referral matches almost
  // nothing with plausible-looking per-unit reasons instead of being visibly refused.
  //
  // Since the destination union landed, `sex` exists only on the ward arm, so the check is
  // guarded by the arm rather than dropped: the runtime hole this closes is an untyped caller,
  // and an untyped caller can just as easily send a malformed ward destination.
  // FD-21: one act, several destinations, up to the cap. Each of these refusals names a
  // different way the list can be wrong, because "invalid destinations" tells a caller nothing.
  if (event.destinations.length === 0) {
    return `RECEIVE_REFERRAL needs at least one destination`;
  }
  if (event.destinations.length > state.configuration.parallelReferralCap) {
    return `RECEIVE_REFERRAL may address at most ${state.configuration.parallelReferralCap} destinations, not ${event.destinations.length}`;
  }
  return null;
}

function destinationIdentityRefusal({ event }: ReferralIntakeContext): string | null {
  const kinds = event.destinations.map((destination) => destination.kind);
  const recipientKeys = event.destinations.map((destination) =>
    destination.kind === "psychiatric_ward" && destination.unitId
      ? `${destination.kind}:${destination.unitId}`
      : destination.kind,
  );
  const broadWard = event.destinations.some(
    (destination) => destination.kind === "psychiatric_ward" && !destination.unitId,
  );
  if (hasRepeatedRecipient({ recipientKeys, broadWard, kinds })) {
    // Asking one kind twice is asking twice, not addressing two destinations. Refused rather
    // than de-duplicated: silently collapsing it would make the cap count something other than
    // what the referrer chose.
    return `RECEIVE_REFERRAL cannot address the same destination kind twice`;
  }
  if (kinds.some((kind) => !REFERRAL_DESTINATION_KINDS.includes(kind))) {
    return `RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS`;
  }
  return null;
}

function hasRepeatedRecipient({
  recipientKeys,
  broadWard,
  kinds,
}: {
  recipientKeys: string[];
  broadWard: boolean;
  kinds: ReferralIntakeEvent["destinations"][number]["kind"][];
}): boolean {
  return (
    new Set(recipientKeys).size !== recipientKeys.length ||
    (broadWard && kinds.filter((kind) => kind === "psychiatric_ward").length > 1)
  );
}

function emergencyDestinationRefusal({ event }: ReferralIntakeContext): string | null {
  /*
   * ⚠️ THE ED ARM GETS THE SAME TREATMENT AS `originSiteCode`, FOR THE SAME REASON.
   *
   * That field's own comment three checks below says it: "resolved against the real network
   * rather than merely checked for non-emptiness, so '12 Wellington St, Perth' cannot pass as a
   * code." When the ED arm gained `edId` and `purpose` it got neither — so a referral could
   * queue at an empty or invented department and read like an answer.
   *
   * ⚠️ **This is the check that would have caught the shortcut two sessions agreed must not be
   * made.** When the arm grew required fields, three call sites stopped compiling and the
   * tempting repair was a cast or an `edId: ""` stub — a form offering a destination the
   * application cannot construct, while looking finished. That stub was mutation-tested and
   * broke only new SCREEN-level guards and no pre-existing test. A screen guard is the wrong
   * last line: it is one component away from being bypassed, and every path goes through here.
   *
   * ⚠️ **And non-emptiness is not the check.** `edId: "not-a-department"` is as wrong as `""`
   * and far more convincing — it survives every truthiness test, reads as a plausible
   * identifier, and queues a real person at a hospital that does not exist. So it resolves.
   */
  const edDestination = event.destinations.find((destination) => destination.kind === "emergency_department");
  if (edDestination?.kind === "emergency_department") {
    if (!allEmergencyDepartments().some((department) => department.id === edDestination.edId)) {
      return `RECEIVE_REFERRAL edId must resolve to a real emergency department`;
    }
    if (!REFERRAL_PURPOSES.includes(edDestination.purpose)) {
      return `RECEIVE_REFERRAL purpose must be chosen from REFERRAL_PURPOSES`;
    }
  }
  return null;
}

function wardDestinationsRefusal(context: ReferralIntakeContext): string | null {
  for (const wardDestination of context.event.destinations) {
    if (wardDestination.kind !== "psychiatric_ward") continue;
    const refusal = wardDestinationRefusal(wardDestination, context);
    if (refusal !== null) return refusal;
  }
  return null;
}

function wardDestinationRefusal(
  wardDestination: Extract<ReferralIntakeEvent["destinations"][number], { kind: "psychiatric_ward" }>,
  { state, findUnit }: ReferralIntakeContext,
): string | null {
  if (wardDestination.unitId !== undefined && !findUnit(state, wardDestination.unitId)) {
    return "RECEIVE_REFERRAL unitId must resolve to a real ward";
  }
  if (!RECORDED_SEXES.includes(wardDestination.sex)) return "RECEIVE_REFERRAL sex must be chosen from RECORDED_SEXES";
  if (wardDestination.gender !== undefined && !REFERRAL_GENDERS.includes(wardDestination.gender))
    return "RECEIVE_REFERRAL gender must be chosen from REFERRAL_GENDERS";
  if (
    [
      wardDestination.secureBedNeeded,
      wardDestination.involuntaryBedNeeded,
      // Legacy broad referrals omitted acuity; named recipients must answer explicitly.
      wardDestination.highAcuityNursingNeeded ?? (wardDestination.unitId === undefined ? false : undefined),
    ].some((value) => typeof value !== "boolean")
  )
    return "RECEIVE_REFERRAL bed criteria must be answered";
  return null;
}

function structuredIntakeRefusal({ event }: ReferralIntakeContext): string | null {
  if (event.intake !== undefined) {
    const error = referralIntakeError(event.intake);
    if (error) return `RECEIVE_REFERRAL: ${error}`;
  }
  return null;
}

function senderRefusal({ state, event, findUnit }: ReferralIntakeContext): string | null {
  if (!REFERRAL_SOURCES.includes(event.source)) {
    return `RECEIVE_REFERRAL source must be chosen from REFERRAL_SOURCES`;
  }
  // R9 (owner item 23, 2026-09-17): "only `ed_medical` is raised as `ed`, and `ed` with any
  // other source is refused. Everything else, including GP, stays `community`." `EVENT_ROLE`
  // alone cannot express this — it only says role `ed` is SOMETIMES valid for this event type —
  // so the pairing is checked here, once the source itself is known to be real. The reverse
  // pairing (role `community` with source `ed_medical`, raised directly at the front door
  // rather than through the ED's own screen) is left open on purpose —
  // `tests/ward-ed-to-community-referral.test.ts` already depends on it.
  //
  // Checked BEFORE the psychiatric_ward-specific originUnitId check below: an `ed`-role
  // referral naming source `psychiatric_ward` is wrong on the pairing alone, and must be
  // refused for that reason even when `originUnitId` is also missing, rather than surfacing
  // the unrelated originUnitId message and never reaching the pairing rule at all.
  if (event.role === "ed" && event.source !== "ed_medical") {
    return `RECEIVE_REFERRAL raised as role ed must carry source ed_medical, not ${event.source}`;
  }
  if (event.source === "psychiatric_ward") {
    if (!event.originUnitId || !findUnit(state, event.originUnitId)) {
      return `RECEIVE_REFERRAL source psychiatric_ward must name a real originUnitId (the sending ward)`;
    }
  }
  return null;
}

function catchmentRefusal({ event }: ReferralIntakeContext): string | null {
  // Fix round B (this task's own addition): `homeRegion` is a REGION from a fixed list —
  // never an address, never free text. Membership-checking it here is what makes that
  // distinction real rather than a naming convention; see `HOME_REGIONS`'s own doc comment.
  if (!HOME_REGIONS.includes(event.homeRegion)) {
    return `RECEIVE_REFERRAL homeRegion must be chosen from HOME_REGIONS`;
  }
  // The suburb is resolved against the real catchment table, never merely checked for
  // non-emptiness — the same reason `edId` and `originSiteCode` below resolve rather than
  // measure. "12 Wellington St, Perth" is non-empty, and letting it through would put a street
  // address in the one field whose defence is that it is coarser than one (`PD-3`).
  if (!referralSuburbIsAnswered(event.suburb)) {
    return `RECEIVE_REFERRAL suburb must name a suburb the catchment source knows, or state that it is not known`;
  }
  if (urgencyIsUnsupported(event)) {
    return `RECEIVE_REFERRAL urgency must be 1, 2 or 3`;
  }
  return null;
}

function urgencyIsUnsupported(event: ReferralIntakeEvent): boolean {
  return event.urgency !== 1 && event.urgency !== 2 && event.urgency !== 3;
}

function originSiteRefusal({ event }: ReferralIntakeContext): string | null {
  // A synthetic site code, never an address — resolved against the real network rather than
  // merely checked for non-emptiness, so "12 Wellington St, Perth" cannot pass as a code.
  const originSite = siteByCode(event.originSiteCode);
  if (!originSite) {
    return `RECEIVE_REFERRAL originSiteCode must resolve to a real site`;
  }
  /*
   * ⚠️ A REFERRAL FROM ED MEDICAL STAFF MUST COME FROM A HOSPITAL THAT HAS AN ED — the first
   * check here that compares TWO fields rather than validating one.
   *
   * `source` and `originSiteCode` are each independently valid and were never compared, so
   * `{ source: "ed_medical", originSiteCode: "FRE" }` passed both membership tests and
   * described a referral from the emergency department of a hospital that has no emergency
   * department. **Nine sites in `wardSites` have none** — Fremantle, Bentley and the country
   * sites.
   *
   * ⚠️ **NOTHING DOWNSTREAM COULD HAVE CAUGHT IT, WHICH IS WHY IT BELONGS AT THE DOOR.** The
   * row renders complete: no missing value, no blank, no implausible number. Every screen
   * shows a source and a hospital and both are real; only their combination is impossible.
   *
   * ⚠️ **THE CHECK READS THE SITE'S OWN RECORD, NEVER A LIST OF CODES.** `wardSites` is where
   * a hospital's emergency department is declared. A hand-written array of "sites that have
   * one" here would be a second home for that fact and would go stale the first time the
   * network changes — the failure `docs/ward-flow-changeable-data-rule.md` exists for.
   */
  if (event.source === "ed_medical" && !originSite.emergencyDepartment) {
    return `RECEIVE_REFERRAL source ed_medical requires an origin site with an emergency department`;
  }
  return null;
}

function timingAndPatientRefusal({ state, event }: ReferralIntakeContext): string | null {
  // A triage instant in the FUTURE would put a patient in the department before they got
  // there, and `referralClocks` clamps at zero rather than printing a negative — so the wrong
  // value would render as a plausible "0m" instead of an obvious error. Refused at the door.
  if (event.triagedAt !== undefined && event.triagedAt > event.now) {
    return `RECEIVE_REFERRAL triagedAt cannot be later than the referral itself`;
  }
  /*
   * ⚠️ THREE STATES, NOT TWO — and the guard below must only ever separate the second from
   * the third. `event.patientId`'s own doc comment (above, on the event type) says a referral
   * raised outside the patient flow LEGITIMATELY has nobody on file, so ABSENT is a real
   * answer that must keep sailing through untouched — exactly as `created.patientId` below is
   * still "COPIED THROUGH, NEVER DEFAULTED". What was never checked is the other failure
   * shape: a `patientId` that IS present but names nobody `state.patients` holds — a fabricated
   * link that would render as a referral belonging to a patient who is not there, the mistyped-
   * web-address case the front door has no defence against otherwise.
   *
   * This is not a new standard — it matches the sibling that already does this exact job.
   * `RAISE_REFERRAL.referralId` (this file, `case "RAISE_REFERRAL"`, the `findReferral`
   * lookup) refuses an id naming no referral with a visible `Rejection` rather than storing
   * it, on the same "optional because most journeys have none, resolved when present" shape
   * this field's own doc comment cites by name. Read that guard before touching this one.
   *
   * So: absent → `event.patientId === undefined` short-circuits the `&&` and this line does
   * nothing (state 1, fine). Present and real → `.some` finds it and this line does nothing
   * (state 2, fine). Present and naming nobody → `.some` finds nothing and this REFUSES (state
   * 3). Collapsing state 1 into state 3 — dropping the presence check — would refuse every
   * referral raised with no person on file, which is the front door this field exists to keep
   * open.
   */
  if (event.patientId !== undefined && !state.patients.some((patient) => patient.id === event.patientId)) {
    return `RECEIVE_REFERRAL patientId must name a patient this system already holds, and ${event.patientId} names none`;
  }
  return null;
}

function historyShapeRefusal({ event }: ReferralIntakeContext): string | null {
  /*
   * ⚠️ THE WRITTEN HISTORY — THE ONLY FIELD ON THIS EVENT THE REDUCER CANNOT MEMBERSHIP-CHECK.
   *
   * Every guard above resolves a value against a closed set. There is no set to check prose
   * against, so exactly two things are enforced here and nothing else is even attempted:
   *
   *   1. It is a string at all — see the shape note below.
   *   2. It does not exceed its limit in `REFERRAL_HISTORY_LIMITS`.
   *
   * ⚠️ **A BLANK STORY IS NO LONGER REFUSED.** It was, until the owner's ruling of 2026-09-05:
   * one story box, OPTIONAL. The rejection that lived here — "a referral needs an account of
   * why it was raised" — was a good sentence about a rule this product no longer has, and the
   * front door no longer goes inert on an empty box either. **`""` is a complete answer.**
   *
   * ⚠️ **AN OVER-LENGTH VALUE IS REFUSED, NEVER TRUNCATED.** `.slice(0, limit)` here would
   * accept the referral and silently drop the tail of somebody's risk note, and the intake
   * would report success. A refusal is visible; a truncation is not, and the part most likely
   * to be cut is the part written last, which on a risk note is usually the part that matters.
   *
   * ⚠️ **NOTHING ELSE IS INSPECTED.** No keyword scan for a name, no check that it "looks
   * clinical", no urgency inferred from its wording. The moment this reducer reads meaning out
   * of this field, the prototype is doing clinical decision support — see `Referral.history`.
   */
  /*
   * ⚠️ THE SHAPE CHECK COMES FIRST, AND IT IS NOT DEFENSIVE PROGRAMMING FOR ITS OWN SAKE.
   *
   * The first version of this block went straight to `.trim()`, which threw a TypeError on any
   * caller that omitted the field — and the reducer's own commentary on `sex` describes exactly
   * who those callers are: "a non-form caller (a demo control, a Playwright fixture, the guided
   * tour)". Three suites found it within a minute of the field landing.
   *
   * **A crash and a refusal are not the same outcome.** A refusal is a `Rejection` a clinician
   * can read; a thrown TypeError unwinds out of `dispatch`, leaves the state untouched, and
   * presents as a button that did nothing at all — the phantom-press failure this file already
   * has a comment about on the officer screen. Every other guard here checks membership before
   * it uses a value, and this one must too — **and it matters MORE now the field is optional**,
   * because an omitted field and a deliberately blank one are the same keystroke away and the
   * loop below is the only thing that tells a caller which mistake it made.
   */
  for (const field of Object.keys(REFERRAL_HISTORY_LIMITS) as ReferralHistoryField[]) {
    if (typeof event[field] !== "string") {
      return `RECEIVE_REFERRAL ${field} must be text, even when it is empty text`;
    }
  }
  return null;
}

function historyLengthRefusal({ event }: ReferralIntakeContext): string | null {
  for (const [field, limit] of Object.entries(REFERRAL_HISTORY_LIMITS) as [ReferralHistoryField, number][]) {
    if (event[field].length > limit) {
      return `RECEIVE_REFERRAL ${field} is ${event[field].length} characters and the limit is ${limit} — it is refused rather than shortened`;
    }
  }
  return null;
}

function sendingTeamRefusal({ event }: ReferralIntakeContext): string | null {
  /*
   * THE SENDING TEAM'S NAME, AND BOTH REFUSALS ARE DELIBERATE.
   *
   * ⚠️ **A blank-but-present value is REFUSED rather than normalised to `undefined`.** Quietly
   * turning "  " into "no team recorded" would accept a caller's bug and store a different
   * answer from the one it sent -- and a referral that says nobody was recorded, when the
   * front door did try to record somebody, is indistinguishable afterwards from a referral
   * where nobody was asked.
   *
   * ⚠️ **An over-length value is refused rather than shortened**, the same rule `history`
   * follows above: a truncated team name is a DIFFERENT team's name, and it renders as a clean
   * plausible row nothing contradicts.
   */
  if (event.sendingTeamName !== undefined) {
    if (event.sendingTeamName.trim() === "") {
      return (
        "RECEIVE_REFERRAL sendingTeamName is present but blank — omit the field to record no " +
        "sending team, rather than sending an empty one"
      );
    }
    if (event.sendingTeamName.length > SENDING_TEAM_NAME_LIMIT) {
      return (
        `RECEIVE_REFERRAL sendingTeamName is ${event.sendingTeamName.length} characters and the ` +
        `limit is ${SENDING_TEAM_NAME_LIMIT} — it is refused rather than shortened, because a ` +
        `truncated team name is a different team's name`
      );
    }
  }
  return null;
}

function diagnosisRefusal({ event }: ReferralIntakeContext): string | null {
  // T15 (item 12): membership-checked exactly like every other closed-list field on this
  // event — `isTentativeDiagnosisBlock` is the same discipline `sex`/`gender`'s own checks
  // above hold to, never a truthiness test. Only checked when supplied at all, since absent
  // means nobody has recorded one.
  if (event.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.tentativeDiagnosis)) {
    return `RECEIVE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`;
  }
  return null;
}
