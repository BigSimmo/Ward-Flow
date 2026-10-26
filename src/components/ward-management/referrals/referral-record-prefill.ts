import { isOpen } from "../ward-derivations";
import type { HomeRegion, Movement, Referral } from "../ward-model";
import type { Patient } from "../ward-patients";
import { resolveSubjectPatient } from "../ward-patient-resolver";
import { edById } from "../ward-sites";
import type { ProfileLookup } from "../settings/settings-profile";
import { EMPTY_DOCUMENTATION, type DocumentationDraft } from "./referral-flow-panels";
import type { ReferralContact } from "./referral-submission";

/**
 * WHAT THE RECORD ALREADY SAYS, SO THE REFERRAL FORM DOES NOT ASK IT AGAIN.
 *
 * Workflow speed audit, 26 Oct 2026 (WS-06, WS-07, WS-08, WS-11). Each helper reads one fact the
 * record holds and returns it, or nothing. None of them guesses: a fact not recorded stays blank
 * and the form asks for it, as before.
 */

type RecordState = { patients: readonly Patient[]; referrals: readonly Referral[]; movements: readonly Movement[] };

/**
 * WS-06 (H-0971): medical clearance recorded on the ED board is carried into the Documentation
 * step. Cleared is "yes". Recorded as not cleared is "no", so the form still asks for the expected
 * time and a contact. Nothing recorded leaves the answer blank.
 */
export function documentationFromBoard(movement: Pick<Movement, "medicalClearance"> | undefined): DocumentationDraft {
  const clearance = movement?.medicalClearance;
  if (!clearance) return EMPTY_DOCUMENTATION;
  return { ...EMPTY_DOCUMENTATION, medical: clearance.cleared ? "yes" : "no" };
}

/**
 * WS-07 (H-0972): the referrer's details. A draft in progress wins, then the details this person
 * last sent from this tab, then the profile for the desk they are on. Before this the profile only
 * filled in when the form was opened from an entry point, so an ED clinician typed five fields at
 * the first Send.
 */
export function initialReferrerContact(
  kept: ReferralContact | undefined,
  lastSent: ReferralContact | null,
  profile: ProfileLookup,
): ReferralContact {
  if (kept) return kept;
  if (lastSent) return lastSent;
  if (profile.status === "available") {
    const { name, role, phone, email, location } = profile.profile;
    return { name, role, phone, email, location };
  }
  return { name: "", email: "", phone: "", role: "", location: "" };
}

/** Every open journey for this person, found through the patient resolver, newest first. */
function openJourneysFor(patientId: string, state: RecordState): Movement[] {
  return state.movements
    .filter((movement) => isOpen(movement) && resolveSubjectPatient(movement, state).patient?.id === patientId)
    .sort((a, b) => b.openedAt - a.openedAt);
}

/**
 * WS-08 (H-0973): the person's open ED journey, if one is already running. The form shows it
 * before Send, so a second ED does not start a second journey without knowing.
 */
export function openEdJourneyFor(
  patientId: string | undefined,
  state: RecordState,
): { movementId: string; siteCode: string; edName: string } | undefined {
  if (!patientId) return undefined;
  for (const movement of openJourneysFor(patientId, state)) {
    const ed = edById(movement.originEdId);
    if (ed) return { movementId: movement.id, siteCode: ed.siteCode, edName: ed.name };
  }
  return undefined;
}

/**
 * WS-11 (H-0976): the home region the record already holds for this person, from the journey the
 * form was opened on, else their newest journey that recorded one. Undefined when none did.
 */
export function recordedHomeRegion(
  patientId: string | undefined,
  liveMovement: Pick<Movement, "homeRegion"> | undefined,
  state: RecordState,
): HomeRegion | undefined {
  if (liveMovement?.homeRegion) return liveMovement.homeRegion;
  if (!patientId) return undefined;
  return state.movements
    .filter((movement) => movement.homeRegion && resolveSubjectPatient(movement, state).patient?.id === patientId)
    .sort((a, b) => b.openedAt - a.openedAt)[0]?.homeRegion;
}

/**
 * WS-11 (H-0976): the catchment is taken as confirmed when the record already names this person's
 * community team and a home region is known. Change still reopens it, so the referrer can correct
 * it; it is asked only when the record does not say.
 */
export function catchmentFromRecord(
  patient: Pick<Patient, "catchmentCommunityTeam"> | undefined,
  team: string,
  homeRegion: HomeRegion | "" | undefined,
): boolean {
  const recorded = patient?.catchmentCommunityTeam?.trim();
  return !!recorded && recorded === team.trim() && !!homeRegion;
}
