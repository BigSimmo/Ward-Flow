import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
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
/**
 * Round 8 (31 Oct 2026): "Under 8 hours" is folded. Open the person the way a user would: unfold
 * the band, then Show more (inside `inspectDelayPerson`), then the row.
 */
function openPerson(id: string) {
  if (screen.queryByTestId(`delays-select-${id}`) === null) {
    for (const band of screen.queryAllByTestId(/^delays-band-/u)) {
      if (band.getAttribute("aria-expanded") === "false") fireEvent.click(band);
    }
  }
  return inspectDelayPerson(id);
}
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  sent.length = 0;
});
/**
 * Waiting redesign (31 Oct 2026): the nurse in charge's view is a role branch of the same screen
 * that leaves the coordinator's tools out (escalation, candidate wards, override; FD-23), so the
 * ward desk gets no Escalate control at all and can dispatch nothing. The bed manager keeps the
 * control, visible and gated, and the coordinator can escalate.
 */
describe("Delays escalation follows the existing desk permission", () => {
  it("offers the ward desk no Escalate control, so it can dispatch no escalation", () => {
    installMatchMediaStub(false);
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [state.units[0]!.id] } });
    });
    renderAllDelays(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    const panel = openPerson(movement.id);
    expect(within(panel).queryByTestId(`delays-escalate-${movement.id}`)).toBeNull();
    expect(screen.queryByRole("button", { name: /Escalate/u })).toBeNull();
    expect(sent.filter((event) => event.type === "RECORD_ESCALATION")).toHaveLength(0);
  });

  it("widens the ward desk's list to the full width while the person panel is closed (Josh, 31 Oct 2026)", () => {
    installMatchMediaStub(false);
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [state.units[0]!.id] } });
    });
    renderAllDelays(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    // On a laptop the ward desk opens on its first person, so the panel starts in the second column.
    const split = () => document.getElementById("delays-table")!.parentElement!;
    expect(split(), "the open person panel takes the second column").not.toHaveAttribute("data-single");
    fireEvent.click(screen.getByTestId("delays-close-detail"));
    expect(split()).toHaveAttribute("data-single");
    openPerson(movement.id);
    expect(split()).not.toHaveAttribute("data-single");
  });

  it.each(["bed_manager", "coordinator"] as const)("keeps the action visible and gates %s before dispatch", (role) => {
    installMatchMediaStub(false);
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(
        role === "bed_manager"
          ? { role, scope: { kind: "site", siteCode: state.units[0]!.siteCode } }
          : { role, scope: { kind: "statewide" } },
      );
    });
    renderAllDelays(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    openPerson(movement.id);
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
  });
});
