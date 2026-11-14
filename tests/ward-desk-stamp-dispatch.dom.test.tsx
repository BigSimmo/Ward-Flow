import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useDeskStampedDispatch } from "@/components/ward-management/ward-desk-stamp-dispatch";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

/*
 * Demo-Rules-LG-6 and RV2-8 (14 Nov 2026), D-222: a step the coordinator's desk takes on an ED or
 * ward route is recorded as the coordinator's at the demo's routing point, as the shared server
 * records it (`deskCommand`). Screens send the route's role; the stamp decides.
 */
afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

const expiry = { type: "RECORD_LEGAL_FORM_EXPIRY", role: "ed", now: 0, movementId: "m", dueAt: 60 } as WardFlowEvent;
const intake = { type: "SET_INTAKE_WINDOW", role: "ward", now: 0, unitId: "u", intake: null } as WardFlowEvent;

function sentRole(event: WardFlowEvent): string {
  const { result } = renderHook(() => useDeskStampedDispatch((sent: WardFlowEvent) => sent));
  return result.current(event).role;
}

describe("the routing point records a step under the session desk", () => {
  it("is the coordinator for the coordinator's desk on another desk's route", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    });
    expect(sentRole(expiry)).toBe("coordinator");
    expect(sentRole(intake)).toBe("coordinator");
  });

  it("stays the route's role for that desk's own staff", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    });
    expect(sentRole(expiry)).toBe("ed");
  });

  it("stays the route's role with role access off, where the route is the desk", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", false);
    });
    expect(sentRole(intake)).toBe("ward");
  });
});
