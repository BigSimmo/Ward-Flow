import { describe, expect, it } from "vitest";

import { fixedServiceFor } from "@/components/ward-management/shell/ward-bar-model";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";

// #838 (multi-account test, 26 Oct 2026): a ward desk's header read "Statewide" off its own ward route.
type Scope = NonNullable<Parameters<typeof fixedServiceFor>[3]>;

describe("the header service for a narrowed desk", () => {
  const { units } = seedWardFlowStateAt(0);
  const unit = units.find((candidate) => unitHealthService(candidate) !== undefined)!;
  const service = unitHealthService(unit)!;
  const offRoute = (scope: Scope) => fixedServiceFor("/ward-flow/handover", undefined, units, scope);
  const otherServiceUnit = units.find((candidate) => {
    const candidateService = unitHealthService(candidate);
    return candidateService !== undefined && candidateService !== service;
  })!;

  it("names a ward desk's own service on a page that is not its ward route", () => {
    expect(offRoute({ kind: "ward", unitIds: [unit.id] })).toBe(service);
  });

  it("leaves a ward desk across two services, a team desk and the whole network on the selector", () => {
    expect(offRoute({ kind: "ward", unitIds: [unit.id, otherServiceUnit.id] })).toBeUndefined();
    expect(offRoute({ kind: "team", teamName: "Any team" })).toBeUndefined();
    expect(offRoute({ kind: "statewide" })).toBeUndefined();
  });

  it("names a service desk's and a site desk's service", () => {
    expect(offRoute({ kind: "service", service })).toBe(service);
    expect(offRoute({ kind: "site", siteCode: unit.siteCode })).toBe(service);
    expect(offRoute({ kind: "site", siteCode: "NOT-A-SITE" })).toBeUndefined();
  });

  it("leaves the badge on a service still chosen from an earlier desk, so it matches the lists", () => {
    const scope = { kind: "ward", unitIds: [unit.id] } as const;
    const stale = unitHealthService(otherServiceUnit)!;
    expect(fixedServiceFor("/ward-flow/handover", undefined, units, scope, stale)).toBeUndefined();
    expect(fixedServiceFor("/ward-flow/handover", undefined, units, scope, service)).toBe(service);
  });

  it("keeps the ward route's own service ahead of the desk's", () => {
    const place = { kind: "ward", name: otherServiceUnit.name } as const;
    const scope = { kind: "ward", unitIds: [unit.id] } as const;
    expect(fixedServiceFor(`/ward-flow/ward/${otherServiceUnit.id}`, place, units, scope)).toBe(
      unitHealthService(otherServiceUnit),
    );
  });
});
