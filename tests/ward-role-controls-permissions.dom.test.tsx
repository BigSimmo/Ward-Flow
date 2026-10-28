import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@/components/ward-management/ward-flow-reducer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-reducer")>();
  return {
    ...actual,
    wardFlowReducer: (
      state: Parameters<typeof actual.wardFlowReducer>[0],
      event: Parameters<typeof actual.wardFlowReducer>[1],
    ) => {
      sent.push(event);
      return actual.wardFlowReducer(state, event);
    },
  };
});

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  sent.length = 0;
});

describe("broadcast actions retain the actual permitted desk identity", () => {
  it.each(["coordinator", "bed_manager"] as const)(
    "dispatches, extends and stands down as %s through the real Alerts page",
    (role) => {
      act(() => {
        setWardFeatureFlagOnDevice("role-access", true);
        setWardAccess(
          role === "coordinator"
            ? { role, scope: { kind: "statewide" } }
            : { role, scope: { kind: "site", siteCode: allUnits()[0].siteCode } },
        );
      });
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <AlertsScreen />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
      fireEvent.change(screen.getByLabelText(/^Target scope$/i), { target: { value: "forensic" } });
      fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
      fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sent.findLast((event) => event.type === "DISPATCH_BROADCAST_ALERT")).toMatchObject({
        role,
        dispatchedByName:
          role === "coordinator" ? "State Mental Health Bed Desk Coordinator" : WARD_FLOW_ROLE_LABELS[role],
      });
      fireEvent.click(screen.getByRole("button", { name: "Extend" }));
      expect(sent.findLast((event) => event.type === "EXTEND_BROADCAST_ALERT")).toMatchObject({ role });
      fireEvent.click(screen.getByRole("button", { name: "Stand down this alert" }));
      expect(sent.findLast((event) => event.type === "STAND_DOWN_BROADCAST_ALERT")).toMatchObject({
        role,
        stoodDownByRole: role,
      });
    },
  );
});
