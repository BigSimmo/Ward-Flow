import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import { withStayReferralsInView } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "../src/components/ward-management/ward-patient-resolver";
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
