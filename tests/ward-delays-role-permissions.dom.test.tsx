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

  // Drawer review (6 Nov 2026): the person opens in the kit drawer over the list, so the ward desk's
  // list keeps the full width with a person open or not, and nothing opens by itself.
  it("keeps the ward desk's list at the full width, with the person in the drawer (Josh, 31 Oct 2026)", () => {
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
    const split = () => document.getElementById("delays-table")!.parentElement!;
    expect(screen.queryByRole("region", { name: "Why this person is waiting" })).toBeNull();
    expect(split()).toHaveAttribute("data-single");
    openPerson(movement.id);
    expect(screen.getByTestId(`delays-detail-${movement.id}`)).toBeInTheDocument();
    expect(split()).toHaveAttribute("data-single");
    fireEvent.click(screen.getByTestId("wf-drawer-close"));
    expect(screen.queryByTestId(`delays-detail-${movement.id}`)).toBeNull();
  });

  it.each(["bed_manager", "coordinator"] as const)(
    "offers Escalate only to a desk that can use it: %s (D-192 item 5, D-218)",
    (role) => {
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
      if (role === "bed_manager") {
        // A desk that can never escalate sees no button and no who-does-it line.
        expect(screen.queryByTestId(`delays-escalate-${movement.id}`)).toBeNull();
        expect(sent.filter((event) => event.type === "RECORD_ESCALATION")).toHaveLength(0);
        return;
      }
      const button = screen.getByTestId(`delays-escalate-${movement.id}`);
      expect(button).not.toBeDisabled();
      fireEvent.click(button);
      const escalations = sent.filter((event) => event.type === "RECORD_ESCALATION");
      expect(escalations.length).toBeGreaterThan(0);
      expect(escalations.every((event) => event.role === "coordinator")).toBe(true);
    },
  );
});

/**
 * Note 8 issue 7 (Josh, 8 Nov 2026): the drawer's Coordinator and ED board buttons open pop-ups that
 * do the job on Waiting, each with a link to the full page; the ward desk still gets no Coordinator.
 */
describe("Waiting drawer footer pop-ups", () => {
  function renderAs(access: Parameters<typeof setWardAccess>[0]) {
    installMatchMediaStub(false);
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access);
    });
    renderAllDelays(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
  }
  const fromEd = state.movements.find((row) => isOpen(row) && !row.escalation && row.originEdId)!;

  it("lets the coordinator open the Wards tab in place and keeps Home one link away", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    openPerson(fromEd.id);
    fireEvent.click(screen.getByTestId(`delays-foot-coordinator-${fromEd.id}`));
    const menu = screen.getByRole("dialog", { name: "Coordinator actions" });
    expect(within(menu).getByRole("link", { name: /Open on coordinator Home/u })).toHaveAttribute("href", "/ward-flow");
    expect(within(menu).getByRole("button", { name: /Find a bed/u })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("button", { name: /Wards that could take them/u }));
    expect(screen.queryByRole("dialog", { name: "Coordinator actions" })).toBeNull();
    expect(screen.getByRole("tab", { name: /Wards/u })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the person's ED at a glance with a link to its board", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    openPerson(fromEd.id);
    fireEvent.click(screen.getByTestId(`delays-foot-ed-${fromEd.id}`));
    const peek = screen.getByRole("dialog", { name: /at a glance$/u });
    expect(within(peek).getByText("Waiting")).toBeInTheDocument();
    expect(
      within(peek)
        .getByRole("link", { name: /Open ED board/u })
        .getAttribute("href"),
    ).toContain(fromEd.originEdId!);
  });

  it("gives the ward desk no Coordinator pop-up", () => {
    renderAs({ role: "ward", scope: { kind: "ward", unitIds: [state.units[0]!.id] } });
    const id = screen
      .getAllByTestId(/^delays-select-/u)[0]!
      .getAttribute("data-testid")!
      .replace("delays-select-", "");
    openPerson(id);
    expect(screen.queryByTestId(`delays-foot-coordinator-${id}`)).toBeNull();
  });
});
