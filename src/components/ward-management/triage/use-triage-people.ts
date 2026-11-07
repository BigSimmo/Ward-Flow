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
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import type { Referral } from "@/components/ward-management/ward-model";

import type { TriagePerson, TriageReferral } from "./triage-risk-data";
import { previousTriageFrom, triagePersonFromWorld } from "./triage-risk-people";
import { triagesFor } from "./triage-record";

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

/** Still waiting for an answer and not yet triaged. */
const awaitingTriage = (referral: Referral) => referral.triagedAt === undefined && referralState(referral) === "queued";

/**
 * Every synthetic person this desk is sent, as the banner reads them; the referrals awaiting triage;
 * and the people by record id. A person with a signed triage on the workspace carries it as `last`.
 */
export function useTriagePeople(): {
  people: TriagePerson[];
  awaiting: TriagePerson[];
  byId: ReadonlyMap<string, TriagePerson>;
} {
  const { patients, movements, referrals, triages, now, dayZero } = useWardFlowSelect(
    "patients",
    "movements",
    "referrals",
    "triages",
    "now",
    "dayZero",
  );
  return useMemo(() => {
    const record = { movements, patients, referrals, dayZero };
    const openReferral = new Map<string, Referral>();
    for (const referral of referrals)
      if (referral.patientId && !openReferral.has(referral.patientId) && referralState(referral) === "queued")
        openReferral.set(referral.patientId, referral);
    const byId = new Map<string, TriagePerson>();
    const people = patients.map((patient) => {
      const key = patientKeyFor(patient.id, record) ?? `patient:${patient.id}`;
      const profile = sampleProfile(key, record, now);
      const open = openReferral.get(patient.id);
      const lastSigned = triagesFor(triages, patient.id)[0];
      const person = triagePersonFromWorld({
        patientId: patient.id,
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        umrn: patient.umrn,
        dob: patient.dateOfBirth,
        origin: profile.origin,
        legalStatus: profile.legalStatus,
        recordAddress: encodeRecordAddress(key.startsWith("WF-") ? key : patient.id),
        openReferral: open ? asReferral(open) : null,
        last: lastSigned ? previousTriageFrom(lastSigned, dayZero) : null,
      });
      byId.set(patient.id, person);
      return person;
    });
    const awaiting = referrals
      .filter((referral) => referral.patientId && awaitingTriage(referral))
      .flatMap((referral) => {
        const person = byId.get(referral.patientId!);
        return person ? [{ ...person, referral: asReferral(referral) }] : [];
      })
      .slice(0, 5);
    return { people, awaiting, byId };
  }, [patients, movements, referrals, triages, now, dayZero]);
}
