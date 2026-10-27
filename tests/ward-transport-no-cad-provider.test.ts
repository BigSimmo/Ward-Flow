import { describe, expect, it } from "vitest";
import { providerNeedsCadNumber } from "../src/components/ward-management/ward-cad-number";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/*
 * Form friction audit (27 Oct 2026): a ward escort or a family member has no dispatch service, so
 * there is no CAD number to read off a call. The engine books those without one, and still refuses
 * a dispatched service without its number. Synthetic seed only.
 */

const NOW = NOW_ANCHOR;

function book(provider: string, cadNumber: string | undefined) {
  return wardFlowReducer(seedWardFlowState(), {
    type: "BOOK_TRANSPORT",
    role: "coordinator",
    now: NOW,
    movementId: "WF-004",
    provider,
    escortRequired: true,
    cadNumber,
    transportLegalStatus: "involuntary",
    estimatedAt: NOW + 30,
  } as never);
}

describe("transport without a dispatch service", () => {
  it("knows which providers carry a CAD number", () => {
    expect(providerNeedsCadNumber("Ward escort")).toBe(false);
    expect(providerNeedsCadNumber("Family or carer")).toBe(false);
    expect(providerNeedsCadNumber("Ambulance (St John)")).toBe(true);
    expect(providerNeedsCadNumber("Police escort")).toBe(true);
    expect(providerNeedsCadNumber(undefined)).toBe(true);
  });

  it("books a ward escort with no CAD number, and stores none", () => {
    const next = book("Ward escort", "");
    expect(next.rejections).toEqual([]);
    const job = next.movements.find((movement) => movement.id === "WF-004")!.transport!;
    expect(job.provider).toBe("Ward escort");
    expect(job.cadNumber).toBeUndefined();
  });

  it("books a family member when the CAD number is left out of the event", () => {
    const next = book("Family or carer", undefined);
    expect(next.rejections).toEqual([]);
    expect(next.movements.find((movement) => movement.id === "WF-004")!.transport!.cadNumber).toBeUndefined();
  });

  it("still refuses a dispatched service with no CAD number, or a placeholder from anyone", () => {
    expect(book("Ambulance (St John)", "").rejections[0]?.reason).toContain("cadNumber must be answered");
    expect(book("Family or carer", "TBC").rejections[0]?.reason).toContain("cadNumber refused");
  });
});
