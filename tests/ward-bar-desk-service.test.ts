import { describe, expect, it } from "vitest";

import { fixedServiceFor } from "@/components/ward-management/shell/ward-bar-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";

// #838: a ward desk on a page that names no place (Handover, Alerts) read "Statewide" in the header.
describe("header service for a desk held to its own place (#838)", () => {
  const { units } = seedWardFlowState();
  const unit = units.find((candidate) => unitHealthService(candidate) !== undefined)!;
  const service = unitHealthService(unit)!;

  it("shows a ward desk's own service off its ward route", () => {
    expect(fixedServiceFor("/ward-flow/handover", undefined, units, { kind: "ward", unitIds: [unit.id] })).toBe(
      service,
    );
  });

  it("shows a service-scoped desk's service", () => {
    expect(fixedServiceFor("/ward-flow/alerts", undefined, units, { kind: "service", service: "East Metro" })).toBe(
      "East Metro",
    );
  });

  it("leaves a statewide desk on the Service selector", () => {
    expect(fixedServiceFor("/ward-flow/handover", undefined, units, { kind: "statewide" })).toBeUndefined();
    expect(fixedServiceFor("/ward-flow/handover", undefined, units)).toBeUndefined();
  });

  it("does not guess when a ward desk spans two services", () => {
    const other = units.find((candidate) => {
      const candidateService = unitHealthService(candidate);
      return candidateService !== undefined && candidateService !== service;
    })!;
    expect(
      fixedServiceFor("/ward-flow/handover", undefined, units, { kind: "ward", unitIds: [unit.id, other.id] }),
    ).toBeUndefined();
  });
});
