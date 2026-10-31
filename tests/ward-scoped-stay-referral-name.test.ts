import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import { withStayReferralsInView } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  isPlaceholderName,
  markRecordsWithheld,
  NAME_NOT_RECORDED,
  NAME_NOT_SHOWN,
  patientIdentityLine,
  resolveSubjectPatient,
  withheldRecordIds,
} from "../src/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Bug list row 28 (31 Oct 2026): a nurse in charge's own bed read "Name not recorded". The
 * browser's scoped copy kept the stay's link to a referral the ward is not sent, and the resolver
 * treats a link it cannot follow as broken. Synthetic seed only.
 */
const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const ids = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id));

describe("a ward's own stays keep their names when the admitting referral is out of view", () => {
  const linked = state.admissions.filter(
    (admission) => admission.referralId !== null && admission.state === "occupied",
  );

  it("the seed has an occupied stay linked to a referral its ward is not sent", () => {
    expect(linked.length).toBeGreaterThan(0);
  });

  it("names every such stay in the ward's own scoped copy", () => {
    for (const stay of linked) {
      const access = { role: "ward", scope: { kind: "ward", unitIds: [stay.unitId] } } as const;
      const scoped = scopeWorkspace(state, access, { now: NOW_ANCHOR, places });
      const before = scoped.admissions.find(({ id }) => id === stay.id)!;
      if (scoped.referrals.some(({ id }) => id === stay.referralId)) continue;
      // The failure as found: the dangling link names nobody.
      expect(resolveSubjectPatient(before, scoped).patient, stay.id).toBeUndefined();
      const admissions = withStayReferralsInView(scoped.admissions, ids(scoped.referrals), ids(state.referrals));
      const after = admissions.find(({ id }) => id === stay.id)!;
      expect(after.referralId).toBeNull();
      expect(resolveSubjectPatient(after, scoped).formalName).toBe(resolveSubjectPatient(stay, state).formalName);
    }
  });

  it("keeps a link the desk can follow, and leaves a truly broken link broken", () => {
    const [stay] = linked;
    const kept = withStayReferralsInView([stay], new Set([stay.referralId!]), ids(state.referrals));
    expect(kept[0]).toBe(stay);
    const broken = { ...stay, referralId: "RF-NOT-IN-WORKSPACE" };
    const after = withStayReferralsInView([broken], new Set(), ids(state.referrals));
    expect(after[0].referralId).toBe("RF-NOT-IN-WORKSPACE");
    expect(resolveSubjectPatient(after[0], state).patient).toBeUndefined();
  });
});

/**
 * Q29 (Josh, 31 Oct 2026): a person this desk's scope leaves out stays hidden, but reads "Name not
 * shown on this desk", because the name IS recorded. A truly broken link still reads "Name not
 * recorded". Synthetic seed only.
 */
describe("records outside a desk's scope read 'Name not shown on this desk'", () => {
  /** The browser's scoped copy as `ward-access.tsx` builds it for one ward desk. */
  const wardDesk = (unitId: string) => {
    const access = { role: "ward", scope: { kind: "ward", unitIds: [unitId] } } as const;
    const base = scopeWorkspace(state, access, { now: NOW_ANCHOR, places });
    const scoped = {
      ...base,
      patients: [...base.patients],
      admissions: withStayReferralsInView(base.admissions, ids(base.referrals), ids(state.referrals)),
    };
    markRecordsWithheld(scoped.patients, withheldRecordIds(state, scoped));
    return scoped;
  };

  it("never says 'Name not recorded' for a recorded person, and never names someone outside the scope", () => {
    let hidden = 0;
    for (const unit of state.units) {
      const scoped = wardDesk(unit.id);
      const shownPatients = ids(scoped.patients);
      for (const record of [...scoped.admissions, ...scoped.movements, ...scoped.referrals]) {
        const whole = resolveSubjectPatient(record, state);
        const seen = resolveSubjectPatient(record, scoped);
        if (seen.patient) expect(shownPatients.has(seen.patient.id), record.id).toBe(true);
        if (!whole.patient) continue;
        if (seen.patient) expect(seen.formalName, record.id).toBe(whole.formalName);
        else {
          expect(seen.displayName, record.id).toBe(NAME_NOT_SHOWN);
          hidden += 1;
        }
      }
    }
    // The seed has at least one such record (a movement linked only through an out-of-scope referral).
    expect(hidden).toBeGreaterThan(0);
  });

  it("tells a hidden link from a broken, duplicate or patient-less one", () => {
    const [patient, other] = state.patients;
    const shown = [other];
    markRecordsWithheld(shown, new Set([patient.id, "RF-HIDDEN", "WF-HIDDEN"]));
    const view = { patients: shown, referrals: [], movements: [] };
    expect(resolveSubjectPatient({ patientId: patient.id }, view).displayName).toBe(NAME_NOT_SHOWN);
    expect(resolveSubjectPatient({ referralId: "RF-HIDDEN" }, view).displayName).toBe(NAME_NOT_SHOWN);
    expect(resolveSubjectPatient({ movementId: "WF-HIDDEN" }, view).displayName).toBe(NAME_NOT_SHOWN);
    // A hidden link is treated as cut, so the person this desk can see is still named.
    expect(resolveSubjectPatient({ patientId: other.id, referralId: "RF-HIDDEN" }, view).patient).toBe(other);
    // Broken links stay broken.
    expect(resolveSubjectPatient({ patientId: "PT-NOT-IN-WORKSPACE" }, view).displayName).toBe(NAME_NOT_RECORDED);
    expect(resolveSubjectPatient({ referralId: "RF-NOT-IN-WORKSPACE" }, view).displayName).toBe(NAME_NOT_RECORDED);
    // The same array unmarked (a whole workspace) never says "not shown".
    const whole = { patients: [other], referrals: [], movements: [] };
    expect(resolveSubjectPatient({ patientId: patient.id }, whole).displayName).toBe(NAME_NOT_RECORDED);
  });

  it("keeps the placeholder away from UMRNs and name reordering", () => {
    expect(isPlaceholderName(NAME_NOT_SHOWN)).toBe(true);
    expect(isPlaceholderName(NAME_NOT_RECORDED)).toBe(true);
    expect(isPlaceholderName("Marrowby, Ines")).toBe(false);
    expect(patientIdentityLine({ formalName: NAME_NOT_SHOWN, umrn: "UMRN not shown on this desk" })).toBe(
      NAME_NOT_SHOWN,
    );
  });
});
