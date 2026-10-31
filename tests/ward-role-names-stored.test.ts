import { describe, expect, it } from "vitest";

import { referralWorkedOnBy } from "@/components/ward-management/referrals/referral-worked-on";
import { deskMatches, type Desk } from "@/components/ward-management/settings/workstation-desks";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { DISCHARGE_ROLE_LABELS } from "@/components/ward-management/ward-admissions";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  EARLIER_ROLE_LABELS,
  roleOfRecordedLabel,
  WARD_FLOW_ROLE_LABELS,
} from "@/components/ward-management/ward-flow-roles";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Q66 (Josh, 31 Oct 2026): new records save the new role names, and every reader of stored role
 * text still accepts the earlier words, so a record saved before 31 Oct 2026 stays valid. Stored
 * records are never rewritten. Synthetic seed records only.
 */
const NOW = NOW_ANCHOR;

describe("Q66: new records save the new role names", () => {
  it("names each role one way across records, the chrome and access", () => {
    expect(WARD_FLOW_ROLE_LABELS.ward).toBe("Nurse in charge");
    expect(WARD_FLOW_ROLE_LABELS.community).toBe("Community team");
    expect(WARD_FLOW_ROLE_LABELS.bed_manager).toBe("Site bed manager");
    expect(CHROME_ROLE_LABELS.community).toBe("Community team");
    expect(CHROME_ROLE_LABELS.bed_manager).toBe("Site bed manager");
    expect(ACCESS_ROLE_LABELS.community).toBe("Community team");
    expect(DISCHARGE_ROLE_LABELS).toEqual(["Nurse in charge"]);
  });
});

describe("Q66: stored records with the earlier words stay valid", () => {
  it("reads each earlier word, and each new one, as its role", () => {
    expect(roleOfRecordedLabel("Ward manager")).toBe("ward");
    expect(roleOfRecordedLabel("Nurse in charge")).toBe("ward");
    expect(roleOfRecordedLabel("Community service")).toBe("community");
    expect(roleOfRecordedLabel("Community clinician")).toBe("community");
    expect(roleOfRecordedLabel("Community team")).toBe("community");
    expect(roleOfRecordedLabel("Bed manager")).toBe("bed_manager");
    expect(roleOfRecordedLabel("Site bed manager")).toBe("bed_manager");
    expect(roleOfRecordedLabel("Bed coordinator")).toBe("coordinator");
    expect(roleOfRecordedLabel("Someone")).toBeNull();
    // No earlier word is a current one, so a stored record is never read as a different role.
    for (const word of Object.keys(EARLIER_ROLE_LABELS))
      expect(Object.values(WARD_FLOW_ROLE_LABELS)).not.toContain(word);
  });

  it("names the desk of a claim saved under an earlier word by its current name", () => {
    const seeded = seedWardFlowState();
    const live = taskItems(seeded, NOW).map((item) => item.id);
    const movement = seeded.movements.find((m) => !m.closure && live.some((id) => id.endsWith(`-${m.id}`)))!;
    const rowId = live.find((id) => id.endsWith(`-${movement.id}`))!;
    const base = seeded.referrals[0]!;
    const referral = {
      ...base,
      destinations: base.destinations.map((arm) => ({ ...arm, state: "queued" as const })),
    };
    const state: WardFlowState = {
      ...seeded,
      referrals: [referral, ...seeded.referrals.slice(1)],
      movements: seeded.movements.map((m) => (m.id === movement.id ? { ...m, referralId: base.id } : m)),
      inboxOwnership: { [rowId]: [{ at: NOW - 5, by: "Community service" }] },
    };
    const liveNow = new Set(taskItems(state, NOW).map((item) => item.id));
    const desks = referralWorkedOnBy(referral, { ...state, rowIsLive: (id) => liveNow.has(id) });
    expect(desks[0]).toBe("Community team");
  });

  it("finds a desk by an earlier role word as well as the new ones", () => {
    const desk: Desk = { id: "ward-synthetic", role: "ward", name: "Synthetic Ward A", href: "/ward" };
    expect(deskMatches(desk, "Nurse in charge")).toBe(true);
    expect(deskMatches(desk, "Ward manager")).toBe(true);
    expect(deskMatches(desk, "Community team")).toBe(false);
  });
});
