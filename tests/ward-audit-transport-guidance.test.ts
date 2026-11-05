import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementOriginLabel, originSiteCode } from "@/components/ward-management/ward-movement-origin";
import { outstandingItem } from "@/components/ward-management/ed/ed-screen-model";
import { movementNextStep } from "@/components/ward-management/movements/movement-next-step";
import type { Movement } from "@/components/ward-management/ward-model";

const state = seedWardFlowState();
const base = state.movements.find((m) => m.originEdId)!;
const booking = state.movements.find((m) => m.transport)!.transport!;
const pulled = (extra: Partial<Movement> = {}): Movement => ({
  ...base,
  stage: "pulled",
  closure: undefined,
  transport: undefined,
  sourceAdmissionId: undefined,
  originCommunity: undefined,
  transportNeed: undefined,
  ...extra,
});

describe("audit transport operational guidance", () => {
  it("uses the linked inpatient stay for pickup ahead of inherited ED metadata", () => {
    const stay = state.admissions[0];
    const unit = state.units.find((u) => u.id === stay.unitId)!;
    const movement = pulled({ sourceAdmissionId: stay.id });
    expect(movementOriginLabel(movement, "Inherited ED", state)).toBe(unit.name);
    expect(originSiteCode(movement, state)).toBe(unit.siteCode);
  });
  it("does not replace a known sending stay with an ED when its ward metadata is withheld", () => {
    const stay = state.admissions[0];
    const movement = pulled({ sourceAdmissionId: stay.id });
    expect(movementOriginLabel(movement, "Inherited ED", { admissions: state.admissions, units: [] })).not.toBe(
      "Inherited ED",
    );
    expect(originSiteCode(movement, { admissions: state.admissions, units: [] })).toBeUndefined();
  });
  it("retains ED and community fallback when no source stay resolves", () => {
    expect(movementOriginLabel(pulled(), "Recorded ED", state)).toBe("Recorded ED");
    const community = pulled({
      originEdId: undefined,
      originCommunity: { teamName: "Synthetic team", siteCode: "RPH" },
    });
    expect(movementOriginLabel(community, undefined, state)).toBe("Synthetic team (community)");
  });
  it("does not describe a live booking as no transport needed", () => {
    expect(
      outstandingItem(pulled({ transport: booking, transportNeed: { needed: false, at: 1 } })).detail,
    ).not.toContain("no transport needed");
  });
  it("assigns a community handover to its sending team", () => {
    expect(
      movementNextStep(
        pulled({
          originEdId: undefined,
          originCommunity: { teamName: "Synthetic team", siteCode: "RPH" },
          transport: booking,
        }),
      ),
    ).toMatchObject({ label: "Handover", owner: "Community team" });
  });
  it("offers direct receiving-ward arrival for a pulled journey needing no transport", () => {
    expect(movementNextStep(pulled({ transportNeed: { needed: false, at: 1 } }))).toMatchObject({
      label: "Arrival",
      owner: "Receiving ward",
    });
  });
  it("names the sending ward for inpatient handover", () => {
    expect(movementNextStep(pulled({ sourceAdmissionId: state.admissions[0].id, transport: booking }))).toMatchObject({
      label: "Handover",
      owner: "Sending ward",
    });
  });
  it("names booking as next work while the sending ED has not logged transport", () => {
    expect(movementNextStep(pulled())).toMatchObject({ label: "Book transport", owner: "ED team" });
  });
  it("keeps a real live job ahead of an earlier negative transport answer", () => {
    expect(movementNextStep(pulled({ transport: booking, transportNeed: { needed: false, at: 1 } }))).toMatchObject({
      label: "Handover",
      owner: "ED team",
    });
  });
});
