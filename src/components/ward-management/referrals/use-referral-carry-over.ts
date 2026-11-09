import { useState } from "react";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "../ward-patient-resolver";
import { referralAgeBand } from "./referral-age-band";
import { PATIENT_KEY_PREFIX } from "./referral-patient-key";
import type { KeptDraft } from "./ward-referral-drawer-model";
import { carriedCommunityNeeds, referralCarryForKey, type ReferralCarryOver } from "./referral-carry-over";

/**
 * Feature 39 (9 Nov 2026): the referral form's carried facts. `start` is what the form's fields
 * open with: a kept draft as it stands, else the facts carried from the person's current stay or
 * last referral. `carryFor` reads them again when another person is picked, and keeps them for the
 * notes (`carriedNotesFor`). Free text and risk flags are never among them.
 */
export function useReferralCarryOver(kept: KeptDraft | null, initialPatientKey: string) {
  const { admissions, movements, patients, referrals, units, dayZero } = useWardFlowSelect(
    "admissions",
    "movements",
    "patients",
    "referrals",
    "units",
    "dayZero",
  );
  const now = useWardFlowClock();
  const read = (key: string, ageBandKnown: boolean) =>
    referralCarryForKey(key, { admissions, movements, patients, referrals, units, dayZero }, now, ageBandKnown);
  // Finding 36: the record's date of birth gives the age band first, for the person the sheet opens
  // on exactly as for one picked later, and only a person with no usable date of birth falls back
  // to the carried band.
  function dobBand(key: string) {
    const movement = movements.find((candidate) => candidate.id === key);
    const record = movement
      ? resolveSubjectPatient(movement, { patients, referrals, movements }).patient
      : key.startsWith(PATIENT_KEY_PREFIX)
        ? patients.find((patient) => patient.id === key.slice(PATIENT_KEY_PREFIX.length))
        : undefined;
    return dayZero instanceof Date ? referralAgeBand(record?.dateOfBirth, calendarDateOf(now, dayZero)) : null;
  }
  const [opening] = useState(() => (kept ? null : dobBand(initialPatientKey)));
  const [carry, setCarry] = useState<ReferralCarryOver>(() => (kept ? {} : read(initialPatientKey, !!opening?.band)));
  const start: Partial<KeptDraft> & { ageBandNote?: string } = kept ?? {
    ...startOf(carry),
    ...(opening?.band ? { ageBand: opening.band } : {}),
    ...(opening?.note ? { ageBandNote: opening.note } : {}),
  };
  /** Reads the carried facts for a newly picked person, keeps them, and returns what fields open with. */
  function carryFor(key: string, ageBandKnown: boolean): Partial<KeptDraft> {
    const next = read(key, ageBandKnown);
    setCarry(next);
    return startOf(next);
  }
  return { carry, start, carryFor };
}

/** The draft fields a carry-over fills, and only those. */
function startOf(carry: ReferralCarryOver): Partial<KeptDraft> {
  return {
    ...(carry.ageBand ? { ageBand: carry.ageBand.value } : {}),
    ...(carry.highAcuity ? { highAcuity: carry.highAcuity.value } : {}),
    ...(carry.legalStatus ? { legalStatus: carry.legalStatus.value } : {}),
    ...(carry.security ? { security: carry.security.value } : {}),
    communityNeeds: carriedCommunityNeeds(carry),
  };
}
