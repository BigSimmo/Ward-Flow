import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const sent = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/waiting", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ward-management/ward-flow-reducer", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-reducer")>();
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
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { renderAllDelays, inspectDelayPerson } from "./helpers/delays-interactions";
import { installMatchMediaStub } from "./setup/jsdom.setup";
const state = seedWardFlowState();
const movement = state.movements.find((row) => isOpen(row) && !row.escalation)!;
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  sent.length = 0;
});
describe("Delays escalation follows the existing desk permission", () => {
  it.each(["ward", "bed_manager", "coordinator"] as const)(
    "keeps the action visible and gates %s before dispatch",
    (role) => {
      installMatchMediaStub(false);
      act(() => {
        setWardFeatureFlagOnDevice("role-access", true);
        setWardAccess(
          role === "ward"
            ? { role, scope: { kind: "ward", unitIds: [state.units[0]!.id] } }
            : role === "bed_manager"
              ? { role, scope: { kind: "site", siteCode: state.units[0]!.siteCode } }
              : { role, scope: { kind: "statewide" } },
        );
      });
      renderAllDelays(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <DelaysScreen />
        </WardFlowProvider>,
      );
      inspectDelayPerson(movement.id);
      const button = screen.getByTestId(`delays-escalate-${movement.id}`);
      if (role === "coordinator") expect(button).not.toBeDisabled();
      else {
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription("Coordinator only");
      }
      fireEvent.click(button);
      const escalations = sent.filter((event) => event.type === "RECORD_ESCALATION");
      if (role === "coordinator") {
        expect(escalations.length).toBeGreaterThan(0);
        expect(escalations.every((event) => event.role === "coordinator")).toBe(true);
      } else expect(escalations).toHaveLength(0);
    },
  );
});
