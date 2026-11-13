"use client";

/**
 * Triage and risk (built 7 Nov 2026): the synthetic world's people as the triage reads them, from
 * the live workspace (`useWardFlowSelect`), with each person's open referral and last signed triage.
 * Synthetic data only.
 */
import { useMemo } from "react";

import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { referralState } from "@/components/ward-management/ward-referrals";
import { patientKeyFor, sampleProfile } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import type { Referral } from "@/components/ward-management/ward-model";
import { formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";

import type { TriagePerson, TriageReferral } from "./triage-risk-data";
import { previousTriageFrom, recordLegalStatus, triagePersonFromWorld, wardStayFacts } from "./triage-risk-people";
import { triagesFor, type TriageSignedRecord } from "./triage-record";

/** Start a triage: the step that asks who the triage is for (`ward-nav.ts`). */
export { WARD_TRIAGE_NEW_HREF as TRIAGE_NEW_HREF } from "@/components/ward-management/ward-nav";

export { triageHrefFor } from "./triage-href";

const SOURCE_WORDS: Readonly<Record<string, string>> = {
  community: "Community team",
  crisis_service: "Crisis service",
  ambulance: "Ambulance",
  inter_hospital: "Another hospital",
  ed_medical: "ED medical team",
  gp: "GP",
  psychiatric_ward: "A ward",
};

const asReferral = (referral: Referral): TriageReferral => ({
  id: referral.id,
  from: SOURCE_WORDS[referral.source] ?? "Not recorded",
  // A world referral asks for a bed urgency, not a triage tier, so the referrer asked none here.
  urgency: null,
  episode: null,
  // The world's referrals do not name a referrer person, so the form asks for one.
  referrer: null,
  received: null,
});

/**
 * Still waiting for an answer and not yet triaged. A triage assesses the person, so one signed at or
 * after a referral was raised answers that referral (and any other raised before it).
 */
const awaitingTriage = (referral: Referral, triages: readonly TriageSignedRecord[] | undefined) =>
  referral.triagedAt === undefined &&
  referralState(referral) === "queued" &&
  !((triagesFor(triages, referral.patientId)[0]?.at ?? -Infinity) >= referral.raisedAt);

/**
 * A referral awaiting triage on the Start a triage queue (9 Nov 2026): the person with that referral,
 * when it was raised on the board's synthetic clock, and how long it has waited since.
 */
export type AwaitingTriage = TriagePerson & {
  referral: TriageReferral;
  raisedAt: Instant;
  /** Minutes since the referral was raised, against the board's synthetic now. Never below 0. */
  waitedMinutes: number;
};

/**
 * Every synthetic person this desk is sent, as the banner reads them; the referrals awaiting triage,
 * oldest first; and the people by record id. A person with a signed triage on the workspace carries
 * it as `last`.
 */
export function useTriagePeople(): {
  people: TriagePerson[];
  awaiting: AwaitingTriage[];
  byId: ReadonlyMap<string, TriagePerson>;
} {
  const { patients, movements, referrals, triages, now, dayZero, admissions, units, plannedAdmissions } =
    useWardFlowSelect(
      "patients",
      "movements",
      "referrals",
      "triages",
      "now",
      "dayZero",
      "admissions",
      "units",
      "plannedAdmissions",
    );
  return useMemo(() => {
    const record = { movements, patients, referrals, dayZero, admissions, units };
    const openReferral = new Map<string, Referral>();
    for (const referral of referrals)
      if (referral.patientId && !openReferral.has(referral.patientId) && referralState(referral) === "queued")
        openReferral.set(referral.patientId, referral);
    const byId = new Map<string, TriagePerson>();
    const people = patients.map((patient) => {
      const key = patientKeyFor(patient.id, record) ?? `patient:${patient.id}`;
      const profile = sampleProfile(key, record, now);
      const open = openReferral.get(patient.id);
      const previous = triagesFor(triages, patient.id).map((signed) => previousTriageFrom(signed, dayZero));
      // D-186 (Q10): with no open movement the referral model has no place or legal status, so a person
      // on a ward stay reads the ward and the stay's legal status the patient page shows.
      const stay = key.startsWith("WF-") ? null : wardStayFacts(patient.id, { ...record, plannedAdmissions }, now);
      // Review R9 (D-186 item 10): everyone else reads the patient page's legal reading, status as
      // status. The referral model's own line puts the form code in place of the status.
      const recordKey = key.startsWith("WF-") ? key : patient.id;
      const person = triagePersonFromWorld({
        patientId: patient.id,
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        umrn: patient.umrn,
        dob: patient.dateOfBirth,
        origin: stay?.origin ?? profile.origin,
        legalStatus: stay?.legalStatus ?? recordLegalStatus(recordKey, record, now),
        recordAddress: encodeRecordAddress(recordKey),
        openReferral: open ? asReferral(open) : null,
        last: previous[0] ?? null,
        previous,
        alerts: recordExtrasFor(patient.id)?.alerts,
      });
      byId.set(patient.id, person);
      return person;
    });
    // The whole queue, oldest first: the start desk folds a long one behind Show all.
    const awaiting = referrals
      .filter((referral) => referral.patientId && awaitingTriage(referral, triages))
      .flatMap((referral): AwaitingTriage[] => {
        const person = byId.get(referral.patientId!);
        if (!person) return [];
        // Received is the referral's own raised time on the synthetic clock, for the queue only.
        const received = formatSheetMoment(referral.raisedAt, dayZero);
        return [
          {
            ...person,
            referral: { ...asReferral(referral), received },
            raisedAt: referral.raisedAt,
            waitedMinutes: Math.max(0, now - referral.raisedAt),
          },
        ];
      })
      .sort((a, b) => a.raisedAt - b.raisedAt);
    return { people, awaiting, byId };
  }, [patients, movements, referrals, triages, now, dayZero, admissions, units, plannedAdmissions]);
}
